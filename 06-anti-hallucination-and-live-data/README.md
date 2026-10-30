# 06 · Anti-hallucination, truth pack & live data

**Time:** 40 min · **You'll build:** a whitelist of facts present in the source, a guard that checks generated text against it, and a cached enrichment layer for data the source does not have.

## 🎯 Goal

Make "the model made it up" detectable. Every place, number and named entity in the output should either come from the source, come from a data provider you can name, or be flagged.

## What FlashVoyage did

Three files under `src/anti-hallucination/`:

| File | Job |
|---|---|
| `truth-pack.js` | Normalise the extracted source into a whitelist: `allowed.locations`, `numbers`, `dates`, `orgs`, `people`, `events`, `keywords`, plus a tone baseline |
| `html-segmentation.js` | Strip non-editorial segments (widgets, FAQ boilerplate) so only the prose is checked |
| `anti-hallucination-guard.js` | Compare prose against the truth pack; return `pass`, `warn` or `fail`, with evidence |

The truth pack's contract is written at the top of the file: *no invention; if a field is missing, return an empty array, never null; normalise strictly (trim, collapse spaces, casefold, strip accents)*.

The guard's rules, as implemented:

| Rule | Type | Trigger |
|---|---|---|
| New location | blocking, then confirmed by a tiny LLM yes/no | a place not in the whitelist |
| Entity drift | warning | entity outside the whitelist but plausible |
| Tone amplification | warning | 4+ intensifiers in a short text, or density above 8 per 1,000 chars, when the source tone was low |
| Keyword drift | warning | under 10% keyword overlap with the source, on texts over 400 chars |

## 🧠 The design decision: whitelist first, model second

A regex and a set lookup cost nothing and are deterministic. Only when the cheap check finds a suspicious location does the pipeline spend an LLM call, and that call is designed to be tiny:

## 🧩 Code: build the whitelist, then ask the smallest possible question

From `truth-pack.js` and `anti-hallucination-guard.js` (trimmed):

```js
function normalizeText(s) {
  return typeof s !== 'string' ? '' : s.trim().replace(/\s+/g, ' ').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');   // "thaïlande" == "thailande"
}

export function buildTruthPack(extracted) {
  const empty = { locations: [], orgs: [], people: [], numbers: [], dates: [], events: [], keywords: [] };
  if (!extracted || typeof extracted !== 'object') return { source_id: null, allowed: empty };
  // Look in several schema paths, tolerate schema drift, never guess.
  const locations = extractStringsDeep(extracted, ['post.signals.locations', 'signals.locations', 'locations']);
  const properNouns = extractProperNouns(extracted.post?.clean_text || '');
  return { source_id: extracted.source?.url ?? null,
           allowed: { ...empty, locations: uniq([...locations, ...properNouns]) /* ...numbers, dates */ } };
}

async function validateLocationWithLLM(location, country) {
  // ~150 tokens, max_tokens 10, temperature 0.1
  const prompt = `Travel article about: ${country}\nPlace found in the article: "${location}"\n` +
                 `Is this place geographically consistent with the article? Answer only "yes" or "no".`;
  const res = await llm({ model: 'small-model', max_tokens: 10, temperature: 0.1, prompt });
  return res.trim().toLowerCase().startsWith('yes');
}
```

A dependency-free version of the whitelist check is in [`templates/truth-pack/`](../templates/truth-pack/).

## 🧩 Live data: say where every number comes from

`live-data-enricher.js` adds a "practical info" block per destination, with a 24-hour file cache per provider and query:

| Data | Source in the code |
|---|---|
| Currency, languages, time zones, capital | REST Countries API (live) |
| Flight prices from Paris | Travelpayouts / Aviasales prices API (live) |
| Safety level | **static** table, labelled "Global Peace Index 2024" in the code |
| Meal, transport, hostel, beer prices | **static** hand-written table per city |

```js
async fetchAll(ctx) {
  const dest = this.extractDestination(ctx);
  if (!dest.country && !dest.city) return null;          // no destination, no block
  const safety = this.fetchSafetyScore(dest.countryCode);  // static dataset
  const cost = this.fetchCostOfLiving(dest.city, dest.country); // static table
  const [countryInfo, flightPrice] = await Promise.all([
    this.fetchCountryInfo(dest.countryCode),               // live, cached 24 h
    this.fetchFlightPrice(dest.city || dest.country, dest.countryCode), // live, cached 24 h
  ]);
  if (!safety && !countryInfo && !flightPrice && !cost) return null;
  return { destination: dest, safety, countryInfo, flightPrice, costOfLiving: cost,
           fetchedAt: new Date().toISOString() };
}
```

## ⚠️ Pitfalls Florian actually hit

1. **Whitelists drown in false positives.** The guard carries two hand-maintained stop lists (91 and 142 entries) of words its place-detection patterns kept mistaking for locations: "Voici", "Checklist", "Budget", and dishes like "sushi" and "ramen". A code comment records the outcome for entity drift: no longer blocking, "truth pack = too many false positives", defer to the LLM. Expect to tune for weeks; start in warn-only mode and promote rules to blocking once their false-positive rate is known.
2. **"Live" data that isn't.** The repo README describes the enrichment as real-time and names cost-of-living and travel-advisory providers, but in the code the safety and price blocks are static tables. A static table is fine, if it is labelled with its date on the page. An unlabelled one is exactly the kind of stale "fact" the integrity agent was built to catch.
3. **Real evidence beats clever checks.** The most robust anti-hallucination feature came late: a "geo-proof" pipeline (`docs/geo-proof-pipeline.md`) that inserts a real photo Florian took in the country, tagged by country, instead of a stock image. Nothing in a truth pack is as convincing as first-hand material.

## ✅ Checklist / exercise

- [ ] Build a truth pack from one source: locations, numbers, dates. Arrays only, never null.
- [ ] Generate an article from that source and list every location and number not in the pack.
- [ ] Classify each one: invented, from a named data provider, or a false positive. That ratio is your guard's baseline.
- [ ] Decide, for each rule, whether it blocks or only warns, write it down, and log every time it triggers.
- [ ] Add a `source` and `asOf` field to every enrichment value and render them on the page.

---
[← 05 Quality gates](../05-quality-gates-and-review-panel/) · [Next: 07 SEO, internal links, JSON-LD →](../07-seo-internal-links-json-ld/)
