import { TYPES, VISUAL, questionsFor, urgent } from './domain.mjs';
import { guidanceFor } from './evidence.mjs';
import { PROTOCOLS } from '../data/protocolos.mjs';
import { pdfLink } from '../data/documents.mjs';
import { icon, svg } from './icons.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, mark => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[mark]);

const steps = ['Foto', 'Achados', 'Exame', 'Resumo'];
const quality = { adequate: 'Adequada para leitura', limited: 'Leitura limitada', poor: 'Imagem insuficiente' };

function notice(text, tone = '') {
  const glyph = tone ? 'alert' : 'info';
  return `<div class="notice ${tone}" ${tone === 'danger' ? 'role="alert"' : ''}>${icon(glyph)}<span>${esc(text)}</span></div>`;
}

function heading(title, description) {
  return `<header class="sheet-heading"><h2 id="step-title" tabindex="-1">${title}</h2>
    ${description ? `<p>${description}</p>` : ''}</header>`;
}

function suggestedType(type) {
  return TYPES[type] || 'Tipo indeterminado';
}

function stepper(state) {
  return `<aside class="steps-panel" aria-label="Etapas da avaliação">
    <h2>Ficha de avaliação</h2>
    <ol class="stepper">
      ${steps.map((label, index) => {
        const current = state.step === index;
        const content = `<span class="step-number">${index < state.step ? svg('check') : index + 1}</span><span>${label}</span>`;
        const item = !current && index <= state.maxStep
          ? `<button type="button" data-step="${index}" ${state.pending ? 'disabled' : ''}>${content}</button>`
          : `<span class="step-label">${content}</span>`;
        return `<li ${current ? 'aria-current="step"' : ''}>${item}</li>`;
      }).join('')}
    </ol>
    ${state.analyzed ? `<div class="case-label"><small>Sugestão do WILLIE</small><strong>${esc(suggestedType(state.type))}</strong></div>` : ''}
  </aside>`;
}

function imageScreen(state) {
  const busy = state.pending === 'image';
  const disabled = busy ? 'disabled' : '';
  const ready = state.photo && state.authorized && !busy;
  let serviceNotice = '';
  if (state.configError) {
    serviceNotice = notice('Servidor indisponível. Verifique a conexão e tente novamente.', 'warning');
  }

  return `${heading('Foto da ferida', 'Tire uma foto ou selecione uma imagem da galeria.')}
    <div class="capture-layout">
      <div class="drop" id="drop">
        <input type="file" class="sr-only" id="camera-file" accept="image/*" capture="environment"
          tabindex="-1" aria-label="Tirar foto da ferida">
        <input type="file" class="sr-only" id="gallery-file" accept="image/*"
          tabindex="-1" aria-label="Selecionar imagem da ferida">
        ${state.photoUrl ? `<div class="photo-review">
          <img src="${esc(state.photoUrl)}" alt="Foto selecionada para a avaliação">
          <div class="actions">
            <button class="btn" type="button" data-action="camera" ${disabled}>${icon('camera')} Tirar outra foto</button>
            <button class="btn text" type="button" data-action="gallery" ${disabled}>Trocar arquivo</button>
          </div></div>` : `<div class="capture-empty">
            <span class="camera-frame" aria-hidden="true">${svg('camera')}</span>
            <div class="actions">
              <button class="btn primary" type="button" data-action="camera" ${disabled}>${icon('camera')} Tirar foto</button>
              <button class="btn" type="button" data-action="gallery" ${disabled}>Selecionar arquivo</button>
            </div>
            <p>Arraste uma imagem de até 12 MB para esta área.</p>
          </div>`}
      </div>
      <aside class="photo-tips">
        <h3>Antes de fotografar</h3>
        <ul>
          <li>Use luz uniforme e mantenha a ferida em foco.</li>
          <li>Inclua a borda da lesão e a pele ao redor.</li>
          <li>Evite rosto, etiquetas e outros identificadores.</li>
        </ul>
      </aside>
    </div>
    ${serviceNotice}
    <label class="consent"><input type="checkbox" id="consent" ${state.authorized ? 'checked' : ''} ${disabled}>
      <span>Confirmo que a foto pode ser processada pelo Medical Eye.</span></label>
    ${state.config?.geminiConfigured ? `<label class="consent cloud-consent">
      <input type="checkbox" id="cloud-consent" ${state.cloudAuthorized ? 'checked' : ''} ${disabled || (state.analyzed ? 'disabled' : '')}>
      <span>O serviço autoriza enviar esta foto ao Gemini para sugerir achados visuais.</span></label>`
      : '<p class="cloud-consent quiet">WILLIE local disponível quando o serviço estiver pronto. Para sugestões do Gemini, configure a chave no servidor.</p>'}
    ${state.error ? notice(state.error, 'danger') : ''}
    <footer class="sheet-actions">
      <p class="quiet">${icon('lock')} A ficha fica disponível durante a sessão.</p>
      <button class="btn primary" type="button" data-action="analyze" ${ready ? '' : 'disabled'}>
        ${busy ? 'Analisando foto…' : state.analyzed ? 'Ver achados' : 'Analisar foto'}</button>
    </footer>`;
}

function findingsScreen(state) {
  const { vision } = state;
  return `${heading('Achados da foto')}
    <div class="finding-layout">
      <div>
        <div class="photo-layer">
          <img class="finding-photo" src="${esc(state.photoUrl)}" alt="Foto selecionada da ferida">
          ${state.maskUrl ? `<img class="wound-mask" id="wound-mask" src="${esc(state.maskUrl)}" alt="Contorno estimado pelo WILLIE">` : ''}
        </div>
        ${state.maskUrl ? '<label class="consent mask-toggle"><input id="mask-toggle" type="checkbox" checked> Exibir contorno estimado</label>' : ''}
      </div>
      <div class="finding-notes">
        <div class="finding-facts">
          <div><span>Tipo sugerido pelo WILLIE</span><strong>${esc(suggestedType(state.type))}</strong></div>
          ${vision ? `<div><span>Qualidade da imagem</span><strong>${esc(quality[vision.quality])}</strong></div>` : ''}
        </div>
        ${vision ? `<h3 class="image-cue">Achados sugeridos pelo Gemini</h3>
          ${vision.findings.length ? `<ul>${vision.findings.map(id => `<li>${esc(VISUAL[id])}</li>`).join('')}</ul>`
            : `<p>${esc(vision.description)}</p>`}` : ''}
        ${state.type && !state.maskUrl && !state.willieError ? '<p class="quiet">Sem contorno identificado nesta foto.</p>' : ''}
      </div>
    </div>
    ${state.willieError ? notice(state.willieError, 'warning') : ''}
    ${state.type === null && !state.willieError ? notice('As previsões do WILLIE divergiram. O exame começa pelo roteiro geral.') : ''}
    ${state.visionError ? notice(state.visionError + ' Você pode seguir com o exame.', 'warning') : ''}
    ${state.error ? notice(state.error, 'danger') : ''}
    ${vision?.quality === 'poor' ? notice('Considere tirar outra foto. A leitura do WILLIE também deve ser revisada.', 'warning') : ''}
    ${state.type === 'no_wound' ? notice('O WILLIE marcou imagem sem ferida visível. Confira a pele no exame.') : ''}
    <footer class="sheet-actions"><button class="btn" data-step="0" ${state.pending ? 'disabled' : ''}>Voltar à foto</button>
      <div class="actions">
        ${state.willieError || state.visionError ? `<button class="btn" data-action="retry-analysis" ${state.pending || !state.authorized ? 'disabled' : ''}>
          ${state.pending ? 'Analisando…' : 'Tentar análise novamente'}</button>` : ''}
        <button class="btn primary" data-action="exam" ${state.pending ? 'disabled' : ''}>Abrir exame</button>
      </div></footer>`;
}

export function urgencyNotice(exam, type) {
  if (urgent(exam, type)) return notice('Sinal de alerta no exame. Priorize avaliação presencial urgente conforme o protocolo local.', 'danger');
  if (exam.alerts === 'fever') return notice('Febre registrada. Confira os demais sinais sistêmicos e o protocolo local.', 'warning');
  return '';
}

function questionField(question, state) {
  const { id, label, options, hint } = question;
  const guidance = guidanceFor(id, state.type, state.exam);
  const selected = state.exam[id];
  return `<fieldset class="question"><legend>${esc(label)}</legend>
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    <div class="options">${options.map(([value, title]) => `
      <label><input type="radio" name="${id}" value="${value}" ${selected === value ? 'checked' : ''} ${state.pending ? 'disabled' : ''}>
      <span>${esc(title)}</span></label>`).join('')}</div>
    ${guidance ? `<details class="question-help">
      <summary>${icon('book')} Consultar orientação</summary>
      <div class="help-text">
        <p>${esc(guidance.text)}</p>
        <small>${esc(guidance.reference.organization)} · ${esc(guidance.reference.section)}</small>
        ${sourceLinks(guidance.reference)}
      </div>
    </details>` : ''}
  </fieldset>`;
}

function examScreen(state) {
  const questions = questionsFor(state.type, state.vision?.findings ?? [], state.exam);
  const groups = [
    ['consultation', 'Consulta e histórico'],
    ['examination', 'Exame da lesão'],
  ];

  return `${heading('Consulta e exame')}
    <p class="completion" id="completion" aria-live="polite"></p>
    <div id="urgent">${urgencyNotice(state.exam, state.type)}</div>
    <form id="exam-form">
      ${state.exam.wound !== 'no' ? `<label class="exam-route">Roteiro de exame
        <select id="exam-route" ${state.pending ? 'disabled' : ''}>
          <option value="">${state.type && state.type !== 'no_wound' ? 'WILLIE · ' + esc(TYPES[state.type]) : 'Roteiro geral'}</option>
          ${Object.entries(TYPES).filter(([id]) => id !== 'no_wound' && id !== state.type).map(([id, title]) =>
            `<option value="${id}" ${state.exam.etiology === id ? 'selected' : ''}>${esc(title)}</option>`).join('')}
          ${state.type && state.type !== 'no_wound' ? `<option value="unknown" ${state.exam.etiology === 'unknown' ? 'selected' : ''}>Tipo indeterminado</option>` : ''}
        </select>
      </label>` : ''}
      ${groups.map(([group, title]) => {
        const items = questions.filter(question => question.group === group);
        return items.length ? `<section class="question-group" aria-labelledby="group-${group}">
          <h3 id="group-${group}">${title}</h3>
          ${items.map(question => questionField(question, state)).join('')}
        </section>` : '';
      }).join('')}
      ${state.error ? notice(state.error, 'danger') : ''}
      <footer class="sheet-actions"><button type="button" class="btn" data-step="1" ${state.pending ? 'disabled' : ''}>Voltar aos achados</button>
        <button type="submit" class="btn primary" id="generate" disabled>${state.pending ? 'Preparando resumo…' : 'Ver resumo'}</button></footer>
    </form>`;
}

function citationLinks(refs, references) {
  return refs.map(id => references.find(ref => ref.id === id)).filter(Boolean)
    .map(ref => `<a href="#source-${esc(ref.id)}">${esc(ref.organization)} · ${esc(ref.section)}</a>`)
    .join(' <span aria-hidden="true">·</span> ');
}

function sectionReport(label, section, references) {
  return `<section class="report-section"><h3>${label}</h3><p>${esc(section.text)}</p>
    ${citationLinks(section.refs, references)}</section>`;
}

function sourceLinks(ref) {
  const pdf = pdfLink(ref);
  return `<div class="source-links">
    ${pdf ? `<a href="${esc(pdf)}" target="_blank" rel="noopener noreferrer">Abrir PDF local${ref.document === 'nice-leg' ? ' (resumo)' : ''}</a>` : ''}
    <a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">Abrir fonte original</a>
  </div>`;
}

function sourceCard(ref, nested = false) {
  return `<article class="source" ${nested ? '' : `id="source-${esc(ref.id)}"`}>
      <small>${esc(ref.kind || 'Diretriz ou protocolo')} · ${esc(ref.organization)} · ${esc(ref.year)}</small>
      <h3>${esc(ref.title)}</h3>
      <small>${esc(ref.section)}</small><p>${esc(ref.text)}</p>
      ${sourceLinks(ref)}
    </article>`;
}

export function renderLibraryResults(query = '') {
  const normalize = text => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const tokens = normalize(query.trim()).split(/\s+/).filter(Boolean);
  const matches = PROTOCOLS.filter(ref => {
    const fields = normalize([ref.kind, ref.title, ref.organization, ref.type, TYPES[ref.type], ref.section, ref.text, ...ref.tags].join(' '));
    return tokens.every(term => fields.includes(term));
  });
  return matches.length ? matches.map(ref => sourceCard(ref)).join('') : '<p>Nenhuma referência encontrada para essa busca.</p>';
}

function reportScreen(state) {
  const { hypothesis, stage, infection, rationale, suggestions, treatment, references, examination, pending } = state.report;
  return `${heading('Resumo da avaliação', 'Confira o registro e as pendências antes de concluir.')}
    ${urgencyNotice(state.exam, state.type)}
    <section class="report-block">
      <h3>Achados da foto</h3>
      <p><strong>WILLIE</strong> · ${esc(suggestedType(state.type))}</p>
      ${state.vision ? `<p><strong>Gemini</strong> · ${esc(state.vision.findings.length
        ? state.vision.findings.map(id => VISUAL[id]).join('; ')
        : state.vision.description)}</p>` : ''}
    </section>
    <div class="report-grid">
      ${sectionReport('Hipótese clínica', hypothesis, references)}
      ${sectionReport('Estágio da ferida', stage, references)}
      ${sectionReport('Gravidade da infecção', infection, references)}
      ${sectionReport('Base da avaliação', rationale, references)}
    </div>
    ${pending.length ? `<section class="report-block pending-block"><h3>Pendências do exame</h3>
      <ul>${pending.map(item => `<li><strong>${esc(item.question)}</strong><p>${esc(item.answer)}</p>
        ${citationLinks(item.refs, references)}</li>`).join('')}</ul></section>` : ''}
    ${examination.length ? `<details class="recorded"><summary>Respostas registradas no exame</summary><dl>
      ${examination.map(item => `<div><dt>${esc(item.question)}</dt><dd>${esc(item.answer)}</dd></div>`).join('')}
      </dl></details>` : ''}
    <section class="report-block"><h3>Conduta a discutir com a equipe</h3><ul>${suggestions.map(item =>
      `<li><p>${esc(item.text)}</p>${citationLinks(item.refs, references)}</li>`).join('')}</ul></section>
    <section class="report-block treatment"><h3>Tratamento e evidências</h3>
      ${treatment.length ? treatment.map(item => `<section class="treatment-topic">
        <h4>${esc(item.title)}</h4><p>${esc(item.text)}</p>
        <details><summary>Consultar diretriz e evidência</summary>
          ${item.refs.map(id => references.find(ref => ref.id === id)).filter(Boolean).map(ref => sourceCard(ref, true)).join('')}
        </details>
      </section>`).join('') : '<p>A hipótese clínica ficou indeterminada ou a lesão não foi confirmada. Você pode consultar a biblioteca para revisar os critérios.</p>'}
    </section>
    <section class="sources"><h3>Referências da avaliação</h3>
      ${references.length ? references.map(ref => sourceCard(ref)).join('') : '<p>Nenhum trecho aplicável encontrado para este caso.</p>'}</section>
    <footer class="sheet-actions"><button class="btn" data-step="2">Revisar exame</button>
      <button class="btn primary" data-action="reset">Nova avaliação</button></footer>`;
}

export function renderView(state) {
  if (state.page === 'assessment') {
    const screens = [imageScreen, findingsScreen, examScreen, reportScreen];
    return `<h1>Avaliação de ferida</h1><div class="work-area">
      ${stepper(state)}
      <section class="sheet" aria-labelledby="step-title" aria-busy="${Boolean(state.pending)}">${screens[state.step](state)}</section>
    </div>`;
  }
  if (state.page === 'library') {
    return `<h1>Biblioteca</h1><div class="sheet library">
      <label class="reference-search">Buscar por tema, diretriz ou tratamento
        <input id="reference-search" type="search" placeholder="Ex.: compressão, pé diabético, curativo">
      </label><div id="reference-results" aria-live="polite">${renderLibraryResults()}</div>
    </div>`;
  }
  return `<h1>Sobre o Medical Eye</h1><section class="sheet about">
    ${heading('Avaliação e dados da consulta')}
    <p>O Medical Eye apoia o registro da avaliação de feridas por profissionais, internos e estudantes de saúde. O WILLIE sugere o tipo de ferida e estima o contorno. O Gemini pode sugerir achados da imagem. A foto direciona as perguntas, e o profissional registra o exame e revisa as orientações de conduta e tratamento com as referências.</p>
    <p>O navegador converte a foto para JPEG antes do envio e remove os metadados do arquivo original. A foto segue para o WILLIE no servidor do Medical Eye. Quando autorizado, a mesma foto segue para o Gemini na análise inicial. A consulta às diretrizes e o resumo são processados na aplicação, com a base local.</p>
    <p>A foto e as respostas ficam em memória durante a sessão. O uso assistencial depende de validação clínica e institucional.</p>
  </section>`;
}
