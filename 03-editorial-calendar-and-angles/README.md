# 03 · Editorial calendar & angle hunting

**Time:** 30 min · **You'll build:** a calendar that decides *what type* of article comes next, and a zero-LLM angle picker that decides *how* to frame it.

## 🎯 Goal

Give the generator a brief, not a blank page: article type, topic cluster, search hints, and one editorial angle backed by signals from the source.

## What FlashVoyage did

**The calendar** (`editorial-calendar.js`) runs a 5-article cycle per geographic cluster:

```
0 pillar   (long guide, 2500+ words)
1 support  (sub-topic of the pillar)
2 support
3 support
4 news     (fresh RSS item, cross-referenced with community threads)
```

Each cluster has destinations, peak months, pillar hints and support hints. A new cycle picks the cluster with the best mix of seasonality and recent under-use. State is a JSON file in the repo.

**The angle hunter** (`angle-hunter.js`) is described in its own header as a "pure, deterministic module, zero LLM". It reads what the extraction step found in the source (contradictions, warnings, costs, open questions, dates) and scores five angle types:

| Angle | Fires when the source has |
|---|---|
| `consensus_breaker` | contradictions, conflicting insights |
| `hidden_risk` | warnings, problems, a "warning" story type |
| `cost_arbitrage` | cost figures, budget lessons |
| `logistic_dilemma` | open questions, trade-off wording |
| `timeline_tension` | events, dates, update threads |

## 🧠 The design decision: plan with code, write with models

The calendar and the angle are **decisions**. Decisions should be reproducible and debuggable, so they are plain functions with a `debugSignals` array explaining every score. Only the writing goes to an LLM. When an article came out wrong, you could tell whether the plan or the prose was at fault.

## 🧩 Code: seasonality plus diversity

From `editorial-calendar.js`:

```js
seasonScore(cluster, month) {
  if (cluster.peakMonths.includes(month)) return 1.0;
  const adjacent = cluster.peakMonths.flatMap(m => [(m % 12) + 1, ((m - 2 + 12) % 12) + 1]);
  return adjacent.includes(month) ? 0.5 : 0.2;
}

pickCluster() {
  const month = new Date().getMonth() + 1;
  const recent = this.state.history.slice(-12).map(h => h.clusterId);
  return CLUSTERS
    .map(c => {
      const used = recent.filter(id => id === c.id).length;
      const diversity = Math.max(0, 1 - used * 0.25);
      return { c, score: this.seasonScore(c, month) * 0.6 + diversity * 0.4 };
    })
    .sort((a, b) => b.score - a.score)[0].c;
}
```

## 🧩 Code: an angle score you can explain

From `angle-hunter.js`. Each detector returns a 0 to 1 score and the signals that produced it:

```js
function detectCostTension(signals) {
  let n = signals.costs.length;
  const debug = n ? [`costs:${n}`] : [];
  const budgetLessons = signals.lessons.filter(l => BUDGET_KEYWORDS.test(l.lesson || ''));
  n += budgetLessons.length;
  if (budgetLessons.length) debug.push(`budget_lessons:${budgetLessons.length}`);

  let score = Math.min(n / 4, 1.0);
  if (signals.themePrimary === 'money') { score = Math.min(score + 0.2, 1.0); debug.push('theme:money'); }
  return { score, signals: debug };
}
// The highest score wins; ties are broken by a fixed priority order.
```

The angle also builds its hook from **source facts only**. A helper is commented "NEVER fabricates: uses extracted destination or generic fallback".

## ⚠️ Pitfalls Florian actually hit

1. **The angle vocabulary leaked into every title.** Two of the five angles are literally "arbitrage" and "dilemma", and the prompts leaned on the same words. Across the 38 articles still live at archive time, the word *arbitrage* appears 251 times and *dilemme* 97 times, and 5 slugs contain it (for example `...-larbitrage-qui-change-tout`, used twice). The code later carries the fix as a comment: "Removed 'arbitrage' and 'dilemme' from detection, we don't want to reward these words anywhere in the pipeline." Name your angles internally with words you never want to read in the output.
2. **A cluster calendar does not prevent cannibalization.** The calendar rotates clusters, not search intents. Four live articles answered the same "Thailand or Vietnam for a first trip" question. Add an intent-level duplicate check (see [module 02](../02-sourcing-signals/)).
3. **Clusters chosen by seasonality, not by evidence of demand.** The calendar defines six clusters (Southeast Asia, Japan, Southern Europe, Latin America, Africa and the Middle East, Oceania), while the site's published focus ended up being Asia only. A calendar should be pruned by what earns impressions, not by what the map suggests.

## ✅ Checklist / exercise

- [ ] Define 3 clusters with peak months and hints. Print the cluster your calendar would pick for each month of the year.
- [ ] Write two angle detectors for your niche. Each must return `{ score, signals }`.
- [ ] Ban list: write the 10 words your angles must never produce in a title. Add a test that fails if a generated title contains one.
- [ ] Add a rotation test: run your picker 30 times and assert no angle repeats within a window (the repo has one: `scripts/test-angle-rotation.mjs`).

---
[← 02 Sourcing signals](../02-sourcing-signals/) · [Next: 04 Generation with LLMs →](../04-generation-with-llms/)
