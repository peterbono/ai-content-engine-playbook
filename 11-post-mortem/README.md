# 11 · Post-mortem: what worked, what didn't, why it was stopped

**Time:** 25 min · **You'll get:** a timeline, an honest scorecard, and a pre-build checklist that would have saved months.

## 🗓️ Timeline

| Date | Event | Source |
|---|---|---|
| 2025-09-25 | Export of an earlier generation of the site (64 posts, no overlap with later content) | archive README |
| 2025-10-02 | Pipeline repo created | GitHub API |
| 2026-02-23 | First run in the cost ledger | `cost-history.jsonl` |
| 2026-03 | Quality loop built; 285 of the 300 logged runs happen this month | `cost-history.jsonl` |
| 2026-04-17 | Last article generation; a crawl that day lists 140 articles | archive README |
| 2026-04-24 | "Plan C" reset: 30 near-duplicates deleted, 29 redirects | archive README, project brief |
| 2026-05-03 | Cloudflare rule returning 503 to Googlebot fixed | `publish-article.yml` comment |
| 2026-05-05 | Daily publishing cron suspended again: the brief "produces low commercial-intent fluff" | `publish-article.yml` comment |
| 2026-05-18 | Last reel published | archive README |
| 2026-06-11 | GEO pivot live: 37 articles restructured, AI crawlers unblocked, IndexNow | project notes |
| 2026-10-25 | Domain expired and was not renewed; content archived through the still-running host | archive README |

The archive README sums up the state on the last day: 38 articles online, **0 EUR of affiliate revenue for the year**, $20.18 of cumulative LLM spend, 3 Instagram followers, 6 Facebook, 29 TikTok, project dormant since May 2026.

## ✅ What worked

- **The engineering.** A solo builder shipped a pipeline of roughly 12k lines with 17 GitHub Actions workflow files, a weighted review panel, a diff-guard, a truth pack, a 57-pass finalizer, a reel factory and a dashboard, with no servers and no database.
- **Cost.** $20.18 for 300 generation runs, median $0.066 per run. Cost was never the problem.
- **Deterministic planning.** Calendar, angle hunter and affiliate placement were plain code with debug signals. Problems were traceable.
- **Safe batch operations.** The GEO reformatter was dry-run by default, needed two flags to go live, wrote before/after files, and reported 33 improved and 0 regressed out of 37.
- **Manual where it mattered.** TikTok, reposted by hand, outperformed every automated channel.

## ❌ What didn't

| Problem | Evidence |
|---|---|
| **No demand signal was validated before building supply** | 0 EUR affiliate revenue year to date (Travelpayouts snapshot, 2026-10-25); social followers 3 / 6 / 29 |
| **Internal quality scores were disconnected from outcomes** | Panel median 93.35, 45 of 46 approved; the integrity judge's own rubric starts every article at 85 |
| **Sameness** | "arbitrage" 251 times and "dilemme" 97 times across 38 articles; 5 slugs built on the same word |
| **Cannibalization** | 4 of 38 live articles answer "Thailand or Vietnam for a first trip" |
| **Volume, then deletion** | 140 articles in April, 38 at the end; 30 deleted in one evening |
| **Infrastructure silently blocking crawlers** | 503 to Googlebot until 2026-05-03; 403 to AI crawlers until the CDN's AI-blocking settings were turned off |
| **Automation that outlived the project** | Daily analytics job still committing on 2026-10-30, five days after the domain lapsed |
| **Secrets in the source tree** | A scan for this playbook found credentials hardcoded in the pipeline's source files (see the note below) |

## 🛑 Why it was stopped

The domain came up for renewal while the site was earning nothing from affiliates, growing nowhere on social, and had not had a new article since April. Renewing hosting and domain for a site with zero revenue for the year was not justified. The domain was let go on 2026-10-25. Before the hosting expired too, the content was pulled through the WordPress REST API by forcing DNS resolution to the host (`curl --resolve your-domain:443:<HOST_IP>`): 38 articles with full bodies, 60 rendered pages, 387 media files, the `robots.txt` and `llms.txt`, and the metrics files this playbook is built on. The Wayback Machine had only four captures of the homepage and no articles; without that last pull, almost nothing would have survived.

## 🧠 Lessons worth stealing

1. **Validate demand by hand first.** Write five articles yourself, get them indexed, and see whether anyone clicks before you automate article number six. A pipeline multiplies whatever demand exists, including zero.
2. **Your eval measures your rubric, not the market.** LLM judges are useful for catching bugs. They cannot tell you if anyone wants the page. Tie at least one gate to an external signal: impressions, clicks, saves.
3. **Volume is a liability.** In a trust-sensitive niche, dozens of similar AI-written pages on a young domain is a pattern search engines are built to discount. The project's own brief describes the domain as "in recovery from scaled-content signal de-prioritization". Publish fewer pages, each with something nobody else has.
4. **First-hand material is the moat.** The best idea came late: real photos taken in the country, inserted automatically ([module 06](../06-anti-hallucination-and-live-data/)). Build the pipeline around what only you can provide.
5. **Distribution belongs on channels you own.** Forum and Reddit promotion nearly cost an account; it was switched off for good. Test reach manually on each owned channel before automating any of them.
6. **Check the site the way machines see it.** Crawler user agents, AI crawler user agents, rendered HTML. Twice the CDN was the real blocker.
7. **Write the shutdown checklist on day one.** Disable schedules, rotate every credential, scan the repo, export the content while the host still answers.

## 🔐 A note on secrets

While preparing this playbook, a read-only scan of the pipeline repo found credentials committed in the source tree (social-platform secrets used as fallbacks in webhook handlers, and a CMS application password in several scripts). The repo was made private. The lesson is general: neither deleting a secret in a new commit nor making a repo private un-leaks it, because history and forks keep copies. Rotate the credential, read secrets only from the environment, and run a secret scanner (`gitleaks`, `trufflehog`) in CI before every push.

## ✅ Pre-build checklist (copy into your project README)

- [ ] I have 5 hand-written pages live and I know their impressions and clicks.
- [ ] I can name the one thing my pages have that competitors' pages do not.
- [ ] Every number in my prompts and few-shot examples is either real and cited, or clearly a placeholder.
- [ ] At least one publish gate uses an external signal, not only an LLM judge.
- [ ] I have a duplicate-intent check before anything enters the queue.
- [ ] I tested my site with Googlebot, GPTBot and ClaudeBot user agents.
- [ ] Secrets come only from the environment, and CI runs a secret scanner.
- [ ] I have a written shutdown procedure: crons, credentials, export.

---
[← 10 Cost tracking](../10-cost-tracking-and-dashboard/) · [Back to the course overview](../README.md)
