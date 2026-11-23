import { TYPES, VISUAL, questionsFor, urgent } from './domain.mjs';
import { guidanceFor } from './evidence.mjs';
import { PROTOCOLS } from '../data/protocolos.mjs';
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
    ${state.vision ? `<div class="case-label"><small>Tipo sugerido na foto</small><strong>${esc(suggestedType(state.type))}</strong></div>` : ''}
  </aside>`;
}

function imageScreen(state) {
  const busy = state.pending === 'image';
  const disabled = busy ? 'disabled' : '';
  const ready = state.config?.configured && state.photo && state.authorized && !busy;
  let serviceNotice = '';
  if (state.configError) {
    serviceNotice = notice('Servidor indisponível. Verifique a conexão e tente novamente.', 'warning');
  } else if (state.config && !state.config.configured) {
    serviceNotice = notice('Configure a chave Gemini no servidor para analisar a foto.', 'warning');
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
      <span>Confirmo que a foto pode ser enviada ao Gemini para análise.</span></label>
    ${state.error ? notice(state.error, 'danger') : ''}
    <footer class="sheet-actions">
      <p class="quiet">${icon('lock')} A ficha fica disponível durante a sessão.</p>
      <button class="btn primary" type="button" data-action="analyze" ${ready ? '' : 'disabled'}>
        ${busy ? 'Analisando foto…' : state.vision ? 'Ver achados' : 'Analisar foto'}</button>
    </footer>`;
}

function findingsScreen(state) {
  const { vision } = state;
  return `${heading('Achados da foto', 'Confira a leitura da imagem antes de registrar o exame.')}
    <div class="finding-layout">
      <img class="finding-photo" src="${esc(state.photoUrl)}" alt="Foto da ferida analisada">
      <div class="finding-notes">
        <div class="finding-facts">
          <div><span>Tipo sugerido pelo Gemini</span><strong>${esc(suggestedType(state.type))}</strong></div>
          <div><span>Qualidade da imagem</span><strong>${esc(quality[vision.quality])}</strong></div>
        </div>
        <p>${esc(vision.description)}</p>
        ${vision.findings.length ? `<ul>${vision.findings.map(item => `<li>${esc(VISUAL[item])}</li>`).join('')}</ul>` : ''}
      </div>
    </div>
    ${vision.quality === 'poor' ? notice('Considere tirar outra foto. Registre no exame o que puder avaliar.', 'warning') : ''}
    ${state.type === 'no_wound' ? notice('A foto não mostra uma ferida visível. Verifique no exame se há alguma alteração de pele.') : ''}
    <footer class="sheet-actions"><button class="btn" data-step="0">Voltar à foto</button>
      <button class="btn primary" data-action="exam">Abrir exame</button></footer>`;
}

export function urgencyNotice(exam) {
  if (urgent(exam)) return notice('Sinal de alerta no exame. Priorize avaliação presencial urgente conforme o protocolo local.', 'danger');
  if (exam.fever === 'yes') return notice('Febre registrada. Confira os demais sinais sistêmicos e o protocolo local.', 'warning');
  return '';
}

function questionField(question, state) {
  const { id, label, options, hint, fromImage } = question;
  const guidance = guidanceFor(id, state.type, state.exam);
  const selected = state.exam[id];
  return `<fieldset class="question"><legend>${esc(label)}</legend>
    ${fromImage ? '<p class="image-cue">Orientada pela leitura da foto</p>' : ''}
    ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    <div class="options">${options.map(([value, title]) => `
      <label><input type="radio" name="${id}" value="${value}" ${selected === value ? 'checked' : ''} ${state.pending ? 'disabled' : ''}>
      <span>${esc(title)}</span></label>`).join('')}</div>
    ${guidance ? `<details class="question-help">
      <summary>${icon('book')} Consultar orientação</summary>
      <div class="help-text">
        <p>${esc(guidance.text)}</p>
        <a href="${esc(guidance.reference.url)}" target="_blank" rel="noopener noreferrer">
          ${esc(guidance.reference.organization)} · ${esc(guidance.reference.section)}
        </a>
      </div>
    </details>` : ''}
  </fieldset>`;
}

function examScreen(state) {
  const questions = questionsFor(state.type, state.vision.findings, state.exam);
  const groups = [
    ['consultation', 'Consulta e histórico'],
    ['examination', 'Exame da lesão'],
  ];

  return `${heading('Consulta e exame', 'Registre o que observou ou marque o que ficou pendente.')}
    <p class="completion" id="completion" aria-live="polite"></p>
    <div id="urgent">${urgencyNotice(state.exam)}</div>
    <form id="exam-form">
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

function sourceCard(ref) {
  return `<article class="source" id="source-${esc(ref.id)}">
      <small>${esc(ref.organization)} · ${esc(ref.year)}</small><h3>${esc(ref.title)}</h3>
      <small>${esc(ref.section)}</small><p>${esc(ref.text)}</p>
      <a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">Abrir fonte original</a>
    </article>`;
}

function reportScreen(state) {
  const { hypothesis, stage, infection, rationale, suggestions, references, examination, pending } = state.report;
  return `${heading('Resumo da avaliação', 'Confira o registro e as pendências antes de concluir.')}
    ${urgencyNotice(state.exam)}
    <section class="report-block">
      <h3>Achados da foto</h3>
      <p><strong>${esc(suggestedType(state.type))}</strong> · ${esc(state.vision.description)}</p>
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
    <section class="report-block"><h3>O que revisar</h3><ul>${suggestions.map(item =>
      `<li><p>${esc(item.text)}</p>${citationLinks(item.refs, references)}</li>`).join('')}</ul></section>
    <section class="sources"><h3>Referências da avaliação</h3>
      ${references.length ? references.map(sourceCard).join('') : '<p>Nenhum trecho aplicável encontrado para este caso.</p>'}</section>
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
    return `<h1>Referências</h1><div class="sheet library">${PROTOCOLS.map(sourceCard).join('')}</div>`;
  }
  return `<h1>Sobre o Medical Eye</h1><section class="sheet about">
    ${heading('Avaliação e dados da consulta')}
    <p>O Medical Eye apoia o registro da avaliação de feridas por profissionais, internos e estudantes de saúde. O Gemini sugere um tipo de ferida e descreve a imagem. O profissional registra as respostas clínicas e revisa o resumo com as referências.</p>
    <p>O navegador converte a foto para JPEG antes do envio e remove os metadados do arquivo original. A foto é enviada ao Gemini somente na análise inicial. A consulta às diretrizes e o resumo são processados na aplicação, com a base local.</p>
    <p>A foto e as respostas ficam em memória durante a sessão. O uso assistencial depende de validação clínica e institucional.</p>
  </section>`;
}
