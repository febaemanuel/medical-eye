import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createAppServer } from '../server/http.mjs';
import { clinicalAssessment, retrieve } from '../server/assessment.mjs';
import { questionsFor } from '../web/app/domain.mjs';
import { guidanceFor } from '../web/app/evidence.mjs';
import { renderLibraryResults, renderView } from '../web/app/views.mjs';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x10, 0xff, 0xd9]);
const vision = { quality: 'adequate', findings: ['yellow', 'redness'], description: 'Material amarelado e área avermelhada.' };
const exam = {
  wound: 'yes', etiology: 'diabetic', diabetes: 'yes', footLocation: 'yes', fever: 'no',
  duration: 'days', plantar: 'yes', neuropathy: 'yes', footPerfusion: 'unknown',
  purulence: 'yes', erythema: 'localized', depth: 'skin', warmth: 'yes', pain: 'no',
  swelling: 'no', systemic: 'no', rapid: 'no', alternative: 'excluded', sirs: 'zero', deepInfection: 'no',
};

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

test('estágio e gravidade exigem os dados clínicos correspondentes', () => {
  assert.match(clinicalAssessment(exam).infection, /^Leve/);
  assert.equal(clinicalAssessment({ ...exam, etiology: 'unknown' }).stage, 'Dados insuficientes');
  assert.equal(clinicalAssessment({ ...exam, depth: 'deep', deepInfection: 'unknown' }).infection, 'Dados insuficientes');
  assert.equal(clinicalAssessment({ ...exam, fever: 'yes' }).infection, 'Dados insuficientes');
  assert.doesNotMatch(clinicalAssessment({ ...exam, diabetes: 'no' }).infection, /IWGDF/);
  assert.match(clinicalAssessment({ ...exam, deepInfection: 'yes' }).infection, /^Moderada/);
  assert.match(clinicalAssessment({ ...exam, sirs: 'multiple' }).infection, /^Grave/);
  const pressure = { wound: 'yes', etiology: 'pressure', pressureExposure: 'yes', depth: 'skin', pressureTissue: 'stage2' };
  assert.equal(clinicalAssessment(pressure).stage, 'Estágio 2');
  assert.equal(clinicalAssessment({ ...pressure, depth: 'obscured' }).stage, 'Dados insuficientes');
  assert.equal(clinicalAssessment({ ...pressure, pressureExposure: 'unknown' }).stage, 'Dados insuficientes');
  assert.equal(clinicalAssessment({ wound: 'no', systemic: 'yes' }).urgency, true);
});

test('tipo e achados indicam as perguntas iniciais e o exame pode corrigir o contexto', () => {
  for (const [type, id] of Object.entries({
    diabetic: 'footLocation', pressure: 'pressureTissue', surgical: 'incisionOpening', venous: 'venousHistory',
  })) {
    const questions = questionsFor(type, vision.findings);
    assert.ok(questions.some(question => question.id === id));
    assert.ok(questions.some(question => question.id === 'diabetes'));
    assert.ok(questions.some(question => question.id === 'fever'));
  }
  const questions = questionsFor('diabetic', vision.findings, exam);
  assert.ok(questions.find(q => q.id === 'purulence').fromImage);
  assert.ok(questions.findIndex(q => q.id === 'purulence') < questions.findIndex(q => q.id === 'depth'));
  assert.deepEqual(questionsFor('pressure', [], { wound: 'no' }).map(q => q.id),
    ['wound', 'diabetes', 'fever', 'systemic', 'rapid']);
  assert.ok(questionsFor('no_wound', []).some(q => q.id === 'wound'));
  const corrected = questionsFor('diabetic', vision.findings, { ...exam, etiology: 'surgical' });
  assert.ok(corrected.some(q => q.id === 'surgerySite'));
  assert.ok(corrected.every(q => q.id !== 'footLocation'));
});

test('referências consultadas usam a pergunta e o contexto clínico', () => {
  assert.equal(guidanceFor('erythema', 'diabetic', {}).reference.id, 'iwgdf-exame');
  assert.match(guidanceFor('erythema', 'diabetic', {}).text, /margem da ferida/);
  assert.equal(guidanceFor('erythema', 'diabetic', { etiology: 'venous' }).reference.id, 'nice-ulcera');
  const references = retrieve({ type: 'diabetic', findings: vision.findings, exam: { ...exam, etiology: 'venous' } });
  assert.ok(references.some(ref => ref.type === 'venous'));
  assert.ok(references.every(ref => ['venous', 'general'].includes(ref.type)));

  for (const type of [null, 'diabetic', 'pressure', 'surgical', 'venous', 'no_wound']) {
    for (const { id } of questionsFor(type, [])) assert.ok(guidanceFor(id, type, {}), String(type) + ' / ' + id);
  }
  const view = renderView({ page: 'assessment', step: 2, maxStep: 2, type: 'diabetic', vision, exam: {} });
  assert.match(view, /Consultar orientação/);
  assert.match(view, /A tabela 1 considera a extensão do eritema/);
});

test('uma chamada analisa o JPEG e as referências e o resumo são produzidos localmente', async t => {
  const requests = [];
  let result = { type: 'venous', ...vision };
  let willieStatus = 200;
  let geminiStatus = 200;
  const mask = 'iVBORw0KGgoAAAA=';
  const localCalls = [];
  const willie = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    localCalls.push({ path: request.url, body: Buffer.concat(chunks) });
    response.writeHead(willieStatus, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ class: 'diabetic', mask }));
  });
  const willieUrl = await listen(willie);
  t.after(() => willie.close());
  const provider = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requests.push({ url: request.url, body: JSON.parse(Buffer.concat(chunks)) });
    response.writeHead(geminiStatus, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(result) }] } }] }));
  });
  const url = await listen(provider);
  t.after(() => provider.close());

  const app = createAppServer({ GEMINI_BASE_URL: url, GEMINI_API_KEY: 'test-key', VISION_MODEL: 'vision-test', WILLIE_URL: willieUrl });
  const appUrl = await listen(app);
  t.after(() => app.close());
  assert.equal((await (await fetch(appUrl + '/api/config')).json()).geminiConfigured, true);

  const analyze = (headers = {}) => fetch(appUrl + '/api/analyze', {
    method: 'POST', headers: { 'content-type': 'image/jpeg', ...headers }, body: jpeg,
  });
  assert.equal((await analyze()).status, 400);
  assert.equal(requests.length, 0);
  assert.equal(localCalls.length, 0);

  const localOnly = await (await analyze({ 'x-image-authorized': 'yes' })).json();
  assert.equal(localOnly.type, 'diabetic');
  assert.equal(localOnly.vision, null);
  assert.equal(requests.length, 0);
  assert.deepEqual(localCalls[0], { path: '/classify', body: jpeg });

  const authorization = { 'x-image-authorized': 'yes', 'x-gemini-authorized': 'yes' };
  const analyzed = await analyze(authorization);
  assert.equal(analyzed.status, 200);
  assert.equal(analyzed.headers.get('cache-control'), 'no-store');
  const analysis = await analyzed.json();
  assert.deepEqual(analysis, { type: 'diabetic', mask, vision, willieError: null, visionError: null });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/models/vision-test:generateContent');
  assert.equal(requests[0].body.contents[0].parts[1].inlineData.data, jpeg.toString('base64'));
  assert.ok(!requests[0].body.generationConfig.responseJsonSchema.properties.type);

  const report = await fetch(appUrl + '/api/report', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorized: true, ...analysis, visualReview: { yellow: 'absent' }, exam: { ...exam, erythema: 'unknown' } }),
  });
  assert.equal(report.status, 200);
  const summary = await report.json();
  assert.deepEqual(summary.pending.find(item => item.refs.includes('iwgdf-exame')), {
    question: 'Até onde vai a vermelhidão a partir da borda?', answer: 'Não aferido', refs: ['iwgdf-exame'],
  });
  assert.ok(summary.examination.some(item => item.question.includes('diagnóstico de diabetes') && item.answer === 'Sim'));
  assert.equal(summary.infection.text, 'Dados insuficientes');
  assert.ok(summary.references.some(ref => ref.id === 'iwgdf-exame'));
  assert.ok(summary.references.some(ref => ref.id === 'lazzarini-descarga'));
  assert.match(summary.treatment.find(item => item.refs.includes('iwgdf-perfusao')).text, /avaliação vascular/);
  assert.ok(summary.visualReview.some(item => item.status === 'Ausente no exame'));
  assert.equal(requests.length, 1);

  result = { ...result, quality: 'poor' };
  const unreadable = await (await analyze(authorization)).json();
  assert.equal(unreadable.type, 'diabetic');
  assert.deepEqual(unreadable.vision.findings, []);

  willieStatus = 503;
  const manual = await (await analyze(authorization)).json();
  assert.equal(manual.type, null);
  assert.match(manual.willieError, /WILLIE/);

  willieStatus = 200;
  geminiStatus = 429;
  const localFallback = await (await analyze(authorization)).json();
  assert.equal(localFallback.type, 'diabetic');
  assert.equal(localFallback.vision, null);
  assert.match(localFallback.visionError, /cota/);
});

test('PWA serve o manifesto e todo o shell atualizado com a busca local', async t => {
  const server = createAppServer({});
  const base = await listen(server);
  t.after(() => server.close());

  const index = await fetch(base + '/');
  const html = await index.text();
  assert.match(html, /rel="manifest"/);
  const entry = html.match(/src="([^"]+\/app\/main.mjs)"/)?.[1];
  assert.ok(entry);
  assert.match(index.headers.get('permissions-policy'), /camera=\(self\)/);
  const manifest = await (await fetch(base + '/manifest.webmanifest')).json();
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
  const sw = await (await fetch(base + '/sw.js')).text();
  const shell = [...sw.matchAll(/'([^']*)'/g)].map(match => match[1]).filter(value => value.startsWith('/'));
  await Promise.all([...new Set(shell)].map(async path => {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    await response.arrayBuffer();
  }));
  assert.ok(shell.includes(entry));
  assert.ok(shell.includes(new URL('./evidence.mjs', base + entry).pathname));
  assert.ok(manifest.icons.every(icon => shell.includes(icon.src)));
  assert.ok(shell.every(path => !path.startsWith('/api/')));
  assert.equal((await (await fetch(base + '/api/config')).json()).geminiConfigured, false);
});

test('biblioteca encontra estudos e disponibiliza PDFs locais sem expor arquivos fora do catálogo', async t => {
  assert.match(renderLibraryResults('compressao'), /VenUS 6/);
  assert.doesNotMatch(renderLibraryResults('compressao'), /Descarga de pressão/);
  const dir = await mkdtemp(join(tmpdir(), 'medical-eye-library-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'trial-venus.pdf'), '%PDF-1.7');
  await writeFile(join(dir, 'privado.pdf'), 'privado');
  const app = createAppServer({ REFERENCES_DIR: dir });
  const base = await listen(app);
  t.after(() => app.close());
  const response = await fetch(base + '/referencias/trial-venus.pdf');
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(await response.text(), '%PDF-1.7');
  assert.equal((await fetch(base + '/referencias/privado.pdf')).status, 404);
  assert.equal((await fetch(base + '/referencias/iwgdf-offloading.pdf')).status, 404);
});
