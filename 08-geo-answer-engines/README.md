# 08 · GEO: optimizing for AI answer engines

**Time:** 40 min · **You'll build:** an idempotent "make it extractable" pass, a 0 to 100 extractability score with a dry-run batch mode, an AI-crawler-friendly `robots.txt`, and an `llms.txt`.

## 🎯 Goal

Make each page the easiest one on the web for ChatGPT, Claude, Perplexity or Google's AI features to quote correctly: the answer first, facts in clean structures, nothing blocking the crawlers.

## Why FlashVoyage pivoted to GEO (June 2026)

Classic SEO was not working for a young travel site. Search Console showed impressions but almost no clicks, and travel is a crowded, trust-sensitive vertical where a new domain does not outrank booking platforms on authority. The reasoning in the project notes: answer engines do not pick the most authoritative domain the way ranking does; they quote the passage that best answers the question in an extractable form. That is a structure problem, which a pipeline can solve.

> **Source note.** The GEO code was written in a later working copy and is **not** in the pipeline repo snapshot this playbook was built from. The figures in this module come from the project notes dated 2026-06-11. What you can verify in the archive: the `robots.txt` with 18 AI crawlers allowed, the `llms.txt`, and that 36 of the 38 archived articles carry the GEO "À retenir" (key takeaways) block.

## What was built

| Piece | What it does |
|---|---|
| GEO formatter pass (`applyGeoFormatting(html, ctx)`) | Adds a TL;DR "key takeaways" block, turns comparison data into semantic tables (`<caption>`, `<th scope>`, wrapped in `<figure>`), wraps prices and durations in fact spans, detects whether the intro answers first. Idempotent. Registered as a finalizer phase after text normalisation and before translation. |
| More JSON-LD | HowTo, Place / TouristDestination, Product / Offer, on top of Article / FAQPage / Breadcrumb / TravelAction ([module 07](../07-seo-internal-links-json-ld/)) |
| Extractability scorer | `scoreExtractability(html)` returns 0 to 100; also a CLI on a single HTML file |
| Batch reformatter | Re-formats live posts. **Dry-run by default**; pushing requires `--live --confirm`; supports `--ids` and `--limit`; writes before/after files for review |
| AI access snippet | A `robots_txt` filter that explicitly allows 18 AI crawlers, and serves `/llms.txt` |
| llms.txt generator | Builds `llms.txt` from the WordPress REST API |
| IndexNow ping | Submits URLs to IndexNow (Bing, which feeds several answer engines); auto-ping after each publish |

## 📊 Results of the batch run

Dry-run over the 37 published posts, then pushed live on 2026-06-11 with 0 failures:

| Measure | Value |
|---|---|
| Average extractability score | **63.4 to 74.2** |
| Articles improved / regressed | 33 improved, 0 regressed |
| TL;DR block injected | 29 of 37 |
| Semantic tables created | 19 of 37 |
| Fact spans added | 37 of 37 |
| URLs submitted to IndexNow | 38, all accepted (HTTP 202) |

What is **not** in any source: whether AI-assistant traffic went up afterwards. The KPI to watch was the GA4 "AI Assistant" channel; no follow-up measurement was recorded before the project stopped, so this playbook claims none.

## 🧠 The design decisions

1. **Dry-run by default, two flags to go live.** A batch job that rewrites every published page needs a review step. `--live` alone is not enough; `--confirm` is the "yes, really".
2. **Idempotent passes.** Running the formatter twice must not add two TL;DR blocks. That made it safe to run on old and new articles alike, and to re-run after every fix.
3. **Score before and after.** The extractability score turned "is this better for LLMs?" into a number per article, so regressions were visible (there were none in the run above).

## 🧩 Code sketch: an extractability score

The original scorer is not reproduced here, so this is a **sketch of the same idea**, not the real weights. The runnable version is [`templates/geo/extractability-score.mjs`](../templates/geo/extractability-score.mjs):

```js
export function scoreExtractability(html) {
  const checks = {
    answerFirst:   firstParagraphAnswers(html),            // intro states the answer, not a story
    takeaways:     /class="[^"]*takeaways|<h2[^>]*>\s*(key takeaways|tl;?dr)/i.test(html),
    semanticTable: /<table[\s\S]*?<caption>[\s\S]*?<th[^>]+scope=/i.test(html),
    questionH2s:   countQuestionHeadings(html) >= 2,       // headings phrased like queries
    facts:         countPricesAndDurations(html) >= 3,     // concrete, quotable numbers
    faqSchema:     /"@type"\s*:\s*"FAQPage"/.test(html),
  };
  const weights = { answerFirst: 25, takeaways: 20, semanticTable: 15, questionH2s: 15, facts: 15, faqSchema: 10 };
  return Object.entries(checks).reduce((s, [k, ok]) => s + (ok ? weights[k] : 0), 0);
}
```

## 🧩 Let the crawlers in

The archived `robots.txt` (2026-10-25) keeps normal rules and then adds an explicit block per AI crawler:

```txt
# --- AI access: explicitly allow AI/LLM crawlers ---
User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /
# ... 18 user agents in total
```

Full list and an `llms.txt` skeleton: [`templates/geo/`](../templates/geo/).

## ⚠️ Pitfalls Florian actually hit

1. **The CDN was blocking the AI crawlers, not WordPress.** After deploying the allow rules, AI bots still got HTTP 403. The cause was two Cloudflare zone settings: a "block AI bots" firewall setting, and a managed `robots.txt` that injected `Disallow` blocks and a `Content-Signal: ai-train=no` line. Both had to be turned off in the dashboard. Always test with the real user agents: `curl -A "GPTBot" -I https://your-site/`.
2. **The CMS strips your markup.** WordPress removed `class` attributes on render, while `data-*` attributes survived. Style and mark up GEO blocks with attributes your CMS keeps, and check the rendered page, not the HTML you sent.
3. **Auto-generated `llms.txt` inherits junk.** Descriptions pulled from post excerpts carried site boilerplate and one broken placeholder. The version archived in October 2026 is minimal: a site description and a single link to the index. Generate it, then read it like a human.
4. **Conservative passes skip the pages that matter.** The TL;DR injector declined to act on about 8 intros, including the three pages with the most Search Console visibility. Check the top pages by hand after any batch.
5. **Off-page "GEO hacks" are spam.** Seeding answers with your links on Reddit, Quora or forums is a common recommendation. Florian had already nearly lost an account to it, and the repo's forum linkbuilding workflows were turned off. Distribution belongs on channels you own.

## ✅ Checklist / exercise

- [ ] Write an idempotent pass that adds a key-takeaways block. Run it twice on the same HTML and diff.
- [ ] Score 10 of your pages with the template scorer, fix the lowest one, re-score.
- [ ] Build a batch job that is dry-run unless given `--live --confirm`, and writes before/after files.
- [ ] `curl` your homepage with five AI crawler user agents. Every one should get 200.
- [ ] Publish an `llms.txt` and read it aloud. If a sentence would embarrass you, fix the generator.

---
[← 07 SEO & JSON-LD](../07-seo-internal-links-json-ld/) · [Next: 09 Social distribution →](../09-social-distribution/)
