import books from '../data/books.json';
import { h, icon, toast, ago, fill } from '../lib/dom.js';
import { speak, speakAll, stop } from '../lib/tts.js';
import { norm } from '../lib/search.js';
import { createBook } from './ebook.js';
import { speakButtons, brandMark } from './parts.js';
import { SEATS, seatLink } from '../config.js';

const TABS = [
  ['board', '관전판'],
  ['links', '학생 링크'],
  ['wall', '문장 벽'],
  ['photos', '사진'],
  ['ebook', '모델 책'],
  ['chunks', '오늘의 덩어리'],
  ['settings', '설정'],
];
const STUCK_MS = 3 * 60 * 1000;
const byName = (a, b) => String(a).localeCompare(String(b), 'ko', { numeric: true });

export function renderTeacher(app) {
  const { store } = app;
  const S = app.session;
  if (!S || S.role !== 'teacher') { app.go('home'); return null; }
  const code = S.code;
  const demo = store.mode === 'demo';

  const unsubs = [];
  let cls = null;
  let students = [];
  let entries = [];
  let searches = [];
  let notices = [];
  let photos = [];
  let tab = 'board';
  let sel = null; // { seat, page }
  let ebook = null;
  let stopWall = null;
  let chunkIndex = 0;
  const drafts = {}; // 못 찾은 말에 쓰던 답

  const root = h('div');
  app.mount(root);

  // ---------- 머리 ----------
  const nameEl = h('h1');
  const lessonSel = h('select', { id: 'lesson-select', 'aria-label': '오늘의 차시', style: { width: 'auto' } },
    books.map((b) => h('option', { value: b.lesson }, `${b.lesson}차시 · ${b.title}`)));
  lessonSel.addEventListener('change', () => store.updateClass(code, { lesson: +lessonSel.value, ...(cls?.follow ? { spread: 0 } : {}) }));
  const head = h('div', { class: 'teacher-head' },
    brandMark(30, false),
    h('div', { class: 'stack', style: { gap: '0', minWidth: '0' } }, h('span', { class: 'muted small' }, 'Say It Your Way · 선생님'), nameEl),
    h('label', { class: 'row', for: 'lesson-select' }, h('span', { class: 'muted small' }, '오늘의 책'), lessonSel),
    h('span', { class: 'spacer' }),
    h('button', { class: 'btn small ghost', type: 'button', onclick: () => { app.setSession(null); app.go('home'); } }, '나가기'));
  const tabsEl = h('div', { class: 'tabs', role: 'tablist' });
  const content = h('div');
  root.append(head, tabsEl, content);

  function renderTabs() {
    const waiting = missGroups().length;
    fill(tabsEl, ...TABS.map(([k, label]) => h('button', {
      class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(tab === k),
      onclick: () => { if (tab !== k) { tab = k; renderTabs(); renderContent(); } },
    }, label, k === 'board' && waiting ? h('span', { class: 'dot', 'aria-label': '못 찾은 말 있음' }) : null)));
  }

  const lesson = () => cls?.lesson || 2;
  const book = () => books.find((b) => b.lesson === lesson()) || books[0];
  // 번호 칸: 아이(uid)마다 번호가 있다. 한 번호로 두 곳에서 들어오면 같은 줄에 모아 가장 최근 것을 보여 준다.
  const SEAT_LIST = Array.from({ length: SEATS }, (_, i) => i + 1);
  const seatNum = (x) => x?.seat || parseInt(x?.nickname, 10) || null;
  const seatByUid = () => {
    const m = new Map();
    for (const s of students) if (seatNum(s)) m.set(s.uid, seatNum(s));
    for (const e of entries) if (!m.has(e.uid) && seatNum(e)) m.set(e.uid, seatNum(e));
    return m;
  };
  const uidsOf = (seat) => [...seatByUid()].filter(([, n]) => n === seat).map(([u]) => u);
  const joinedSeats = () => new Set(seatByUid().values());
  const latestUid = (seat) => {
    const uids = uidsOf(seat);
    const joined = students.filter((s) => uids.includes(s.uid)).sort((a, b) => (b.joinedAt || 0) - (a.joinedAt || 0));
    return joined[0]?.uid || uids[0] || null;
  };
  const stateOf = (e) => {
    if (!e?.en) return 'empty';
    if (e.en.includes('___')) return (e.filled ?? (e.ko ? 1 : 0)) ? 'part' : 'empty';
    return 'done';
  };
  const withGaps = (text) => String(text).split(/(___)/).map((p) => (p === '___' ? h('span', { class: 'gap', 'aria-label': '빈칸' }) : p));
  const entryAt = (seat, page) => {
    const uids = uidsOf(seat);
    return entries.filter((e) => uids.includes(e.uid) && e.lesson === lesson() && e.page === page)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  };

  function missGroups() {
    const answered = new Set(notices.map((n) => norm(n.q)));
    const groups = new Map();
    for (const s of searches) {
      if (s.found) continue;
      const k = norm(s.q);
      if (!k || answered.has(k)) continue;
      const g = groups.get(k) || { key: k, q: s.q, who: new Set(), count: 0, at: 0 };
      g.count++;
      g.who.add(s.nickname);
      g.at = Math.max(g.at, s.at || 0);
      groups.set(k, g);
    }
    return [...groups.values()].sort((a, b) => b.count - a.count || b.at - a.at);
  }

  // ---------- 관전판 ----------
  const boardWrap = h('div', { class: 'board-wrap' });
  const detail = h('div', { class: 'card detail stack' });
  const tipIn = h('textarea', { id: 'tip-text', rows: '2', class: 'en', lang: 'en', placeholder: 'Try: She looks small, but she is super strong!', 'aria-label': '이렇게도 말해요 카드 문장' });
  const detailInfo = h('div', { class: 'stack' });
  const detailForm = h('form', {
    class: 'stack',
    onsubmit: async (e) => {
      e.preventDefault();
      const text = tipIn.value.trim();
      const to = sel && (entryAt(sel.seat, sel.page)?.uid || latestUid(sel.seat));
      if (!to || !text) return;
      try {
        await store.sendTip(code, { uid: to, lesson: lesson(), page: sel.page, text });
        tipIn.value = '';
        toast('카드를 보냈어요.');
      } catch { toast('보내지 못했어요. 다시 눌러 주세요.'); }
    },
  },
  h('label', { class: 'field', for: 'tip-text' }, '“이렇게도 말해요” 카드', tipIn),
  h('div', { class: 'row' },
    h('button', { class: 'btn primary', type: 'submit' }, '이 아이에게 보내기'),
    h('button', { class: 'btn small', type: 'button', onclick: () => tipIn.value && speak(tipIn.value) }, icon('speaker', 16), '들어보기')));
  detail.append(detailInfo, detailForm);

  const summary = h('div', { class: 'summary' });
  const feedCard = h('div', { class: 'card' });
  const missCard = h('div', { class: 'card' });
  let missSig = '';

  function renderSummary() {
    const joined = joinedSeats().size;
    let done = 0;
    for (const n of SEAT_LIST) for (let p = 1; p <= 6; p++) if (stateOf(entryAt(n, p)) === 'done') done++;
    const misses = missGroups().length;
    fill(summary, 
      h('span', { class: 'chip' }, `들어온 학생 ${joined} / ${SEATS}명`),
      h('span', { class: 'chip good' }, `다 쓴 쪽 ${done} / ${SEATS * 6}`),
      h('span', { class: misses ? 'chip warn' : 'chip' }, `못 찾은 말 ${misses}개`),
      demo ? h('span', { class: 'chip' }, '체험 모드') : null);
  }

  function renderBoard() {
    const now = Date.now();
    const joined = joinedSeats();
    fill(boardWrap, h('table', { class: 'board' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, '학생'), [1, 2, 3, 4, 5, 6].map((p) => h('th', { scope: 'col' }, `${p}쪽`)))),
      h('tbody', null, SEAT_LIST.map((n) => h('tr', { class: joined.has(n) ? '' : 'away' },
        h('td', { class: 'name' }, `${n}번`,
          joined.has(n) ? null : h('div', { class: 'small muted' }, '아직'),
          uidsOf(n).length > 1 ? h('div', null, h('span', { class: 'chip', title: '같은 번호로 두 곳 이상에서 들어왔어요' }, '두 곳')) : null),
        [1, 2, 3, 4, 5, 6].map((p) => {
          const e = entryAt(n, p);
          const state = stateOf(e);
          const stuck = state === 'part' && now - (e.updatedAt || now) > STUCK_MS;
          const isSel = sel && sel.seat === n && sel.page === p;
          return h('td', {
            class: `cell state-${state}${isSel ? ' sel' : ''}`, tabindex: '0',
            'aria-label': `${n}번 ${p}쪽`,
            onclick: () => select(n, p),
            onkeydown: (ev) => { if (ev.key === 'Enter') select(n, p); },
          },
          state === 'empty' ? h('span', { class: 'empty' }, '·') : null,
          state !== 'empty' ? h('div', { class: 'en' }, withGaps(e.en)) : null,
          (stuck || e?.shared) ? h('div', { class: 'meta' },
            stuck ? h('span', { class: 'chip warn' }, '막힘?') : null,
            e?.shared ? h('span', { class: 'chip good' }, '문장 벽') : null) : null);
        }))))));
  }

  function select(seat, page) {
    sel = { seat, page };
    renderBoard();
    renderDetail();
    if (window.matchMedia('(max-width: 1000px)').matches) detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderDetail() {
    if (!sel) {
      fill(detailInfo, h('h3', null, '칸을 누르면 여기에 자세히 보여요'), h('p', { class: 'muted small' }, '아이가 쓰는 문장과 찾아본 말을 보고, 그 아이에게만 “이렇게도 말해요” 카드를 보낼 수 있어요.'));
      detailForm.hidden = true;
      return;
    }
    const uids = uidsOf(sel.seat);
    detailForm.hidden = !uids.length;
    const e = entryAt(sel.seat, sel.page);
    const q = book().pages[sel.page - 1].q;
    fill(detailInfo, 
      h('div', { class: 'row' }, h('h3', null, `${sel.seat}번 · ${sel.page}쪽`), h('span', { class: 'spacer' }), e?.updatedAt ? h('span', { class: 'small muted' }, ago(e.updatedAt)) : null),
      h('p', { class: 'small muted' }, `생각 질문: ${q}`),
      h('div', null, h('div', { class: 'small muted' }, e?.free != null ? '문장 · 직접 고쳐 씀' : `문장 · ${({ 1: '★ 쉽게', 2: '★★ 선생님 책처럼', 3: '★★★ 도전' })[e?.level || '2']}`),
        stateOf(e) !== 'empty' ? h('div', { class: 'row' }, h('p', { class: 'en', style: { flex: '1', minWidth: '0' } }, withGaps(e.en)), speakButtons(e.en.replace(/___/g, ''))) : h('p', null, uids.length ? '아직 없어요' : '아직 이 번호로 들어온 아이가 없어요')),
      (() => {
        const mine = searches.filter((x) => uids.includes(x.uid) && x.lesson === lesson()).slice(0, 8);
        return h('div', null, h('div', { class: 'small muted' }, '이 아이가 찾은 말'),
          mine.length ? h('div', { class: 'row' }, mine.map((x) => h('span', { class: x.found ? 'chip good' : 'chip warn' }, x.q))) : h('p', { class: 'small muted' }, '아직 없어요'));
      })(),
      stateOf(e) === 'done' ? h('button', {
        class: 'btn small', type: 'button', 'aria-pressed': String(!!e.shared),
        onclick: () => store.setShared(code, e.id, !e.shared).catch(() => toast('바꾸지 못했어요.')),
      }, e.shared ? '문장 벽에서 내리기' : '문장 벽에 올리기') : null);
  }

  function renderFeed() {
    const recent = searches.slice(0, 40);
    fill(feedCard, 
      h('h3', null, '검색 흐름'),
      recent.length
        ? h('div', { class: 'feed' }, recent.map((s) => h('div', { class: 'feed-item' },
          h('span', { class: 'who' }, s.nickname),
          h('span', { class: 'q' }, s.q, ' ', s.found ? h('span', { class: 'chip good' }, '찾음') : h('span', { class: 'chip warn' }, '못 찾음')),
          h('span', { class: 't' }, ago(s.at)))))
        : h('p', { class: 'muted small' }, '아이들이 ‘말 찾기’에서 검색하면 여기에 바로 보여요.'));
  }

  function renderMisses(force = false) {
    const groups = missGroups();
    const sig = groups.map((g) => `${g.key}:${g.count}`).join('|');
    if (!force && sig === missSig && missCard.childElementCount) return;
    missSig = sig;
    const focusedId = document.activeElement?.id;
    queueMicrotask(() => {
      if (!focusedId?.startsWith('miss-')) return;
      const el = document.getElementById(focusedId);
      if (el) { el.focus(); el.setSelectionRange?.(el.value.length, el.value.length); }
    });
    fill(missCard, 
      h('h3', null, '못 찾은 말'),
      h('p', { class: 'small muted' }, '영어로 한 번 답하면 반 전체 화면에 “선생님이 알려준 말”로 뜨고, 검색에도 잡혀요.'),
      groups.length ? h('div', { class: 'stack' }, groups.map((g) => {
        const input = h('input', { type: 'text', class: 'en', lang: 'en', id: `miss-${g.key}`, placeholder: 'English', 'aria-label': `${g.q} 영어로`, value: drafts[g.key] || '' });
        input.addEventListener('input', () => { drafts[g.key] = input.value; });
        return h('form', {
          class: 'miss',
          onsubmit: async (e) => {
            e.preventDefault();
            const en = input.value.trim();
            if (!en) return;
            try { await store.answerMiss(code, g.q, en); delete drafts[g.key]; toast('반 전체에 알려줬어요.'); }
            catch { toast('보내지 못했어요.'); }
          },
        },
        h('div', { class: 'row' }, h('span', { class: 'q' }, `★${g.q}`), h('span', { class: 'chip' }, `${g.count}번`), h('span', { class: 'small muted' }, [...g.who].slice(0, 4).join(', '))),
        h('div', { class: 'row', style: { flexWrap: 'nowrap' } }, input, h('button', { class: 'btn small primary', type: 'submit' }, '알려주기')));
      })) : h('p', { class: 'muted small' }, '아직 없어요.'),
      notices.length ? h('details', null,
        h('summary', { class: 'small' }, `알려준 말 ${notices.length}개`),
        h('div', { class: 'stack', style: { marginTop: '8px' } }, notices.map((n) => h('div', { class: 'row small' }, h('span', null, `★${n.q}`), h('span', { class: 'en' }, n.en))))) : null);
  }

  function boardView() {
    renderSummary(); renderBoard(); renderDetail(); renderFeed(); renderMisses(true);
    return h('div', null,
      summary,
      h('div', { class: 'board-layout' },
        h('div', { class: 'stack', style: { gap: '16px', minWidth: '0' } },
          boardWrap,
          h('p', { class: 'small muted' }, '살구색 칸은 빈칸을 채우는 중, 초록 칸은 다 쓴 칸이에요. 점선은 아직 비어 있는 빈칸이에요. ‘막힘?’은 3분 넘게 빈칸이 그대로인 칸이에요.'),
          detail),
        h('div', { class: 'side' }, missCard, feedCard)));
  }

  // ---------- 학생 링크 ----------
  async function copyText(text, done) {
    try { await navigator.clipboard.writeText(text); toast(done); }
    catch { toast('복사하지 못했어요. 링크를 길게 눌러 복사해 주세요.'); }
  }
  function linksView() {
    const joined = joinedSeats();
    const all = SEAT_LIST.map((n) => `${n}번: ${seatLink(n)}`).join('\n');
    return h('div', { class: 'stack' },
      h('div', { class: 'row' },
        h('h2', null, '학생 링크'),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn primary', type: 'button', onclick: () => copyText(all, `${SEATS}개를 모두 복사했어요.`) }, `${SEATS}개 모두 복사`)),
      h('p', { class: 'muted small' }, '아이마다 자기 번호 링크를 보내 주세요. 누르면 로그인 없이 바로 그 번호 화면이 열려요. 링크를 아는 사람은 누구나 들어올 수 있으니 우리 반 아이들에게만 보내요.'),
      h('div', { class: 'card links' }, SEAT_LIST.map((n) => h('div', { class: 'link-row' },
        h('b', { class: 'seat-no' }, `${n}번`),
        h('a', { class: 'url', href: seatLink(n), target: '_blank', rel: 'noopener' }, seatLink(n)),
        joined.has(n) ? h('span', { class: 'chip good' }, '들어옴') : null,
        h('button', { class: 'btn small', type: 'button', onclick: () => copyText(seatLink(n), `${n}번 링크를 복사했어요.`) }, '복사')))));
  }

  // ---------- 문장 벽 ----------
  function wallView() {
    const list = entries.filter((e) => e.shared && e.lesson === lesson())
      .sort((a, b) => (seatNum(a) || 99) - (seatNum(b) || 99) || byName(a.nickname, b.nickname) || a.page - b.page);
    const cards = list.map((e) => h('div', { class: 'card wall-card' },
      h('div', { class: 'row small muted' }, h('span', null, `${e.nickname} · ${e.page}쪽`)),
      h('p', { class: 'en' }, e.en),
      h('div', { class: 'row' }, speakButtons(e.en),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn small ghost', type: 'button', onclick: () => store.setShared(code, e.id, false) }, '내리기'))));
    const playAll = h('button', {
      class: 'btn primary', type: 'button', disabled: !list.length,
      onclick: () => {
        stopWall?.();
        stopWall = speakAll(list.map((e) => e.en), {
          onitem: (i) => cards.forEach((c, j) => c.classList.toggle('now', i === j)),
          ondone: () => cards.forEach((c) => c.classList.remove('now')),
        });
      },
    }, icon('speaker', 18), '차례로 모두 듣기');
    return h('div', { class: 'stack' },
      h('div', { class: 'row' },
        h('h2', null, `${lesson()}차시 문장 벽`),
        h('span', { class: 'spacer' }),
        playAll,
        h('button', { class: 'btn', type: 'button', onclick: () => { stopWall?.(); stop(); cards.forEach((c) => c.classList.remove('now')); } }, '멈추기')),
      h('p', { class: 'muted small' }, '화면 공유로 보여 주세요. 마이크를 켜지 않아도 앱이 대신 읽어 줘요. 관전판에서 칸을 눌러 ‘문장 벽에 올리기’를 하면 여기에 생겨요.'),
      list.length ? h('div', { class: 'wall' }, cards) : h('div', { class: 'card empty-state' }, h('h3', null, '아직 올린 문장이 없어요'), h('p', null, '관전판에서 좋은 문장을 골라 올려 보세요.')));
  }

  // ---------- 사진 ----------
  function photosView() {
    const list = photos.filter((p) => p.lesson === lesson());
    const open = (p) => {
      const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': `${p.nickname} 책 사진`, onclick: () => box.remove() },
        h('img', { src: p.dataUrl, alt: `${p.nickname}의 책 사진` }));
      document.body.append(box);
    };
    return h('div', { class: 'stack' },
      h('h2', null, `${lesson()}차시 책 사진`),
      list.length
        ? h('div', { class: 'photos' }, list.map((p) => h('div', { class: 'card photo-card' },
          h('img', { src: p.dataUrl, alt: `${p.nickname}의 책 사진`, onclick: () => open(p) }),
          h('div', { class: 'row small' }, h('b', null, p.nickname), h('span', { class: 'muted' }, ago(p.at))))))
        : h('div', { class: 'card empty-state' }, h('h3', null, '아직 올라온 사진이 없어요'), h('p', null, '아이들이 학생 화면의 ‘사진’ 칸에서 책을 펼쳐 찍어 올리면 여기에 모여요.')));
  }

  // ---------- 모델 책: 아이들 책도 같이 넘기기 ----------
  function followBar() {
    const on = !!cls?.follow;
    return h('div', { class: 'card follow-bar' + (on ? ' on' : '') },
      h('button', {
        class: on ? 'btn' : 'btn primary', type: 'button', 'aria-pressed': String(on),
        onclick: () => store.updateClass(code, on ? { follow: false } : { follow: true, spread: ebook?.spread() ?? 0 })
          .catch(() => toast('바꾸지 못했어요. 다시 눌러 주세요.')),
      }, on ? '같이 넘기는 중 · 끄기' : '아이들 책도 같이 넘기기'),
      h('span', { class: 'small muted' }, on
        ? '선생님이 장을 넘기면 아이들 화면의 선생님 책도 같은 장으로 넘어가요. 아이들도 혼자 넘겨 볼 수 있고, 선생님이 다음 장을 넘기면 다시 맞춰져요.'
        : '켜면 선생님이 넘기는 대로 아이들 화면의 선생님 책도 같이 넘어가요. 책 읽어 주기를 할 때 켜고, 쓰기 시간에는 꺼 주세요.'));
  }

  // ---------- 오늘의 덩어리 ----------
  function chunksView() {
    const list = book().chunks;
    chunkIndex = Math.min(chunkIndex, list.length - 1);
    const c = list[chunkIndex];
    return h('div', { class: 'card chunks-stage' },
      h('span', { class: 'muted' }, `${lesson()}차시 오늘의 덩어리 ${chunkIndex + 1} / ${list.length}`),
      h('p', { class: 'en' }, h('span', { class: 'marker' }, c)),
      h('div', { class: 'row' },
        h('button', { class: 'btn icon', type: 'button', 'aria-label': '이전', disabled: chunkIndex === 0, onclick: () => { chunkIndex--; renderContent(); } }, icon('left')),
        h('button', { class: 'btn primary', type: 'button', onclick: () => speak(c) }, icon('speaker', 18), '듣기'),
        h('button', { class: 'btn', type: 'button', onclick: () => speak(c, { slow: true }) }, '느리게'),
        h('button', { class: 'btn icon', type: 'button', 'aria-label': '다음', disabled: chunkIndex === list.length - 1, onclick: () => { chunkIndex++; renderContent(); } }, icon('right'))),
      h('p', { class: 'small muted' }, '듣기 → 따라 말하기(마이크는 꺼도 돼요) → 내 말로 바꿔 채팅에 쓰기'));
  }

  // ---------- 설정 ----------
  function settingsView() {
    const confirmIn = h('input', { type: 'text', id: 'confirm-clear', placeholder: '지우기', 'aria-label': '지우려면 지우기라고 쓰기' });
    return h('div', { class: 'settings' },
      h('div', { class: 'card stack' },
        h('h3', null, '원어민 영상(유글리시)'),
        h('p', { class: 'small muted' }, '켜면 학생 화면의 표현 카드에 ‘원어민 영상’ 버튼이 생겨요. 제한 모드로 열지만 실제 유튜브 영상이라, 먼저 선생님 화면에서 몇 개 열어 보고 켜는 걸 권해요.'),
        h('button', {
          class: 'btn', type: 'button', 'aria-pressed': String(!!cls?.youglish),
          onclick: () => store.updateClass(code, { youglish: !cls?.youglish }),
        }, cls?.youglish ? '학생 버튼 끄기' : '학생 버튼 켜기')),
      h('div', { class: 'card stack' },
        h('h3', null, '학생 화면 열어 보기'),
        h('p', { class: 'small muted' }, demo
          ? '이 주소를 새 탭에서 한 번 더 열고 학생으로 들어가 보세요. 체험 모드는 같은 컴퓨터의 탭끼리 실시간으로 이어져요.'
          : '아이들은 ‘학생 링크’ 탭의 자기 번호 링크를 눌러 들어와요. 앱 주소로 들어오면 번호를 눌러 들어와요.')),
      demo ? h('div', { class: 'card stack' },
        h('h3', null, '예시 데이터'),
        h('p', { class: 'small muted' }, '“(예시)”가 붙은 학생과 문장은 체험용이에요.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => store.addExamples(code) }, '예시 다시 넣기'),
          h('button', { class: 'btn', type: 'button', onclick: () => store.removeExamples(code) }, '예시 지우기'))) : null,
      h('form', {
        class: 'card stack danger',
        onsubmit: async (e) => {
          e.preventDefault();
          if (confirmIn.value.trim() !== '지우기') { toast('확인 칸에 ‘지우기’라고 써 주세요.'); return; }
          try { await store.clearClass(code); sel = null; confirmIn.value = ''; toast('반의 기록을 모두 지웠어요.'); }
          catch { toast('지우지 못했어요. 다시 해 주세요.'); }
        },
      },
      h('h3', null, '학기 끝: 반 기록 모두 지우기'),
      h('p', { class: 'small muted' }, `아이들의 문장, 검색, 카드, 사진, 들어온 기록이 모두 지워져요. 1~${SEATS}번 칸과 학생 링크는 그대로예요. 되돌릴 수 없어요.`),
      h('label', { class: 'field', for: 'confirm-clear' }, '확인하려면 ‘지우기’라고 써요', confirmIn),
      h('button', { class: 'btn', type: 'submit' }, '반 기록 모두 지우기')));
  }

  function renderContent() {
    if (tab !== 'ebook' && ebook) { ebook.destroy(); ebook = null; }
    if (tab !== 'wall') { stopWall?.(); stopWall = null; }
    if (tab === 'board') fill(content, boardView());
    else if (tab === 'links') fill(content, linksView());
    else if (tab === 'wall') fill(content, wallView());
    else if (tab === 'photos') fill(content, photosView());
    else if (tab === 'ebook') {
      if (!ebook) {
        ebook = createBook({
          lesson: lesson(), mode: 'browse', pickLesson: false,
          onSpread: (n) => { if (cls?.follow) store.updateClass(code, { spread: n }).catch(() => {}); },
        });
      } else ebook.setLesson(lesson());
      fill(content, h('div', { class: 'stack' }, followBar(), ebook.el));
    } else if (tab === 'chunks') fill(content, chunksView());
    else fill(content, settingsView());
  }

  // 데이터가 바뀌면 지금 탭에서 필요한 부분만 다시 그린다.
  function refresh(kind) {
    renderTabs();
    if (tab === 'board') {
      if (kind === 'entries' || kind === 'students' || kind === 'class') { renderSummary(); renderBoard(); renderDetail(); }
      if (kind === 'searches' || kind === 'notices') { renderSummary(); renderFeed(); renderMisses(); if (sel) renderDetail(); }
    } else if (tab === 'links' && (kind === 'students' || kind === 'entries')) {
      fill(content, linksView());
    } else if (tab === 'wall' && (kind === 'entries' || kind === 'class')) {
      if (!stopWall) fill(content, wallView());
    } else if (tab === 'photos' && (kind === 'photos' || kind === 'class')) {
      fill(content, photosView());
    } else if (kind === 'class' && (tab === 'chunks' || tab === 'settings' || tab === 'ebook')) {
      renderContent();
    }
  }

  unsubs.push(store.watchClass(code, (c) => {
    if (!c) { fill(content, h('div', { class: 'banner' }, '반을 찾을 수 없어요. Firebase 콘솔에서 반 문서가 있는지 확인해 주세요.')); return; }
    if (!demo && c.teacherUid && c.teacherUid !== store.uid()) {
      fill(content, h('div', { class: 'card stack' },
        h('h3', null, '이 반의 선생님 계정이 아니에요'),
        h('p', null, '처음 이 반을 만든 선생님 구글 계정으로 다시 로그인해 주세요.'),
        h('button', { class: 'btn', type: 'button', onclick: async () => { await store.signOut(); app.setSession(null); app.go('home'); } }, '로그아웃하고 처음으로')));
      return;
    }
    const first = !cls;
    cls = c;
    nameEl.textContent = c.name;
    lessonSel.value = String(c.lesson);
    if (first) { renderTabs(); renderContent(); } else refresh('class');
  }));
  unsubs.push(store.watchStudents(code, (l) => { students = l; if (cls) refresh('students'); }));
  unsubs.push(store.watchEntries(code, (l) => { entries = l; if (cls) refresh('entries'); }));
  unsubs.push(store.watchSearches(code, (l) => { searches = l; if (cls) refresh('searches'); }));
  unsubs.push(store.watchNotices(code, (l) => { notices = l; if (cls) refresh('notices'); }));
  unsubs.push(store.watchPhotos(code, (l) => { photos = l; if (cls) refresh('photos'); }));

  // ‘막힘?’ 표시가 시간이 지나며 바뀌도록 1분마다 다시 그린다.
  const tick = setInterval(() => { if (tab === 'board' && cls) { renderBoard(); renderFeed(); } }, 60000);

  return () => {
    clearInterval(tick);
    ebook?.destroy();
    stopWall?.();
    unsubs.forEach((u) => u?.());
  };
}
