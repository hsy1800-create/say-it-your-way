import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut,
} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where,
  onSnapshot, getDocs, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { firebaseConfig } from '../config.js';

// 실제 수업용 저장 방식. 학생은 익명 로그인, 선생님은 구글 로그인.
// 누가 무엇을 볼 수 있는지는 firestore.rules가 정한다.
export async function createFirebaseStore() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  await new Promise((resolve) => { const off = onAuthStateChanged(auth, () => { off(); resolve(); }); });

  const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : (typeof v === 'number' ? v : 0));
  const C = (code, name) => collection(db, 'classes', code, name);
  const D = (code, name, id) => doc(db, 'classes', code, name, id);
  const rows = (snap) => snap.docs.map((d) => {
    const x = d.data({ serverTimestamps: 'estimate' });
    return { ...x, id: d.id, at: ms(x.at), updatedAt: ms(x.updatedAt), joinedAt: ms(x.joinedAt) };
  });
  const watch = (q, cb) => onSnapshot(q, (snap) => {
    const arr = rows(snap);
    arr.sort((a, b) => (b.at || b.updatedAt || 0) - (a.at || a.updatedAt || 0));
    cb(arr);
  }, (err) => { console.error(err); cb([]); });

  async function ensureStudent() {
    if (!auth.currentUser) await signInAnonymously(auth);
    return auth.currentUser;
  }
  function teacher() {
    const u = auth.currentUser;
    if (!u || u.isAnonymous) throw new Error('not-teacher');
    return u;
  }

  return {
    mode: 'firebase',
    async signInTeacher() {
      if (!auth.currentUser || auth.currentUser.isAnonymous) await signInWithPopup(auth, new GoogleAuthProvider());
      const u = teacher();
      return { uid: u.uid, name: u.displayName || '선생님' };
    },
    async signOut() { await signOut(auth); },
    isTeacher() { const u = auth.currentUser; return !!u && !u.isAnonymous; },
    uid() { return auth.currentUser?.uid || null; },
    // 반은 콘솔에서 한 번 만들어 두고 앱에서는 만들지 않는다.
    async ensureRoom() {},
    async joinClass(code, nickname, seat) {
      if (auth.currentUser && !auth.currentUser.isAnonymous) throw new Error('teacher-account');
      const u = await ensureStudent();
      const c = await getDoc(doc(db, 'classes', code));
      if (!c.exists()) throw new Error('no-class');
      await setDoc(D(code, 'students', u.uid), { uid: u.uid, nickname, seat, joinedAt: serverTimestamp() });
      return { uid: u.uid };
    },
    watchClass(code, cb) {
      return onSnapshot(doc(db, 'classes', code), (s) => {
        if (!s.exists()) return cb(null);
        const d = s.data();
        cb({ code, name: d.name, lesson: d.lesson, youglish: !!d.youglish, teacherUid: d.teacherUid });
      }, () => cb(null));
    },
    async updateClass(code, patch) { await updateDoc(doc(db, 'classes', code), patch); },

    async saveEntry(code, e) {
      const id = `${e.uid}_${e.lesson}_${e.page}`;
      await setDoc(D(code, 'entries', id), { ...e, updatedAt: serverTimestamp() }, { merge: true });
    },
    watchMyEntries(code, uid, cb) { return watch(query(C(code, 'entries'), where('uid', '==', uid)), cb); },
    watchEntries(code, cb) { return watch(C(code, 'entries'), cb); },
    watchStudents(code, cb) { return watch(C(code, 'students'), cb); },
    async setShared(code, id, shared) { await updateDoc(D(code, 'entries', id), { shared }); },
    watchWall(code, cb) { return watch(query(C(code, 'entries'), where('shared', '==', true)), cb); },

    async logSearch(code, s) { await addDoc(C(code, 'searches'), { ...s, at: serverTimestamp() }); },
    watchSearches(code, cb) { return watch(C(code, 'searches'), cb); },
    async answerMiss(code, q, en) { await addDoc(C(code, 'notices'), { q, en, at: serverTimestamp() }); },
    watchNotices(code, cb) { return watch(C(code, 'notices'), cb); },

    async sendTip(code, t) { await addDoc(C(code, 'tips'), { ...t, at: serverTimestamp() }); },
    watchMyTips(code, uid, cb) { return watch(query(C(code, 'tips'), where('uid', '==', uid)), cb); },
    watchTips(code, cb) { return watch(C(code, 'tips'), cb); },

    async addPhoto(code, p) { await setDoc(D(code, 'photos', `${p.uid}_${p.lesson}`), { ...p, at: serverTimestamp() }); },
    watchPhotos(code, cb) { return watch(C(code, 'photos'), cb); },
    watchMyPhotos(code, uid, cb) { return watch(query(C(code, 'photos'), where('uid', '==', uid)), cb); },

    // 학기 끝: 반의 모든 기록을 지운다. 반(번호 칸과 링크)은 그대로 둔다.
    async clearClass(code) {
      for (const name of ['entries', 'students', 'searches', 'notices', 'tips', 'photos']) {
        const snap = await getDocs(C(code, name));
        let batch = writeBatch(db);
        let n = 0;
        for (const d of snap.docs) {
          batch.delete(d.ref);
          if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
        }
        await batch.commit();
      }
    },
  };
}
