# 🧰 Templates

Small, self-contained starter files distilled from the modules. No dependencies beyond Node.js 20+. Every `.mjs` file runs a demo when executed directly.

| File | Module | What it is | Try it |
|---|---|---|---|
| [`github-actions/content-cron.yml`](github-actions/content-cron.yml) | 01 | Queue-driven daily workflow with dry run, concurrency guard and state commit | copy to `.github/workflows/` |
| [`quality-gate/quality-loop.mjs`](quality-gate/quality-loop.mjs) | 05 | Gates, weighted panel, decider, early exit, diff-guard with one retry | `node quality-gate/quality-loop.mjs` |
| [`truth-pack/truth-pack.mjs`](truth-pack/truth-pack.mjs) | 06 | Source whitelist and a warn-mode checker for entities and numbers | `node truth-pack/truth-pack.mjs` |
| [`json-ld/build-json-ld.mjs`](json-ld/build-json-ld.mjs) | 07 | Article, FAQPage, BreadcrumbList, TouristDestination derived from the HTML | `node json-ld/build-json-ld.mjs` |
| [`geo/extractability-score.mjs`](geo/extractability-score.mjs) | 08 | Illustrative 0 to 100 extractability score | `node geo/extractability-score.mjs page.html` |
| [`geo/robots-ai-allow.txt`](geo/robots-ai-allow.txt) | 08 | `robots.txt` with the 18 AI crawler allow blocks | copy, then test with `curl -A` |
| [`geo/llms.txt.template`](geo/llms.txt.template) | 08 | `llms.txt` skeleton with a pre-publish checklist | fill in by hand |
| [`cost-tracker/cost-tracker.mjs`](cost-tracker/cost-tracker.mjs) | 10 | Per-call cost ledger, JSONL persistence, report | `node cost-tracker/cost-tracker.mjs` |

Notes:

- These are generic rewrites, not copies of the original files. The original code lives in the original pipeline repo (private, French).
- Prices in the cost tracker are examples. Check your provider's pricing before relying on any number it prints.
- Nothing here contains a credential. Read secrets from the environment, never with a literal fallback.
