# Web3 Threat Tracker

A comprehensive Web3/blockchain/crypto domain threat intelligence tracker with **448,000+ entries** aggregated from 8 upstream feeds. Includes a static web frontend with domain search and multi-chain blockchain investigation tools supporting **Ethereum, BSC, Polygon, Arbitrum, Base, Optimism, Solana, and Bitcoin**.

**Live site:** [elchacal801.github.io/web3-threat-tracker](https://elchacal801.github.io/web3-threat-tracker/)

**Releases:** [Download CSVs and SQLite DB](https://github.com/elchacal801/web3-threat-tracker/releases)

---

## Features

- **Domain Intelligence** — Search 448K+ Web3 threat domains with severity, confidence, and category classification
- **SIEM-Ready Exports** — Pre-filtered CSVs for direct upload to CrowdStrike NG-SIEM, Splunk, or any SIEM as lookup files
- **Multi-Chain Investigation Tools** — 5 browser-based blockchain trace tools across 8 chains (Ethereum, BSC, Polygon, Arbitrum, Base, Optimism, Solana, Bitcoin). Fund Flow supports all 8 chains; Gas Tracer, Contract Audit, Mint Tracker, and CCTP Tracer support EVM chains
- **Daily Automated Ingestion** — GitHub Actions pulls from all upstream sources daily at 06:00 UTC
- **Weekly Releases** — Tagged releases with downloadable CSVs and SQLite database every Sunday

---

## Quick Start

```bash
git clone https://github.com/elchacal801/web3-threat-tracker.git
cd web3-threat-tracker
pip install -e ".[dev]"

# Run ingestion pipeline
python -m scripts.ingest.ingest_metamask
python -m scripts.ingest.ingest_scamsniffer
# ... (or trigger via GitHub Actions)

# Normalize, validate, build
python -m scripts.normalize
python -m scripts.validate
python -m scripts.build_db
python -m scripts.export_csv
python -m scripts.stats
```

---

## Data Schema

Each entry carries the fields described in the [Data Dictionary](docs/data_dictionary.md):

| Group | Fields |
|---|---|
| Core Identity | `domain`, `url`, `type` |
| Severity & Classification | `severity`, `confidence`, `tags` |
| Domain Infrastructure | `registrar`, `registration_date`, `whois_privacy`, `nameservers`, `hosting_provider`, `ip_addresses`, `asn`, `ssl_*` |
| Blockchain Infrastructure | `blockchain_network`, `wallet_addresses`, `smart_contract_addresses`, `ens_name`, `unstoppable_domain`, `transaction_hashes` |
| Provenance | `sources`, `first_seen`, `last_seen`, `added_by`, `notes`, `references`, `related_domains` |

---

## Available Exports

| File | Description |
|---|---|
| `all_domains.csv` | Full dataset, all severity levels |
| `malicious_only.csv` | Rows where `severity = MALICIOUS` |
| `high_confidence.csv` | Rows where `confidence = HIGH` |
| `by_tag/<tag>.csv` | One file per threat category tag |
| `web3_tracker.db` | SQLite database with junction tables for tags, sources, IPs, wallets |
| `stats.json` | Summary statistics |

Download from [Releases](https://github.com/elchacal801/web3-threat-tracker/releases) or build locally.

---

## Upstream Sources

| Source | Records | Notes |
|---|---|---|
| ScamSniffer | 331K+ | Real-time wallet drainer and phishing feed with wallet address mapping |
| MetaMask eth-phishing-detect | 105K+ | Community-curated blocklist |
| CryptoScamDB | 9.8K+ | Historic + active scam domains with category classification |
| Forta Network | 6.3K+ | On-chain phishing addresses and malicious smart contracts |
| spmedia | 1K+ | Daily-updated crypto phishing threat intel feed |
| PhishTank | Active | General phishing database, filtered for crypto targets |
| Chainabuse | API | User-reported blockchain abuse (10 req/month free tier) |
| URLhaus | API | Malware URL feed, filtered for crypto tags |

---

## Investigation Tools

The web frontend includes 5 browser-based investigation tools. All tracing happens client-side — API calls go directly from your browser to the chain's block explorer API. **Bring Your Own Key** for Etherscan (EVM chains) and Helius (Solana). Bitcoin uses mempool.space (free, no key needed).

| Tool | Chains | Purpose |
|---|---|---|
| **Fund Flow** | ETH, BSC, Polygon, Arbitrum, Base, Optimism, Solana, Bitcoin | Map transfers, tag known entities (CEX, DEX, bridges, mixers), identify exit paths and funding sources |
| **Gas Tracer** | EVM chains | Recursively trace native token funding chain to find who funded a wallet |
| **Contract Audit** | EVM chains | Detect proxy patterns, extract roles/owners, pull upgrade and role change history |
| **Mint Tracker** | EVM chains | Detect unauthorized token mints (Transfer events from null address) |
| **CCTP Tracer** | EVM chains | Detect Circle Cross-Chain Transfer Protocol activity |

### Supported Chains

| Chain | API | Key Required |
|---|---|---|
| Ethereum, BSC, Polygon, Arbitrum, Base, Optimism | Etherscan V2 | Yes (free tier) |
| Solana | Helius RPC | Yes (free tier) |
| Bitcoin | mempool.space | No |

Entity labels dataset includes 75+ tagged addresses across all chains: exchanges (Binance, Coinbase, Kraken), DEXes (Uniswap, Jupiter, Raydium), bridges (Wormhole), mixers (Tornado Cash), and OFAC-sanctioned addresses.

---

## Severity Levels

| Level | Meaning |
|---|---|
| `LEGITIMATE` | Verified safe; used as allowlist baseline |
| `SUSPICIOUS` | Behavioural or registration anomalies; monitor |
| `RISKY` | Strong indicators of abuse; block recommended |
| `MALICIOUS` | Confirmed threat activity; block immediately |

## Confidence

Confidence is **corroboration-driven**: entries seen by 2+ upstream sources are automatically `HIGH`; single high-quality source (MetaMask, ScamSniffer, PhishTank) = `MEDIUM`; single lower-quality source = `LOW`.

| Value | Meaning |
|---|---|
| `HIGH` | Multi-source corroboration (2+ feeds) |
| `MEDIUM` | Single high-quality source |
| `LOW` | Single heuristic or lower-quality source |

---

## Threat Category Tags (19)

`drainer` `phishing` `rug_pull` `fake_exchange` `fake_wallet` `fake_airdrop` `etherhiding` `clickfix` `pig_butchering` `address_poisoning` `ice_phishing` `investment_scam` `impersonation` `c2_infrastructure` `credential_stealer` `nft_scam` `defi_impersonation` `smishing` `typosquat`

See [Threat Landscape](docs/threat_landscape.md) for technique descriptions, detection patterns, and key statistics.

---

## SIEM Integration

See [SIEM Integration Guide](docs/siem_integration.md) for detailed instructions:

- **CrowdStrike NG-SIEM:** Upload `malicious_only.csv` as a LogScale Lookup File
- **Splunk:** Upload as lookup table, query with `| lookup web3_threats domain AS query`
- **Generic:** Any SIEM supporting CSV lookup files

---

## Contributing

Pull requests welcome. See [CONTRIBUTING.md](docs/contributing.md) for:

- How to add manual entries (YAML format)
- PR submission process and schema validation
- Severity/confidence assignment guidelines

---

## Data Attribution

This project aggregates data from multiple upstream sources. See [NOTICE.md](NOTICE.md) for per-source attribution, licensing, and redistribution terms.

---

## License

MIT — see [LICENSE](LICENSE).
