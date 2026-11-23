import { QUESTIONS, TYPES, questionsFor } from '../web/app/domain.mjs';
import { clinicalAssessment, draftReport, retrieve } from './assessment.mjs';
import { ApiError, DEFAULT_MODEL, checkedVision, classify, describe, generateReport } from './providers.mjs';

const maxImageBytes = 4 * 1024 * 1024;
const questionById = new Map(QUESTIONS.map(item => [item.id, item]));

function checkedCase(payload) {
  if (payload?.authorized !== true || !Object.hasOwn(TYPES, payload?.type) ||
      !payload?.exam || typeof payload.exam !== 'object' || Array.isArray(payload.exam)) {
    throw new ApiError(400, 'Confirme a autorização e preencha os campos do exame.');
  }
  const vision = checkedVision(payload.vision, 400);
  const exam = {};
  for (const [key, value] of Object.entries(payload.exam)) {
    if (!questionById.get(key)?.options.some(([id]) => id === value)) {
      throw new ApiError(400, 'Há uma resposta de exame inválida.');
    }
    exam[key] = value;
  }
  const activeQuestions = questionsFor(payload.type, vision.findings, exam);
  if (activeQuestions.some(({ id }) => !Object.hasOwn(exam, id))) {
    throw new ApiError(400, 'Responda às perguntas ou marque quando um achado não foi avaliado.');
  }
  return {
    type: payload.type, findings: vision.findings, imageQuality: vision.quality,
    exam: Object.fromEntries(activeQuestions.map(({ id }) => [id, exam[id]])),
  };
}

export function configured(config) {
  return Boolean(config.GEMINI_API_KEY?.trim() && config.WILLIE_URL?.trim());
}

export async function handleApi(request, config, dependencies = { classify, describe, generateReport }) {
  const path = new URL(request.url).pathname;
  try {
    if (path === '/api/config' && request.method === 'GET') {
      return Response.json({
        configured: configured(config),
        visionModel: config.VISION_MODEL || DEFAULT_MODEL,
        reportModel: config.REPORT_MODEL || DEFAULT_MODEL,
      });
    }
    if (!['/api/analyze', '/api/report'].includes(path)) throw new ApiError(404, 'Rota não encontrada.');
    if (request.method !== 'POST') throw new ApiError(405, 'Método não permitido.');
    if (!configured(config)) throw new ApiError(503, 'Configure o WILLIE e a chave do serviço Gemini no servidor.');

    if (path === '/api/analyze') {
      if (request.headers.get('x-image-authorized') !== 'yes') {
        throw new ApiError(400, 'Confirme a autorização para processar a imagem.');
      }
      if (request.headers.get('content-type') !== 'image/jpeg') throw new ApiError(415, 'A imagem deve estar em JPEG.');
      const image = Buffer.from(await request.arrayBuffer());
      if (image.length > maxImageBytes) throw new ApiError(413, 'A imagem excede o limite de 4 MB.');
      if (image.length < 6 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff ||
          image.at(-2) !== 0xff || image.at(-1) !== 0xd9) throw new ApiError(400, 'O arquivo não é um JPEG válido.');
      const [type, vision] = await Promise.all([
        dependencies.classify(image, config), dependencies.describe(image, config),
      ]);
      return Response.json({ type, vision });
    }

    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
      throw new ApiError(415, 'Envie os dados do exame em JSON.');
    }
    let payload;
    try { payload = await request.json(); } catch { throw new ApiError(400, 'Dados do exame inválidos.'); }
    const caseData = checkedCase(payload);
    const references = retrieve(caseData);
    const assessment = clinicalAssessment(caseData.exam);
    const base = draftReport(caseData, references, assessment);
    const draft = await dependencies.generateReport({ caseData, references, assessment }, config);
    return Response.json({
      ...base, ...draft,
      hypothesis: ['diabetic', 'pressure', 'surgical', 'venous'].includes(caseData.exam.etiology) &&
        caseData.exam.wound === 'yes' ? draft.hypothesis : base.hypothesis,
      suggestions: [
        ...(assessment.urgency ? base.suggestions.slice(0, 1) : []),
        ...draft.suggestions,
        ...(!assessment.urgency && !draft.suggestions.length ? base.suggestions : []),
      ],
    });
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Falha inesperada ao processar a solicitação.' }, { status: 500 });
  }
}
