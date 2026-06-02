# Data Dictionary

All fields in the Web3 Threat Tracker unified schema. Required fields are marked **R**; optional fields are marked *O*.

> **CSV vs. YAML:** This dictionary describes the full unified schema as stored in YAML and the
> SQLite database. The flat CSV exports (`all_domains.csv`, `malicious_only.csv`,
> `high_confidence.csv`, `by_tag/<tag>.csv`) carry **only** these columns, in order:
> `domain`, `severity`, `confidence`, `tags`, `type`, `first_seen`, `last_seen`, `ip_addresses`,
> `asn`, `hosting_provider`, `registrar`, `blockchain_network`, `wallet_addresses`, `sources`.
> Enrichment fields not in that list (e.g. `ssl_*`, `ens_name`, `unstoppable_domain`,
> `transaction_hashes`, `smart_contract_addresses`, `nameservers`, `notes`, `references`,
> `related_domains`) are YAML/DB-only and are **not** present in the CSV exports.

---

## Core Identity

| Field | Req | Type | Description | Example |
|---|---|---|---|---|
| `domain` | **R** | string | Apex or subdomain being tracked. Normalised to lowercase, no trailing dot. | `fake-metamask.io` |
| `url` | *O* | string | Full URL if the threat is path-specific. Must include scheme. | `https://fake-metamask.io/connect` |
| `type` | **R** | enum | Record / infrastructure type — **not** a threat classification. See allowed values below. | `traditional_domain` |

**Allowed values for `type`:** (these describe the kind of name/record, not the threat — threat
classification lives in `tags`)

| Value | Meaning |
|---|---|
| `traditional_domain` | Standard DNS domain (ICANN registrar) |
| `ens` | Ethereum Name Service name (e.g. `*.eth`) |
| `unstoppable` | Unstoppable Domains name (e.g. `*.crypto`, `*.x`) |
| `handshake` | Handshake (HNS) decentralised TLD |
| `namecoin` | Namecoin `.bit` name |
| `ipfs` | IPFS-hosted resource / gateway path |
| `smart_contract` | On-chain smart-contract address as the tracked entity |

---

## Severity & Classification

| Field | Req | Type | Description | Example |
|---|---|---|---|---|
| `severity` | **R** | enum | Threat severity. See levels below. | `MALICIOUS` |
| `confidence` | **R** | enum | Analyst or automated confidence in the severity rating. | `HIGH` |
| `tags` | **R** | list[string] | Threat-category tags from the controlled vocabulary (may be empty). | `["drainer", "impersonation"]` |

**Severity levels:**

| Value | Meaning |
|---|---|
| `LEGITIMATE` | Verified safe; used as allowlist seed |
| `SUSPICIOUS` | Behavioural or registration anomalies; monitor (schema-reserved, not produced) |
| `RISKY` | Strong indicators of abuse; block recommended (schema-reserved, not produced) |
| `MALICIOUS` | Confirmed threat activity; block immediately |

> **In practice** the ingestion pipeline produces only `MALICIOUS` entries (plus a single
> `LEGITIMATE` baseline). `SUSPICIOUS` and `RISKY` are valid in the schema but are not currently
> emitted. Use `confidence` and `tags` to differentiate records, not `severity`.

**Confidence values:**

| Value | Meaning |
|---|---|
| `HIGH` | Multi-source corroboration or analyst-verified |
| `MEDIUM` | Single high-quality source or partial corroboration |
| `LOW` | Single low-quality source or automated heuristic only |

**Controlled tag vocabulary (20 tags):** (these are the exact schema values — note underscores)

| Tag | Technique |
|---|---|
| `drainer` | Drainer-as-a-Service kit; steals on-chain assets via malicious approvals |
| `phishing` | Credential or seed-phrase harvesting page |
| `rug_pull` | Token or NFT project abandoned after liquidity extracted |
| `fake_exchange` | Lookalike or entirely fabricated exchange UI |
| `fake_wallet` | Trojanised wallet app or lookalike connect page |
| `fake_airdrop` | Fake token airdrop requiring wallet connection or fee |
| `etherhiding` | DPRK-attributed blockchain C2; payload hidden in smart-contract ABI |
| `clickfix` | Fake browser update or CAPTCHA; drops infostealer on crypto professionals |
| `pig_butchering` | Long-con relationship fraud leading to fake investment platform |
| `address_poisoning` | Sends zero-value tx from lookalike address to pollute clipboard history |
| `ice_phishing` | Tricks user into signing malicious token approval; no key exfiltration |
| `investment_scam` | Fraudulent investment / yield platform or scheme |
| `impersonation` | Brand, protocol, or person impersonation |
| `c2_infrastructure` | Command-and-control infrastructure |
| `credential_stealer` | Web or host-based credential harvesting |
| `nft_scam` | Fake minting page, counterfeit collection, or NFT phishing |
| `defi_impersonation` | Lookalike or fraudulent DeFi protocol front-end |
| `smishing` | SMS phishing; often Lighthouse/Smishing Triad infrastructure |
| `typosquat` | Lookalike domain relying on misspelling or character substitution |
| `cryptojacking` | Browser/host cryptomining (CoinMiner, cryptojacking) |

---

## Domain Infrastructure

| Field | Req | Type | Description | Example |
|---|---|---|---|---|
| `registrar` | *O* | string | Domain registrar name as reported by WHOIS. | `Namecheap, Inc.` |
| `registration_date` | *O* | date (ISO 8601) | Domain registration date. | `2024-11-03` |
| `whois_privacy` | *O* | bool | True if registrant data is hidden behind a privacy proxy. | `true` |
| `nameservers` | *O* | list[string] | Authoritative nameservers at time of collection. | `["ns1.cloudflare.com", "ns2.cloudflare.com"]` |
| `hosting_provider` | *O* | string | Hosting or CDN provider inferred from ASN or rDNS. | `Cloudflare` |
| `ip_addresses` | *O* | list[string] | IPv4/IPv6 addresses resolved at collection time. | `["104.21.45.3"]` |
| `asn` | *O* | string | Autonomous System Number and name. | `AS13335 CLOUDFLARENET` |
| `ssl_issuer` | *O* | string | TLS certificate issuer CN. | `Let's Encrypt` |
| `ssl_subject` | *O* | string | TLS certificate subject CN or SAN. | `fake-metamask.io` |
| `ssl_valid_from` | *O* | datetime (ISO 8601) | Certificate notBefore timestamp. | `2024-11-03T00:00:00Z` |
| `ssl_valid_to` | *O* | datetime (ISO 8601) | Certificate notAfter timestamp. | `2025-02-01T00:00:00Z` |

---

## Blockchain Infrastructure

| Field | Req | Type | Description | Example |
|---|---|---|---|---|
| `blockchain_network` | *O* | enum (string) | Primary blockchain network. One of `ethereum`, `optimism`, `arbitrum`, `bsc`, `polygon`, `solana`, `tron`, `bitcoin`, `other`. | `ethereum` |
| `wallet_addresses` | *O* | list[string] | Attacker-controlled wallet addresses observed in the campaign. | `["0xDEAD...BEEF"]` |
| `smart_contract_addresses` | *O* | list[string] | Smart contract addresses used for drainer logic or C2. | `["0xABCD...1234"]` |
| `ens_name` | *O* | string | Ethereum Name Service name if the domain resolves via ENS. | `fakemeta.eth` |
| `unstoppable_domain` | *O* | string | Unstoppable Domains name if applicable. | `fakemeta.crypto` |
| `transaction_hashes` | *O* | list[string] | On-chain transaction hashes relevant to the investigation. | `["0xTXID..."]` |

---

## Provenance

| Field | Req | Type | Description | Example |
|---|---|---|---|---|
| `sources` | **R** | list[string] | One or more upstream source identifiers. See source keys in README. | `["metamask", "scamsniffer"]` |
| `first_seen` | **R** | datetime (ISO 8601) | Earliest timestamp the domain/URL was observed across all sources. | `2024-11-03T08:22:00Z` |
| `last_seen` | **R** | datetime (ISO 8601) | Most recent observation timestamp. | `2025-01-15T14:05:00Z` |
| `added_by` | **R** | string | Analyst handle or pipeline identifier that added the record. | `pipeline-v2` |
| `notes` | *O* | string | Free-text analyst notes. Markdown supported. | `Confirmed drainer kit via JS review.` |
| `references` | *O* | list[string] | URLs to reports, tweets, or other external evidence. | `["https://scamsniffer.io/report/123"]` |
| `related_domains` | *O* | list[string] | Other domains in the same campaign or infrastructure cluster. | `["fake-metamask2.io"]` |
