// Truth pack: build a whitelist of what the SOURCE actually contains, then list
// everything in the generated text that is not on it. Pattern from module 06
// (source: src/anti-hallucination/truth-pack.js and anti-hallucination-guard.js).
// Zero dependencies. Demo: node truth-pack.mjs

export function normalize(s) {
  return typeof s !== 'string' ? '' : s.trim().replace(/\s+/g, ' ').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const uniq = (arr) => [...new Set(arr.map(normalize).filter(Boolean))];

// Capitalised words are candidate named entities, including at sentence start.
// Expect false positives:
// keep a stop list and grow it as you review warnings.
const STOP = new Set(['the', 'this', 'here', 'budget', 'checklist', 'faq', 'tip', 'note', 'day', 'week']);
function properNouns(text) {
  const out = [];
  for (const m of text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g)) {
    if (!STOP.has(m[1].toLowerCase())) out.push(m[1]);
  }
  return out;
}

function numbers(text) {
  return (text.match(/\d+(?:[.,]\d+)?\s?(?:%|€|eur|usd|\$|days?|nights?|hours?|km)?/gi) || [])
    .map(n => n.replace(/\s+/g, '').toLowerCase());
}

// Invariant: arrays always defined, never null; nothing is guessed.
export function buildTruthPack(source = {}) {
  const text = [source.title, source.body].filter(Boolean).join('\n');
  return {
    sourceId: source.url ?? null,
    allowed: {
      entities: uniq([...(source.locations || []), ...properNouns(text)]),
      numbers: uniq(numbers(text)),
    },
  };
}

export function checkAgainstTruthPack(generated, pack, { extraAllowed = [] } = {}) {
  const allowedEntities = new Set([...pack.allowed.entities, ...extraAllowed.map(normalize)]);
  const allowedNumbers = new Set(pack.allowed.numbers);
  const unknownEntities = uniq(properNouns(generated)).filter(e => !allowedEntities.has(e));
  const unknownNumbers = [...new Set(numbers(generated))].filter(n => !allowedNumbers.has(n));
  // Start in warn mode. Promote a rule to blocking only once you know its false-positive rate.
  const status = unknownEntities.length || unknownNumbers.length ? 'warn' : 'pass';
  return { status, unknownEntities, unknownNumbers };
}

// ---------- Demo ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const source = {
    url: 'https://source.example/thread/123',
    title: 'Two weeks in Vietnam on a budget',
    body: 'I spent 14 days between Hanoi and Hoi An. Hostels were 8 € a night, the night bus took 15 hours.',
  };
  const generated = 'Lucas spent 14 days between Hanoi and Da Nang. Hostels cost 8 € but the train took 17 hours.';
  const pack = buildTruthPack(source);
  console.log(pack);
  console.log(checkAgainstTruthPack(generated, pack));
  // -> flags "lucas" (name not in the source), "da nang" (new place), "17hours" (unsupported number)
}
