// 소리로 읽을 글을 다듬는 규칙. 앱(tts.js)과 소리 파일을 만드는 스크립트(scripts/audio-list.mjs)가 함께 쓴다.

// "a / b"처럼 묶인 표현은 앞의 것만, He(She)는 앞의 것만 읽는다. 빈칸(___)은 "…"로 잠깐 쉰다.
export function speakable(text) {
  return String(text || '')
    .split(' / ')[0]
    .replace(/\b(He|he|His|his|him)\((?:She|she|Her|her)\)/g, '$1')
    .replace(/_{2,}(\{[^}]*\})?/g, '…')
    .replace(/\s+…/g, '…')
    .replace(/…[.]+/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

// 소리 파일을 찾을 때 쓰는 열쇠. 대소문자, 굽은 따옴표, 띄어쓰기 차이는 같은 것으로 본다.
export function audioKey(text) {
  return speakable(text)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
