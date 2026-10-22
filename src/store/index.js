import { USE_FIREBASE } from '../config.js';
import { createLocalStore } from './local.js';

// 저장 방식은 두 가지다. Firebase 설정이 있으면 Firebase, 없으면 체험 모드(같은 컴퓨터의 탭끼리).
// 두 방식 모두 아래 이름의 함수를 똑같이 가진다.
//   mode, signInTeacher(), myClasses(), createClass(name), joinClass(code, nickname)
//   watchClass, updateClass, saveEntry, watchMyEntries, watchEntries, watchStudents
//   setShared, watchWall, logSearch, watchSearches, answerMiss, watchNotices
//   sendTip, watchMyTips, watchTips, addPhoto, watchPhotos, watchMyPhotos, clearClass
let store = null;

export async function getStore() {
  if (store) return store;
  if (!__PREVIEW__ && USE_FIREBASE) {
    const mod = await import('./firebase.js');
    store = await mod.createFirebaseStore();
  } else {
    store = createLocalStore();
  }
  return store;
}
