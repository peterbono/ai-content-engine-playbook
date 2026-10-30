# 10 · Cost tracking & the dashboard

**Time:** 30 min · **You'll build:** a per-call LLM cost ledger with per-step and per-model rollups, persisted as JSONL, and a read-mostly dashboard that uses the GitHub repo as its backend.

## 🎯 Goal

Know what every article cost, which step cost the most, and which model did the work, without a database or a paid observability tool.

## What FlashVoyage did

`llm-cost-tracker.js` is a singleton. Every LLM wrapper calls `record(step, model, promptTokens, completionTokens, durationMs)`. At the end of a run, the summary (totals, `byStep`, `byModel`, duration, LLM time ratio, cost per word) is appended as **one JSON line per article** to `data/cost-history.jsonl`, committed to the repo.

The dashboard (`peterbono/flashvoyage-dashboard`, Next.js App Router, TypeScript) reads that file straight from GitHub, caches it for 5 minutes, and renders cost per article, per step and per model. Other tabs read other committed JSON files (queue, scores, reels), trigger workflows through `workflow_dispatch`, and write queue changes back through the GitHub contents API. Every API route also supports a `?demo=1` mode with fake data, so the UI could be developed and shown without credentials.

## 📊 What the ledger says

All computed from the 300 lines of `cost-history.jsonl` (2026-02-23 to 2026-04-17):

| Measure | Value |
|---|---|
| Total spend | $20.18 |
| Distinct articles | 108 |
| Median run | $0.066, 18 calls, ~42.7k tokens, 5.6 min |
| By model | Claude Haiku 4.5: $14.72 (1,316 calls) · GPT-4o-mini: $2.95 (4,119 calls) · GPT-4o: $2.50 (119 calls) |
| Most expensive steps | `micro-body-sections` $5.69 · `generator-evergreen` $3.43 · `generator-main` $3.16 · `micro-conclusion` $2.72 |
| Busiest month | March 2026, 285 of the 300 runs |

The March spike coincides with the quality loop being built: every run with a recorded panel score dates from 17 to 23 March. Tuning a loop means many runs per article, and the ledger shows it.

## 🧠 The design decisions

1. **Track at the wrapper, not at the call site.** No step can forget to log, because every provider call goes through the same two functions.
2. **One line per article.** Append-only JSONL is diffable in git, trivially parsed by the dashboard, and survives partial runs.
3. **Git as the backend.** No database, no server; the dashboard is a view over files the pipeline already commits. The trade-off is a 5-minute cache and API rate limits.

## 🧩 Code: the ledger

From `llm-cost-tracker.js` (trimmed). A dependency-free version with a test is in [`templates/cost-tracker/`](../templates/cost-tracker/):

```js
// USD per 1M tokens, dated so you remember to update it.
const PRICING = {
  'gpt-4o':            { input: 2.50, output: 10.00 },
  'gpt-4o-mini':       { input: 0.15, output: 0.60 },
  'claude-haiku-4-5':  { input: 1.00, output: 5.00 },
};

function computeCostUSD(model, promptTokens, completionTokens) {
  const p = PRICING[model] || PRICING['gpt-4o'];      // see pitfall 1
  return (promptTokens / 1e6) * p.input + (completionTokens / 1e6) * p.output;
}

record(step, model, promptTokens, completionTokens, durationMs = 0) {
  if (!promptTokens && !completionTokens) return;
  this.records.push({ step, model, promptTokens, completionTokens,
                      costUSD: computeCostUSD(model, promptTokens, completionTokens), durationMs });
}
```

## 🧩 Code: the dashboard reads the repo

From `app/api/github/costs/route.ts` (trimmed):

```ts
const RAW_URL = "https://raw.githubusercontent.com/<owner>/<pipeline-repo>/main/data/cost-history.jsonl";
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { data: unknown; expiry: number } | null = null;

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("demo") === "1") return NextResponse.json(demoCosts());
  if (cache && Date.now() < cache.expiry) return NextResponse.json(cache.data);
  const text = await (await fetch(RAW_URL, { headers: authHeaders() })).text();
  const entries = text.split("\n").filter(Boolean).map(l => JSON.parse(l));
  cache = { data: { entries, total: entries.length, fetchedAt: new Date().toISOString() },
            expiry: Date.now() + CACHE_TTL_MS };
  return NextResponse.json(cache.data);
}
```

## ⚠️ Pitfalls Florian actually hit

1. **Silent price fallback.** Any model name missing from the price table is billed at GPT-4o rates. The Anthropic wrapper also records `model || 'claude-3-5-haiku'` when no model is passed, a key that is not in the table. Make unknown models throw, or at least log loudly.
2. **Three totals for one project.** The ledger sums to $20.18. The content-intelligence snapshot of 2026-10-25 shows a "total invested" of $18.44. An April project brief quotes a much lower Claude-only figure. Each was computed from a different slice. Compute every money number from the ledger, at display time, with the date range shown next to it.
3. **Cost is not the constraint you think.** The median run cost under 7 cents. Cost tracking was excellent and never the reason anything succeeded or failed. Track it, then spend your attention on demand ([module 11](../11-post-mortem/)).
4. **Not every LLM call goes through the ledger.** The reel pipeline has its own `cost-tracker.js` and a `tracked-anthropic.js`. Two ledgers mean two partial truths; route every provider call through one.

## ✅ Checklist / exercise

- [ ] Add a cost ledger to your LLM wrapper. Append one JSONL line per run.
- [ ] Make an unknown model name fail your tests.
- [ ] Print: total, median per run, top 3 steps, cost by model, for the last 30 days.
- [ ] Build one dashboard page that reads the JSONL from your repo, with a `?demo=1` mode.
- [ ] Put the price table's "last updated" date in the dashboard footer.

---
[← 09 Social distribution](../09-social-distribution/) · [Next: 11 Post-mortem →](../11-post-mortem/)
