// Quality loop skeleton: deterministic gates, weighted review panel, decider,
// best-version tracking, early exit, and a diff-guard that vetoes bad rewrites.
// Pattern from module 05 (source: quality-loop-publisher.js, review-agents.js).
// Zero dependencies. Run the demo with: node quality-loop.mjs

// ---------- 1. Deterministic gates (cheap, run first) ----------

export function runGates(html) {
  const issues = [];
  const internalLinks = countInternalLinks(html);
  if (!/<h2[\s>]/i.test(html)) issues.push({ severity: 'critical', gate: 'structure', message: 'no H2' });
  if (internalLinks < 3) issues.push({ severity: 'major', gate: 'links', message: `only ${internalLinks} internal links` });
  if (/\{\{[^}]+\}\}|\[url\]|\[link\]/i.test(html)) issues.push({ severity: 'critical', gate: 'placeholders', message: 'placeholder left in text' });
  const open = (html.match(/<(p|h2|h3|ul|ol|a)\b/gi) || []).length;
  const close = (html.match(/<\/(p|h2|h3|ul|ol|a)>/gi) || []).length;
  if (Math.abs(open - close) > 2) issues.push({ severity: 'major', gate: 'html', message: `tag imbalance ${open}/${close}` });
  return issues;
}

// ---------- 2. Weighted panel ----------

// Each reviewer is async (html, ctx) => { score: 0..100, issues: [{severity, message, section?}] }
// In production each one is an LLM call with its own system prompt and a strict JSON schema.
export async function runPanel(reviewers, html, ctx) {
  let total = 0, weights = 0;
  const allIssues = [];
  for (const r of reviewers) {
    const res = await r.review(html, ctx);
    total += res.score * r.weight;
    weights += r.weight;
    for (const i of res.issues) allIssues.push({ ...i, reviewer: r.id });
  }
  return { weightedScore: Math.round((total / weights) * 10) / 10, allIssues };
}

// Deterministic version of the "CEO" rules. You can also make this an LLM call
// that receives the panel reports, but keep the hard rules in code.
export function decide({ weightedScore, allIssues }, { approveAt = 85, rejectBelow = 80 } = {}) {
  const critical = allIssues.filter(i => i.severity === 'critical').length;
  if (critical > 0) return 'REJECT';
  if (weightedScore < rejectBelow) return 'REJECT';
  if (weightedScore >= approveAt) return 'APPROVE';
  return 'SOFT_APPROVE';
}

// ---------- 3. Diff-guard: things a rewrite must never do ----------

export function diffGuard(before, after, { sourceUrl, maxLinks = 8, maxNewLinks = 3 } = {}) {
  const v = [];
  const lb = countInternalLinks(before), la = countInternalLinks(after);
  if (la > maxLinks || la > lb + maxNewLinks) v.push(`internal_links_inflated:${lb}->${la}`);
  if (/\{\{[^}]+\}\}/.test(after) && !/\{\{[^}]+\}\}/.test(before)) v.push('placeholders_reintroduced');
  if (sourceUrl && before.includes(sourceUrl) && !after.includes(sourceUrl)) v.push('source_url_removed');
  if (after.length < before.length * 0.6) v.push('content_shrunk_over_40pct');
  return v;
}

// ---------- 4. The loop ----------

export async function qualityLoop({ html, ctx, reviewers, rewrite, maxLoops = 3 }) {
  let best = { score: -Infinity, html }, previous = null, current = html;
  const trace = [];

  for (let iter = 1; iter <= maxLoops; iter++) {
    const gateIssues = runGates(current);             // feed the rewriter, not the score
    const panel = await runPanel(reviewers, current, ctx);
    const decision = decide(panel);
    trace.push({ iter, score: panel.weightedScore, decision, gateIssues: gateIssues.length });

    if (panel.weightedScore > best.score) best = { score: panel.weightedScore, html: current };
    if (previous !== null && panel.weightedScore < best.score - 1) { current = best.html; break; } // regression
    if (previous !== null && Math.abs(panel.weightedScore - previous) < 2) { current = best.html; break; } // stagnation
    previous = panel.weightedScore;

    if (decision === 'APPROVE' && gateIssues.length === 0) break;

    // Rewrite, with one retry if the diff-guard vetoes the first attempt.
    // A vetoed rewrite never reaches the panel, so it costs no review calls.
    const issues = [...gateIssues, ...panel.allIssues];
    let accepted = null;
    for (let attempt = 1; attempt <= 2 && !accepted; attempt++) {
      const candidate = await rewrite(current, issues);
      const violations = diffGuard(current, candidate, { sourceUrl: ctx.sourceUrl });
      if (violations.length) trace.push({ iter, attempt, rollback: violations });
      else accepted = candidate;
    }
    if (!accepted) break;          // nothing safe to try: keep the best version
    current = accepted;
  }
  // Return the best version that was actually scored, never an unscored rewrite.
  return { html: best.html, bestScore: best.score, trace };
}

function countInternalLinks(html, host = ctxHost) {
  const re = new RegExp(`<a\\b[^>]*href=["']https?://(?:www\\.)?${host.replace(/\./g, '\\.')}[^"']*["']`, 'gi');
  return (html.match(re) || []).length;
}
let ctxHost = 'example.com';
export function setSiteHost(host) { ctxHost = host; }

// ---------- Demo with fake reviewers (no API calls) ----------

if (import.meta.url === `file://${process.argv[1]}`) {
  const link = (p) => `<a href="https://example.com/${p}/">${p}</a>`;
  const draft = `<p>Intro.</p><h2>Budget</h2><p>Prices ${link('a')} ${link('b')}.</p>
<p>Source: https://source.example/thread</p>`;

  const reviewers = [
    { id: 'seo', weight: 1, review: async h => ({ score: countInternalLinks(h) >= 3 ? 90 : 72, issues: countInternalLinks(h) >= 3 ? [] : [{ severity: 'major', message: 'needs 3 internal links' }] }) },
    { id: 'editorial', weight: 1.5, review: async () => ({ score: 88, issues: [] }) },
    { id: 'integrity', weight: 1, review: async h => ({ score: h.includes('source.example') ? 90 : 60, issues: [] }) },
  ];

  let attempt = 0;
  const rewrite = async (h) => {
    attempt++;
    // First rewrite misbehaves (drops the source and spams links), second one is reasonable.
    if (attempt === 1) return h.replace(/<p>Source:.*<\/p>/, '') + [1, 2, 3, 4, 5, 6, 7].map(i => link('x' + i)).join(' ');
    return h.replace(link('b'), `${link('b')} ${link('c')}`);
  };

  const out = await qualityLoop({ html: draft, ctx: { sourceUrl: 'https://source.example/thread' }, reviewers, rewrite });
  console.log(JSON.stringify(out.trace, null, 2));
  console.log('best score:', out.bestScore);
}
