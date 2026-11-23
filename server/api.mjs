import { QUESTIONS, TYPES, questionsFor } from '../web/app/domain.mjs';
import { draftReport } from './assessment.mjs';
import { ApiError, DEFAULT_MODEL, analyzeImage, analyzeWithWillie, checkedVision } from './providers.mjs';

const maxImageBytes = 4 * 1024 * 1024;
const questionById = new Map(QUESTIONS.map(item => [item.id, item]));

function checkedCase(payload) {
  if (payload?.authorized !== true || (payload.type !== null && (typeof payload.type !== 'string' || !Object.hasOwn(TYPES, payload.type))) ||
      !payload.exam || typeof payload.exam !== 'object' || Array.isArray(payload.exam)) {
    throw new ApiError(400, 'Confirme a autorização e preencha os campos do exame.');
  }
  const vision = payload.vision == null ? null : checkedVision(payload.vision, 400);
  const type = payload.type;
  const findings = vision?.findings ?? [];
  const { etiology } = payload.exam;
  if (etiology !== undefined && !['diabetic', 'pressure', 'surgical', 'venous', 'unknown'].includes(etiology)) {
    throw new ApiError(400, 'Roteiro de exame inválido.');
  }
  const exam = etiology === undefined ? {} : { etiology };
  for (const [key, value] of Object.entries(payload.exam)) {
    if (key === 'etiology') continue;
    if (!questionById.get(key)?.options.some(([id]) => id === value)) {
      throw new ApiError(400, 'Há uma resposta de exame inválida.');
    }
    exam[key] = value;
  }
  const activeQuestions = questionsFor(type, findings, exam);
  if (activeQuestions.some(({ id }) => !Object.hasOwn(exam, id))) {
    throw new ApiError(400, 'Responda às perguntas ou marque quando um achado não foi avaliado.');
  }
  return {
    type, vision, findings,
    exam: {
      ...Object.fromEntries(activeQuestions.map(({ id }) => [id, exam[id]])),
      ...(etiology === undefined ? {} : { etiology }),
    },
  };
}

function configured(config) {
  return Boolean(config.GEMINI_API_KEY?.trim());
}

export async function handleApi(request, config) {
  const path = new URL(request.url).pathname;
  try {
    if (path === '/api/config' && request.method === 'GET') {
      return Response.json({ geminiConfigured: configured(config), visionModel: config.VISION_MODEL || DEFAULT_MODEL });
    }
    if (!['/api/analyze', '/api/report'].includes(path)) throw new ApiError(404, 'Rota não encontrada.');
    if (request.method !== 'POST') throw new ApiError(405, 'Método não permitido.');

    if (path === '/api/analyze') {
      if (request.headers.get('x-image-authorized') !== 'yes') {
        throw new ApiError(400, 'Confirme a autorização para processar a imagem.');
      }
      if (request.headers.get('content-type') !== 'image/jpeg') throw new ApiError(415, 'A imagem deve estar em JPEG.');
      const image = Buffer.from(await request.arrayBuffer());
      if (image.length > maxImageBytes) throw new ApiError(413, 'A imagem excede o limite de 4 MB.');
      if (image.length < 6 || image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff ||
          image.at(-2) !== 0xff || image.at(-1) !== 0xd9) throw new ApiError(400, 'O arquivo não é um JPEG válido.');
      const target = request.headers.get('x-analysis-target') || 'both';
      if (!['both', 'willie', 'gemini'].includes(target)) throw new ApiError(400, 'Serviço de análise inválido.');
      const cloudAllowed = request.headers.get('x-gemini-authorized') === 'yes' && configured(config);
      const [willie, gemini] = await Promise.allSettled([
        target !== 'gemini' ? analyzeWithWillie(image, config) : null,
        cloudAllowed && target !== 'willie' ? analyzeImage(image, config) : null,
      ]);
      return Response.json({
        type: willie.value?.type ?? null,
        mask: willie.value?.mask ?? null,
        vision: gemini.value ?? null,
        willieError: willie.status === 'rejected' ? willie.reason.message : null,
        visionError: gemini.status === 'rejected' ? gemini.reason.message : null,
      });
    }

    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
      throw new ApiError(415, 'Envie os dados do exame em JSON.');
    }
    let payload;
    try {
      payload = await request.json();
    } catch {
      throw new ApiError(400, 'Dados do exame inválidos.');
    }
    return Response.json(draftReport(checkedCase(payload)));
  } catch (error) {
    if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Falha inesperada ao processar a solicitação.' }, { status: 500 });
  }
}
