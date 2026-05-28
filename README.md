# Web3 Threat Tracker

A comprehensive Web3/blockchain/crypto domain threat intelligence tracker that aggregates 8 upstream feeds
with multi-dimensional classification. The pipeline ingests raw domain and URL data from leading community
and commercial sources, normalises each record against a unified schema, applies severity and confidence
scoring, attaches threat-category tags, and exports the result to CSV, per-tag slices, and a queryable
SQLite database — giving analysts a single authoritative feed for Web3 phishing, scam, and malware
infrastructure.

---

## Quick Start

```bash
git clone https://github.com/your-org/web3-threat-tracker.git
cd web3-threat-tracker
pip install -e ".[dev]"

# Run the full pipeline (fetch → normalise → classify → export)
python -m web3_threat_tracker.pipeline
```

Exports land in `data/exports/` by default. See `pipeline --help` for options.

---

## Data Schema

Each record in the unified dataset carries the fields described in the
[Data Dictionary](docs/data_dictionary.md). Key groups:

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
| `data/exports/all_domains.csv` | Full dataset, all severity levels |
| `data/exports/malicious_only.csv` | Rows where `severity = MALICIOUS` |
| `data/exports/high_confidence.csv` | Rows where `confidence = HIGH` |
| `data/exports/tag_<name>.csv` | One file per threat category tag |
| `data/exports/web3_threats.db` | SQLite database with full schema |

---

## Upstream Sources

| Source | Approx. Records | Notes |
|---|---|---|
| MetaMask eth-phishing-detect | 205 K+ | Community-curated allowlist/blocklist |
| ScamSniffer | Ongoing | Real-time wallet drainer & phishing feed |
| CryptoScamDB | Large | Historic + active scam domain list |
| Chainabuse | Community | User-reported blockchain abuse reports |
| spmedia | Ongoing | Spam / malvertising domain feed |
| Forta Network | Real-time | On-chain threat detection alerts |
| PhishTank | 1 M+ | General phishing, filtered for crypto |
| URLhaus | Active | Malware URL feed, filtered for crypto |

---

## Severity Levels

| Level | Meaning |
|---|---|
| `LEGITIMATE` | Verified safe; used as allowlist seed |
| `SUSPICIOUS` | Behavioural or registration anomalies; monitor |
| `RISKY` | Strong indicators of abuse; block recommended |
| `MALICIOUS` | Confirmed threat activity; block immediately |

---

## Confidence

| Value | Meaning |
|---|---|
| `HIGH` | Multi-source corroboration or analyst-verified |
| `MEDIUM` | Single high-quality source or partial corroboration |
| `LOW` | Single low-quality source or automated heuristic only |

---

## Threat Category Tags (19)

`wallet-drainer` · `ice-phishing` · `address-poisoning` · `pig-butchering` ·
`etherhiding` · `clickfix` · `smishing` · `vishing` · `fake-exchange` ·
`fake-wallet` · `rug-pull` · `ponzi` · `nft-scam` · `airdrop-scam` ·
`blockchain-domain-abuse` · `malware-distribution` · `c2` · `credential-stealer` ·
`impersonation`

See [Threat Landscape](docs/threat_landscape.md) for technique descriptions and key statistics.

---

## Contributing

Pull requests are welcome. Please read [CONTRIBUTING.md](docs/contributing.md) for:

- How to add manual entries (YAML format)
- PR submission process
- Schema validation requirements
- Severity / confidence assignment guidelines

---

## License

MIT — see [LICENSE](LICENSE).
