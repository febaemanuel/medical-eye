import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { createAppServer } from '../server/http.mjs';
import { clinicalAssessment, retrieve } from '../server/assessment.mjs';
import { questionsFor } from '../web/app/domain.mjs';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x10, 0xff, 0xd9]);
const vision = { quality: 'adequate', findings: ['yellow', 'redness'], description: 'Material amarelado e área avermelhada.' };
const exam = {
  wound: 'yes', etiology: 'diabetic', purulence: 'yes', erythema: 'localized', depth: 'skin',
  warmth: 'yes', pain: 'no', swelling: 'no', systemic: 'no', rapid: 'no',
  alternative: 'excluded', sirs: 'zero', deepInfection: 'no',
};

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return 'http://127.0.0.1:' + server.address().port;
}

test('usar apenas o contexto clínico confirmado para estágio e gravidade', () => {
  assert.match(clinicalAssessment(exam).infection, /^Leve/);
  assert.equal(clinicalAssessment({ ...exam, etiology: 'unknown' }).stage, 'Dados insuficientes');
  assert.equal(clinicalAssessment({ ...exam, depth: 'deep', deepInfection: 'unknown' }).infection, 'Dados insuficientes');
  assert.match(clinicalAssessment({ ...exam, deepInfection: 'yes' }).infection, /^Moderada/);
  assert.match(clinicalAssessment({ ...exam, sirs: 'multiple' }).infection, /^Grave/);
  const pressure = { wound: 'yes', etiology: 'pressure', depth: 'skin', pressureTissue: 'stage2' };
  assert.equal(clinicalAssessment(pressure).stage, 'Estágio 2');
  assert.equal(clinicalAssessment({ ...pressure, depth: 'obscured' }).stage, 'Dados insuficientes');
  assert.equal(clinicalAssessment({ wound: 'no', systemic: 'yes' }).urgency, true);
});

test('achados priorizam perguntas e a etiologia clínica limita a recuperação', () => {
  const questions = questionsFor('diabetic', vision.findings, exam);
  assert.ok(questions.find(q => q.id === 'purulence').fromImage);
  assert.ok(questions.findIndex(q => q.id === 'purulence') < questions.findIndex(q => q.id === 'depth'));
  assert.deepEqual(questionsFor('pressure', [], { wound: 'no' }).map(q => q.id), ['wound', 'systemic', 'rapid']);
  const sources = retrieve({ type: 'diabetic', findings: vision.findings, exam: { ...exam, etiology: 'venous' } });
  assert.ok(sources.length > 0);
  assert.ok(sources.every(source => source.type === 'venous'));
});

test('API envia o mesmo JPEG aos dois modelos e fundamenta o parecer com os trechos locais', async t => {
  const requests = [];
  let returnedSource = 'iwgdf-exame';

  const provider = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    requests.push({ url: request.url, body, headers: request.headers });
    response.setHeader('content-type', 'application/json');
    if (request.url === '/classify') {
      response.end(JSON.stringify({ class: 'diabetic' }));
      return;
    }
    const item = { text: 'Revisar o exame.', refs: [returnedSource] };
    const result = request.url.includes('/models/vision-test:')
      ? vision : { hypothesis: item, rationale: item, suggestions: [item] };
    const text = JSON.stringify(result);
    response.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
  });
  const url = await listen(provider);
  t.after(() => provider.close());

  const app = createAppServer({
    WILLIE_URL: url + '/classify', GEMINI_BASE_URL: url, GEMINI_API_KEY: 'test-key',
    VISION_MODEL: 'vision-test', REPORT_MODEL: 'report-test',
  });
  const appUrl = await listen(app);
  t.after(() => app.close());

  const analyzeHeaders = { 'content-type': 'image/jpeg', 'x-image-authorized': 'yes' };
  const rejected = await fetch(appUrl + '/api/analyze', {
    method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: jpeg,
  });
  assert.equal(rejected.status, 400);
  assert.equal(requests.length, 0);

  const analyzed = await fetch(appUrl + '/api/analyze', { method: 'POST', headers: analyzeHeaders, body: jpeg });
  assert.equal(analyzed.status, 200);
  assert.equal(analyzed.headers.get('cache-control'), 'no-store');
  const result = await analyzed.json();
  assert.deepEqual(result, { type: 'diabetic', vision });
  assert.deepEqual(requests.find(item => item.url === '/classify').body, jpeg);
  const visualRequest = JSON.parse(requests.find(item => item.url.includes('/models/vision-test:')).body);
  assert.equal(visualRequest.contents[0].parts[1].inlineData.data, jpeg.toString('base64'));

  const submitReport = () => fetch(appUrl + '/api/report', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authorized: true, ...result, exam }),
  });
  const report = await submitReport();
  assert.equal(report.status, 200);
  const reportData = await report.json();
  assert.match(reportData.infection.text, /^Leve/);
  assert.equal(reportData.suggestions[0].refs[0], returnedSource);
  const reportRequest = JSON.parse(requests.find(item => item.url.includes('/models/report-test:')).body);
  const context = JSON.parse(reportRequest.contents[0].parts[0].text);
  assert.deepEqual(context.caseData.findings, vision.findings);
  assert.equal(context.caseData.exam.etiology, 'diabetic');
  assert.ok(context.references.some(ref => ref.id === returnedSource));
  assert.equal(context.caseData.vision, undefined);
  assert.equal(reportRequest.contents[0].parts.some(part => part.inlineData), false);

  returnedSource = 'guia-inventado';
  assert.equal((await submitReport()).status, 502);
});

test('PWA serve o manifesto e todos os recursos do shell instalado', async t => {
  const server = createAppServer({});
  const base = await listen(server);
  t.after(() => server.close());

  const index = await fetch(base + '/');
  assert.match(await index.text(), /rel="manifest"/);
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
  assert.ok(manifest.icons.every(icon => shell.includes(icon.src)));
  assert.ok(shell.every(path => !path.startsWith('/api/')));
  assert.equal((await (await fetch(base + '/api/config')).json()).configured, false);
});
