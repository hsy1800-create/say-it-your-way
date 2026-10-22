import phrases from '../data/phrases.json';
import words from '../data/words.json';

// 띄어쓰기·문장부호를 빼고 비교한다. 아이들은 띄어쓰기를 자주 다르게 쓴다.
export function norm(s) {
  return String(s || '').toLowerCase().replace(/[\s.,!?~"“”'’‘·()\[\]…★*-]/g, '');
}

export const WORD_GROUPS = [...new Set(words.map((w) => w.group))];

// 선생님이 알려준 말(notices)도 사전처럼 함께 찾는다.
function noticePhrases(notices = []) {
  return notices.map((n) => ({
    id: 'n-' + n.id, ko: n.q, tags: [n.q], en: n.en, easy: null, ex: null,
    lessons: [], group: '선생님이 알려준 말', fromTeacher: true,
  }));
}

function scoreKo(q, item) {
  let s = 0;
  for (const t of item.tags) {
    const nt = norm(t);
    if (!nt) continue;
    if (q === nt) s += nt.length * 3;
    else if (q.includes(nt)) s += nt.length * 2;
    else if (q.length >= 2 && nt.includes(q)) s += q.length;
  }
  const nk = norm(item.ko);
  if (q.length >= 2 && nk.includes(q)) s += q.length;
  return s;
}

function scoreEn(q, item) {
  let s = 0;
  if (norm(item.en).includes(q)) s += q.length * 2;
  if (item.past && norm(item.past).includes(q)) s += q.length * 2;
  if (item.easy && norm(item.easy).includes(q)) s += q.length;
  return s;
}

function rank(pool, q, english, lesson, limit) {
  const scored = [];
  for (const it of pool) {
    let s = english ? scoreEn(q, it) : scoreKo(q, it);
    if (!s) continue;
    if (it.fromTeacher) s += 3;
    if (lesson && it.lessons?.includes(lesson)) s += 1.5;
    scored.push({ it, s });
  }
  scored.sort((a, b) => b.s - a.s);
  const seen = new Set();
  const out = [];
  for (const { it } of scored) {
    if (seen.has(it.en)) continue;
    seen.add(it.en);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

// 낱말과 표현을 함께 찾는다. 빈칸에는 낱말이 더 잘 맞으므로 낱말을 먼저 보여 준다.
export function search(query, { lesson, notices = [] } = {}) {
  const q = norm(query);
  if (!q) return { words: [], phrases: [] };
  const english = /[a-z]/.test(q) && !/[가-힣]/.test(q);
  return {
    words: rank(words, q, english, lesson, 8),
    phrases: rank([...noticePhrases(notices), ...phrases], q, english, lesson, 4),
  };
}

export function findPhrases(query, opts = {}) {
  return search(query, opts).phrases;
}

export function wordsInGroup(group) {
  return words.filter((w) => w.group === group);
}

export function phrasesForLesson(lesson) {
  return phrases.filter((p) => p.lessons.includes(lesson));
}
