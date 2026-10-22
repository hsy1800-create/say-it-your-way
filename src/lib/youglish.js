import { h, fill } from './dom.js';
import { speakable } from './tts.js';

// 유글리시 위젯: 13세 미만이 쓰므로 제한 모드(restrictionMode: 1)를 항상 켠다.
// 버튼을 누르기 전에는 스크립트를 불러오지 않는다.
let loading = null;
function loadYG() {
  if (window.YG?.Widget) return Promise.resolve(window.YG);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const prev = window.onYouglishAPIReady;
    window.onYouglishAPIReady = () => { prev?.(); resolve(window.YG); };
    const s = document.createElement('script');
    s.src = 'https://youglish.com/public/emb/widget.js';
    s.async = true;
    s.onerror = () => { loading = null; reject(new Error('blocked')); };
    document.head.append(s);
    setTimeout(() => { if (!window.YG?.Widget) { loading = null; reject(new Error('timeout')); } }, 9000);
  });
  return loading;
}

export function youglishQuery(text) {
  return speakable(text).replace(/[,.!?]+$/g, '').replace(/^,\s*/, '').trim();
}

let seq = 0;
export function mountYouglish(box, text) {
  const query = youglishQuery(text);
  const id = 'yg-widget-' + (++seq);
  const holder = h('div', { id, class: 'yg-holder' });
  const status = h('p', { class: 'muted small' }, '원어민 영상을 불러오는 중이에요…');
  fill(box, 
    status,
    holder,
    h('p', { class: 'yg-credit' },
      'Powered by ',
      h('a', { href: 'https://youglish.com', target: '_blank', rel: 'noopener' }, 'YouGlish.com'),
      ' · ',
      h('a', { href: 'https://www.youtube.com/t/terms', target: '_blank', rel: 'noopener' }, 'YouTube 약관'),
      ' · ',
      h('a', { href: 'https://policies.google.com/privacy', target: '_blank', rel: 'noopener' }, 'Google 개인정보처리방침'),
    ),
  );
  loadYG()
    .then((YG) => {
      status.remove();
      const w = new YG.Widget(id, { components: 254, restrictionMode: 1, autoStart: 0 });
      w.fetch(query, 'english', 'us');
    })
    .catch(() => {
      status.textContent = '여기서는 원어민 영상을 열 수 없어요. 실제 웹앱 주소에서 열면 보여요.';
    });
}
