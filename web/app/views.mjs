import { TYPES, VISUAL, questionsFor, urgent } from './domain.mjs';
import { PROTOCOLS } from '../data/protocolos.mjs';
import { icon, svg } from './icons.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, mark => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[mark]);

const labels = ['Imagem', 'Achados', 'Exame', 'Parecer'];
function notice(text, tone = '') {
  const glyph = tone ? 'alert' : 'info';
  return `<div class="notice ${tone}" ${tone === 'danger' ? 'role="alert"' : ''}>${icon(glyph)}<span>${esc(text)}</span></div>`;
}

function sectionHead(glyph, title, detail = '') {
  return `<div class="card-head"><span class="section-icon" data-icon="${glyph}">${svg(glyph)}</span><div>
    <h2 id="step-title" tabindex="-1">${title}</h2>${detail ? `<p>${detail}</p>` : ''}</div></div>`;
}

function pageHead(title, detail, mode = false) {
  return `<div class="page-head"><div><h1>${title}</h1><p>${detail}</p></div>
    ${mode ? `<span class="mode">${icon('cap')} Uso acadêmico</span>` : ''}</div>`;
}

function stepper(state) {
  return `<ol class="stepper" aria-label="Progresso da avaliação">${labels.map((label, index) => {
    const current = state.step === index;
    const accessible = !current && index <= state.maxStep;
    const content = `<span class="step-number">${index < state.step ? svg('check') : index + 1}</span><span>${label}</span>`;
    return `<li ${current ? 'aria-current="step"' : ''}>${accessible
      ? `<button type="button" data-step="${index}" ${state.pending ? 'disabled' : ''}>${content}</button>`
      : `<div>${content}</div>`}</li>`;
  }).join('')}</ol>`;
}

function rail(state) {
  const photography = state.photo ? 'Foto selecionada' : 'Aguardando foto';
  const className = state.type ? TYPES[state.type] : 'Aguardando análise';
  const exam = state.report ? 'Parecer gerado' : Object.keys(state.exam).length ? 'Em avaliação' : 'Aguardando exame';
  const data = [['Imagem', photography, !state.photo], ['WILLIE', className, !state.type], ['Exame', exam, !Object.keys(state.exam).length]];
  return `<aside class="rail" aria-label="Contexto da avaliação">
    <section class="card rail-card"><div class="rail-title">${icon('clipboard')}<h3>Caso atual</h3></div>
      <dl class="case-data">${data.map(([label, text, waiting]) =>
        `<div><dt>${label}</dt><dd class="${waiting ? 'pending' : ''}">${esc(text)}</dd></div>`).join('')}</dl>
    </section>
    <section class="card rail-card tip-card"><div class="rail-title">${icon('light')}<h3>Orientações para a foto</h3></div>
      <ul><li>Use luz uniforme e mantenha o foco na lesão.</li><li>Inclua a pele ao redor da ferida.</li><li>Evite rosto, etiquetas e outros identificadores.</li></ul>
    </section>
  </aside>`;
}

function imageScreen(state) {
  const busy = state.pending === 'image';
  const disabled = busy ? 'disabled' : '';
  let serviceNotice = '';
  if (state.configError) {
    serviceNotice = notice('Servidor indisponível. Verifique a conexão e tente novamente.', 'warning');
  } else if (state.config && !state.config.configured) {
    serviceNotice = notice('Para iniciar a análise, configure o WILLIE e a chave Gemini no servidor.', 'warning');
  }
  return `${sectionHead('camera', 'Foto da ferida', 'Inclua a lesão e a pele ao redor na imagem.')}
    <div class="drop" id="drop">
      <input type="file" class="sr-only" id="camera-file" accept="image/*" capture="environment" tabindex="-1" aria-label="Tirar foto da ferida">
      <input type="file" class="sr-only" id="gallery-file" accept="image/*" tabindex="-1" aria-label="Selecionar imagem da ferida">
      ${state.photoUrl ? `<div class="photo-review">
        <img src="${esc(state.photoUrl)}" alt="Foto selecionada para a avaliação">
        <div class="file-controls">
          <button class="btn" type="button" data-action="camera" ${disabled}>${icon('camera')} Tirar outra foto</button>
          <button class="btn text" type="button" data-action="gallery" ${disabled}>Trocar arquivo</button>
        </div></div>` : `<div>
          <div class="upload-icon" data-icon="focus">${svg('focus')}</div>
          <h3>Foto da ferida</h3>
          <p>Use a câmera do dispositivo ou arraste um arquivo para cá.</p>
          <div class="file-controls">
            <button class="btn primary" type="button" data-action="camera" ${disabled}>${icon('camera')} Tirar foto</button>
            <button class="btn" type="button" data-action="gallery" ${disabled}>${icon('image')} Selecionar arquivo</button>
          </div>
          <p class="file-types">Imagem de até 12 MB</p>
        </div>`}
    </div>
    ${serviceNotice}
    <label class="consent"><input type="checkbox" id="consent" ${state.authorized ? 'checked' : ''} ${disabled}>
      <span>Confirmo que o processamento da foto e dos dados do exame pelos serviços configurados está autorizado.</span></label>
    ${state.error ? notice(state.error, 'danger') : ''}
    <div class="card-foot">
      <p class="quiet">${icon('lock')} A foto e o exame ficam disponíveis só durante a sessão.</p>
      <button class="btn ${state.photo ? 'primary' : ''}" type="button" data-action="analyze"
        ${!state.photo || !state.authorized || !state.config?.configured || busy ? 'disabled' : ''}>
        ${icon('focus')} ${busy ? 'Analisando imagem…' : 'Analisar imagem'}</button>
    </div>`;
}

const quality = { adequate: 'Adequada para leitura visual', limited: 'Leitura visual limitada', poor: 'Qualidade insuficiente' };

function findingsScreen(state) {
  const vision = state.vision;
  return `${sectionHead('focus', 'Achados da imagem', 'Revise a classificação e as observações antes do exame.')}
    <div class="finding-layout">
      <img class="finding-photo" src="${esc(state.photoUrl)}" alt="Foto da ferida analisada">
      <div class="stack">
        <div class="finding-summary">
          <div class="section-label">Classificação sugerida pelo WILLIE</div>
          <h3>${esc(TYPES[state.type])}</h3><p>Código ${esc(state.type)}</p>
        </div>
        <div>
          <div class="section-label">Leitura visual</div>
          <h3>${esc(quality[vision.quality])}</h3>
          <p>${esc(vision.description)}</p>
          ${vision.findings.length ? `<ul>${vision.findings.map(finding => `<li>${esc(VISUAL[finding])}</li>`).join('')}</ul>` : ''}
        </div>
      </div>
    </div>
    ${vision.quality === 'poor' ? notice('Considere tirar outra foto. Use o exame para documentar o que é possível avaliar.', 'warning') : ''}
    ${state.type === 'no_wound' ? notice('O WILLIE retornou imagem sem ferida. Confirme no exame se há lesão, inclusive quando a pele está íntegra.') : ''}
    <div class="card-foot"><button class="btn" data-step="0">Voltar à foto</button>
      <button class="btn primary" data-action="exam">${icon('exam')} Abrir exame guiado</button></div>`;
}

export function urgencyNotice(exam) {
  return urgent(exam) ? notice('Sinal de alerta no exame. Priorize avaliação presencial urgente conforme o protocolo local.', 'danger') : '';
}

function questionField(question, selected, busy) {
  const { id, label, options, hint, fromImage } = question;
  return `<fieldset class="question"><legend>${esc(label)}</legend>
    ${fromImage ? '<p class="image-cue">Confira este ponto no exame</p>' : ''}
    ${hint ? `<p>${esc(hint)}</p>` : ''}
    <div class="options">${options.map(([value, title]) => `
      <label><input type="radio" name="${id}" value="${value}" ${selected === value ? 'checked' : ''} ${busy ? 'disabled' : ''}>
      <span>${esc(title)}</span></label>`).join('')}</div>
  </fieldset>`;
}

function examScreen(state) {
  const questions = questionsFor(state.type, state.vision.findings, state.exam);
  return `${sectionHead('exam', 'Exame guiado', 'Registre os achados confirmados e sinalize o que ficou sem avaliação.')}
    <div class="form-top"><p id="completion"></p></div>
    <div id="urgent">${urgencyNotice(state.exam)}</div>
    <form id="exam-form">
      ${questions.map(question => questionField(question, state.exam[question.id], state.pending)).join('')}
      ${state.error ? notice(state.error, 'danger') : ''}
      <div class="card-foot"><button type="button" class="btn" data-step="1" ${state.pending ? 'disabled' : ''}>Voltar aos achados</button>
        <button type="submit" class="btn primary" id="generate" disabled>${icon('file')} ${state.pending ? 'Gerando parecer…' : 'Gerar parecer'}</button></div>
    </form>`;
}

function citationLinks(refs, references) {
  return refs.map(id => references.find(ref => ref.id === id)).filter(Boolean)
    .map(ref => `<a href="#source-${esc(ref.id)}">${esc(ref.organization)} · ${esc(ref.section)}</a>`)
    .join(' <span aria-hidden="true">•</span> ');
}

function sectionReport(label, section, references) {
  return `<section class="report-section"><h3>${label}</h3><p>${esc(section.text)}</p>
    ${citationLinks(section.refs, references)}</section>`;
}

function sourceCard(ref, grid = false) {
  const url = new URL(ref.url);
  return `<article class="source ${grid ? 'card' : ''}" id="source-${esc(ref.id)}">
      <small>${esc(ref.organization)} · ${esc(ref.year)}</small><h3>${esc(ref.title)}</h3>
      <small>${esc(ref.section)}</small><p>${esc(ref.text)}</p>
      ${url.protocol === 'https:' ? `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">Abrir fonte original</a>` : ''}
    </article>`;
}

function reportScreen(state) {
  const { hypothesis, stage, infection, rationale, suggestions, references } = state.report;
  return `${sectionHead('file', 'Parecer preliminar', 'Revise a hipótese, a conduta e as fontes antes de concluir a avaliação.')}
    ${urgencyNotice(state.exam)}
    <div class="stack">
      ${sectionReport('Hipótese principal', hypothesis, references)}
      ${sectionReport('Estágio da ferida', stage, references)}
      ${sectionReport('Gravidade da infecção', infection, references)}
      ${sectionReport('Raciocínio clínico', rationale, references)}
      <section class="report-section"><h3>Conduta sugerida</h3><ul>${suggestions.map(item =>
        `<li><p>${esc(item.text)}</p>${citationLinks(item.refs, references)}</li>`).join('')}</ul></section>
    </div>
    <section class="sources"><h3>Trechos consultados</h3>
      ${references.length ? references.map(ref => sourceCard(ref)).join('') : '<p>Nenhum trecho aplicável encontrado para este caso.</p>'}</section>
    <div class="card-foot"><button class="btn" data-step="2">Revisar exame</button>
      <button class="btn primary" data-action="reset">Nova avaliação</button></div>`;
}

export function renderView(state) {
  if (state.page === 'assessment') {
    const screens = [imageScreen, findingsScreen, examScreen, reportScreen];
    return `${pageHead('Nova avaliação', 'Comece pela foto da ferida.', true)}
      ${stepper(state)}
      <div class="layout">
        <section class="card main-card" aria-labelledby="step-title" aria-busy="${Boolean(state.pending)}">
          ${screens[state.step](state)}
        </section>
        ${rail(state)}
      </div>`;
  }
  if (state.page === 'library') {
    return `${pageHead('Protocolos', 'Diretrizes usadas na elaboração do parecer.')}
      <div class="library-grid">${PROTOCOLS.map(ref => sourceCard(ref, true)).join('')}</div>`;
  }
  return `${pageHead('Sobre o app', 'Apoio à avaliação de feridas para profissionais, internos e estudantes de saúde.')}
    <div class="card main-card about-grid">
      ${sectionHead('info', 'Fluxo e privacidade')}
      <p>O WILLIE sugere o tipo da ferida. O modelo de visão descreve os elementos que aparecem na foto. O exame registra a confirmação clínica, e o parecer usa trechos de diretrizes recuperados na base local.</p>
      <p>O navegador converte a foto em JPEG e remove os metadados do arquivo original. A foto vai ao WILLIE e ao provedor de visão configurado. O provedor do parecer recebe os dados do exame e os trechos recuperados. O aplicativo mantém o caso em memória durante a sessão.</p>
      <p>O WILLIE foi publicado para pesquisa. Use os resultados em discussão acadêmica e sob revisão profissional. O uso assistencial depende de validação clínica e institucional.</p>
    </div>`;
}
