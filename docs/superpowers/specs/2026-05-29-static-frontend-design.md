# Web3 Threat Tracker — Static Frontend Design Specification

**Date:** 2026-05-29
**Status:** Draft

---

## Context

The web3-threat-tracker has 448K+ domain entries with daily automated ingestion and SIEM-ready CSV exports. Currently, the only way to query the data is by downloading CSVs or the SQLite database. A web frontend would let analysts search domains and run on-chain traces without downloading anything.

**Constraints:**
- No hosting — must run on GitHub Pages (static files only)
- No build framework — vanilla HTML/JS/CSS
- On-chain traces must call Etherscan directly from the browser (BYOK — user provides their own API key)
- Playbook logic is a clean-room JS port from CrimsonVector investigation playbooks — no case-specific data, no PII, no org identifiers

---

## Architecture

### Overview

A GitHub Pages static site with two feature groups:

1. **Domain Intelligence** — Search 448K entries via a compressed in-memory JSON index
2. **On-Chain Trace Tools** — 5 investigation playbooks ported to client-side JavaScript, calling Etherscan API directly from the browser

### Data Flow

```
GitHub Actions (daily ingestion) →
  builds search-index.json.gz (~5-8MB, domain + severity + confidence + tags + sources)
  builds detail shards (a.json ... z.json, full entry data per letter)
  copies site/ to gh-pages branch

Browser loads:
  search-index.json.gz → in-memory search (one-time download, cached)
  stats.json → dashboard
  detail shard → on-demand when user clicks a result

Trace tools:
  User's Etherscan API key → browser localStorage
  Browser → api.etherscan.io directly (no server proxy)
  Results rendered client-side as tables
```

---

## Pages

### 1. Dashboard (index.html)

- Project title and description
- Stats cards: total entries, malicious count, source count
- Severity breakdown chart (bar or pie)
- Source distribution chart
- Recent additions (if tracked)
- Links to search and trace tools
- Data sourced from `stats.json`

### 2. Domain Search (search.html)

- Search input with instant results as user types (debounced 200ms)
- Results table: domain, severity (color-coded), confidence, tags, sources
- Click a result to expand full details (fetches from detail shard)
- Expanded view shows: all domain infrastructure fields, blockchain fields, wallet addresses, notes, references
- Wallet addresses in expanded view are clickable — link to Fund Flow trace page with address pre-filled
- Filter controls: severity dropdown, tag dropdown
- Result count shown

**Search index format:**
```json
[
  {"d": "evil.com", "s": "MALICIOUS", "c": "HIGH", "t": ["phishing","drainer"], "src": ["metamask","scamsniffer"]},
  ...
]
```
Short keys to minimize file size. Gzipped by the build step.

**Detail shard format:**
Each `details/a.json` contains full Entry dicts for all domains starting with 'a'. Fetched on-demand when user expands a result.

### 3. Contract Audit (tools/contract-audit.html)

- Input: contract address
- Output: proxy detection, implementation address, owner/admin roles, upgrade history, role grant/revoke events
- Table display of findings

### 4. Mint Tracker (tools/mint-tracker.html)

- Input: token contract address
- Optional: from-block, to-block, decimals
- Output: table of Transfer events from null address (mints), amounts, recipients
- Flags any mint recipient that appears in the tracker's known malicious wallets

### 5. Fund Flow (tools/fund-flow.html)

- Input: address (can be pre-filled from domain search results)
- Output: table of ETH + ERC-20 transfers, with known entity tagging
- Tags from built-in known address database (CEX hot wallets, DEX routers, bridges, mixers)
- Color-coded by entity type

### 6. Gas Tracer (tools/gas-tracer.html)

- Input: address, depth (default 3, max 5)
- Output: recursive funding chain — who sent ETH to this address, and who funded them
- Tree/table view showing the funding chain
- Known entity tagging at each level

### 7. CCTP Tracer (tools/cctp-tracer.html)

- Input: address
- Output: CCTP (Circle Cross-Chain Transfer Protocol) transactions detected
- Table of cross-chain transfer events

### Common Trace UI Elements

Each trace page includes:
- API key input field (pre-filled from localStorage if previously saved)
- "Save key" checkbox (saves to localStorage)
- "Get a free Etherscan API key" link
- Loading spinner during API calls
- Error display for API failures
- Rate limit indicator (5 req/sec with key)

---

## File Structure

```
site/
├── index.html                    # Dashboard
├── search.html                   # Domain search
├── tools/
│   ├── contract-audit.html
│   ├── mint-tracker.html
│   ├── fund-flow.html
│   ├── gas-tracer.html
│   └── cctp-tracer.html
├── css/
│   ├── pico.min.css              # Pico CSS framework
│   └── app.css                   # Custom styles
├── js/
│   ├── search.js                 # Search index loading and querying
│   ├── dashboard.js              # Stats chart rendering
│   ├── common.js                 # Etherscan API client, rate limiter, known addresses, utilities
│   ├── playbooks/
│   │   ├── contract-audit.js
│   │   ├── mint-tracker.js
│   │   ├── fund-flow.js
│   │   ├── gas-tracer.js
│   │   └── cctp-tracer.js
│   └── ui.js                     # Shared UI components (API key input, spinner, error display)
├── data/                         # Generated by build step (gitignored, built in CI)
│   ├── search-index.json.gz      # Compressed search index
│   ├── stats.json                # Copy of exports/stats.json
│   └── details/                  # Per-letter detail shards
│       ├── a.json
│       ├── b.json
│       └── ...
└── favicon.ico
```

---

## JavaScript Modules

### common.js — Etherscan API Client

Ported from CrimsonVector `common.py`. Clean-room rewrite with NO case-specific data.

**Exports:**
- `EtherscanClient` class — rate-limited (5 req/sec), auto-retry on 429
- `KNOWN_ADDRESSES` — generic only: major CEX hot wallets (Coinbase, Binance, Kraken, etc.), DEX routers (Uniswap, SushiSwap), bridges (Arbitrum, Optimism, Polygon), mixers (Tornado Cash), stablecoin contracts
- `normalizeAddress(addr)` — lowercase, validate 0x prefix
- `weiToEth(wei)` — conversion utility
- `formatTimestamp(unix)` — human-readable dates
- `EVENT_SIGNATURES` — Transfer, RoleGranted, RoleRevoked, OwnershipTransferred, Upgraded, AdminChanged
- `ROLE_HASHES` — MINTER_ROLE, DEFAULT_ADMIN_ROLE, PAUSER_ROLE

**NOT included (sanitized from original):**
- No case-specific wallet addresses
- No investigation identifiers (INV-02, SM-002, etc.)
- No personal names or org names
- No .env file reading (key comes from browser localStorage)
- No "CrimsonVector" or "kashif_osint" references

### contract-audit.js

Ported from `contract_audit.py`.

**Input:** contract address
**API calls:** `getabi`, `getsourcecode`, `getLogs` (RoleGranted, RoleRevoked, OwnershipTransferred, Upgraded, AdminChanged)
**Output:** `{ isProxy, implementation, owner, admin, roles: [], upgrades: [], events: [] }`

### mint-tracker.js

Ported from `mint_tracker.py`.

**Input:** token contract, optional block range, optional decimals
**API calls:** `getLogs` (Transfer from 0x0 address)
**Output:** `{ mints: [{ txHash, blockNumber, to, amount, timestamp }], totalMinted, uniqueRecipients }`

### fund-flow.js

Ported from `fund_flow.py`.

**Input:** address
**API calls:** `txlist` (normal transactions), `tokentx` (ERC-20 transfers)
**Output:** `{ ethTransfers: [], tokenTransfers: [], taggedEntities: [], summary: {} }`

### gas-tracer.js

Ported from `gas_tracer.py`.

**Input:** address, depth (default 3, max 5 to prevent runaway API calls)
**API calls:** `txlist` (filtered for ETH funding — incoming value > 0)
**Output:** `{ fundingChain: [{ level, from, to, value, txHash, fromTag }], sharedFunders: [] }`

### cctp-tracer.js

Ported from `cctp_tracer.py`.

**Input:** address
**API calls:** `txlist` (filtered for CCTP MessageSent contract calls)
**Output:** `{ cctpTransfers: [{ txHash, amount, destinationDomain, timestamp }] }`

---

## Build Pipeline Addition

### New script: scripts/build_site.py

Generates the static data files for the frontend:

1. Load all entries from `data/entries/*.yaml`
2. Build `search-index.json` — array of `{d, s, c, t, src}` objects (short keys)
3. Gzip to `search-index.json.gz`
4. Build detail shards — `details/a.json` through `details/z.json` + `details/numeric.json`
5. Copy `stats.json` to site data directory

### New workflow: .github/workflows/deploy-site.yml

Triggered after daily ingestion completes:

1. Run `build_site.py` to generate search index and detail shards
2. Copy `site/` + generated data to `gh-pages` branch
3. GitHub Pages serves automatically

---

## Styling

- Pico CSS as base (dark mode default, professional aesthetic)
- Severity color coding: LEGITIMATE=green, SUSPICIOUS=yellow, RISKY=orange, MALICIOUS=red
- Confidence badges: HIGH=solid, MEDIUM=outlined, LOW=dashed
- Tag pills with consistent colors per tag category
- Monospace font for addresses and hashes
- Responsive layout — works on mobile

---

## Security Considerations

- Etherscan API key stored in browser localStorage only — never transmitted to any server
- No server-side code — all processing happens in the browser
- No user tracking, no analytics, no cookies beyond localStorage
- CORS: Etherscan API allows browser-direct calls
- Rate limiting enforced client-side (5 req/sec with key)
- Known address database contains only publicly-known entity addresses (CEX hot wallets from public documentation)

### Sanitization from CrimsonVector Playbooks

The JS port is a clean-room rewrite. The following are explicitly excluded:

- All case-specific data (case_ausdt.json, case_lwc.json)
- All investigation output data (output/ directory)
- Named individuals (Noel Damien Foti, etc.)
- Organization identifiers (CrimsonVector, kashif_osint, Linework, NSBDC)
- Investigation IDs (INV-02, SM-002, Milano Case 283/2024)
- Case-specific wallet addresses from common.py:135-143
- All API keys and .env references
- All file path references to local directories

---

## Non-Goals

- No server-side processing
- No user authentication
- No persistent storage beyond browser localStorage
- No multi-chain support (Ethereum only for traces, matching playbook scope)
- No graph visualization in v1 (tables only)
- No real-time monitoring or alerting

---

## Verification Plan

1. Build search index locally, verify size is under 10MB gzipped
2. Load site in browser, verify search returns results within 200ms after index load
3. Run each trace tool against a known public address (e.g., Vitalik's address) with a test Etherscan key
4. Verify API key is not visible in network requests to any non-Etherscan domain
5. Verify no CrimsonVector/case-specific data appears anywhere in the published site
6. Test on mobile viewport
7. Verify GitHub Pages deployment serves correctly
