import { h, icon } from '../lib/dom.js';
import { speak } from '../lib/tts.js';
import { mountYouglish } from '../lib/youglish.js';

export function speakButtons(text, { slow = true, label = '듣기' } = {}) {
  const normal = h('button', {
    class: 'btn small icon', type: 'button', title: '듣기', 'aria-label': `${label}: ${text}`,
    onclick: () => speak(text),
  }, icon('speaker', 18));
  if (!slow) return normal;
  const slowBtn = h('button', {
    class: 'btn small', type: 'button', title: '느리게 듣기', 'aria-label': `느리게 듣기: ${text}`,
    onclick: () => speak(text, { slow: true }),
  }, '느리게');
  return [normal, slowBtn];
}

// 표현 카드: 원어민 표현(형광펜) → 쉬운 버전 → 우리말 뜻 → 예문. EFL이라 뜻과 소리를 늘 같이 준다.
export function phraseCard(p, { onUse, youglish = false } = {}) {
  const ygBox = h('div', { class: 'yg-box', hidden: true });
  // "He(She)"처럼 둘 중 고르는 표현은 He / She 버튼을 따로 준다.
  const pick = (t, he) => t.replace(/He\(She\)/g, he ? 'He' : 'She').replace(/he\(she\)/g, he ? 'he' : 'she')
    .replace(/His\(Her\)/g, he ? 'His' : 'Her').replace(/his\(her\)/g, he ? 'his' : 'her').replace(/him\(her\)/g, he ? 'him' : 'her');
  const variants = p.en.split(' / ').flatMap((v) => (/\((She|she|Her|her)\)/.test(v) ? [pick(v, true), pick(v, false)] : [v]));
  const useButtons = !onUse ? [] : variants.length > 1
    ? variants.map((v) => h('button', { class: 'btn small primary en', type: 'button', onclick: () => onUse(v) }, icon('plus', 16), v))
    : [h('button', { class: 'btn small primary', type: 'button', onclick: () => onUse(p.en) }, icon('plus', 16), '내 문장에 넣기')];
  if (onUse && p.easy) {
    useButtons.push(h('button', { class: 'btn small', type: 'button', onclick: () => onUse(p.easy.split(' / ')[0]) }, '쉬운 걸로 넣기'));
  }
  return h('div', { class: 'phrase' + (p.fromTeacher ? ' teacher' : '') },
    h('div', { class: 'tag' }, p.fromTeacher ? '선생님이 알려준 말' : (p.group || '')),
    h('div', { class: 'say' },
      h('div', { class: 'native en' }, h('span', { class: 'marker' }, p.en)),
      speakButtons(p.en)),
    p.easy ? h('div', { class: 'easy' }, h('b', null, '쉽게'), h('span', null, p.easy), speakButtons(p.easy, { slow: false })) : null,
    h('div', { class: 'ko' }, p.ko),
    p.ex ? h('div', { class: 'ex row' }, h('span', { style: { flex: '1', minWidth: '0' } }, p.ex), speakButtons(p.ex, { slow: false })) : null,
    h('div', { class: 'row' },
      useButtons,
      youglish ? h('button', {
        class: 'btn small', type: 'button',
        onclick: () => {
          ygBox.hidden = !ygBox.hidden;
          if (!ygBox.hidden && !ygBox.childElementCount) mountYouglish(ygBox, variants[0]);
        },
      }, icon('video', 16), '원어민 영상') : null),
    ygBox);
}

export function pageName(key) {
  if (key === 'cover') return '표지';
  if (key === 'back') return '뒷표지';
  return key.replace('p', '') + '쪽';
}

// 하트 풍선 세 개 + 이름. 앱의 얼굴.
const SVG_NS = 'http://www.w3.org/2000/svg';
function heart(cx, cy, r) {
  return `M${cx} ${cy + r * 0.95}C${cx - r * 1.7} ${cy - r * 0.05} ${cx - r * 0.95} ${cy - r * 1.35} ${cx} ${cy - r * 0.42}`
    + `C${cx + r * 0.95} ${cy - r * 1.35} ${cx + r * 1.7} ${cy - r * 0.05} ${cx} ${cy + r * 0.95}Z`;
}
export function brandMark(size = 40, withName = true) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 60 72');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(Math.round(size * 1.2)));
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'balloons');
  svg.innerHTML = `<path class="str" d="M16 34 Q22 52 30 70M33 26 Q31 48 30 70M45 37 Q38 54 30 70"/>`
    + `<path class="b" d="${heart(16, 22, 12)}"/><path class="b2" d="${heart(45, 26, 11)}"/><path class="b" d="${heart(33, 14, 12.5)}"/>`
    + `<ellipse class="shine" cx="28.5" cy="8.5" rx="3" ry="1.8" transform="rotate(-30 28.5 8.5)"/>`
    + `<ellipse class="shine" cx="11.5" cy="16" rx="2.6" ry="1.6" transform="rotate(-30 11.5 16)"/>`;
  if (!withName) return svg;
  return h('span', { class: 'brand' }, svg, h('span', { class: 'brand-name' }, 'Say It Your Way'));
}
