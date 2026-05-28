# Data Dictionary

All fields in the Web3 Threat Tracker unified schema. Required fields are marked **R**; optional fields are marked *O*.

---

## Core Identity

| Field | Req | Type | Description | Example |
|---|---|---|---|---|
| `domain` | **R** | string | Apex or subdomain being tracked. Normalised to lowercase, no trailing dot. | `fake-metamask.io` |
| `url` | *O* | string | Full URL if the threat is path-specific. Must include scheme. | `https://fake-metamask.io/connect` |
| `type` | **R** | enum | Record classification. See allowed values below. | `phishing` |

**Allowed values for `type`:**

| Value | Meaning |
|---|---|
| `phishing` | Credential or seed-phrase harvesting page |
| `scam` | Fraudulent offer, fake giveaway, rug-pull, or pig-butchering |
| `malware` | Drive-by download or malware distribution |
| `c2` | Command-and-control infrastructure |
| `drainer` | Wallet-drainer kit landing page or smart-contract endpoint |
| `impersonation` | Brand or person impersonation without a specific sub-type |
| `spam` | Unsolicited bulk messaging infrastructure |
| `unknown` | Insufficient data to classify |

---

## Severity & Classification

| Field | Req | Type | Description | Example |
|---|---|---|---|---|
| `severity` | **R** | enum | Threat severity. See levels below. | `MALICIOUS` |
| `confidence` | **R** | enum | Analyst or automated confidence in the severity rating. | `HIGH` |
| `tags` | *O* | list[string] | One or more threat-category tags from the controlled vocabulary. | `["wallet-drainer", "impersonation"]` |

**Severity levels:**

| Value | Meaning |
|---|---|
| `LEGITIMATE` | Verified safe; used as allowlist seed |
| `SUSPICIOUS` | Behavioural or registration anomalies; monitor |
| `RISKY` | Strong indicators of abuse; block recommended |
| `MALICIOUS` | Confirmed threat activity; block immediately |

**Confidence values:**

| Value | Meaning |
|---|---|
| `HIGH` | Multi-source corroboration or analyst-verified |
| `MEDIUM` | Single high-quality source or partial corroboration |
| `LOW` | Single low-quality source or automated heuristic only |

**Controlled tag vocabulary (19 tags):**

| Tag | Technique |
|---|---|
| `wallet-drainer` | Drainer-as-a-Service kit; steals on-chain assets via malicious approvals |
| `ice-phishing` | Tricks user into signing malicious token approval; no key exfiltration |
| `address-poisoning` | Sends zero-value tx from lookalike address to pollute clipboard history |
| `pig-butchering` | Long-con relationship fraud leading to fake investment platform |
| `etherhiding` | DPRK-attributed blockchain C2; payload hidden in smart-contract ABI |
| `clickfix` | Fake browser update or CAPTCHA; drops infostealer on crypto professionals |
| `smishing` | SMS phishing; often Lighthouse/Smishing Triad infrastructure |
| `vishing` | Voice or callback phishing |
| `fake-exchange` | Lookalike or entirely fabricated exchange UI |
| `fake-wallet` | Trojanised wallet app or lookalike connect page |
| `rug-pull` | Token or NFT project abandoned after liquidity extracted |
| `ponzi` | Yield or staking scheme reliant on new deposits |
| `nft-scam` | Fake minting page, counterfeit collection, or NFT phishing |
| `airdrop-scam` | Fake token airdrop requiring wallet connection or fee |
| `blockchain-domain-abuse` | Abuse of ENS, Unstoppable Domains, Handshake, or Namecoin |
| `malware-distribution` | Drive-by download or trojanised installer |
| `c2` | Command-and-control infrastructure |
| `credential-stealer` | Web or host-based credential harvesting |
| `impersonation` | Brand, protocol, or person impersonation |

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
| `blockchain_network` | *O* | list[string] | Blockchain networks referenced or used by the threat. | `["ethereum", "bnb-smart-chain"]` |
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
| `last_seen` | *O* | datetime (ISO 8601) | Most recent observation timestamp. | `2025-01-15T14:05:00Z` |
| `added_by` | *O* | string | Analyst handle or pipeline identifier that added the record. | `pipeline-v2` |
| `notes` | *O* | string | Free-text analyst notes. Markdown supported. | `Confirmed drainer kit via JS review.` |
| `references` | *O* | list[string] | URLs to reports, tweets, or other external evidence. | `["https://scamsniffer.io/report/123"]` |
| `related_domains` | *O* | list[string] | Other domains in the same campaign or infrastructure cluster. | `["fake-metamask2.io"]` |
