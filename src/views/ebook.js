import books from '../data/books.json';
import { h, icon, fill } from '../lib/dom.js';
import { speak, stop } from '../lib/tts.js';
import { FOLD_VIDEO_URL } from '../config.js';
import { pageName, brandMark } from './parts.js';

const BASE = import.meta.env.BASE_URL || './';

// 종이책 8쪽을 펼친 책으로 보여 준다: [면지|표지] [1|2] [3|4] [5|6] [뒷표지|면지]
const SPREADS = [[null, 'cover'], ['p1', 'p2'], ['p3', 'p4'], ['p5', 'p6'], ['back', null]];
const spreadOfPage = (n) => Math.ceil(n / 2);

const SVG_NS = 'http://www.w3.org/2000/svg';
function flowerArt() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('width', '56');
  svg.setAttribute('height', '56');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<path d="M32 60V34" stroke="#8fb487" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M32 48c-8 0-12-5-13-9 6 0 11 2 13 9zM32 44c7 0 11-4 12-8-6 0-10 2-12 8z" fill="#a8c99f"/>'
    + '<g fill="#f4aab1"><circle cx="32" cy="14" r="8"/><circle cx="43" cy="22" r="8"/><circle cx="39" cy="34" r="8"/><circle cx="25" cy="34" r="8"/><circle cx="21" cy="22" r="8"/></g>'
    + '<circle cx="32" cy="25" r="6" fill="#ffd77a"/>';
  return svg;
}

// mode: 'browse'(차시를 넘겨 보는 전자책) | 'student'(학생이 지금 쓰는 쪽을 함께 보여 줌)
export function createBook({ lesson = 2, mode = 'browse', page = 1, onPickPage, pickLesson = mode === 'browse', onLesson } = {}) {
  let L = lesson;
  let s = mode === 'student' ? spreadOfPage(page) : 0;
  let active = page;
  let showKo = false;
  let full = false;
  const el = h('section', { class: `book ${mode}`, 'aria-label': '선생님 모델 책' });
  const book = () => books.find((b) => b.lesson === L) || books[0];

  function wordSpans(text) {
    const parts = text.split(/(\s+)/);
    let offset = 0;
    return parts.map((part) => {
      const start = offset;
      offset += part.length;
      if (!part.trim()) return document.createTextNode(part);
      const clean = part.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
      return h('span', {
        class: 'w', 'data-start': start, 'data-end': start + part.length,
        onclick: (e) => { e.stopPropagation(); if (clean) speak(clean, { slow: true }); },
      }, part);
    });
  }

  function leaf(key, side) {
    const b = book();
    if (!key) return h('div', { class: `leaf ${side}`, 'aria-hidden': 'true' }, h('div', { class: 'endpaper' }));
    const pg = b.modelBook.find((x) => x.key === key);
    const n = /^p\d$/.test(key) ? +key.slice(1) : null;
    const isActive = mode === 'student' && n === active;
    const canPick = mode === 'student' && n && onPickPage;

    const img = h('img', { src: BASE + pg.image, alt: '', loading: 'lazy' });
    const art = h('div', { class: 'art' }, img);
    img.addEventListener('error', () => {
      // .webp가 없으면 같은 이름의 .png를 한 번 더 찾아본다(GPT가 만든 원본을 그대로 넣었을 때).
      if (img.src.endsWith('.webp')) { img.src = img.src.replace(/\.webp$/, '.png'); return; }
      img.remove();
      art.append(h('div', { class: 'blank-art' }, flowerArt(), h('span', null, '그림 자리'), h('span', { class: 'path' }, 'public/' + pg.image.replace(/\.webp$/, '.webp 또는 .png'))));
    });

    const text = h('p', { class: 'text has-say', lang: 'en' }, wordSpans(pg.en), showKo ? h('span', { class: 'ko', lang: 'ko' }, pg.ko) : null);
    const words = () => [...text.querySelectorAll('.w')];
    const say = h('button', {
      class: 'say', type: 'button', 'aria-label': `${pageName(key)} 문장 듣기`,
      onclick: (e) => {
        e.stopPropagation();
        speak(pg.en, {
          onword: (ci) => words().forEach((w) => w.classList.toggle('now', ci >= +w.dataset.start && ci < +w.dataset.end)),
          onend: () => words().forEach((w) => w.classList.remove('now')),
        });
      },
    }, icon('speaker'));

    return h('article', {
      class: `leaf ${side}${key === 'cover' ? ' cover' : ''}${isActive ? ' active' : ''}${canPick ? ' pick' : ''}`,
      'aria-label': `${pageName(key)}: ${pg.en}`,
      tabindex: canPick ? '0' : null,
      onclick: canPick ? () => onPickPage(n) : null,
      onkeydown: canPick ? (e) => { if (e.key === 'Enter') onPickPage(n); } : null,
    },
    art,
    key !== 'cover' ? h('span', { class: 'num' }, pageName(key)) : null,
    isActive ? h('span', { class: 'now-tag' }, '지금 쓰는 쪽') : null,
    text,
    say);
  }

  function render() {
    const b = book();
    const [l, r] = SPREADS[s];
    const label = s === 0 ? '표지' : s === 4 ? '뒷표지' : `${s * 2 - 1}–${s * 2}쪽`;
    fill(el, 
      h('div', { class: 'book-head' },
        mode === 'student' ? h('span', { class: 'chip' }, '선생님 책') : brandMark(26, false),
        h('h2', { lang: 'en' }, b.modelBook[0].en),
        h('span', { class: 'muted small' }, `${b.lesson}차시`),
        h('span', { class: 'spacer' }),
        FOLD_VIDEO_URL ? h('a', { class: 'btn small', href: FOLD_VIDEO_URL, target: '_blank', rel: 'noopener' }, icon('video', 16), '접기 영상') : null),
      pickLesson ? h('div', { class: 'lesson-pick', role: 'group', 'aria-label': '차시 고르기' },
        books.map((bk) => h('button', {
          class: 'btn small', type: 'button', 'aria-pressed': String(bk.lesson === L),
          onclick: () => { L = bk.lesson; s = 0; onLesson?.(L); render(); },
        }, `${bk.lesson}차시`))) : null,
      h('div', { class: 'book-cover' }, leaf(l, 'left'), leaf(r, 'right')),
      h('div', { class: 'book-controls' },
        h('button', { class: 'btn icon', type: 'button', 'aria-label': '앞 장', disabled: s === 0, onclick: () => go(-1) }, icon('left')),
        h('span', { class: 'pager' }, label),
        h('button', { class: 'btn icon', type: 'button', 'aria-label': '다음 장', disabled: s === SPREADS.length - 1, onclick: () => go(1) }, icon('right')),
        h('button', { class: 'btn small', type: 'button', 'aria-pressed': String(showKo), onclick: () => { showKo = !showKo; render(); } }, '우리말 뜻'),
        h('button', { class: 'btn small icon', type: 'button', 'aria-label': full ? '크게 보기 닫기' : '크게 보기', onclick: toggleFull }, icon(full ? 'close' : 'expand', 18)),
        h('span', { class: 'small muted' }, '낱말을 누르면 그 낱말만 들려줘요')));
  }

  function go(d) {
    s = Math.max(0, Math.min(SPREADS.length - 1, s + d));
    stop();
    render();
  }

  function toggleFull() {
    full = !full;
    el.classList.toggle('full', full);
    if (full) document.documentElement.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    render();
  }

  function onKey(e) {
    if (e.target.closest?.('input, textarea, select')) return;
    if (!el.isConnected) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Escape' && full) toggleFull();
  }
  document.addEventListener('keydown', onKey);
  render();

  return {
    el,
    setLesson(n) { if (n !== L) { L = n; s = mode === 'student' ? spreadOfPage(active) : 0; render(); } },
    setPage(n) { active = n; s = spreadOfPage(n); render(); },
    destroy() { document.removeEventListener('keydown', onKey); stop(); },
  };
}

export function renderEbookPage(app, params = {}) {
  const book = createBook({ lesson: params.lesson || 2, onLesson: (n) => { params.lesson = n; } });
  const back = app.session?.role === 'teacher' ? 'teacher' : app.session?.role === 'student' ? 'student' : 'home';
  app.mount(h('div', { class: 'stack' },
    h('div', { class: 'topbar' },
      h('button', { class: 'btn small', type: 'button', onclick: () => app.go(back) }, icon('left', 16), '돌아가기')),
    book.el));
  return () => book.destroy();
}
