import { firebaseConfig } from './firebase-config.js';

// 접기 영상 주소. public 폴더에 fold.mp4를 넣었다면 'fold.mp4', 유튜브라면 그 주소.
export const FOLD_VIDEO_URL = '';

export const USE_FIREBASE = !__PREVIEW__ && !!firebaseConfig;
export { firebaseConfig };

// 우리 반은 하나다. 반 만들기 없이 이 방 하나에 번호 칸 12개를 쓴다.
// ROOM은 Firebase 콘솔의 classes 문서 이름이다(선생님 구글 계정으로 처음 만든 반). 아이들에게는 보이지 않는다.
export const ROOM = '3UZN';
export const SEATS = 12;
// 0번은 선생님 시범용 칸이다. 화면 공유로 아이들에게 쓰는 법을 보여 줄 때 쓴다(선생님 계정으로도 열린다).
export const DEMO_SEAT = 0;
export const seatName = (n) => (n === DEMO_SEAT ? '0번 · 선생님 시범' : `${n}번`);

// 아이마다 보내 줄 링크: 누르면 바로 그 번호로 들어온다.
export function seatLink(n) {
  return `${location.origin}${location.pathname}?n=${n}`;
}
export function seatFromUrl() {
  const n = parseInt(new URLSearchParams(location.search).get('n'), 10);
  return n >= DEMO_SEAT && n <= SEATS ? n : null;
}
