# Data Source Attribution & Redistribution Notice

This project aggregates threat intelligence data from multiple upstream sources.
Each source's license and redistribution terms are documented below. Terms were
verified against upstream repositories and published policies as of May 2026.

---

## Sources

### MetaMask eth-phishing-detect

- **URL:** https://github.com/MetaMask/eth-phishing-detect
- **License:** MIT
- **Redistribution:** Permitted. Include the original MIT license and copyright notice.
- **Attribution:** Copyright (c) MetaMask contributors. Licensed under the MIT License.
- **Notes:** Community-curated blocklist. Free to use, modify, and redistribute with attribution.

---

### ScamSniffer scam-database

- **URL:** https://github.com/scamsniffer/scam-database
- **License:** GPL-3.0 (GNU General Public License v3.0)
- **Redistribution:** Permitted under GPL-3.0 terms. Any project that incorporates
  GPL-3.0-licensed data in a way that triggers copyleft obligations must also be
  released under GPL-3.0. Review carefully if this project is distributed publicly.
- **Attribution:** Copyright (c) ScamSniffer. Licensed under GPL-3.0.
- **Notes:** The open-source feed is published with a 7-day delay. Real-time data
  requires a paid API subscription ($999/month). The GPL-3.0 license is more
  restrictive than MIT — redistribution of derivative works may require open-sourcing
  those works under the same license. **Flag for legal review if this project is
  commercially distributed.**

---

### CryptoScamDB blacklist

- **URL:** https://github.com/CryptoScamDB/blacklist
- **License:** Not specified. No LICENSE file is present in the repository; the
  `package.json` does not declare a license field; the README contains no license
  statement.
- **Redistribution:** Unknown. No explicit permission granted.
- **Attribution:** CryptoScamDB (https://cryptoscamdb.org)
- **Notes:** Used under good-faith community data-sharing norms given the project's
  stated public-protection mission. However, the absence of an explicit license means
  default copyright law applies — the copyright holder retains all rights. **Do not
  redistribute this dataset in isolation without first confirming terms with the
  CryptoScamDB maintainers.**

---

### spmedia Crypto Scam and Crypto Phishing Threat Intel Feed

- **URL:** https://github.com/spmedia/Crypto-Scam-and-Crypto-Phishing-Threat-Intel-Feed
- **License:** MIT
- **Redistribution:** Permitted. Include the original MIT license and copyright notice.
- **Attribution:** Copyright (c) spmedia. Licensed under the MIT License.
- **Notes:** The repository README explicitly encourages broad use: "roll this threat
  intel feed into places and block lists where it can help." Free to incorporate into
  detection pipelines and redistribute with attribution.

---

### Chainabuse

- **URL:** https://www.chainabuse.com
- **License:** Proprietary / API ToS. No open license.
- **Redistribution:** Not explicitly permitted. Data is obtained via a rate-limited
  free API tier (10 requests/month on the free plan). Chainabuse's terms govern use;
  no redistribution clause was found in publicly accessible documentation.
- **Attribution:** Chainabuse (https://www.chainabuse.com) — user-reported blockchain
  abuse data.
- **Notes:** Data is used here for threat intelligence aggregation purposes. Raw
  Chainabuse API responses are not re-exported in this repository. Only derived
  entries (normalized domain records) appear in the output dataset. Consumers of
  this dataset who wish to use Chainabuse data for other purposes should review
  Chainabuse's terms of service directly.

---

### Forta Network labelled-datasets

- **URL:** https://github.com/forta-network/labelled-datasets
- **License:** MIT
- **Redistribution:** Permitted. Include the original MIT license and copyright notice.
- **Attribution:** Copyright (c) Forta Network contributors. Licensed under the MIT License.
- **Notes:** Open dataset of malicious smart contract addresses and phishing scam
  addresses extracted from on-chain sources including Etherscan labels. Free to use
  and redistribute with attribution.

---

### PhishTank

- **URL:** https://phishtank.org
- **License:** Creative Commons Attribution-ShareAlike 2.5 (CC BY-SA 2.5)
- **Redistribution:** Permitted, including commercial use, under CC BY-SA 2.5 terms.
  Derivative datasets must be released under the same CC BY-SA 2.5 license.
  Attribution is requested but not strictly required by the license text; PhishTank
  asks for a link to https://phishtank.org where feasible.
- **Attribution:** "This data is provided by PhishTank (https://phishtank.org)."
- **Notes:** **PhishTank requires specific handling:**
  - The CC BY-SA 2.5 ShareAlike clause means any dataset that incorporates PhishTank
    data and is publicly distributed must itself be licensed CC BY-SA 2.5 or a
    compatible license. This may conflict with the MIT license applied to this
    project's own code and other data components.
  - PhishTank's ToS prohibits automated scraping without express written permission;
    data must be obtained via the official API or data feeds.
  - Data accuracy is not warranted by PhishTank.
  - **Flag for legal review regarding the ShareAlike interaction with this project's
    MIT license before any public redistribution of the combined dataset.**

---

### URLhaus (abuse.ch)

- **URL:** https://urlhaus.abuse.ch
- **License:** No standard open-source license declared. Governed by abuse.ch Terms
  of Use and fair use principles.
- **Redistribution:** Not explicitly permitted for derivative redistribution.
  - The community API is free under fair use principles for non-commercial or
    research use.
  - Commercial or for-profit use requires a paid subscription to the abuse.ch
    commercial API.
  - abuse.ch Terms of Use state that content may not be used for commercial purposes
    without a license from abuse.ch.
  - The Terms also prohibit use of data to train, fine-tune, or validate AI/ML models.
- **Attribution:** "URLhaus data provided by abuse.ch (https://urlhaus.abuse.ch)."
- **Notes:** **URLhaus is the most ambiguous source in this dataset from a
  redistribution standpoint.** Normalized entries derived from URLhaus data are
  included in this project's output for threat intelligence purposes (non-commercial,
  community benefit). Consumers redistributing this dataset commercially should
  contact abuse.ch (abuse@abuse.ch) to confirm permitted use or obtain a commercial
  license.

---

## Summary Table

| Source | License | Commercial Redistribution | Attribution Required |
|---|---|---|---|
| MetaMask eth-phishing-detect | MIT | Yes | Yes (copyright notice) |
| ScamSniffer scam-database | GPL-3.0 | Yes, under GPL-3.0 terms | Yes — **copyleft applies** |
| CryptoScamDB blacklist | Not specified | Unknown | Yes (good faith) |
| spmedia Crypto Phishing Feed | MIT | Yes | Yes (copyright notice) |
| Chainabuse | Proprietary / API ToS | Not explicitly permitted | Yes |
| Forta labelled-datasets | MIT | Yes | Yes (copyright notice) |
| PhishTank | CC BY-SA 2.5 | Yes — **ShareAlike applies** | Yes |
| URLhaus (abuse.ch) | Fair use / ToS only | Not permitted without paid plan | Yes |

---

## Redistribution Flags

The following sources require special attention before redistributing this dataset:

1. **ScamSniffer (GPL-3.0):** The copyleft clause may require that any publicly
   distributed project incorporating this data also be released under GPL-3.0. Seek
   legal review if this project is distributed commercially or as part of a product.

2. **PhishTank (CC BY-SA 2.5):** The ShareAlike clause requires derivative datasets
   to carry the same license. This may be incompatible with redistributing the
   combined dataset under MIT. Attribution link to phishtank.org is requested.

3. **URLhaus (abuse.ch):** No open license. Commercial redistribution is not permitted
   under the free community API terms. Contact abuse.ch for commercial licensing.

4. **CryptoScamDB:** No license declared. All rights reserved by default under
   copyright law. Contact maintainers before redistributing in isolation.

---

*This notice was last reviewed: 2026-05-28.*
