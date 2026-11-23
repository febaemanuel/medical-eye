const icons = {
  brand: '<path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6-10-6-10-6Z"/><path d="M12 9v6m-3-3h6"/>',
  clipboard: '<path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M8 12h8m-8 4h6"/>',
  book: '<path d="M4 19a2 2 0 0 1 2-2h14V3H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h14M8 8h8m-8 4h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  cap: '<path d="M2 10l10-5 10 5-10 5zm4 2v5c3 3 9 3 12 0v-5m4-2v5"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4m3 5v4H5v-4"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="3.2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-5 5 5"/>',
  focus: '<path d="M3 8V5a2 2 0 0 1 2-2h3m8 0h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3m-8 0H5a2 2 0 0 1-2-2v-3"/><circle cx="12" cy="12" r="3"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>',
  light: '<path d="M9 18h6m-5 3h4M8 15a6 6 0 1 1 8 0l-1 1H9z"/>',
  alert: '<path d="m12 3 10 17H2zM12 9v4m0 3h.01"/>',
  exam: '<path d="M3 12h4l2-5 4 10 2-5h6"/><rect x="2" y="3" width="20" height="18" rx="4"/>',
  file: '<path d="M6 3h8l4 4v14H6zM14 3v5h4m-9 4h6m-6 4h6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
export const svg = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name] || ''}</svg>`;
export const icon = name => `<span data-icon="${name}">${svg(name)}</span>`;
