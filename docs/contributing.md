# Contributing

Thank you for helping improve the Web3 Threat Tracker dataset. This document explains how to add
manual entries, submit pull requests, and meet the quality bar required for inclusion.

---

## Adding Manual Entries

Manual entries live in `data/manual/` as YAML files, one file per campaign or domain cluster. Name
the file descriptively: `YYYY-MM-DD-<short-slug>.yaml`.

### Required fields

```yaml
# data/manual/2025-06-01-fake-uniswap-drainer.yaml

domain: fake-uniswap-v4.io
type: drainer
severity: MALICIOUS
confidence: HIGH
sources:
  - manual
first_seen: "2025-06-01T00:00:00Z"
tags:
  - wallet-drainer
  - impersonation
```

### Full example with optional fields

```yaml
domain: fake-uniswap-v4.io
url: https://fake-uniswap-v4.io/connect
type: drainer
severity: MALICIOUS
confidence: HIGH
tags:
  - wallet-drainer
  - impersonation
registrar: Namecheap, Inc.
registration_date: "2025-05-28"
whois_privacy: true
nameservers:
  - ns1.cloudflare.com
  - ns2.cloudflare.com
hosting_provider: Cloudflare
ip_addresses:
  - 104.21.45.3
asn: AS13335 CLOUDFLARENET
ssl_issuer: Let's Encrypt
blockchain_network:
  - ethereum
wallet_addresses:
  - "0xDEADBEEF..."
smart_contract_addresses:
  - "0xABCD1234..."
sources:
  - manual
  - scamsniffer
first_seen: "2025-06-01T00:00:00Z"
last_seen: "2025-06-03T12:00:00Z"
added_by: your-github-handle
notes: |
  Drainer kit confirmed via JS review. Inferno Drainer v3 signature in
  bundled script. Wallet address matches cluster from June 2025 campaign.
references:
  - https://scamsniffer.io/report/example
related_domains:
  - fake-uniswap-v3.io
```

### Field guidelines

- `domain`: apex domain only, lowercase, no scheme, no trailing slash
- `url`: include only if the threat is path-specific (e.g., distinct phishing page at a sub-path)
- `type`: must be one of the controlled values in the [Data Dictionary](data_dictionary.md)
- `sources`: use the canonical source keys: `metamask`, `scamsniffer`, `cryptoscamdb`,
  `chainabuse`, `spmedia`, `forta`, `phishtank`, `urlhaus`, `manual`
- `first_seen` / `last_seen`: ISO 8601 with timezone (`Z` or offset)
- `tags`: use only tags from the 19-item controlled vocabulary

---

## Pull Request Process

1. Fork the repository and create a branch: `git checkout -b entries/your-slug`
2. Add your YAML file(s) to `data/manual/`
3. Run schema validation locally (see below) and confirm it passes
4. Open a PR with a brief description of the threat, the evidence basis, and your confidence
   reasoning
5. A maintainer will review within 5 business days; complex campaigns may require additional
   evidence before merge

### PR description template

```
## Summary
One or two sentences describing the threat.

## Evidence
- [ ] Domain observed in the wild (link or screenshot)
- [ ] Source feed reference
- [ ] On-chain evidence (tx hash, contract address)
- [ ] Analyst notes / previous reporting

## Confidence rationale
Why HIGH / MEDIUM / LOW? List corroborating sources.
```

---

## Schema Validation

Validation runs automatically on every PR via GitHub Actions. To run it locally before pushing:

```bash
# Install dev dependencies if not already done
pip install -e ".[dev]"

# Validate all manual YAML files
python -m web3_threat_tracker.validate data/manual/
```

The validator checks:

- All required fields present (`domain`, `type`, `severity`, `confidence`, `sources`, `first_seen`)
- `type`, `severity`, `confidence` values are in the controlled vocabulary
- All `tags` values are in the 19-item controlled vocabulary
- `first_seen` / `last_seen` are valid ISO 8601 datetimes
- `domain` is a syntactically valid hostname (no scheme, no path)
- `ip_addresses` are valid IPv4 or IPv6 literals
- No duplicate domains within the manual dataset

PRs with validation failures will not be merged until the issues are resolved.

---

## Severity & Confidence Assignment Guidelines

### Severity

| Level | Assign when |
|---|---|
| `LEGITIMATE` | Domain is a known good actor; used only to anchor allowlist seeds |
| `SUSPICIOUS` | One or more anomalies (young domain, privacy WHOIS, lookalike name, shared infra with known threats) but no confirmed malicious activity |
| `RISKY` | Appears in one lower-quality source, or multiple suspicious signals without direct evidence of active abuse |
| `MALICIOUS` | Confirmed active phishing, draining, malware delivery, or C2; supported by at least one high-quality source or direct technical analysis |

### Confidence

| Level | Assign when |
|---|---|
| `HIGH` | Two or more independent high-quality sources agree, or direct analyst verification (e.g., JS review, on-chain trace, sandbox detonation) |
| `MEDIUM` | Single high-quality source (ScamSniffer, MetaMask, Forta) with no contradicting signals, or two lower-quality sources |
| `LOW` | Single low-quality or automated source only, or heuristic match without corroboration |

When in doubt, assign the lower severity or confidence value. It is easier to escalate a record
after further analysis than to retract a false positive that has propagated into downstream SIEM
block lists.
