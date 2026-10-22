import { firebaseConfig } from './firebase-config.js';

// 접기 영상 주소. public 폴더에 fold.mp4를 넣었다면 'fold.mp4', 유튜브라면 그 주소.
export const FOLD_VIDEO_URL = '';

export const USE_FIREBASE = !__PREVIEW__ && !!firebaseConfig;
export { firebaseConfig };
