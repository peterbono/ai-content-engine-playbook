# 02 · Sourcing signals

**Time:** 25 min · **You'll build:** a scored, deduplicated topic feed from public signals.

## 🎯 Goal

Never ask an LLM "what should I write about?". Feed it a topic that some external signal says people care about right now, plus raw material it can quote.

## What FlashVoyage did

Three kinds of input, each with a different job:

| Input | Job | Where |
|---|---|---|
| **Google Trends** (daily trending RSS for France + related queries per destination) | Demand: what is rising | `social-distributor/sources/trends-scanner.js` |
| **Travel news RSS** (four feeds, each with a trust weight) | Freshness: what changed | `rss-signal-fetcher.js` |
| **Community threads** (travel and remote-work subreddits, searched via the official API) | Raw experience: real prices, real complaints, real trade-offs | `reddit-*` modules |
| **Search Console** queries at positions 5 to 30 | Gaps: queries you almost rank for | `intelligence/content-gap-detector.js` |

The output is a ranked list of topics plus a "source pack" for each one.

## 🧠 The design decision: score with code, not with a model

The RSS scorer is twenty lines of keyword arithmetic. It is cheap, explainable, and it never hallucinates a trend. A topic needs a destination match and a news keyword to clear the threshold, and fresh items get a boost.

## 🧩 Code: an explainable relevance score

From `rss-signal-fetcher.js` (trimmed):

```js
const RSS_FEEDS = [
  { name: 'FeedA', url: 'https://feed-a.example/feed/', weight: 1.0 },
  { name: 'FeedB', url: 'https://feed-b.example/feed/', weight: 0.8 },
  { name: 'FeedC', url: 'https://feed-c.example/feed/', weight: 0.6 },
];

const NEWS_KEYWORDS = ['visa', 'advisory', 'closed', 'reopened', 'new route',
  'regulation', 'strike', 'cancelled', 'digital nomad', 'price drop', 'fee', 'border'];

function scoreItem(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let score = 0;
  for (const kw of NEWS_KEYWORDS) if (text.includes(kw)) score += 10;
  for (const dest of DESTINATION_KEYWORDS) if (text.includes(dest)) score += 15;

  const ageDays = (Date.now() - new Date(item.pubDate)) / 86_400_000;
  if (ageDays < 2) score += 20; else if (ageDays < 5) score += 10; else if (ageDays < 10) score += 5;

  return { ...item, score: Math.round(score * item.weight) };
}

// Keep unseen items above a threshold, best first.
const ranked = items
  .filter(i => !alreadyProcessed(i.guid))   // persisted in data/rss-processed.json
  .map(scoreItem)
  .filter(i => i.score >= 15)
  .sort((a, b) => b.score - a.score);
```

The `alreadyProcessed` set is a JSON file committed to the repo, so a feed item is never turned into two articles.

## 🧩 Code: gap detection from Search Console

From `intelligence/content-gap-detector.js`, the core filter. Queries where you already appear on page 1 to 3 with some impressions are the cheapest wins:

```js
const gaps = rows
  .filter(r => r.position >= 5 && r.position <= 30 && r.impressions >= 10)
  .sort((a, b) => b.impressions - a.impressions);
```

## 🚫 Communities are a source, never a channel

FlashVoyage read community threads to find real numbers and real frustrations, then cited them. **It never posted there.** An earlier attempt to promote the site on Reddit nearly got the account banned, and the repo's forum and Q&A "linkbuilding" workflows were switched off. Treat every community as read-only research:

- Use the official API with a descriptive user agent, respect rate limits and terms.
- Quote sparingly and attribute.
- Do not post links, do not "seed" answers, do not run accounts. Distribution goes through channels you own ([module 09](../09-social-distribution/)).

## ⚠️ Pitfalls Florian actually hit

1. **Coverage checks by word overlap miss near-duplicates.** The gap detector marks a topic as covered when enough query words appear in an existing slug or title. Rephrased topics slip through. By archive time, 4 of the 38 live articles were Thailand-versus-Vietnam comparisons. Check coverage semantically (embeddings, or an LLM yes/no against your title list) before you queue a topic.
2. **Signals that silently degrade to defaults.** The last gap report (2026-10-25) lists different topics with exactly the same signal values and the same score. When an upstream API stops answering, a scorer often keeps running on fallback numbers. Log the raw input next to every score and alert when it stops changing.
3. **Fresh is not the same as valuable.** The recency boost favors news, and news has a short shelf life. Weight evergreen demand (Trends, Search Console) above novelty for anything that has to earn traffic for months.

## ✅ Checklist / exercise

- [ ] Pick three RSS feeds in your niche, give each a trust weight, and print the top 10 scored items.
- [ ] Persist processed GUIDs so a second run returns nothing new.
- [ ] Pull 28 days of Search Console queries and list those at positions 5 to 30.
- [ ] For each candidate topic, run a duplicate check against your existing titles. Count how many you would have published twice.
- [ ] Write down, in your README, which sources are read-only.

---
[← 01 Architecture](../01-architecture-and-orchestration/) · [Next: 03 Editorial calendar & angles →](../03-editorial-calendar-and-angles/)
