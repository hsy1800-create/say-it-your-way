// 아주 작은 DOM 도우미. 아이들이 쓴 글은 항상 텍스트로만 넣는다(innerHTML 쓰지 않음).
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

// replaceChildren는 null을 "null" 글자로 넣어 버리므로, 비우고 append로 채운다.
export function fill(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

export function append(el, children) {
  for (const c of [children].flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const ICONS = {
  speaker: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16 8.5a5 5 0 0 1 0 7" fill="none"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12" fill="none"/>',
  slow: '<circle cx="12" cy="12" r="8" fill="none"/><path d="M12 7v5l3 2" fill="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="2"/>',
  camera: '<path d="M4 8h3l2-2.5h6L17 8h3v11H4z" fill="none"/><circle cx="12" cy="13" r="3.5" fill="none"/>',
  search: '<circle cx="10.5" cy="10.5" r="6" fill="none"/><path d="M15 15l5 5" fill="none"/>',
  left: '<path d="M15 5l-7 7 7 7" fill="none"/>',
  right: '<path d="M9 5l7 7-7 7" fill="none"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" fill="none"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2" fill="none"/><path d="M16 10l5-3v10l-5-3z"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8L3.5 9.7l5.9-.8z"/>',
};

export function icon(name, size = 20) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ic');
  svg.innerHTML = ICONS[name] || '';
  return svg;
}

let toastTimer;
export function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  return d;
}

export function ago(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 30) return '방금';
  if (s < 90) return '1분 전';
  if (s < 3600) return `${Math.round(s / 60)}분 전`;
  return `${Math.round(s / 3600)}시간 전`;
}

export function ss(key, value) {
  try {
    if (value === undefined) return JSON.parse(sessionStorage.getItem(key) || 'null');
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
}

export function ls(key, value) {
  try {
    if (value === undefined) return JSON.parse(localStorage.getItem(key) || 'null');
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { return null; }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
