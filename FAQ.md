# ❓ FAQ

**Is this a course for a tool I have to buy?**
No. There is nothing to buy and no affiliate link. The code is plain Node.js, the infrastructure is GitHub Actions, and the dashboard repo is public.

**Did FlashVoyage make money?**
No. The Travelpayouts snapshot of 2026-10-25 shows 0 EUR of affiliate earnings year to date. That is why [module 11](11-post-mortem/) exists, and why the first lesson is to validate demand before you automate supply.

**Then why learn from it?**
Because the engineering held up and the failure is well documented. You get working patterns (quality loop, diff-guard, truth pack, cost ledger, GEO batch) plus a measured list of the mistakes that made them irrelevant. Most write-ups give you only the first half.

**How much did it cost to run?**
The LLM ledger records $20.18 over 300 generation runs between 2026-02-23 and 2026-04-17, a median of $0.066 per run. Hosting and domain costs are not in the ledger and are not included.

**Which models did it use?**
GPT-4o and GPT-4o-mini throughout, and Claude Haiku 4.5 for the bulk of the work in 263 of the 300 runs (2026-03-11 to 2026-04-02). By spend: Haiku 4.5 $14.72, GPT-4o-mini $2.95, GPT-4o $2.50. Model choice mattered far less than the stages around generation.

**Is fully automated AI content a good idea?**
On this evidence: as a production tool, yes; as a business on its own, no. Automate the parts that are mechanical (structure, schema, checks, formatting, distribution prep). Keep the parts that make a page worth reading (first-hand material, real sources, real authors) human.

**Can I use community sites like Reddit for distribution?**
Use them as research input only, through official APIs and within their rules. Do not post links, seed answers or run accounts. FlashVoyage's own attempt at promotion there nearly got the account banned, and its forum workflows were switched off.

**Do the GEO numbers prove that GEO works?**
No. They show that a batch restructuring raised an internal extractability score (average 63.4 to 74.2 across 37 articles, 0 regressions). No follow-up traffic measurement was recorded before the project stopped. Treat the method as promising and unproven here.

**The source code is in French. Is that a problem?**
Prompts, comments and docs in the original pipeline repo (private) are mostly French. Every excerpt in this playbook is translated and trimmed, and each one names its source file.

**Can I run the original pipeline?**
The pipeline repo is private, and it was never packaged for reuse anyway: there is a lot of site-specific logic and some dead code. Start from the [templates](templates/). The [dashboard repo](https://github.com/peterbono/flashvoyage-dashboard) is public.

**Can I reuse this material in my own course or post?**
Yes, under the [MIT license](LICENSE). Keep the copyright notice and link back.

**I found a number that looks wrong.**
Open an issue with the file and line it should come from. Every figure here is meant to be traceable to a file in the original repos or the project archive.
