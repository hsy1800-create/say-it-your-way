import { h, toast, fill } from '../lib/dom.js';
import { brandMark } from './parts.js';
import { ROOM, SEATS, DEMO_SEAT, seatName, seatLink } from '../config.js';

// 번호로 바로 들어간다. 링크(?n=7)로 왔을 때도 이 함수를 쓴다. 실패하면 아이에게 보여 줄 말을 돌려준다.
export async function enterSeat(app, n) {
  const { store } = app;
  const nickname = seatName(n);
  try {
    await store.ensureRoom(ROOM);
    const { uid } = await store.joinClass(ROOM, nickname, n);
    app.setSession({ role: 'student', code: ROOM, uid, nickname, seat: n });
    app.go('student');
    return null;
  } catch (err) {
    if (err.message === 'teacher-account') return '이 브라우저는 선생님 계정으로 로그인되어 있어요. 학생 화면은 다른 브라우저나 기기에서 열어 주세요.';
    if (err.message === 'no-class') return '반을 찾을 수 없어요. 선생님께 알려 주세요.';
    return '들어가지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.';
  }
}

export function renderHome(app, params = {}) {
  const { store } = app;
  const demo = store.mode === 'demo';

  // 학생: 내 번호 누르기
  const joinMsg = h('p', { class: 'small muted', role: 'status' }, params.msg || '');
  const seatGrid = h('div', { class: 'seat-grid', role: 'group', 'aria-label': '내 번호' },
    Array.from({ length: SEATS }, (_, i) => i + 1).map((n) => h('button', {
      class: 'seat-btn', type: 'button', 'aria-label': `${n}번으로 들어가기`,
      onclick: async () => {
        joinMsg.textContent = '들어가는 중…';
        const err = await enterSeat(app, n);
        if (err) joinMsg.textContent = err;
      },
    }, String(n))));
  const studentCard = h('div', { class: 'card' },
    h('h2', null, '학생'),
    h('p', { class: 'muted' }, '선생님이 정해 준 내 번호를 눌러요. 선생님이 보내 준 내 링크를 누르면 바로 들어와요.'),
    seatGrid,
    joinMsg);

  // 선생님: 로그인하면 바로 관전판
  const teacherBody = h('div', { class: 'stack' });
  const teacherCard = h('div', { class: 'card' },
    h('h2', null, '선생님'),
    h('p', { class: 'muted' }, `1번부터 ${SEATS}번까지 아이들이 쓰는 문장과 찾아본 말이 실시간으로 보여요.`),
    teacherBody);

  async function openTeacher() {
    try {
      await store.ensureRoom(ROOM);
      app.setSession({ role: 'teacher', code: ROOM });
      app.go('teacher');
    } catch { toast('열지 못했어요. 다시 눌러 주세요.'); }
  }

  // 0번: 아이들에게 쓰는 법을 보여 줄 학생 화면(새 탭)
  const demoSeatButton = () => h('a', { class: 'btn', href: seatLink(DEMO_SEAT), target: '_blank', rel: 'noopener' }, '0번 시범 학생 화면 열기');

  function renderTeacherBody() {
    if (!demo && !store.isTeacher()) {
      fill(teacherBody, h('button', {
        class: 'btn primary', type: 'button',
        onclick: async () => {
          try { await store.signInTeacher(); openTeacher(); }
          catch { toast('로그인하지 못했어요. 팝업이 막혀 있지 않은지 확인해 주세요.'); }
        },
      }, '구글 계정으로 로그인'));
      return;
    }
    fill(teacherBody,
      h('button', { class: 'btn primary', type: 'button', onclick: openTeacher }, demo ? '선생님 화면 열기' : '관전판 열기'),
      demoSeatButton(),
      demo ? null : h('button', { class: 'btn small ghost', type: 'button', onclick: async () => { await store.signOut(); renderTeacherBody(); } }, '로그아웃'));
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
      demo ? h('p', { class: 'banner lede' }, '체험 모드예요. 이 컴퓨터의 브라우저 탭끼리만 연결돼요. 한 탭은 선생님, 다른 탭은 학생 번호로 들어가면 실시간으로 이어지는 걸 볼 수 있어요.') : null),
    h('div', { class: 'home-grid' },
      studentCard,
      teacherCard,
      h('div', { class: 'card' },
        h('h2', null, '모델 책'),
        h('p', { class: 'muted' }, '그날의 선생님 책을 펼친 책으로 봐요. 그림, 문장, 소리, 우리말 뜻이 들어 있어요.'),
        h('button', { class: 'btn', type: 'button', onclick: () => app.go('ebook', { lesson: 2 }) }, '모델 책 보기'))));

  app.mount(page);
  renderTeacherBody();
}
