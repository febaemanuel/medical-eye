import { TYPES, questionsFor } from './domain.mjs';
import { icon, svg } from './icons.mjs';
import { renderView, renderLibraryResults, urgencyNotice } from './views.mjs';

const el = id => document.getElementById(id);
const state = {
  page: 'assessment', step: 0, maxStep: 0, photo: null, photoUrl: null, authorized: false,
  cloudAuthorized: false, config: null, configError: false, type: null, vision: null, exam: {}, report: null,
  analyzed: false, maskUrl: null, visualReview: {}, willieError: null, visionError: null,
  pending: '', error: '', install: null, camera: null,
};

function announce(message) {
  el('announcement').textContent = message;
}

function updateExamStatus() {
  const questions = questionsFor(state.type, state.vision?.findings ?? [], state.exam);
  const answered = questions.filter(({ id }) => Object.hasOwn(state.exam, id)).length;
  el('completion').textContent = answered + ' de ' + questions.length + ' perguntas respondidas';
  el('generate').disabled = answered !== questions.length || Boolean(state.pending);
}

function render() {
  for (const button of document.querySelectorAll('.nav [data-view]')) {
    if (button.dataset.view === state.page) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }
  el('app').innerHTML = renderView(state);
  if (state.page === 'assessment' && state.step === 2) updateExamStatus();
}

function goTo(step) {
  if (state.pending) return;
  state.error = '';
  state.step = step;
  state.maxStep = Math.max(step, state.maxStep);
  render();
  el('step-title')?.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

async function fetchJson(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, cache: 'no-store' });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique a rede e tente novamente.');
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(body?.error || 'O servidor retornou uma resposta inesperada.');
  return body;
}

async function jpeg(file) {
  if (file.size > 12 * 1024 * 1024) throw new Error('Selecione uma imagem de até 12 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (Math.min(image.naturalWidth, image.naturalHeight) < 64) throw new Error('A imagem é muito pequena para análise.');
    const ratio = Math.min(1, 1536 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = Object.assign(document.createElement('canvas'), {
      width: Math.round(image.naturalWidth * ratio), height: Math.round(image.naturalHeight * ratio),
    });
    const context = canvas.getContext('2d');
    if (!context) throw new Error('O navegador não conseguiu preparar a foto.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .9));
    if (!blob || blob.size > 4 * 1024 * 1024) throw new Error('Não foi possível preparar a foto para envio.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function clearPhoto() {
  if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
  if (state.maskUrl) URL.revokeObjectURL(state.maskUrl);
  Object.assign(state, {
    photo: null, photoUrl: null, type: null, vision: null, maskUrl: null, analyzed: false,
    willieError: null, visionError: null, visualReview: {}, exam: {}, report: null, maxStep: 0,
  });
}

async function choosePhoto(file) {
  if (!file || state.pending) return;
  state.error = '';
  state.pending = 'image';
  render();
  try {
    const photo = await jpeg(file);
    clearPhoto();
    state.photo = photo;
    state.photoUrl = URL.createObjectURL(photo);
    announce('Foto selecionada.');
  } catch (error) {
    state.error = error.name === 'EncodingError' ? 'Formato de imagem incompatível. Tente JPEG, PNG ou WebP.' : error.message;
  } finally {
    state.pending = '';
    render();
  }
  if (!state.error && state.authorized && state.config) await analyze();
}

async function analyze() {
  if (!state.photo || !state.authorized || state.pending) return;
  if (state.analyzed) {
    goTo(1);
    return;
  }
  state.pending = 'image';
  state.error = '';
  render();
  announce('Analisando a foto.');
  try {
    const result = await fetchJson('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'image/jpeg', 'X-Image-Authorized': 'yes',
        'X-Gemini-Authorized': state.cloudAuthorized ? 'yes' : 'no',
      },
      body: state.photo,
    });
    if (result.type !== null && !Object.hasOwn(TYPES, result.type)) throw new Error('A análise retornou dados incompletos.');
    const { type, vision, mask, willieError, visionError } = result;
    const maskUrl = mask
      ? URL.createObjectURL(new Blob([Uint8Array.from(atob(mask), char => char.charCodeAt(0))], { type: 'image/png' }))
      : null;
    Object.assign(state, { type, vision, maskUrl, willieError, visionError, analyzed: true, maxStep: 1, pending: '' });
    goTo(1);
    announce('Análise concluída. Revise os achados.');
  } catch (error) {
    state.error = error.message;
    state.pending = '';
    render();
  }
}

async function generate() {
  if (state.pending) return;
  state.pending = 'report';
  state.error = '';
  render();
  announce('Consultando referências e preparando o resumo.');
  try {
    state.report = await fetchJson('/api/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorized: state.authorized, type: state.type, vision: state.vision, visualReview: state.visualReview, exam: state.exam }),
    });
    state.pending = '';
    goTo(3);
    announce('Resumo pronto para revisão.');
  } catch (error) {
    state.pending = '';
    state.error = error.message;
    render();
  }
}

function showDialog(title, content) {
  const dialog = el('dialog');
  dialog.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${title}</h2>
    <button type="button" class="btn" data-action="close" aria-label="Fechar">${icon('close')}</button></div>${content}`;
  dialog.showModal();
}

async function openCamera() {
  const mobile = matchMedia('(pointer: coarse)').matches;
  if (mobile || !navigator.mediaDevices?.getUserMedia) {
    el('camera-file').click();
    return;
  }
  showDialog('Tirar foto da ferida',
    `<video id="camera-preview" autoplay playsinline muted></video><p id="camera-status" class="dialog-note" role="status">Aguardando acesso à câmera…</p>
    <div class="actions"><button class="btn primary" type="button" data-action="capture" disabled>${icon('camera')} Capturar foto</button>
    <button class="btn" type="button" data-action="use-file">Selecionar arquivo</button></div>`);
  const video = el('camera-preview');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    if (!video.isConnected || !el('dialog').open) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    state.camera = stream;
    video.srcObject = stream;
    await video.play();
    if (!video.isConnected) return;
    el('camera-status').textContent = 'Posicione a lesão no centro da imagem.';
    el('dialog').querySelector('[data-action=capture]').disabled = false;
  } catch {
    if (video.isConnected && el('dialog').open) {
      el('camera-status').textContent = 'Câmera indisponível. Verifique a permissão do navegador ou selecione um arquivo.';
    }
  }
}

async function capturePhoto() {
  const video = el('camera-preview');
  if (!video?.videoWidth) return;
  const canvas = Object.assign(document.createElement('canvas'), { width: video.videoWidth, height: video.videoHeight });
  canvas.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .93));
  el('dialog').close();
  if (blob) await choosePhoto(blob);
}

async function install() {
  if (state.install) {
    const prompt = state.install;
    state.install = null;
    await prompt.prompt();
    return;
  }
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  showDialog('Instalar Medical Eye', standalone
    ? '<p class="dialog-note">O aplicativo já está aberto no modo instalado.</p>'
    : '<p class="dialog-note"><strong>Android ou desktop.</strong> Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial.</p>' +
      '<p class="dialog-note"><strong>iPhone e iPad.</strong> No Safari, toque em Compartilhar e em Adicionar à Tela de Início.</p>' +
      (!isSecureContext ? '<p class="dialog-note">Para instalar em outro dispositivo, abra a URL do servidor por HTTPS.</p>' : ''));
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.view && !state.pending) {
    state.page = button.dataset.view;
    render();
    el('main').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  if (button.dataset.step !== undefined) {
    const step = Number(button.dataset.step);
    if (step <= state.maxStep && (step !== 3 || state.report)) goTo(step);
  }
  if (button.id === 'install') void install();
  switch (button.dataset.action) {
    case 'camera': void openCamera(); break;
    case 'capture': void capturePhoto(); break;
    case 'use-file':
      el('dialog').close();
      el('gallery-file').click();
      break;
    case 'gallery': el('gallery-file').click(); break;
    case 'analyze': void analyze(); break;
    case 'exam': goTo(2); break;
    case 'close': el('dialog').close(); break;
    case 'reset':
      clearPhoto();
      state.authorized = false;
      state.cloudAuthorized = false;
      goTo(0);
      break;
  }
});

document.addEventListener('change', event => {
  const input = event.target;
  if (['camera-file', 'gallery-file'].includes(input.id)) void choosePhoto(input.files[0]);
  if (input.id === 'consent') {
    state.authorized = input.checked;
    el('app').querySelector('[data-action=analyze]').disabled = !state.authorized || !state.photo || Boolean(state.pending);
  }
  if (input.id === 'cloud-consent') state.cloudAuthorized = input.checked;
  if (input.id === 'mask-toggle') el('wound-mask').hidden = !input.checked;
  if (input.dataset.visual && input.type === 'radio') {
    state.visualReview[input.dataset.visual] = input.value;
    state.report = null;
    state.maxStep = Math.min(state.maxStep, 2);
  }
  if (input.form?.id === 'exam-form' && input.type === 'radio') {
    const hasPriorReport = Boolean(state.report);
    state.exam[input.name] = input.value;
    state.report = null;
    state.maxStep = 2;
    let selected = input;
    if (['etiology', 'wound'].includes(input.name) || hasPriorReport) {
      const selection = `input[name="${input.name}"][value="${input.value}"]`;
      render();
      selected = document.querySelector(selection);
      selected?.focus({ preventScroll: true });
    } else {
      el('urgent').innerHTML = urgencyNotice(state.exam);
      updateExamStatus();
    }
    if (input.value === 'unknown') {
      const guidance = selected?.closest('fieldset')?.querySelector('.question-help');
      if (guidance) guidance.open = true;
    }
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'reference-search') {
    el('reference-results').innerHTML = renderLibraryResults(event.target.value);
  }
});

document.addEventListener('submit', event => {
  if (event.target.id !== 'exam-form') return;
  event.preventDefault();
  if (!el('generate').disabled) void generate();
});
document.addEventListener('dragover', event => {
  if (!event.target.closest('#drop')) return;
  event.preventDefault();
  el('drop').classList.add('active');
});
document.addEventListener('dragleave', event => {
  if (event.target.closest('#drop') && !el('drop').contains(event.relatedTarget)) el('drop').classList.remove('active');
});
document.addEventListener('drop', event => {
  if (!event.target.closest('#drop')) return;
  event.preventDefault();
  el('drop').classList.remove('active');
  void choosePhoto(event.dataTransfer.files[0]);
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  state.install = event;
});
window.addEventListener('appinstalled', () => announce('Medical Eye instalado.'));
el('dialog').addEventListener('close', () => {
  state.camera?.getTracks().forEach(track => track.stop());
  state.camera = null;
  el('dialog').replaceChildren();
});

for (const item of document.querySelectorAll('[data-icon]')) item.innerHTML = svg(item.dataset.icon);
render();
fetchJson('/api/config').then(config => {
  state.config = config;
  render();
}).catch(() => {
  state.configError = true;
  render();
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
