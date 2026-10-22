// 브라우저에 들어 있는 음성으로 영어를 읽어준다(무료, 서버 없음).
export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voices = [];
function loadVoices() { voices = ttsSupported ? speechSynthesis.getVoices() : []; }
if (ttsSupported) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

const PREFERRED = /(Google US English|Samantha|Aria|Jenny|Ava|Allison|Natural)/i;
function pickVoice() {
  const en = voices.filter((v) => /^en[-_]/i.test(v.lang));
  return en.find((v) => /en[-_]US/i.test(v.lang) && PREFERRED.test(v.name))
    || en.find((v) => /en[-_]US/i.test(v.lang))
    || en[0] || null;
}

// 빈칸(___)은 잠깐 쉬듯이 읽고, "a / b"처럼 묶인 표현은 앞의 것만 읽는다.
export function speakable(text) {
  return String(text || '')
    .split(' / ')[0]
    .replace(/_{2,}(\{[^}]*\})?/g, ', ')
    .replace(/\s+,/g, ',')
    .trim();
}

let current = null;
export function speak(text, { slow = false, onstart, onend, onword } = {}) {
  const say = speakable(text);
  if (!ttsSupported || !say) { onend?.(); return false; }
  stop();
  const u = new SpeechSynthesisUtterance(say);
  u.lang = 'en-US';
  const v = pickVoice();
  if (v) u.voice = v;
  u.rate = slow ? 0.62 : 0.9;
  u.onstart = () => onstart?.();
  u.onend = u.onerror = () => { if (current === u) current = null; onend?.(); };
  if (onword) u.onboundary = (e) => { if (e.name === 'word' || e.name === undefined) onword(e.charIndex); };
  current = u;
  speechSynthesis.speak(u);
  return true;
}

export function stop() {
  if (ttsSupported) speechSynthesis.cancel();
  current = null;
}

// 문장 여러 개를 차례로 읽는다.
export function speakAll(list, { slow = false, onitem, ondone } = {}) {
  let i = 0;
  let cancelled = false;
  const next = () => {
    if (cancelled || i >= list.length) { if (!cancelled) ondone?.(); return; }
    const idx = i++;
    onitem?.(idx);
    speak(list[idx], { slow, onend: () => setTimeout(next, 450) });
  };
  next();
  return () => { cancelled = true; stop(); };
}
