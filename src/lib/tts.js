// 영어 소리.
// 1) 모델 책·낱말·표현·덩어리·문장틀은 미리 만든 원어민 소리 파일(public/audio)을 튼다.
// 2) 파일이 없는 글(아이가 쓴 문장 등)은 브라우저의 "영어" 목소리로만 읽는다.
//    영어 목소리가 없는 브라우저에서는 한국어 목소리로 읽지 않고(콩글리시가 된다) 안내만 한다.
import clips from '../data/audio.json';
import { speakable, audioKey } from './speech-text.js';
import { toast } from './dom.js';

export { speakable };

const AUDIO_BASE = (import.meta.env?.BASE_URL || './') + 'audio/';
const hasSynth = typeof window !== 'undefined' && 'speechSynthesis' in window;

// ---------- 브라우저 영어 목소리 ----------
let voices = [];
function loadVoices() { voices = hasSynth ? speechSynthesis.getVoices() : []; }
if (hasSynth) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}
function voicesReady() {
  if (!hasSynth || voices.length) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { loadVoices(); resolve(); };
    speechSynthesis.addEventListener?.('voiceschanged', done, { once: true });
    setTimeout(done, 1200);
  });
}
// 사람 같은 목소리일수록 점수가 높다. 영어가 아니면 쓰지 않는다.
function score(v) {
  if (!/^en([-_]|$)/i.test(v.lang)) return -1;
  let s = /en[-_]US/i.test(v.lang) ? 20 : 10;
  if (/Natural|Neural|Online/i.test(v.name)) s += 60; // 엣지
  else if (/Google US English/i.test(v.name)) s += 50; // 크롬
  else if (/Samantha|Ava|Allison|Susan|Zoe|Evan|Nathan/i.test(v.name)) s += 40; // 맥·아이패드
  else if (/Google/i.test(v.name)) s += 30;
  return s;
}
export function englishVoice() {
  let best = null;
  for (const v of voices) if (score(v) >= 0 && (!best || score(v) > score(best))) best = v;
  return best;
}
export function hasClip(text) { return !!clips[audioKey(text)]; }

let lastNotice = 0;
function noVoiceNotice() {
  if (Date.now() - lastNotice < 4000) return;
  lastNotice = Date.now();
  toast('이 브라우저에는 영어 목소리가 없어요. 크롬이나 엣지에서 열면 이 문장도 들을 수 있어요.');
}

// ---------- 읽기 ----------
let current = null; // { stop() }
let gen = 0;

// onend(interrupted): 다 읽으면 false, 중간에 멈추면 true
export function speak(text, { slow = false, onstart, onend, onword } = {}) {
  stop();
  const say = speakable(text);
  if (!say) { onend?.(false); return false; }
  const my = ++gen;
  const file = clips[audioKey(text)];
  if (file) playClip(file, say, { slow, onstart, onend, onword }, my);
  else speakWithVoice(say, { slow, onstart, onend, onword }, my);
  return true;
}

function playClip(file, say, opts, my) {
  const { slow, onstart, onend, onword } = opts;
  const a = new Audio(AUDIO_BASE + file);
  a.preload = 'auto';
  a.playbackRate = slow ? 0.75 : 1;
  a.preservesPitch = true;
  let started = false;
  let finished = false;
  let raf = 0;
  let lastCi = -1;
  const finish = (interrupted) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    if (current?.audio === a) current = null;
    onend?.(interrupted);
  };
  // 소리 파일에는 낱말 위치 정보가 없어서, 지난 시간만큼 글자를 따라가며 낱말을 비춘다.
  const tick = () => {
    if (finished) return;
    if (a.duration && Number.isFinite(a.duration)) {
      const ci = Math.min(say.length - 1, Math.floor((a.currentTime / a.duration) * say.length));
      if (ci !== lastCi) { lastCi = ci; onword(ci); }
    }
    raf = requestAnimationFrame(tick);
  };
  // 파일을 못 불러오면 브라우저 영어 목소리로 넘어간다.
  const fallback = () => {
    if (started || finished || my !== gen) return;
    finished = true;
    if (current?.audio === a) current = null;
    speakWithVoice(say, opts, my);
  };
  a.addEventListener('playing', () => {
    if (started) return;
    started = true;
    onstart?.();
    if (onword) tick();
  });
  a.addEventListener('ended', () => finish(false));
  a.addEventListener('error', () => (started ? finish(false) : fallback()));
  current = { audio: a, stop: () => { a.pause(); finish(true); } };
  a.play().catch(fallback);
}

async function speakWithVoice(say, { slow, onstart, onend, onword }, my) {
  if (!hasSynth) { noVoiceNotice(); onend?.(false); return; }
  await voicesReady();
  if (my !== gen) return;
  const v = englishVoice();
  if (!v) { noVoiceNotice(); onend?.(false); return; }
  const u = new SpeechSynthesisUtterance(say);
  u.voice = v;
  u.lang = v.lang;
  u.rate = slow ? 0.7 : 0.95;
  let finished = false;
  const finish = (interrupted) => {
    if (finished) return;
    finished = true;
    if (current?.utterance === u) current = null;
    onend?.(interrupted);
  };
  u.onstart = () => onstart?.();
  u.onend = () => finish(false);
  u.onerror = (e) => finish(e?.error === 'interrupted' || e?.error === 'canceled');
  if (onword) u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) onword(e.charIndex); };
  current = { utterance: u, stop: () => { speechSynthesis.cancel(); finish(true); } };
  speechSynthesis.speak(u);
}

export function stop() {
  gen++;
  const c = current;
  current = null;
  c?.stop();
  if (hasSynth) speechSynthesis.cancel();
}

// 문장 여러 개를 차례로 읽는다(문장 벽).
export function speakAll(list, { slow = false, onitem, ondone } = {}) {
  let i = 0;
  let cancelled = false;
  const next = () => {
    if (cancelled || i >= list.length) { if (!cancelled) ondone?.(); return; }
    const idx = i++;
    onitem?.(idx);
    speak(list[idx], { slow, onend: (interrupted) => { if (interrupted) { cancelled = true; return; } setTimeout(next, 450); } });
  };
  next();
  return () => { cancelled = true; stop(); };
}
