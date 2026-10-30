# 01 · Architecture & orchestration

**Time:** 30 min · **You'll build:** a cron-driven pipeline skeleton with a queue, dry-run flags and concurrency control.

## 🎯 Goal

Run a multi-step content pipeline every day without a server, a queue service, or a database. Make every step observable and every run safe to repeat.

## What FlashVoyage did

The whole system ran on **GitHub Actions**. At archive time the pipeline repo held 17 workflow files: article publishing, a content-intelligence job, daily analytics, indexing pings, reels (three daily slots), social posts, a weekly "money page" job, smoke tests for the video pipeline, and a daily digest email. Each one is a cron line plus `npm ci` plus one Node entry point.

State lived in **JSON and JSONL files committed back to the repo**: the publication queue, the editorial calendar state, the cost ledger, article scores, the reel-to-article map. A separate Next.js dashboard read those files through the GitHub API (see [module 10](../10-cost-tracking-and-dashboard/)).

The article pipeline itself is a chain of plain modules:

```
calendar -> source fetch -> semantic extraction -> pattern detection -> story compiler
  -> angle hunter -> generator -> auto-critique -> live data -> affiliate plan
  -> SEO optimizer -> editorial enhancer -> finalizer (57 passes) -> anti-hallucination
  -> quality loop (gates + panel + rewrite) -> WordPress publish -> cost ledger
```

## 🧠 The design decision: git is the database

Committing state to the repo gave three things for free: a full history of every queue change, a diff for every score update, and zero infrastructure. The dashboard needed no database either, only a GitHub token.

The cost: the repo became noisy. Of the 1,976 commits on the pipeline repo, 1,353 were authored by `github-actions[bot]` (GitHub API, 2026-10-30). That is fine for a solo project. On a team it would bury human commits, so put bot state on a dedicated branch.

## 🧩 Code: queue-driven publishing

From `.github/workflows/publish-article.yml` (trimmed). The job picks the first pending item whose date has arrived and whose time slot matches:

```yaml
name: Publish an article
on:
  workflow_dispatch:
    inputs:
      dry_run:
        type: choice
        options: ['0', '1']
        default: '0'
  # schedule:              # suspended, see "Pitfalls"
  #   - cron: '0 3 * * *'
  #   - cron: '0 8 * * *'

permissions:
  contents: write          # the job commits state back

concurrency:
  group: publish-article
  cancel-in-progress: false  # never kill a half-published run

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - name: Pick next item from the queue
        id: queue
        run: |
          TODAY=$(date -u +%Y-%m-%d)
          HINT=$(jq -r --arg today "$TODAY" --arg slot "$SLOT" \
            '.queue[] | select(.status=="pending" and .publish_date<=$today and .slot==$slot) | .article_hint' \
            data/publication-queue.json | head -1)
          if [ -z "$HINT" ]; then echo "skip=true" >> $GITHUB_OUTPUT; fi
```

Two details matter more than they look:

- `concurrency` with `cancel-in-progress: false`. A second trigger waits instead of killing a run that is halfway through a WordPress publish.
- An **empty queue is a skip, not a failure**. The workflow stays green and the dashboard shows "nothing to do".

## 🧩 Code: feature flags as the kill switches

From the pipeline README and `config.js`. Every expensive or risky stage has an environment flag:

| Flag | Default | Effect |
|---|---|---|
| `FLASHVOYAGE_DRY_RUN` | `0` | Run everything, publish nothing |
| `FORCE_OFFLINE` | `0` | Block every LLM call (tests, CI) |
| `ENABLE_AFFILIATE_INJECTOR` | `1` | Affiliate placement on/off |
| `ENABLE_ANTI_HALLUCINATION_BLOCKING` | `1` | Guard blocks, or only warns |
| `ENABLE_MARKETING_PASS` | `1` | Conversion rewrite pass |

`FORCE_OFFLINE` is the one to copy first. The LLM client checks it before creating a client at all, so a test can never spend money by accident.

## ⚠️ Pitfalls Florian actually hit

1. **Two orchestrators drifted apart.** `PIPELINE-AUDIT.md` documents that the production entry point (`enhanced-ultra-generator.js`) had silently merged three steps into one, skipped the SEO optimizer, and moved the affiliate step, while a cleaner `pipeline-runner.js` followed the documented order. Keep one orchestrator, and generate the step list in your docs from code.
2. **A cron that keeps running after you stop.** The last article was generated on 2026-04-17 and the project was stopped on 2026-10-25, yet the daily analytics job was still committing on 2026-10-30. When you stop a project, disable the schedules first.
3. **Automating volume before quality.** The daily publish cron was re-suspended on 2026-05-05 with this note in the workflow: the daily brief "produces low commercial-intent fluff". Cron makes it easy to publish more; it does nothing to make publishing worth it.
4. **The CDN can block your own crawlers.** The same workflow notes that a Cloudflare rule had been returning 503 to Googlebot until a fix on 2026-05-03. Monitor your site the way a crawler sees it (see [module 08](../08-geo-answer-engines/)).

## ✅ Checklist / exercise

- [ ] Write one workflow with `workflow_dispatch` + `schedule`, a `dry_run` input, a `concurrency` group and a `timeout-minutes`.
- [ ] Put the queue in `data/queue.json`. Make "no item due" exit 0.
- [ ] Add `FORCE_OFFLINE` to your LLM client and run the whole pipeline once with it set.
- [ ] Decide where bot commits go (main, or a `data` branch) before the first cron fires.
- [ ] Write a one-line "how to stop everything" in your README: which workflows to disable, in which order.

Starter file: [`templates/github-actions/content-cron.yml`](../templates/github-actions/content-cron.yml)

---
[Next: 02 Sourcing signals →](../02-sourcing-signals/)
