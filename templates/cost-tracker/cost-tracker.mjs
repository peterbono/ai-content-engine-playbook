// LLM cost ledger: record every call, roll up per step and per model,
// append one JSON line per run. Pattern from module 10 (source: llm-cost-tracker.js).
// Zero dependencies. Demo: node cost-tracker.mjs

import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

// USD per 1M tokens. These are EXAMPLE prices: check your provider's pricing page
// and update PRICING_AS_OF whenever you touch this table.
export const PRICING_AS_OF = '2026-03';
export const PRICING = {
  'small-model': { input: 0.15, output: 0.60 },
  'mid-model':   { input: 1.00, output: 5.00 },
  'large-model': { input: 2.50, output: 10.00 },
};

export function costUSD(model, inTok, outTok) {
  const p = PRICING[model];
  // Unlike the original, an unknown model is an error, not a silent fallback.
  if (!p) throw new Error(`No price for model "${model}". Add it to PRICING.`);
  return (inTok / 1e6) * p.input + (outTok / 1e6) * p.output;
}

export class CostLedger {
  constructor() { this.records = []; this.startedAt = Date.now(); }

  record(step, model, inTok, outTok, durationMs = 0) {
    if (!inTok && !outTok) return;
    this.records.push({ step, model, inTok, outTok, costUSD: costUSD(model, inTok, outTok), durationMs });
  }

  summary(meta = {}) {
    const roll = (key) => this.records.reduce((acc, r) => {
      const k = r[key];
      acc[k] ??= { calls: 0, tokensIn: 0, tokensOut: 0, costUSD: 0 };
      acc[k].calls++; acc[k].tokensIn += r.inTok; acc[k].tokensOut += r.outTok; acc[k].costUSD += r.costUSD;
      acc[k].costUSD = Number(acc[k].costUSD.toFixed(6));
      return acc;
    }, {});
    const totalCostUSD = this.records.reduce((s, r) => s + r.costUSD, 0);
    const llmMs = this.records.reduce((s, r) => s + r.durationMs, 0);
    const durationMs = Date.now() - this.startedAt;
    return {
      date: new Date().toISOString(), ...meta,
      totalCalls: this.records.length,
      totalTokensIn: this.records.reduce((s, r) => s + r.inTok, 0),
      totalTokensOut: this.records.reduce((s, r) => s + r.outTok, 0),
      totalCostUSD: Number(totalCostUSD.toFixed(6)),
      durationMs, llmTimeRatio: durationMs ? Number((llmMs / durationMs).toFixed(3)) : 0,
      costPerWord: meta.wordCount ? Number((totalCostUSD / meta.wordCount).toFixed(8)) : null,
      pricingAsOf: PRICING_AS_OF,
      byStep: roll('step'), byModel: roll('model'),
    };
  }

  // One line per run: append-only, diffable in git, easy for a dashboard to read.
  persist(path, meta) {
    mkdirSync(dirname(path), { recursive: true });
    const line = this.summary(meta);
    appendFileSync(path, JSON.stringify(line) + '\n');
    return line;
  }
}

export function report(path) {
  if (!existsSync(path)) return null;
  const rows = readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const costs = rows.map(r => r.totalCostUSD).sort((a, b) => a - b);
  const median = costs.length ? costs[Math.floor((costs.length - 1) / 2)] : 0;
  const steps = {};
  for (const r of rows) for (const [s, v] of Object.entries(r.byStep)) steps[s] = (steps[s] || 0) + v.costUSD;
  return {
    runs: rows.length,
    totalUSD: Number(costs.reduce((a, b) => a + b, 0).toFixed(4)),
    medianUSD: Number(median.toFixed(4)),
    topSteps: Object.entries(steps).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, c]) => [s, Number(c.toFixed(4))]),
  };
}

// ---------- Demo ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const ledger = new CostLedger();
  ledger.record('title', 'small-model', 400, 80, 900);
  ledger.record('body-sections', 'mid-model', 6000, 4500, 40000);
  ledger.record('review-seo', 'small-model', 5000, 300, 3000);
  const path = new URL('./demo-cost-history.jsonl', import.meta.url).pathname;
  console.log(ledger.persist(path, { articleId: 'demo', wordCount: 2400 }));
  console.log(report(path));
  try { ledger.record('oops', 'unknown-model', 10, 10); } catch (e) { console.log('as expected:', e.message); }
}
