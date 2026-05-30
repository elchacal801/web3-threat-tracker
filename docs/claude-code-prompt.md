# Claude Code Working Prompt — web3-threat-tracker hardening + multi-chain foundation

## Your role and goal
You are working directly in the `web3-threat-tracker` repository (a Web3/crypto domain threat-intel aggregator: Python ingestion pipeline → sharded YAML → SQLite/CSV exports + a static GitHub Pages site with browser-based on-chain investigation tools). A prior code review identified 9 issues plus a strategic direction (multi-chain tracing). Your job is to work through them **in phases**, committing after each phase, running tests continuously, and **stopping for my confirmation at the marked gates**. Do not attempt all phases in one pass without checking in.

The numbers below were accurate at review time but the dataset changes daily — verify against the current repo state before acting, don't hard-code them.

## Hard constraints (apply to every phase)
- **Never commit secrets or API keys.** Preserve the existing Bring-Your-Own-Key model (Etherscan key lives in the browser's `localStorage`). Any new keys go through environment variables / GitHub Actions secrets, never the repo.
- **Keep the test suite green.** Run `pytest tests/ -v` after every change. Add tests for new logic. Do not weaken `scripts/validate.py` to make things pass.
- **Match the existing stack and style.** Frontend is vanilla JS (no framework) + Pico.css; Python is stdlib + `pyyaml`/`requests`/`jsonschema`. Do not introduce heavy dependencies without flagging it first. Use the repo's existing Conventional-Commit message style (e.g. `chore:`, `feat:`, `fix:`, `refactor:`).
- **Do not break two things:** the GitHub Pages deploy (`deploy-site.yml`) and the schema-validation PR check (`validate.yml`).
- **Work on a feature branch** (e.g. `hardening/phase-N` or one branch with per-phase commits). Summarize the diff at the end of each phase.
- **Destructive git is fine here.** This repo is solely mine — no other clones, collaborators, or open PRs. Perform history rewrites and `git push --force` directly as part of the normal flow; no approval pause. (Phase 2 keeps one cheap local backup before rewriting — that's the only safety step, not a gate.)

## Decisions already made (defaults — flag if you disagree)
- **Confidence becomes corroboration-driven** (multi-source ⇒ higher confidence) rather than hard-coded per feed.
- **Search will require a minimum query length** and load only the prefix shard, intentionally dropping the "empty query + browse all 448K" behavior in exchange for killing the 43 MB client load.
- **Severity tiers stay in the schema** even though feeds report mostly `MALICIOUS`; we make the data honest via confidence + tags, not by ripping out the enum.

---

## Phase 1 — Stop committing derived artifacts (SAFE, do first)
Problem: `ingest.yml` runs `git add data/exports/` daily, and `all_domains.csv`, `malicious_only.csv`, `high_confidence.csv`, and `by_tag/phishing.csv` are each ~65 MB and ~99% identical. The repo gains ~250 MB of near-duplicate data per commit. Releases are the correct distribution channel and already exist (`release.yml`).

Tasks:
- Add `data/exports/*.csv` and `data/exports/by_tag/*.csv` to `.gitignore` (keep `.gitkeep`). Decide and document whether `stats.json` stays tracked (it's tiny — keeping it is fine).
- Edit `ingest.yml` so it builds exports ephemerally but **commits only `data/entries/`** (or, if we later decide entries can be rebuilt from sources, nothing). Remove `data/exports/` from the `git add` line.
- Confirm `release.yml` still attaches all CSVs + `web3_tracker.db` + `stats.json`. Adjust if needed so nothing is lost.
- Reconsider the daily `data/entries/` churn: the full re-shard rewrites ~117 MB of YAML each run. Note the tradeoff in your summary; do not change the entries-commit behavior yet unless trivial.

Acceptance: daily workflow no longer stages CSVs; `.gitignore` covers them; a dry run of the export + release path still yields all artifacts; tests green.

## Phase 2 — Scrub `data/exports/` from git history
Solo repo, so just do the rewrite and force-push as part of normal flow — no approval pause.

Tasks:
- Make one cheap local backup first (insurance against a botched filter glob): `git clone --mirror . ../web3-threat-tracker-backup.git`.
- Install and run filter-repo:
  - `pip install git-filter-repo`
  - `git filter-repo --path data/exports/ --invert-paths`
- filter-repo intentionally drops the `origin` remote — re-add it: `git remote add origin <url>`.
- Force-push the rewritten history: `git push origin --all --force` (add `--tags --force` if you have tags).
- Report `.git` size before vs. after (`git count-objects -vH`) so the reclaimed space is visible.

Acceptance: `data/exports/` is gone from history; remote re-pushed; local backup exists; `.git` visibly smaller; tests green.

## Phase 3 — Shard the search index (frontend perf)
Problem: `site/js/search.js` downloads `site/data/search-index.json` (~43.5 MB, ~102 bytes × 448K entries) and parses it into memory on every page load. Detail files are already sharded per first character — mirror that for the index.

Tasks:
- In `scripts/build_site.py`, emit prefix-sharded index files at `site/data/index/<key>.json` (`a`–`z`, `numeric`) using the same compact keys (`d,s,c,t,src`), plus a small `site/data/index/manifest.json` (keys present + counts).
- Rewrite `search.js` to activate at a minimum query length (start with 2 chars), load only the shard matching the query's first character (cache loaded shards), and filter within it. Preserve debounce, the severity filter (now scoped to the loaded shard), the result cap, and the existing wallet→`fund-flow.html` linking.
- Update the search page copy to reflect the new behavior. Update `tests/test_build_site.py`.

Acceptance: no index shard exceeds a few MB; typing returns correct results; severity filter works within results; test added and green.

## Phase 4 — Make the classification layer mean something (data quality)
Problem: 448,358 / 448,359 entries are `MALICIOUS`; 444,558 are tagged `phishing`; confidence is near-flat. The signal that exists upstream is being flattened. Covers review items 3, 7, 8.

Tasks:
- **Confidence from corroboration:** add a post-merge pass in `scripts/normalize.py` that computes each deduped entry's `confidence` from its unioned `sources` (count + a source-quality map you define, e.g. metamask/scamsniffer/phishtank/manual = high-quality, others = medium). Rule of thumb: ≥2 distinct sources ⇒ `HIGH`; single high-quality source ⇒ `MEDIUM`; single low-quality/heuristic ⇒ `LOW`. Make the map and thresholds a clearly-labeled constant so they're tunable.
- **Real category mapping:** audit the upstream category fields in `ingest_chainabuse.py` and `ingest_cryptoscamdb.py`; expand their `CATEGORY_MAP`s and stop defaulting unknown categories to `phishing` when a better tag exists (only fall back to `phishing` when genuinely unknown). ScamSniffer/MetaMask are phishing/drainer feeds by nature — leave those.
- **Per-source visibility (item 7):** add per-source ingested counts to `stats.json` and print them in each ingester's log / the CI step output, so dead feeds (urlhaus and chainabuse currently contribute 0) are obvious.
- **Honest tags + domain overload (item 8):** relax the schema so `tags` may be empty (change `minItems` to 0) for non-malicious entries, and fix the code path that tags `LEGITIMATE` entries (e.g. `coinbase.com`) as `phishing`. Separately, `domain` is currently overloaded to hold `0x…` contract addresses for Forta rows — make contract entries unambiguous (ensure they populate `smart_contract_addresses`, and introduce a clean unique-key strategy in `build_db.py` so the DB key isn't a fake "domain"). Update `schemas/entry.schema.json`, `scripts/validate.py`, `scripts/build_db.py`, and tests together; migrate without data loss.

Acceptance: confidence visibly varies across the set; categories from category-bearing feeds survive into tags; `stats.json` shows per-source counts; schema + DB handle contracts cleanly; all tests updated and green.

## Phase 5 — Fix Etherscan result truncation (tool correctness)
Problem: `site/js/common.js` fetches with `offset:10000, page:1, sort:asc`, silently returning only the earliest 10k txs for busy addresses — fine for "first funder" analysis, wrong for exit-path detection on active wallets.

Tasks:
- In `common.js`, implement block-window pagination for `getNormalTxs`/`getInternalTxs`/`getERC20Transfers` (loop forward by block ranges until exhausted, respecting the ~5 req/s rate limit already handled), OR at minimum detect a full 10,000-row page and surface a visible "results truncated" warning to the tool's result pane.
- Make sure `fund-flow.js` and `gas-tracer.js` benefit. In `gas-tracer.js`, label the chain as a single-funder heuristic in the UI (it follows only the first funder per hop).

Acceptance: busy addresses no longer silently truncate (or the truncation is clearly surfaced); rate limiting still respected; no regression on small addresses.

## Phase 6 — Introduce a ChainAdapter abstraction (multi-chain foundation — GATE before non-EVM)
Goal: stop the analytic logic from being hard-wired to Etherscan so Bitcoin/Solana can be added without forking `fund-flow.js`. This is the most important structural change before any new chain.

Tasks:
- Define a `ChainAdapter` interface and a normalized transfer/edge model: `{ from, to, asset, amount (decimal), txid, ts, direction }`. Put shared graph-building, exit-path/funding-source detection, entity tagging, and rendering in a chain-agnostic layer.
- Refactor the current Etherscan logic into an `EvmAdapter` parameterized by `chainId` (the V2 endpoint at `api.etherscan.io/v2/api` is already multichain — one key, change `chainid`). Wire `fund-flow.js` to consume the adapter rather than calling `Etherscan` directly.
- Add a chain selector to the Fund Flow UI for EVM chains (Ethereum 1, BSC 56, Polygon 137, Arbitrum 42161, Base 8453, Optimism 10) as proof the abstraction holds. Make `KNOWN_ADDRESSES` chain-keyed (entity addresses differ per chain).
- After this phase the EVM multi-chain foundation is complete. Continue through Phases 7–8 without pausing; the only decision left is the capstone chain choice (flag it when you get there, per the capstone section).

Acceptance: Ethereum behavior is unchanged; at least one additional EVM chain works end-to-end; the analytic/render layer no longer imports `Etherscan` directly; the diff is reviewable.

## Phase 7 — Build a first-class labels dataset (the real moat)
Problem: entity tagging relies on ~49 static ETH addresses in `KNOWN_ADDRESSES`. Every tracing tool on every chain is only as good as its labels.

Tasks:
- Create a `labels/` dataset with a clear schema: `chain, address_or_program, entity, category (cex|dex|bridge|mixer|sanctioned|...), source, confidence`. Add a small builder that consolidates it into a form the site can consume.
- Add an ingester for the **OFAC SDN "Digital Currency Address" entries** (free, authoritative, multi-chain) and load them as `category: sanctioned`.
- Migrate `KNOWN_ADDRESSES` into / on top of this dataset and have the EVM adapter and tools tag from it.

Acceptance: labels dataset builds; OFAC sanctioned addresses are present and tagged; tools surface labels including a `sanctioned` flag; tests cover the new ingester.

## Phase 8 — Redistribution governance
Problem: you aggregate and redistribute third-party feeds; terms vary and some (PhishTank in particular) have specific ToS.

Tasks:
- Verify each upstream feed's redistribution terms (MetaMask, ScamSniffer, CryptoScamDB, Forta, spmedia, PhishTank, Chainabuse, URLhaus, OFAC). Add `NOTICE.md` (or `ATTRIBUTION.md`) summarizing each source, its license/ToS, and how it's attributed. Flag PhishTank explicitly and gate or attribute its redistribution per their terms.
- Link the notice from `README.md`.

Acceptance: `NOTICE.md` committed and linked; any feed with restrictive terms is handled explicitly.

## Capstone (optional — own session, needs a decision + likely an API key)
Implement **one** non-EVM adapter behind the `ChainAdapter` interface. This is large; treat it as its own effort.
- **Bitcoin** (UTXO model): data via mempool.space REST or Blockstream Esplora (self-hostable). The analytic core is clustering, not edge-following — implement common-input-ownership clustering, change-output detection, peeling-chain following, and CoinJoin flagging. Tag against the labels dataset.
- **Solana** (account model, but ATAs ≠ wallets): data via Helius Enhanced Transactions (best DX, needs a free key) or raw JSON-RPC. You must resolve token accounts back to owner wallets or the graph is wrong; tag known program IDs (Jupiter/Raydium/Wormhole/etc.) from the labels dataset.

Tell me which chain to start with and whether I should provision a Helius key before you begin.

---

## How to proceed
Start with Phase 1. After each phase: run the full test suite, commit with a Conventional-Commit message, and give me a short diff summary. Phases 1–8 can run straight through, committing as you go — no approval pauses. The one check-in is before the **capstone**: confirm the non-EVM chain choice (and whether I've provisioned a Helius key, if Solana) since that's a large effort with a dependency. If a default I specified seems wrong once you're in the code, say so before implementing.
