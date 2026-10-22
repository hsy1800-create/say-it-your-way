// 원어민 소리 파일 목록을 만든다.
// 모델 책 문장, 책 속 낱말, 문장틀, 오늘의 덩어리, 낱말 사전, 표현사전에서 읽을 글을 모아
//   src/data/audio.json      (글 → 소리 파일 이름, 앱이 씀)
//   scripts/audio-todo.json  (아직 없는 소리 파일 목록, make-audio.py가 씀)
// 을 쓴다. 실행: node scripts/audio-list.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { speakable, audioKey } from '../src/lib/speech-text.js';

const root = new URL('../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const books = read('src/data/books.json');
const words = read('src/data/words.json');
const phrases = read('src/data/phrases.json');

const he = (t, g) => {
  const m = g === 'he';
  return t.replace(/He\(She\)/g, m ? 'He' : 'She').replace(/he\(she\)/g, m ? 'he' : 'she')
    .replace(/His\(Her\)/g, m ? 'His' : 'Her').replace(/his\(her\)/g, m ? 'his' : 'her')
    .replace(/him\(her\)/g, m ? 'him' : 'her');
};
const hasGender = (t) => /\((She|she|Her|her)\)/.test(t);

const texts = [];
const add = (t) => { if (t && String(t).trim()) texts.push(String(t)); };

for (const b of books) {
  for (const pg of b.modelBook) {
    add(pg.en);
    // 책 속 낱말을 누르면 그 낱말만 읽는다.
    for (const part of pg.en.split(/\s+/)) add(part.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, ''));
  }
  b.chunks.forEach(add);
  for (const pg of b.pages) {
    for (const f of Object.values(pg.frames)) {
      if (hasGender(f)) { add(he(f, 'he')); add(he(f, 'she')); } else add(f);
    }
  }
}
for (const w of words) {
  w.en.split(' / ').forEach(add);
  add(w.past);
}
for (const p of phrases) {
  add(p.en);
  add(p.easy);
  add(p.ex);
}

const manifest = {};
const todo = [];
for (const t of texts) {
  const key = audioKey(t);
  if (!key || manifest[key]) continue;
  const file = createHash('sha1').update(key).digest('hex').slice(0, 12) + '.mp3';
  manifest[key] = file;
  if (!existsSync(new URL(`public/audio/${file}`, root))) todo.push({ file, say: speakable(t) });
}

writeFileSync(new URL('src/data/audio.json', root), JSON.stringify(manifest) + '\n');
writeFileSync(new URL('scripts/audio-todo.json', root), JSON.stringify(todo, null, 1) + '\n');
console.log(`소리 ${Object.keys(manifest).length}개, 새로 만들 것 ${todo.length}개`);
