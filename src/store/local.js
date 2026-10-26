import { ss, uid as newId } from '../lib/dom.js';

// 체험 모드: 이 컴퓨터의 브라우저 안에만 저장한다.
// 같은 컴퓨터에서 학생 탭과 선생님 탭을 따로 열면 실시간으로 이어진다(BroadcastChannel).
const KEY = 'siyw-demo-v1';
const TEACHER = 'teacher-demo';

function emptyDb() { return { classes: {} }; }

export function createLocalStore() {
  let mem = read() || emptyDb();
  const subs = new Set();
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('siyw-demo') : null;

  function read() {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; }
  }
  function refresh() { mem = read() || mem || emptyDb(); }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); }
    catch { throw new Error('storage-full'); }
    channel?.postMessage(1);
    emit();
  }
  function emit() { subs.forEach((f) => f()); }
  if (channel) channel.onmessage = () => { refresh(); emit(); };
  window.addEventListener('storage', (e) => { if (e.key === KEY) { refresh(); emit(); } });

  function sub(fn) {
    const run = () => { try { fn(); } catch (e) { console.error(e); } };
    subs.add(run);
    run();
    return () => subs.delete(run);
  }
  const cls = (code) => mem.classes[code];
  const tabUid = () => {
    let u = ss('siyw-tab-uid');
    if (!u) { u = 'kid-' + newId(); ss('siyw-tab-uid', u); }
    return u;
  };
  const sortBy = (arr, key) => [...arr].sort((a, b) => (b[key] || 0) - (a[key] || 0));

  return {
    mode: 'demo',
    async signInTeacher() { return { uid: TEACHER, name: '선생님' }; },
    async signOut() {},
    isTeacher() { return true; },
    uid() { return tabUid(); },
    // 체험 모드에는 반이 없으면 예시가 들어 있는 반을 하나 만든다.
    async ensureRoom(code) {
      refresh();
      if (cls(code)) return;
      mem.classes[code] = {
        code, name: '우리 반', lesson: 2, youglish: false, teacherUid: TEACHER, createdAt: Date.now(),
        students: {}, entries: {}, searches: [], notices: [], tips: [], photos: {},
      };
      seedExamples(mem.classes[code]);
      write();
    },
    async addExamples(code) { refresh(); const c = cls(code); if (c) { seedExamples(c); write(); } },
    async removeExamples(code) {
      refresh();
      const c = cls(code);
      if (!c) return;
      const isEx = (u) => String(u).startsWith('example-');
      for (const k of Object.keys(c.students)) if (isEx(k)) delete c.students[k];
      for (const [k, e] of Object.entries(c.entries)) if (isEx(e.uid)) delete c.entries[k];
      c.searches = c.searches.filter((s) => !isEx(s.uid));
      c.tips = c.tips.filter((t) => !isEx(t.uid));
      write();
    },
    async joinClass(code, nickname, seat) {
      refresh();
      const c = cls(code);
      if (!c) throw new Error('no-class');
      const u = tabUid();
      c.students[u] = { uid: u, nickname, seat, joinedAt: Date.now() };
      write();
      return { uid: u };
    },
    watchClass(code, cb) {
      return sub(() => {
        const c = cls(code);
        cb(c ? { code, name: c.name, lesson: c.lesson, youglish: !!c.youglish, teacherUid: c.teacherUid } : null);
      });
    },
    async updateClass(code, patch) { refresh(); Object.assign(cls(code), patch); write(); },

    async saveEntry(code, e) {
      refresh();
      const c = cls(code);
      if (!c) return;
      const id = `${e.uid}_${e.lesson}_${e.page}`;
      const prev = c.entries[id] || { shared: false };
      c.entries[id] = { ...prev, ...e, id, shared: !!prev.shared, updatedAt: Date.now() };
      write();
    },
    watchMyEntries(code, u, cb) { return sub(() => cb(Object.values(cls(code)?.entries || {}).filter((x) => x.uid === u))); },
    watchEntries(code, cb) { return sub(() => cb(Object.values(cls(code)?.entries || {}))); },
    watchStudents(code, cb) { return sub(() => cb(Object.values(cls(code)?.students || {}))); },
    async setShared(code, id, shared) { refresh(); const e = cls(code)?.entries[id]; if (e) { e.shared = shared; write(); } },
    watchWall(code, cb) { return sub(() => cb(Object.values(cls(code)?.entries || {}).filter((x) => x.shared))); },

    async logSearch(code, s) {
      refresh();
      const c = cls(code);
      if (!c) return;
      c.searches.push({ ...s, id: newId(), at: Date.now() });
      if (c.searches.length > 400) c.searches = c.searches.slice(-400);
      write();
    },
    watchSearches(code, cb) { return sub(() => cb(sortBy(cls(code)?.searches || [], 'at'))); },
    async answerMiss(code, q, en) { refresh(); cls(code).notices.push({ id: newId(), q, en, at: Date.now() }); write(); },
    watchNotices(code, cb) { return sub(() => cb(sortBy(cls(code)?.notices || [], 'at'))); },

    async sendTip(code, t) { refresh(); cls(code).tips.push({ ...t, id: newId(), at: Date.now() }); write(); },
    watchMyTips(code, u, cb) { return sub(() => cb(sortBy((cls(code)?.tips || []).filter((t) => t.uid === u), 'at'))); },
    watchTips(code, cb) { return sub(() => cb(sortBy(cls(code)?.tips || [], 'at'))); },

    async addPhoto(code, p) {
      refresh();
      const c = cls(code);
      const id = `${p.uid}_${p.lesson}`;
      const before = c.photos[id];
      c.photos[id] = { ...p, id, at: Date.now() };
      try { write(); }
      catch (e) { if (before) c.photos[id] = before; else delete c.photos[id]; throw e; }
    },
    watchPhotos(code, cb) { return sub(() => cb(sortBy(Object.values(cls(code)?.photos || {}), 'at'))); },
    watchMyPhotos(code, u, cb) { return sub(() => cb(Object.values(cls(code)?.photos || {}).filter((p) => p.uid === u))); },

    async clearClass(code) {
      refresh();
      const c = cls(code);
      if (!c) return;
      Object.assign(c, { students: {}, entries: {}, searches: [], notices: [], tips: [], photos: {} });
      write();
    },
  };
}

// 체험용 예시. 이름에 "(예시)"를 붙여 진짜 학생과 헷갈리지 않게 한다.
function seedExamples(c) {
  const now = Date.now();
  const kids = [['example-1', '1번 (예시)', 1], ['example-2', '2번 (예시)', 2], ['example-3', '3번 (예시)', 3]];
  for (const [u, n, seat] of kids) c.students[u] = { uid: u, nickname: n, seat, joinedAt: now - 600000 };
  const put = (u, n, page, en, blanks, gender, minsAgo, shared = false) => {
    const id = `${u}_2_${page}`;
    const filled = blanks.filter((b) => b && b.trim()).length;
    c.entries[id] = { id, uid: u, nickname: n, lesson: 2, page, en, level: '2', gender, blanks, free: null, filled, shared, updatedAt: now - minsAgo * 60000 };
  };
  put('example-1', '1번 (예시)', 1, 'This is my grandma. She lives near the sea.', ['grandma', 'near the sea'], 'she', 9);
  put('example-1', '1번 (예시)', 2, 'She looks small, but she is super strong.', ['small', 'strong'], 'she', 6, true);
  put('example-1', '1번 (예시)', 3, 'She likes trot music, especially ___.', ['trot music', ''], 'she', 5);
  put('example-2', '2번 (예시)', 1, 'This is my dog. He lives in my house.', ['dog', 'in my house'], 'he', 8);
  put('example-2', '2번 (예시)', 4, 'We always go for a walk together. He jumps every time!', ['go for a walk', 'jumps'], 'he', 3, true);
  put('example-3', '3번 (예시)', 1, 'This is my big brother. He lives ___.', ['big brother', ''], 'he', 7);
  const s = (u, n, page, q, found, m) => c.searches.push({ id: newId(), uid: u, nickname: n, lesson: 2, page, q, found, at: now - m * 60000 });
  s('example-1', '1번 (예시)', 1, '바닷가', true, 9);
  s('example-1', '1번 (예시)', 2, '힘이 세다', true, 6);
  s('example-1', '1번 (예시)', 3, '트로트', false, 4);
  s('example-2', '2번 (예시)', 4, '산책', true, 3);
  s('example-3', '3번 (예시)', 1, '형', true, 2);
  s('example-3', '3번 (예시)', 1, '기숙사', false, 1);
}
