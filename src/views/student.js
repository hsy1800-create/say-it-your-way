import books from '../data/books.json';
import { h, icon, toast, ago, fill } from '../lib/dom.js';
import { speak } from '../lib/tts.js';
import { search, norm, WORD_GROUPS, wordsInGroup } from '../lib/search.js';
import { compressFile, openCamera, snapshot, startRecording } from '../lib/media.js';
import { phraseCard, speakButtons, brandMark } from './parts.js';
import { createBook } from './ebook.js';
import { hasBuiltInTranslator, translateKoEn, papagoUrl, MAX_LEN } from '../lib/translate.js';

const LEVELS = [['1', '쉽게'], ['2', '선생님 책처럼'], ['3', '도전']];
const BLANK_RE = /___(?:\{([^}]*)\})?/;

// 문장 키우기 카드. 누르면 ‘직접 고쳐 쓰기’로 바뀌며 뒤에 덧붙는다.
const GROW = [
  { en: 'because', ko: '왜냐하면', add: (s) => trimEnd(s) + ' because ___.' },
  { en: 'but', ko: '하지만', add: (s) => trimEnd(s) + ', but ___.' },
  { en: 'especially', ko: '특히', add: (s) => trimEnd(s) + ', especially ___.' },
  { en: 'when', ko: '~할 때', add: (s) => trimEnd(s) + ' when I ___.' },
  { en: 'It makes me feel', ko: '그래서 내 기분은', add: (s) => (s.trim() ? s.trim() + ' ' : '') + 'It makes me feel ___.' },
  { en: 'like', ko: '예를 들면', add: (s) => trimEnd(s) + ', like ___.' },
];
function trimEnd(s) { return s.trim().replace(/[.!?]+$/, '') || '___'; }

export function hasGender(frame) { return /\((She|she|Her|her)\)/.test(frame); }
export function applyGender(t, g) {
  const he = g === 'he';
  return t.replace(/He\(She\)/g, he ? 'He' : 'She').replace(/he\(she\)/g, he ? 'he' : 'she')
    .replace(/His\(Her\)/g, he ? 'His' : 'Her').replace(/his\(her\)/g, he ? 'his' : 'her')
    .replace(/him\(her\)/g, he ? 'him' : 'her');
}
// "This is my ___{누구}." → { texts: ['This is my ', '.'], hints: ['누구'] }
export function parseFrame(frame, g) {
  const parts = applyGender(frame, g).split(BLANK_RE);
  const texts = [];
  const hints = [];
  parts.forEach((p, i) => { if (i % 2 === 0) texts.push(p); else hints.push(p || ''); });
  return { texts, hints };
}
function compose(texts, values) {
  return texts.map((t, i) => t + (i < texts.length - 1 ? (values[i]?.trim() || '___') : '')).join('').replace(/\s+/g, ' ').trim();
}

export function renderStudent(app) {
  const { store } = app;
  const S = app.session;
  if (!S || S.role !== 'student') { app.go('home'); return null; }

  const unsubs = [];
  let cls = null;
  let lesson = null;
  let page = 1;
  let tab = 'page';
  let myEntries = {};
  let tips = [];
  let notices = [];
  let myPhotos = [];
  let state = null; // 지금 쪽: { level, gender, blanks[], free }
  let ui = null; // 지금 쪽의 입력 칸
  let target = 0; // 찾은 낱말을 넣을 빈칸 번호
  let book = null;

  const root = h('div', { class: 'student' });
  app.mount(root);

  const title = h('h1');
  const header = h('div', { class: 'topbar' },
    brandMark(30, false),
    h('div', { class: 'who' }, h('span', { class: 'muted small' }, S.nickname), title),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn small ghost', type: 'button', onclick: leave }, '나가기'));
  const noticeRow = h('div', { class: 'notice-row' });
  const bookSlot = h('div');
  const followNote = h('p', { class: 'follow-note', hidden: true }, '선생님과 같이 보는 중이에요. 선생님이 장을 넘기면 내 책도 같이 넘어가요.');
  let lastSpread = null;
  const pageTabs = h('div', { class: 'pagetabs', role: 'tablist', 'aria-label': '내 책 쪽 고르기' });
  const writeCol = h('div', { class: 'write' });
  const finder = h('aside', { class: 'card finder', 'aria-label': '낱말 찾기' });
  const work = h('div', { class: 'work' }, writeCol, finder);
  root.append(header, noticeRow, followNote, bookSlot, pageTabs, work);

  const bookData = () => books.find((b) => b.lesson === lesson) || books[0];
  const entryOf = (p) => myEntries[`${S.uid}_${lesson}_${p}`];

  // ---------- 선생님이 알려준 말 ----------
  function renderNotices() {
    fill(noticeRow, ...notices.slice(0, 4).map((n) => h('div', { class: 'notice' },
      h('span', { class: 'from' }, `선생님이 알려준 말 · ★${n.q}`),
      h('span', { class: 'en marker' }, n.en),
      speakButtons(n.en, { slow: false }))));
  }

  // ---------- 쪽 탭 ----------
  function stateOf(e) {
    if (!e?.en) return '';
    if (e.en.includes('___')) return e.filled ? 'part' : '';
    return 'done';
  }
  function renderTabs() {
    fill(pageTabs, 
      ...[1, 2, 3, 4, 5, 6].map((p) => {
        const st = stateOf(entryOf(p));
        return h('button', {
          class: 'pagetab', type: 'button', role: 'tab', 'aria-selected': String(tab === 'page' && page === p),
          onclick: () => goPage(p),
        }, `${p}쪽`, st ? h('span', { class: `tick ${st}`, 'aria-label': st === 'done' ? '다 썼어요' : '쓰는 중' }) : null);
      }),
      h('button', {
        class: 'pagetab', type: 'button', role: 'tab', 'aria-selected': String(tab === 'photo'),
        onclick: () => { flushSave(); tab = 'photo'; renderTabs(); renderWrite(); },
      }, '사진'));
  }
  function goPage(p) {
    flushSave();
    tab = 'page';
    page = p;
    book?.setPage(p);
    renderTabs();
    renderWrite();
  }

  // ---------- 저장 ----------
  let saveTimer = null;
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 800); }
  function flushSave() { if (saveTimer) { clearTimeout(saveTimer); save(); } }
  async function save() {
    saveTimer = null;
    if (!ui || !state) return;
    const en = currentSentence();
    const filled = state.free != null ? 1 : state.blanks.filter((v) => v?.trim()).length;
    const data = {
      uid: S.uid, nickname: S.nickname, lesson, page: ui.page, en,
      level: state.level, gender: state.gender, blanks: state.blanks.slice(0, 8), free: state.free, filled,
    };
    try {
      await store.saveEntry(S.code, data);
      ui.saved.textContent = '선생님 화면에 보였어요 · 방금';
    } catch {
      ui.saved.textContent = '보내지 못했어요. 인터넷 연결을 확인해요. 쓴 글은 그대로 있어요.';
    }
  }

  function currentFrame() {
    const pg = bookData().pages[ui.page - 1];
    return pg.frames[state.level] || pg.frames['2'];
  }
  function currentSentence() {
    if (state.free != null) return state.free.trim();
    const { texts } = parseFrame(currentFrame(), state.gender);
    return compose(texts, state.blanks);
  }

  // ---------- 한 쪽 쓰기 ----------
  function renderWrite() {
    if (tab === 'photo') { renderPhoto(); return; }
    photoCleanup?.(); photoCleanup = null;
    const b = bookData();
    const pg = b.pages[page - 1];
    const model = b.modelBook.find((x) => x.key === `p${page}`);
    const e = entryOf(page) || {};
    state = {
      level: e.level || '2',
      gender: e.gender || 'she',
      blanks: Array.isArray(e.blanks) ? [...e.blanks] : [],
      free: typeof e.free === 'string' ? e.free : null,
    };
    target = 0;

    const tipBox = h('div', { class: 'stack' });
    const frameBox = h('div');
    const preview = h('p', { class: 'sentence', lang: 'en' });
    const saved = h('p', { class: 'saved', role: 'status' }, e.updatedAt ? `선생님 화면에 보였어요 · ${ago(e.updatedAt)}` : '');
    ui = { page, frameBox, preview, saved, tipBox, inputs: [], freeArea: null };

    // 혼자 말해보기
    const recBox = h('div', { class: 'rec' });
    let stopRec = null;
    const recBtn = h('button', {
      class: 'btn small', type: 'button',
      onclick: async () => {
        if (stopRec) {
          const url = await stopRec();
          stopRec = null;
          fill(recBtn, icon('mic', 16), '다시 말해보기');
          recBox.querySelector('audio')?.remove();
          recBox.append(h('audio', { controls: true, src: url }));
          return;
        }
        try { stopRec = await startRecording(); fill(recBtn, icon('stop', 16), '멈추기'); }
        catch { toast('마이크를 쓸 수 없어요. 듣기 버튼으로 따라 말해 봐요.'); }
      },
    }, icon('mic', 16), '혼자 말해보기');
    recBox.append(recBtn, h('span', { class: 'small muted' }, '녹음은 이 노트북에만 남아요.'));

    fill(writeCol, 
      h('div', { class: 'write-head' },
        h('h2', null, `내 책 ${page}쪽`),
        h('span', { class: 'muted small' }, `선생님 책 ${page}쪽 문장을 따라, 빈칸에 내 이야기를 넣어요.`)),
      tipBox,
      h('div', { class: 'think' },
        h('span', { class: 'chip' }, '생각해 보기'),
        h('span', { class: 'q' }, pg.q),
        h('span', { class: 'en muted small' }, pg.qEn)),
      model ? h('div', { class: 'model-line' },
        h('span', { class: 'chip' }, `선생님 책 ${page}쪽`),
        h('span', { class: 'en', lang: 'en' }, model.en),
        speakButtons(model.en, { slow: false }),
        h('span', { class: 'ko' }, `뜻: ${model.ko}`)) : null,
      h('div', { class: 'card stack' },
        frameBox,
        h('div', { class: 'mine' },
          h('span', { class: 'label' }, '내 문장'),
          preview,
          h('div', { class: 'row' },
            h('button', { class: 'btn small primary', type: 'button', onclick: () => speak(currentSentence()) }, icon('speaker', 16), '듣기'),
            h('button', { class: 'btn small', type: 'button', onclick: () => speak(currentSentence(), { slow: true }) }, '느리게'),
            recBox)),
        h('div', { class: 'stack', style: { gap: '6px' } },
          h('span', { class: 'sub-h' }, '한 문장 더 말하고 싶으면 문장 키우기'),
          h('div', { class: 'grow' }, GROW.map((g) => h('button', {
            class: 'btn small', type: 'button', title: g.ko,
            onclick: () => { state.free = g.add(currentSentence()); renderFrame(); queueSave(); ui.freeArea?.focus(); },
          }, g.en, h('span', { class: 'small muted', style: { fontFamily: 'var(--body)' } }, g.ko))))),
        saved));

    renderFrame();
    renderTips();
    renderFinder();
  }

  function renderFrame() {
    const { frameBox } = ui;
    ui.inputs = [];
    ui.freeArea = null;
    if (state.free != null) {
      const ta = h('textarea', { id: `free-${ui.page}`, rows: '3', class: 'en', lang: 'en', spellcheck: 'false', 'aria-label': '내 문장 직접 고쳐 쓰기' });
      ta.value = state.free;
      ta.addEventListener('input', () => { state.free = ta.value; updatePreview(); queueSave(); });
      ta.addEventListener('focus', () => { renderTarget(); });
      ui.freeArea = ta;
      fill(frameBox, h('div', { class: 'stack' },
        h('div', { class: 'row' },
          h('span', { class: 'sub-h' }, '직접 고쳐 쓰는 중'),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn small', type: 'button', onclick: () => { state.free = null; renderFrame(); queueSave(); } }, '빈칸 문장으로 돌아가기')),
        ta,
        h('p', { class: 'small muted' }, '___ 자리는 내 말로 바꿔요. 모르는 낱말은 옆에서 찾아 넣어요.')));
      updatePreview();
      renderTarget();
      return;
    }

    const frame = currentFrame();
    const { texts, hints } = parseFrame(frame, state.gender);
    state.blanks = state.blanks.slice(0, hints.length);
    const line = h('p', { class: 'frame-line', lang: 'en' });
    // 빈칸 바로 뒤의 문장부호(. , ! ?)는 빈칸과 같은 줄에 붙여 둔다.
    let carry = '';
    texts.forEach((t0, i) => {
      let t = t0;
      if (carry) t = t.slice(carry.length);
      carry = '';
      line.append(t);
      if (i >= hints.length) return;
      const next = texts[i + 1] || '';
      carry = (next.match(/^[.,!?"'…)]+/) || [''])[0];
      const input = h('input', {
        type: 'text', class: 'blank', id: `blank-${ui.page}-${i}`, autocomplete: 'off', spellcheck: 'false',
        placeholder: hints[i] || '빈칸', 'aria-label': `${i + 1}번째 빈칸: ${hints[i] || ''}`,
      });
      input.value = state.blanks[i] || '';
      const fit = () => {
        input.style.width = `${Math.max(7, (input.value || input.placeholder).length + 2)}ch`;
        input.classList.toggle('filled', !!input.value.trim());
      };
      input.addEventListener('input', () => { state.blanks[i] = input.value; fit(); updatePreview(); queueSave(); });
      input.addEventListener('focus', () => { target = i; renderTarget(); });
      fit();
      ui.inputs.push(input);
      line.append(carry ? h('span', { class: 'nb' }, input, carry) : input);
    });

    fill(frameBox, h('div', { class: 'stack' },
      h('div', { class: 'row' },
        h('div', { class: 'levels', role: 'group', 'aria-label': '문장 고르기' },
          LEVELS.map(([lv, label]) => h('button', {
            type: 'button', 'aria-pressed': String(state.level === lv),
            onclick: () => { state.level = lv; target = 0; renderFrame(); queueSave(); },
          }, h('span', { class: 'stars', 'aria-hidden': 'true' }, '★'.repeat(+lv)), label))),
        hasGender(frame) ? h('div', { class: 'seg', role: 'group', 'aria-label': '그 사람은' },
          [['he', 'He 남자'], ['she', 'She 여자']].map(([g, label]) => h('button', {
            type: 'button', 'aria-pressed': String(state.gender === g),
            onclick: () => { state.gender = g; renderFrame(); queueSave(); },
          }, label))) : null),
      line,
      h('div', { class: 'row' },
        h('button', { class: 'btn small', type: 'button', onclick: () => speak(applyGender(frame, state.gender)) }, icon('speaker', 16), '틀 듣기'),
        h('button', {
          class: 'btn small ghost', type: 'button',
          onclick: () => { state.free = currentSentence(); renderFrame(); queueSave(); ui.freeArea?.focus(); },
        }, '직접 고쳐 쓰기'))));
    updatePreview();
    renderTarget();
  }

  function updatePreview() {
    const s = currentSentence();
    fill(ui.preview, ...s.split(/(___)/).map((part) => (part === '___'
      ? h('span', { class: 'gap', 'aria-label': '빈칸' }, '___')
      : part)));
  }

  function renderTarget() {
    ui?.inputs.forEach((inp, i) => inp.classList.toggle('target', i === target));
    const note = finder.querySelector('.target-note');
    if (!note) return;
    if (tab !== 'page' || !ui) { note.textContent = '사진 칸에서는 낱말을 넣을 곳이 없어요.'; return; }
    if (state.free != null) { fill(note, '찾은 낱말은 ', h('b', null, '내 문장'), '에 들어가요.'); return; }
    const hint = ui.inputs[target]?.placeholder;
    fill(note, '찾은 낱말은 ', h('b', null, `${target + 1}번째 빈칸`), hint ? ` (${hint})` : '', '에 들어가요.');
  }

  function insertText(text) {
    if (tab !== 'page' || !ui) { toast('쪽을 먼저 골라요.'); return; }
    const clean = String(text).trim();
    if (state.free != null) {
      const ta = ui.freeArea;
      const v = ta.value;
      const i = v.indexOf('___');
      ta.value = i >= 0 ? v.slice(0, i) + clean + v.slice(i + 3) : (v.trim() ? `${v.trim()} ${clean}` : clean);
      ta.dispatchEvent(new Event('input'));
      ta.focus();
      return;
    }
    const inp = ui.inputs[target] || ui.inputs.find((x) => !x.value.trim()) || ui.inputs[0];
    if (!inp) { state.free = currentSentence() + ' ' + clean; renderFrame(); queueSave(); return; }
    inp.value = inp.value.trim() ? `${inp.value.trim()} ${clean}` : clean;
    inp.dispatchEvent(new Event('input'));
    inp.focus();
    toast(`‘${clean}’을(를) 넣었어요.`);
  }

  function renderTips() {
    if (!ui) return;
    const mine = tips.filter((t) => t.lesson === lesson && t.page === ui.page);
    fill(ui.tipBox, ...mine.slice(0, 3).map((t) => h('div', { class: 'tip' },
      h('div', { class: 'from' }, `선생님 카드 · 이렇게도 말해요 · ${ago(t.at)}`),
      h('div', { class: 'row' }, h('span', { class: 'en' }, t.text), speakButtons(t.text),
        h('button', {
          class: 'btn small', type: 'button',
          onclick: () => { state.free = t.text; renderFrame(); queueSave(); },
        }, '이 문장으로 쓰기')))));
  }

  // ---------- 낱말 찾기 ----------
  let lastQuery = '';
  let browseGroup = null;
  const qInput = h('input', { type: 'text', id: 'word-search', placeholder: '낱말이나 하고 싶은 말: 바닷가, 가족이 생각나', autocomplete: 'off', 'aria-label': '낱말 찾기' });
  const results = h('div', { class: 'stack' });

  function wordCard(w) {
    const pastFirst = lesson === 5 && w.past;
    const variants = w.en.split(' / ');
    const forms = w.past ? (pastFirst ? [[w.past, '지난 일'], [w.en, '지금·늘']] : [[w.en, ''], [w.past, '지난 일']]) : variants.map((v) => [v, '']);
    return h('div', { class: 'word' + (w.fromTeacher ? ' teacher' : '') },
      h('span', { class: 'en', lang: 'en' }, h('span', { class: 'marker' }, pastFirst ? w.past : w.en)),
      speakButtons(pastFirst ? w.past : variants[0], { slow: false }),
      h('span', { class: 'ko' }, w.fromTeacher ? `선생님이 알려준 말 · ${w.ko}` : `${w.ko}${w.past ? ` · 지난 일은 ${w.past}` : ''}`),
      h('div', { class: 'acts' }, forms.map(([f, label]) => h('button', {
        class: 'btn small primary', type: 'button', onclick: () => insertText(f),
      }, icon('plus', 14), h('span', { class: 'en' }, f), label ? h('span', { class: 'small' }, label) : null))));
  }

  function showResults(q) {
    const { words, phrases } = search(q, { lesson, notices });
    const teacherWords = phrases.filter((p) => p.fromTeacher).map((p) => ({ ...p, past: null }));
    const otherPhrases = phrases.filter((p) => !p.fromTeacher);
    const allWords = [...teacherWords, ...words];
    const found = allWords.length + otherPhrases.length > 0;
    // "음식", "동물"처럼 묶음 이름으로 찾으면 그 묶음을 통째로 볼 수 있게 한다.
    const groupHit = WORD_GROUPS.find((g) => g.split('·').some((part) => norm(part) === norm(q)));
    // 띄어 쓴 말("가족이 생각나")은 문장으로 말하고 싶은 것이라, 번역기 카드를 맨 위에 둔다.
    const sentenceLike = /\s/.test(q.trim()) || q.trim().length >= 6;
    const trTop = sentenceLike || !found;
    fill(results, 
      h('div', { class: 'row' },
        h('span', { class: 'sub-h' }, `‘${q}’`),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => { lastQuery = ''; qInput.value = ''; renderResults(); } }, icon('close', 14), '지우기')),
      found ? null : h('div', { class: 'banner' },
        '아직 사전에 없는 말이에요. 선생님 화면에 전해졌어요. 책에는 ', h('b', null, `★${q}`), ' 처럼 한글로 쓰고 넘어가요.'),
      trTop ? translateCard(q) : null,
      found ? null : h('span', { class: 'sub-h' }, '더 짧은 말로 찾거나, 묶음에서 골라 봐요'),
      found ? null : h('div', { class: 'groups' }, WORD_GROUPS.map((g) => h('button', { class: 'btn small', type: 'button', onclick: () => { lastQuery = ''; browseGroup = g; renderResults(); } }, g))),
      allWords.length ? h('div', { class: 'word-list' }, allWords.map(wordCard)) : null,
      groupHit ? h('button', { class: 'btn small', type: 'button', onclick: () => { lastQuery = ''; qInput.value = ''; browseGroup = groupHit; renderResults(); } },
        `‘${groupHit}’ 낱말 모두 보기 (${wordsInGroup(groupHit).length}개)`) : null,
      otherPhrases.length ? h('span', { class: 'sub-h' }, '이런 표현도 있어요') : null,
      otherPhrases.length ? h('div', { class: 'phrase-list' }, otherPhrases.map((p) => phraseCard(p, { onUse: insertText, youglish: !!cls?.youglish }))) : null,
      trTop ? null : translateCard(q));
  }

  // ---------- 문장으로 바꿔 보기(번역기) ----------
  function useSentence(en) {
    if (tab !== 'page' || !ui) { toast('쪽을 먼저 골라요.'); return; }
    state.free = en;
    renderFrame();
    queueSave();
    ui.freeArea?.focus();
    toast('내 문장에 넣었어요. 고치고 싶은 곳은 직접 고쳐요.');
  }
  // 바꾼 문장은 기억해 두어, 화면이 다시 그려져도 사라지지 않게 한다. (글 → 영어 문장, 실패하면 null)
  const translated = new Map();
  function translateCard(q) {
    const text = q.slice(0, MAX_LEN);
    const out = h('div', { class: 'stack', style: { gap: '8px' } });
    const builtIn = hasBuiltInTranslator();
    const log = (en) => store.logSearch(S.code, {
      uid: S.uid, nickname: S.nickname, lesson, page: tab === 'page' ? page : null, q: text, found: !!en, kind: 'translate', en: en || null,
    }).catch(() => {});
    const papago = () => h('a', { class: 'btn small', href: papagoUrl(text), target: '_blank', rel: 'noopener' }, '파파고에서 보기');
    function showResult(en) {
      if (en === null) {
        fill(out, h('p', { class: 'small muted' }, '이 브라우저에서는 바로 바꿀 수 없어요. 파파고로 열어 봐요.'), papago());
        return;
      }
      fill(out, h('div', { class: 'phrase' },
        h('div', { class: 'say' }, h('div', { class: 'native en', lang: 'en' }, h('span', { class: 'marker' }, en)), speakButtons(en)),
        h('div', { class: 'ko' }, text),
        h('div', { class: 'row' },
          h('button', { class: 'btn small primary', type: 'button', onclick: () => useSentence(en) }, icon('plus', 16), '이 문장으로 쓰기'),
          h('button', { class: 'btn small', type: 'button', onclick: () => insertText(en.replace(/[.!?]+$/, '')) }, '빈칸에 넣기'),
          papago()),
        h('p', { class: 'small muted' }, '번역기가 바꾼 문장이라 조금 어색할 수 있어요. 선생님 화면에도 보여서, 선생님이 더 좋은 말을 보내 줄 수도 있어요.')));
    }
    const go = h('button', {
      class: 'btn small primary', type: 'button',
      onclick: async () => {
        if (!builtIn) { window.open(papagoUrl(text), '_blank', 'noopener'); log(null); return; }
        go.disabled = true;
        fill(out, h('p', { class: 'small muted', role: 'status' }, '바꾸는 중이에요… 처음 한 번은 번역기를 준비하느라 조금 걸려요.'));
        let en = null;
        try {
          en = await translateKoEn(text, {
            onProgress: (p) => fill(out, h('p', { class: 'small muted', role: 'status' }, `번역기 준비 중 ${Math.round(p * 100)}%`)),
          }) || null;
        } catch { en = null; }
        go.disabled = false;
        translated.set(text, en);
        showResult(en);
        log(en);
      },
    }, builtIn ? '번역기로 영어 문장 보기' : '파파고로 영어 문장 보기');
    if (translated.has(text)) showResult(translated.get(text));
    return h('div', { class: 'card translate-card stack' },
      h('div', { class: 'row' }, h('b', null, '문장으로 말하고 싶을 때'), h('span', { class: 'spacer' }), go),
      h('p', { class: 'small muted' }, builtIn
        ? `‘${text}’을(를) 이 노트북 안에서 바로 영어 문장으로 바꿔요.`
        : `‘${text}’을(를) 파파고 새 창에서 영어로 바꿔요. 크롬이나 엣지 최신판에서는 이 화면에서 바로 바뀌어요.`),
      out);
  }

  function renderResults() {
    if (lastQuery) { showResults(lastQuery); return; }
    if (browseGroup) {
      fill(results, 
        h('div', { class: 'row' },
          h('span', { class: 'sub-h' }, browseGroup),
          h('span', { class: 'spacer' }),
          h('button', { class: 'btn small ghost', type: 'button', onclick: () => { browseGroup = null; renderResults(); } }, icon('left', 14), '묶음 고르기')),
        h('div', { class: 'word-list' }, wordsInGroup(browseGroup).map(wordCard)));
      return;
    }
    fill(results, 
      h('span', { class: 'sub-h' }, '뭘 찾을지 모르겠으면 묶음에서 골라요'),
      h('div', { class: 'groups' }, WORD_GROUPS.map((g) => h('button', { class: 'btn small', type: 'button', onclick: () => { browseGroup = g; renderResults(); } }, g))),
      h('span', { class: 'sub-h' }, `${lesson}차시 오늘의 덩어리`),
      h('div', { class: 'stack', style: { gap: '6px' } }, bookData().chunks.map((c) => h('div', { class: 'row' },
        h('span', { class: 'en marker' }, c), speakButtons(c, { slow: false })))));
  }

  function renderFinder() {
    fill(finder, 
      h('h2', null, '낱말·문장 찾기'),
      h('form', {
        role: 'search',
        onsubmit: (e) => {
          e.preventDefault();
          const q = qInput.value.trim();
          if (!q) return;
          lastQuery = q;
          browseGroup = null;
          const r = search(q, { lesson, notices });
          const found = r.words.length + r.phrases.length > 0;
          store.logSearch(S.code, { uid: S.uid, nickname: S.nickname, lesson, page: tab === 'page' ? page : null, q, found }).catch(() => {});
          renderResults();
        },
      }, qInput, h('button', { class: 'btn primary', type: 'submit' }, icon('search', 16), '찾기')),
      h('p', { class: 'target-note' }),
      results);
    renderTarget();
    renderResults();
  }

  // ---------- 사진 ----------
  let photoCleanup = null;
  function renderPhoto() {
    photoCleanup?.(); photoCleanup = null;
    ui = null;
    const mine = myPhotos.find((p) => p.lesson === lesson);
    const preview = h('div', { class: 'stack' });
    let pending = null;
    let closeCam = null;

    const fileIn = h('input', { type: 'file', id: 'photo-file', accept: 'image/*', hidden: true });
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files?.[0];
      if (!f) return;
      try { pending = await compressFile(f); showPending(); }
      catch { toast('사진 파일만 올릴 수 있어요.'); }
    });
    function showPending() {
      closeCam?.(); closeCam = null;
      fill(preview, 
        h('img', { class: 'photo-preview', src: pending.dataUrl, alt: '올릴 책 사진 미리보기' }),
        h('p', { class: 'small muted' }, `줄인 크기 ${Math.round(pending.bytes / 1024)}KB`),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', type: 'button', onclick: upload }, '선생님에게 올리기'),
          h('button', { class: 'btn', type: 'button', onclick: () => { pending = null; fill(preview); } }, '다시 찍기')));
    }
    async function upload() {
      try {
        await store.addPhoto(S.code, { uid: S.uid, nickname: S.nickname, lesson, dataUrl: pending.dataUrl });
        toast('올렸어요!');
        pending = null;
        fill(preview);
      } catch (err) {
        toast(err.message === 'storage-full' ? '체험 모드에서는 사진을 몇 장만 저장할 수 있어요.' : '올리지 못했어요. 다시 눌러 주세요.');
      }
    }
    async function camera() {
      const video = h('video', { class: 'photo-preview', playsinline: true, muted: true });
      fill(preview, video, h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: () => { pending = snapshot(video); showPending(); } }, icon('camera', 18), '찰칵'),
        h('button', { class: 'btn', type: 'button', onclick: () => { closeCam?.(); closeCam = null; fill(preview); } }, '닫기')));
      try { closeCam = await openCamera(video); }
      catch { fill(preview, h('p', { class: 'banner' }, '카메라를 쓸 수 없어요. 휴대폰으로 찍은 사진 파일을 골라 올려도 돼요.')); }
    }
    fill(writeCol, h('section', { class: 'card photo-area' },
      h('h2', null, '완성한 책 사진 올리기'),
      h('ol', { class: 'stack', style: { paddingLeft: '20px', margin: '0', gap: '4px' } },
        h('li', null, '책을 활짝 펼쳐서 8쪽이 한 면에 다 보이게 놓아요.'),
        h('li', null, '책만 찍어요. 얼굴은 나오지 않게 해요.'),
        h('li', null, '선생님만 볼 수 있어요.')),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'button', onclick: camera }, icon('camera', 18), '노트북 카메라로 찍기'),
        h('label', { class: 'btn', for: 'photo-file' }, '사진 파일 고르기'),
        fileIn),
      preview,
      mine ? h('div', { class: 'stack' },
        h('p', { class: 'muted small' }, `올린 사진 · ${ago(mine.at)}`),
        h('img', { class: 'photo-preview', src: mine.dataUrl, alt: '내가 올린 책 사진' })) : null));
    renderTarget();
    photoCleanup = () => closeCam?.();
  }

  function renderAll() {
    const b = bookData();
    fill(title, `${b.lesson}차시 · `, h('span', { class: 'en' }, b.title));
    if (!book) {
      book = createBook({ lesson, mode: 'student', page, onPickPage: goPage });
      fill(bookSlot, book.el);
    } else {
      book.setLesson(lesson);
      book.setPage(page);
    }
    renderTabs();
    renderWrite();
  }

  function leave() {
    flushSave();
    // 링크(?n=7)로 들어왔으면 주소에서 번호를 지워, 처음 화면에서 다른 번호를 고를 수 있게 한다.
    if (location.search) history.replaceState(null, '', location.pathname);
    app.setSession(null);
    app.go('home');
  }

  // ---------- 실시간 ----------
  unsubs.push(store.watchClass(S.code, (c) => {
    if (!c) { fill(writeCol, h('p', { class: 'banner' }, '반을 찾을 수 없어요. 선생님께 알려 주세요.')); return; }
    const prevYg = cls?.youglish;
    cls = c;
    if (c.lesson !== lesson) {
      flushSave();
      lesson = c.lesson;
      page = 1;
      tab = 'page';
      lastSpread = null;
      renderAll();
    } else if (prevYg !== c.youglish) {
      renderResults();
    }
    // 같이 보기: 선생님이 넘긴 장으로 내 화면의 선생님 책을 맞춘다.
    followNote.hidden = !c.follow;
    if (!c.follow) lastSpread = null;
    else if (c.spread !== lastSpread) { lastSpread = c.spread; book?.setSpread(c.spread); }
  }));
  unsubs.push(store.watchMyEntries(S.code, S.uid, (list) => {
    myEntries = Object.fromEntries(list.map((e) => [`${e.uid}_${e.lesson}_${e.page}`, e]));
    if (lesson) renderTabs();
  }));
  unsubs.push(store.watchMyTips(S.code, S.uid, (list) => {
    const isNew = list.length > tips.length && tips.length > 0;
    tips = list;
    renderTips();
    if (isNew) toast('선생님 카드가 왔어요!');
  }));
  unsubs.push(store.watchNotices(S.code, (list) => {
    notices = list;
    renderNotices();
    if (lastQuery && lesson) renderResults();
  }));
  unsubs.push(store.watchMyPhotos(S.code, S.uid, (list) => {
    myPhotos = list;
    if (tab === 'photo') renderWrite();
  }));

  const onHide = () => flushSave();
  window.addEventListener('pagehide', onHide);

  return () => {
    flushSave();
    photoCleanup?.();
    book?.destroy();
    window.removeEventListener('pagehide', onHide);
    unsubs.forEach((u) => u?.());
  };
}
