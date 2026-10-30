# 05 · Quality gates & multi-agent review panel

**Time:** 45 min · **You'll build:** deterministic gates, a weighted panel of LLM reviewers with a final decider, a bounded rewrite loop, and a diff-guard that undoes harmful rewrites.

## 🎯 Goal

Let nothing reach "publish" on the generator's word. Every article passes cheap deterministic checks, then a panel of specialised reviewers, then targeted fixes, and the loop stops before it starts making things worse.

## What FlashVoyage did

`quality-loop-publisher.js` is the orchestrator. Its header lists the loop:

```
1. Generate (pipeline runner)
2. Validation gates (pre-publish-validator.js): HTML completeness, fact-check, internal links, SEO meta
3. Multi-agent panel: 5 experts + a "CEO"
4. If REJECT: targeted LLM rewrite, then back to step 2
5. Publish to WordPress
6. Optional post-publication check
```

The five reviewers live in `review-agents.js`, each with its own system prompt and weight:

| Agent | Weight | Looks for |
|---|---|---|
| SEO | 1 | intent, title tag, density, structure |
| Affiliation | 1 | relevance and placement of affiliate modules |
| Editorial | 1.5 | voice, narrative, AI tells |
| UX/Bugs | 1.5 | broken HTML, wrong images, dead links |
| Integrity | 1 | implausible prices, contradictions, unsupported claims |

The CEO agent receives the five reports and returns JSON: `APPROVE`, `SOFT_APPROVE` or `REJECT`, a reasoning line, a prioritised `critical_fixes` list, and `generator_recommendations` for improving the generator itself. Its rules are explicit: any single critical bug means reject; weighted score below 80 means reject; 85 or more with zero criticals means approve.

Before the panel there is also a **finalizer** of 57 registered passes (`finalizer-pass-registry.js`), each with a group, a risk level, and a list of passes it conflicts with, plus invariant checks between phases (`finalizer-invariants.js`).

## 🧠 The design decisions

1. **Gates feed the rewriter, not the score.** Deterministic gate issues are converted into the same issue format as the panel's, but they "don't affect panel scores". Two kinds of signal, kept apart.
2. **Surgical rewrites first.** Issues carry a location. The rewriter groups them by H2 section and rewrites only the sections with problems, with rules like "fix only the listed issues", "keep the HTML structure", "keep roughly the same length". Full-article rewrite is the fallback.
3. **Keep the best version, not the last one.** Each iteration's score is compared to the best so far.
4. **A diff-guard can veto a rewrite.** Even when the panel asked for it.

## 🧩 Code: weighted panel score

From `review-agents.js`:

```js
let total = 0, weights = 0;
for (const r of results) {
  const w = AGENTS[r.agentId].weight;        // 1 or 1.5
  total += (r.score || 0) * w;
  weights += w;
  for (const issue of r.issues) allIssues.push({ ...issue, agent: r.agentId });
}
const weightedScore = Math.round((total / weights) * 10) / 10;
```

## 🧩 Code: early exit on regression or stagnation

From `quality-loop-publisher.js` (trimmed):

```js
if (currentScore > bestScore) { bestScore = currentScore; bestHtml = article.content; }

// Any regression of more than 1 point from the best: roll back and stop.
if (previousScore !== null && currentScore < bestScore - 1) {
  article.content = bestHtml; break;
}
// Score barely moved: keep the best version and stop.
if (previousScore !== null && Math.abs(currentScore - previousScore) < 2) {
  if (bestScore > currentScore) article.content = bestHtml;
  break;
}
previousScore = currentScore;
```

There is also a hard cap (`--max-loops`, default 3) and optional score stages (for example 88, then 92, then 95).

## 🧩 Code: the diff-guard

From `quality-loop-publisher.js`. After a rewrite, compare before and after on things a rewrite must never do:

```js
const buildRewriteDiffViolations = (before, after, { sourceUrl } = {}) => {
  const v = [];
  const linksBefore = countInternalLinks(before), linksAfter = countInternalLinks(after);
  if (linksAfter > 8 || linksAfter > linksBefore + 3) v.push(`internal_links_inflated:${linksBefore}->${linksAfter}`);
  if (hasBrokenPlaceholderTokens(after)) v.push('placeholders_reintroduced');
  if (sourceUrl && hasSourceUrl(before, sourceUrl) && !hasSourceUrl(after, sourceUrl)) v.push('source_url_removed');
  return v;
};

const violations = buildRewriteDiffViolations(preRewriteHtml, article.content, { sourceUrl });
if (violations.length) article.content = preRewriteHtml;   // roll back, log the reason
```

Each check targets something an LLM rewrite can do while "fixing" an issue: stuff in internal links to please the SEO reviewer, bring back broken placeholder tokens (the code hunts strings like `2quelques`, a number glued to the French word for "a few"), or delete the source citation. The same placeholder strings also appear in the finalizer invariants, which tells you they showed up more than once.

A runnable version of this whole loop, with no dependencies, is in [`templates/quality-gate/`](../templates/quality-gate/).

## ⚠️ Pitfalls Florian actually hit

1. **Generous judges.** The integrity agent's prompt contains its own calibration: score = 85, minus 15 per critical, minus 8 per major, minus 3 per minor, plus 3 per strength, minimum 50, and "an article published without a critical bug always scores at least 80". Over the 46 runs with a recorded panel score (2026-03-17 to 2026-03-23), scores ranged from 83.8 to 96.5 with a median of 93.35, and 45 of 46 were approved. Those same articles earned no measurable business result ([module 11](../11-post-mortem/)). A panel tells you an article meets *your rubric*. It cannot tell you anyone wants to read it.
2. **Reviewers fight each other.** The SEO reviewer wants more links, the editorial reviewer wants fewer interruptions, the affiliation reviewer wants modules higher. The first rule of the diff-guard is a cap on internal links, which tells you which reviewer wins when nothing stops it. Make conflicting goals explicit as hard limits in code.
3. **Passes that cancel each other.** The pass registry documents conflicts honestly: two passes are marked "wasted" because a later QA pass strips every blockquote they add. With 57 passes, ordering bugs are inevitable; a registry with `conflicts` and `risk` fields is how you find them.
4. **Truncation reported as a bug.** Reviewers got truncated HTML and flagged "article ends abruptly". The UX prompt had to say: if you see the truncation marker, it is not a bug. Tell every reviewer exactly what it is and is not seeing.

## ✅ Checklist / exercise

- [ ] Write three deterministic gates that run in under a second (HTML balance, min internal links, no placeholders).
- [ ] Define three reviewers with weights and a strict JSON output schema. Compute a weighted score.
- [ ] Implement best-version tracking and the two early exits. Cap the loop at 3.
- [ ] Add a diff-guard with at least two "a rewrite must never..." rules.
- [ ] Calibrate: score five articles you consider bad. If any gets above your publish threshold, your judges are too kind.

---
[← 04 Generation](../04-generation-with-llms/) · [Next: 06 Anti-hallucination & live data →](../06-anti-hallucination-and-live-data/)
