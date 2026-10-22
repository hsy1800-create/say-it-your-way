import './styles.css';
import { getStore } from './store/index.js';
import { h, ss, fill } from './lib/dom.js';
import { renderHome } from './views/home.js';
import { renderStudent } from './views/student.js';
import { renderTeacher } from './views/teacher.js';
import { renderEbookPage } from './views/ebook.js';

const root = document.getElementById('app');
const VIEWS = { home: renderHome, student: renderStudent, teacher: renderTeacher, ebook: renderEbookPage };
let cleanup = null;

const app = {
  store: null,
  session: ss('siyw-session'),
  setSession(s) { this.session = s; ss('siyw-session', s); },
  mount(node) { fill(root, node); },
  go(view, params = {}) {
    try { cleanup?.(); } catch (e) { console.error(e); }
    cleanup = null;
    window.scrollTo(0, 0);
    ss('siyw-view', { view, params });
    const fn = VIEWS[view] || renderHome;
    cleanup = fn(app, params) || null;
  },
};

(async () => {
  fill(root, h('p', { class: 'muted' }, '불러오는 중…'));
  try {
    app.store = await getStore();
  } catch (e) {
    console.error(e);
    fill(root, h('div', { class: 'banner' }, 'Firebase에 연결하지 못했어요. src/firebase-config.js의 값을 확인해 주세요.'));
    return;
  }
  const last = ss('siyw-view');
  const role = app.session?.role;
  const ok = last && (
    (last.view === 'student' && role === 'student')
    || (last.view === 'teacher' && role === 'teacher')
    || last.view === 'ebook' || last.view === 'home');
  app.go(ok ? last.view : 'home', ok ? last.params : {});
})();
