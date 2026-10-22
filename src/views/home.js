import { h, icon, toast, fill } from '../lib/dom.js';
import { brandMark } from './parts.js';

export function renderHome(app) {
  const { store } = app;
  const demo = store.mode === 'demo';

  // 학생
  const codeIn = h('input', { type: 'text', id: 'join-code', maxlength: '4', placeholder: '예: AB7K', autocomplete: 'off', class: 'en code', 'aria-label': '반 코드' });
  const nickIn = h('input', { type: 'text', id: 'join-nick', maxlength: '12', placeholder: '예: 7번, 별님', autocomplete: 'off', 'aria-label': '번호나 별명' });
  const joinMsg = h('p', { class: 'small muted', role: 'status' });
  const demoCodes = h('p', { class: 'small muted' });
  codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });

  async function join(e) {
    e.preventDefault();
    const code = codeIn.value.trim().toUpperCase();
    const nickname = nickIn.value.trim();
    if (code.length !== 4) { joinMsg.textContent = '반 코드 4자리를 넣어 주세요.'; return; }
    if (!nickname) { joinMsg.textContent = '번호나 별명을 넣어 주세요. 진짜 이름은 쓰지 않아요.'; return; }
    joinMsg.textContent = '들어가는 중…';
    try {
      const { uid } = await store.joinClass(code, nickname);
      app.setSession({ role: 'student', code, uid, nickname });
      app.go('student');
    } catch (err) {
      joinMsg.textContent = err.message === 'no-class'
        ? '그 코드의 반이 없어요. 선생님이 알려준 코드를 다시 확인해요.'
        : '들어가지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.';
    }
  }

  const studentCard = h('form', { class: 'card', onsubmit: join },
    h('h2', null, '학생'),
    h('p', { class: 'muted' }, '선생님이 알려준 반 코드와 내 번호를 넣어요.'),
    h('label', { class: 'field', for: 'join-code' }, '반 코드', codeIn),
    h('label', { class: 'field', for: 'join-nick' }, '번호나 별명', nickIn),
    h('button', { class: 'btn primary', type: 'submit' }, '들어가기'),
    joinMsg,
    demo ? demoCodes : null);

  // 선생님
  const teacherBody = h('div', { class: 'stack' });
  const teacherCard = h('div', { class: 'card' },
    h('h2', null, '선생님'),
    h('p', { class: 'muted' }, '반을 열면 아이들이 쓰는 문장과 찾아본 말이 실시간으로 보여요.'),
    teacherBody);

  const nameIn = h('input', { type: 'text', id: 'class-name', placeholder: '예: 4학년 원격 영어', maxlength: '30', 'aria-label': '새 반 이름' });

  function openClass(code) {
    app.setSession({ role: 'teacher', code });
    app.go('teacher');
  }

  async function listClasses() {
    const list = await store.myClasses().catch(() => []);
    if (demo) {
      demoCodes.textContent = list.length
        ? `체험용 반 코드: ${list.map((c) => c.code).join(', ')}`
        : '체험해 보려면 선생님 칸에서 체험용 반을 먼저 열어요.';
    }
    return list;
  }

  async function renderTeacherBody() {
    fill(teacherBody);
    if (!demo) {
      if (!store.isTeacher()) {
        teacherBody.append(h('button', {
          class: 'btn primary', type: 'button',
          onclick: async () => {
            try { await store.signInTeacher(); renderTeacherBody(); }
            catch { toast('로그인하지 못했어요. 팝업이 막혀 있지 않은지 확인해 주세요.'); }
          },
        }, '구글 계정으로 로그인'));
        return;
      }
    }
    const list = await listClasses();
    if (list.length) {
      teacherBody.append(h('div', { class: 'class-list' },
        list.map((c) => h('div', { class: 'class-item' },
          h('div', null, h('div', null, c.name), h('div', { class: 'code' }, c.code)),
          h('button', { class: 'btn small primary', type: 'button', onclick: () => openClass(c.code) }, '열기')))));
    }
    if (demo && !list.length) {
      teacherBody.append(h('button', {
        class: 'btn primary', type: 'button',
        onclick: async () => openClass(await store.createClass('체험용 반', { withExamples: true })),
      }, '예시가 들어 있는 체험용 반 열기'));
    }
    teacherBody.append(
      h('label', { class: 'field', for: 'class-name' }, '새 반 만들기', nameIn),
      h('button', {
        class: 'btn', type: 'button',
        onclick: async () => {
          try { openClass(await store.createClass(nameIn.value.trim() || '우리 반')); }
          catch { toast('반을 만들지 못했어요. 다시 눌러 주세요.'); }
        },
      }, icon('plus', 18), '반 만들기'));
    if (!demo) {
      teacherBody.append(h('button', { class: 'btn small ghost', type: 'button', onclick: async () => { await store.signOut(); renderTeacherBody(); } }, '로그아웃'));
    }
  }

  const mascot = h('img', { class: 'mascot', src: (import.meta.env.BASE_URL || './') + 'art/mascot.webp', alt: '' });
  mascot.addEventListener('error', () => {
    if (mascot.src.endsWith('.webp')) mascot.src = mascot.src.replace(/\.webp$/, '.png');
    else mascot.remove();
  });
  const page = h('div', { class: 'home' },
    h('header', { class: 'home-head' },
      brandMark(54),
      mascot,
      h('p', { class: 'lede muted' }, '선생님 책을 펼쳐 보고, 그 문장에 내 이야기를 넣어 영어로 써 보는 곳'),
      demo ? h('p', { class: 'banner lede' }, '체험 모드예요. 이 컴퓨터의 브라우저 탭끼리만 연결돼요. 한 탭은 선생님, 다른 탭은 학생으로 들어가면 실시간으로 이어지는 걸 볼 수 있어요.') : null),
    h('div', { class: 'home-grid' },
      studentCard,
      teacherCard,
      h('div', { class: 'card' },
        h('h2', null, '모델 책'),
        h('p', { class: 'muted' }, '그날의 선생님 책을 펼친 책으로 봐요. 그림, 문장, 소리, 우리말 뜻이 들어 있어요.'),
        h('button', { class: 'btn', type: 'button', onclick: () => app.go('ebook', { lesson: 2 }) }, '모델 책 보기'))));

  app.mount(page);
  renderTeacherBody();
  if (demo) listClasses();
}
