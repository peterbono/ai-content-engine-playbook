# 04 · Generation with LLMs

**Time:** 40 min · **You'll build:** a micro-prompt generator with few-shot examples, a provider-agnostic client, and a model bake-off.

## 🎯 Goal

Produce a long article as a sequence of small, focused LLM calls, each with one job, one example of "good", and its own cost line.

## What FlashVoyage did

The first version generated a whole article with one big GPT-4o prompt, then expanded and auto-critiqued it. The later version split it into **micro-prompts**. You can see the split directly in the cost ledger, where every call is tagged with its step name:

| Step | Job |
|---|---|
| `micro-seo-title` | title + `<title>` tag from the brief |
| `micro-intro-hook` | 3-paragraph intro only |
| `micro-body-sections` | H2 sections, one by one |
| `micro-conclusion` | verdict, recommendations, checklist |
| `autocritique-pass2` | a cheap model hunts anomalies |
| `editorial-faq`, `editorial-table`, `editorial-checklist` | structured add-ons |
| `translate-section` | catch any English left in a French article |

Over the 300 logged runs, `micro-body-sections` was the single most expensive step, with about $5.69 of the $20.18 total (`cost-history.jsonl`).

## 🧠 The design decision: one call, one job, one example

Small prompts are easier to evaluate, cheaper to retry, and they fail locally. If the intro is bad you regenerate the intro, not 2,800 words. Each micro-prompt carries one few-shot exemplar from `few-shot-examples.js`, which holds eight categories: hook, decisional H2, verdict, SEO title, body section, FAQ, recommendation block, comparison table.

The few-shot file also encodes taste as data. The SEO-title example comes with explicit negatives:

```js
seoTitle: {
  input: "Article about budget travel in Thailand, 3 weeks, Bangkok + Chiang Mai + islands",
  // Specific: names real places, a real price, a real duration.
  // NO "hidden traps", "secrets", "crucial", "dilemma".
  // NO "[Number] tips/traps/mistakes" clickbait openers.
  output: {
    titre: "Thaïlande 3 semaines : on a dépensé 1 680 € à deux, voici le détail",
    title_tag: "Thaïlande 3 semaines à deux : 1 680 € détaillés"
  }
}
```

## 🧩 Code: one client, two providers, cost tracked on every call

From `anthropic-client.js` (trimmed). The wrapper accepts OpenAI-style messages, calls Anthropic, retries on overload, records usage, and returns an OpenAI-shaped response so the rest of the pipeline never knows which provider answered:

```js
export async function createClaudeCompletion(config, retries = 3, trackingStep = 'unknown') {
  const client = await getAnthropicClient();          // null when FORCE_OFFLINE=1
  if (!client) throw new Error('LLM unavailable (offline or missing key)');

  const { model, messages, max_tokens, temperature } = config;
  const system = messages.find(m => m.role === 'system')?.content;
  const turns = messages.filter(m => m.role !== 'system');
  const backoff = [2000, 5000, 10000];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const t0 = Date.now();
      const res = await client.messages.create({ model, max_tokens: max_tokens || 4096,
        messages: turns, ...(system && { system }), ...(temperature !== undefined && { temperature }) });
      tracker.recordFromUsage(trackingStep, model, {
        prompt_tokens: res.usage.input_tokens, completion_tokens: res.usage.output_tokens,
      }, Date.now() - t0);
      return { choices: [{ message: { role: 'assistant', content: res.content[0]?.text || '' } }] };
    } catch (err) {
      const retryable = err.status === 429 || err.status === 529;
      if (retryable && attempt < retries) { await sleep(backoff[attempt - 1]); continue; }
      throw err;
    }
  }
}
```

## 🧩 Data: pick models with a bake-off, not a hunch

`scripts/compare-models-quality.js` runs the same source through several models and scores the output with the pipeline's own quality analyzer. The stored result (`data/model-comparison-results.json`, 2026-03-11, one source thread):

| Model | Words | Global score | KPIs passed | Blocking gate |
|---|---|---|---|---|
| Claude Haiku 4.5 | 3,321 | 50.4 | 3 / 10 | failed |
| GPT-4o | 669 | 43.6 | 3 / 10 | failed |
| GPT-4o-mini | 895 | 42.4 | 2 / 10 | failed |

The recorded recommendation was "hybrid", and that is what shipped: across all logged runs, Claude Haiku 4.5 took 1,316 calls ($14.72), GPT-4o-mini 4,119 calls ($2.95) and GPT-4o 119 calls ($2.50). Note what the table also says: **no model passed the gate raw**. The quality came from the stages after generation ([module 05](../05-quality-gates-and-review-panel/)). One source is a tiny sample; run your bake-off on ten.

## ⚠️ Pitfalls Florian actually hit

1. **Few-shot examples teach numbers, not just style.** The exemplars contain precise figures. Models copy the *shape* of an example, including "12 testimonies, 9 reached the same conclusion" style claims. Write exemplars whose numbers are clearly placeholders, or real and cited.
2. **Language leaks.** Sources were English, output was French, and English fragments kept surviving. The pipeline ended up with a dedicated `translate-section` step plus a `removeEnglishLeaks` fixer. If your sources and output differ in language, budget a check for it from day one.
3. **The "AI voice" comes back.** The section rewriter prompt carries a ban list of phrases ("Ce que les autres guides ne disent pas", "Option 1/2/3", and the angle words from [module 03](../03-editorial-calendar-and-angles/)). Ban lists work, but each rewrite can reintroduce them, so enforce them in a deterministic check after every LLM pass, not only in the prompt.

## ✅ Checklist / exercise

- [ ] Split your generator into at least four tagged micro-steps. Log tokens and cost per step.
- [ ] Write one few-shot exemplar per step. Mark every number in it as either real (with source) or placeholder.
- [ ] Wrap your provider SDK in one function with retries, a `trackingStep` argument and an offline switch.
- [ ] Run a bake-off: same 10 sources, 3 models, scored by your own gate. Keep the JSON result in the repo.

---
[← 03 Calendar & angles](../03-editorial-calendar-and-angles/) · [Next: 05 Quality gates & review panel →](../05-quality-gates-and-review-panel/)
