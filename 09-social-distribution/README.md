# 09 · Social distribution: articles to reels and posts

**Time:** 30 min · **You'll build:** a format-driven reel generator (script, assets, FFmpeg composition), a hook validator, and a cross-posting queue, plus a way to read the numbers honestly.

## 🎯 Goal

Turn every article into short vertical videos and posts on channels you own, automatically, and feed engagement back into what gets written next.

## What FlashVoyage did

`social-distributor/` is a second pipeline next to the article one:

| Part | Files |
|---|---|
| Platforms | `platforms/instagram.js`, `facebook.js`, `threads.js`, `tiktok.js` |
| Reel formats | 11 composers in `reels/composers/`: before/after, best time, daily budget, cost versus, poll, humor, humor-tweet, leaderboard, "where to go in [month]", trip pick, versus |
| Rendering | `reels/core/ffmpeg.js`, `overlay-renderer.js`, `clip-preparer.js`, safe zones, a local music and SFX library |
| Text quality | `reels/hook-validator.js` (local rules, then a Haiku rewrite) |
| Scheduling | `smart-scheduler.js`, best-time analysis, three daily reel slots in GitHub Actions |
| Feedback | `analytics/` (IG stats, GA4, Search Console, article scorer, reel-to-article map) |

The format list was not guessed. `reels/REEL-FORMATS-V2.md` (2026-03-30) is based on a breakdown of 42 reels from two established travel accounts, challenged by four specialist review agents, ending in six consolidated formats with scene-by-scene timings, typography and caption templates.

TikTok's posting API required an app review, so the TikTok path was semi-manual: a daily job downloaded the reels published in the last 12 hours and sent each one to a private Telegram chat with a TikTok-ready caption, for a one-tap manual repost.

## 🧠 The design decision: formats are templates, text is validated data

Each format is code (a composer) with fixed scene durations and layout. The LLM only fills text slots, and the text is checked by rules before it reaches FFmpeg.

## 🧩 Code: hook rules before any model call

From `reels/hook-validator.js` (trimmed):

```js
function localValidate(scene) {
  const issues = [];
  const words = scene.text.trim().split(/\s+/).filter(Boolean).length;
  if (scene.isHook) {
    if (words < 8)  issues.push('hook_too_short');
    if (words > 12) issues.push('hook_too_long');
  } else if (scene.isItem) {
    if (words < 3) issues.push('item_too_short');
    if (words > 8) issues.push('item_too_long');
  }
  if (scene.text !== scene.text.toUpperCase()) issues.push('not_caps');
  const weakOpenings = [/^voici\b/i, /^il y a\b/i, /^c'est\b/i, /^on peut\b/i];  // "here is", "there is"...
  if (weakOpenings.some(p => p.test(scene.text))) issues.push('weak_opening');
  return issues;
}
// Then: one Haiku call rewrites only what fails, returning strict JSON.
// Non-blocking: if the model fails, the original texts are kept.
```

## 📊 What the numbers said

From the dashboard snapshot of 2026-10-25 (TikTok figures were entered by hand and last updated 2026-05-16):

| Channel | Published | Reach | Engagement | Followers |
|---|---|---|---|---|
| Instagram | 16 reels | 1,157 impressions total | 8 likes, 0 comments | 3 |
| TikTok | 13 videos | 6,145 views | 236 likes | 29 (after 16 days) |
| Facebook | n/a | 0 reach recorded | n/a | 6 |

TikTok, posted by hand from the Telegram batch, got more than five times Instagram's reach with fewer videos. The best-time analysis agrees: the best slot for TikTok averaged 473 engagement over 13 samples, while Instagram's main slot averaged 1 over 34 samples (`best-times.json`). The fully automated channel was the weakest one.

## ⚠️ Pitfalls Florian actually hit

1. **Automating the channel with the least reach.** Most of the automation went into Instagram and Facebook, where the API is easy. The audience was on TikTok, where it wasn't. Test reach by hand on every platform for two weeks before automating any of them.
2. **Tokens expire, and tokens leak.** Meta page tokens need refreshing (there is a `token-manager.js` for it). Worse, a security scan of the pipeline repo done for this playbook found platform secrets hardcoded as fallbacks in the social-distributor webhooks. Read secrets from the environment only, with no literal fallback, and scan before every push.
3. **Automating engagement on other people's accounts.** An engagement script tried to comment on niche accounts' posts: 50 attempts on 2026-04-07, 0 comments posted (`engagement-log.jsonl`). It is just as well. Automated comments on other people's content is spam, and platforms treat it as such.
4. **Format inspiration is not audience.** Formats copied from accounts with large audiences carry their reach assumptions with them. The best TikTok videos ("trip pick", "expectation vs reality", humor, daily budget) all landed between roughly 570 and 670 views, a ceiling set by the account, not the format. Formats matter less than an account's history.

## ✅ Checklist / exercise

- [ ] Define one reel format as code: scenes, durations, text slots, layout.
- [ ] Write local hook rules (length, case, banned openings). Run them on 20 hooks from your best articles.
- [ ] Post 10 videos by hand on two platforms. Compare reach after a week before you automate either.
- [ ] Map each reel to its source article and record the link, so engagement can feed back into the article scorer.
- [ ] Grep your social code for literal tokens and `||` fallbacks after `process.env`.

---
[← 08 GEO](../08-geo-answer-engines/) · [Next: 10 Cost tracking & dashboard →](../10-cost-tracking-and-dashboard/)
