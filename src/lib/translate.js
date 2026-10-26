// 하고 싶은 말(우리말 문장)을 영어 문장으로 바꿔 본다.
// 1) 크롬·엣지 최신판에 들어 있는 번역기: 노트북 안에서만 돌아가고, 무료이고, 글이 밖으로 나가지 않는다.
//    처음 한 번은 번역기를 내려받느라 조금 걸린다(버튼을 누른 뒤에만 내려받는다).
// 2) 그 번역기가 없는 브라우저는 파파고를 새 탭으로 연다(쓴 글이 미리 들어간다).
export const MAX_LEN = 80;

let translator = null;

export function hasBuiltInTranslator() {
  return typeof self !== 'undefined' && 'Translator' in self;
}

export async function translateKoEn(text, { onProgress } = {}) {
  if (!hasBuiltInTranslator()) throw new Error('unsupported');
  const opts = { sourceLanguage: 'ko', targetLanguage: 'en' };
  const avail = await self.Translator.availability(opts);
  if (avail === 'unavailable') throw new Error('unsupported');
  if (!translator) {
    translator = self.Translator.create({
      ...opts,
      monitor(m) { m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded)); },
    }).catch((e) => { translator = null; throw e; });
  }
  const t = await translator;
  const out = await t.translate(String(text).slice(0, MAX_LEN));
  return out.trim();
}

export function papagoUrl(text) {
  return `https://papago.naver.com/?sk=ko&tk=en&st=${encodeURIComponent(String(text).slice(0, MAX_LEN))}`;
}
