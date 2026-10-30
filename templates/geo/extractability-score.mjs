// Extractability score (0 to 100): how easy is this page for an answer engine to quote?
// ILLUSTRATIVE: the checks follow the GEO features described in module 08, but the
// weights are this template's own, not the original project's (that code is not reproduced here).
// Zero dependencies. Usage: node extractability-score.mjs page.html [more.html ...]

import { readFileSync } from 'node:fs';

const text = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export const CHECKS = {
  // Intro states a concrete answer (a number, a yes/no, a recommendation) in its first 300 chars.
  answerFirst: { weight: 25, test: (h) => {
    const first = text((h.match(/<p[^>]*>[\s\S]*?<\/p>/i) || [''])[0]).slice(0, 300);
    return /\d/.test(first) || /\b(yes|no|best|choose|avoid|recommend)\b/i.test(first);
  } },
  // A key-takeaways / TL;DR block near the top.
  takeaways: { weight: 20, test: (h) => /data-geo="takeaways"|class="[^"]*takeaways|<(h2|h3|strong)[^>]*>\s*(key takeaways|tl;?dr|in short)/i.test(h) },
  // At least one semantic table: caption + header cells with scope.
  semanticTable: { weight: 15, test: (h) => /<table[\s\S]*?<caption>[\s\S]*?<th[^>]+scope=/i.test(h) },
  // Headings phrased as the questions people ask.
  questionHeadings: { weight: 15, test: (h) => (h.match(/<h[23][^>]*>[^<]*\?\s*<\/h[23]>/gi) || []).length >= 2 },
  // Concrete, quotable facts: prices, durations, distances.
  facts: { weight: 15, test: (h) => (text(h).match(/\d+(?:[.,]\d+)?\s?(?:€|eur|usd|\$|%|days?|nights?|hours?|km|min)\b/gi) || []).length >= 3 },
  // Structured data that matches the visible FAQ.
  faqSchema: { weight: 10, test: (h) => /"@type"\s*:\s*"FAQPage"/.test(h) },
};

export function scoreExtractability(html) {
  const results = Object.fromEntries(Object.entries(CHECKS).map(([k, c]) => [k, Boolean(c.test(html))]));
  const score = Object.entries(results).reduce((s, [k, ok]) => s + (ok ? CHECKS[k].weight : 0), 0);
  return { score, results };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) {
    const before = '<p>Picture yourself landing in Hanoi at dawn...</p><h2>Getting around</h2><p>Buses exist.</p>';
    const after = `<div data-geo="takeaways"><strong>Key takeaways</strong><ul><li>Night bus Hanoi to Hue: about 12 hours.</li></ul></div>
<p>Short answer: take the night train if you have 3 days or less; it saves a hotel night.</p>
<h2>Is the night bus or the train better?</h2><table><caption>Hanoi to Hue</caption><tr><th scope="col">Option</th><th scope="col">Time</th></tr><tr><td>Bus</td><td>12 hours</td></tr></table>
<h2>How much does it cost?</h2><p>Budget 20 € for the bus, 35 € for a sleeper berth, 2 days minimum.</p>`;
    console.log('before:', scoreExtractability(before));
    console.log('after: ', scoreExtractability(after));
  }
  for (const f of files) console.log(f, scoreExtractability(readFileSync(f, 'utf8')));
}
