# Web3 Threat Landscape

Technique reference for the 20 threat category tags used in the Web3 Threat Tracker schema.
Statistics reflect publicly available reporting through mid-2025.

---

## Key Statistics

| Metric | Value | Source |
|---|---|---|
| Total crypto scam losses | $17 B (2025) | Chainalysis |
| Total security losses (hacks, exploits) | $3.35 B (2025) | CertiK |
| Impersonation scams increase YoY | +1,400% | FBI IC3 / industry |
| Wallet drainer losses (2025) | $83.85 M | ScamSniffer |
| Address poisoning losses | $83.8 M+ | Chainalysis |
| Address poisoning attempts | 270 M+ | Chainalysis |
| Pig-butchering average payment | $2,764 | FBI IC3 |

---

## Technique Reference

### EtherHiding — `etherhiding`

**Attribution:** Lazarus Group / DPRK  
**Infrastructure:** BNB Smart Chain

A DPRK-attributed technique in which malicious JavaScript payloads are stored across a chain of three
smart contracts on BNB Smart Chain. Compromised legitimate websites are injected with a small loader
that reads payload bytes from the contract ABI; each stage decodes the next, delivering a final
infostealer or RAT. Because the payload lives on-chain it cannot be taken down via traditional hosting
abuse.

- Approximately 14,000 infected pages observed in the wild
- Contracts rotate to evade blocklisting
- Payloads have included ClearFake and SocGholish-style loaders

---

### ClickFix — `clickfix`

**Primary targets:** Crypto professionals, DeFi developers, NFT traders  
**Delivery:** Fake browser update pages, fake CAPTCHA challenges, malicious GitHub issues

ClickFix presents victims with a fabricated browser error or security prompt and instructs them to
paste a PowerShell or shell command into a terminal to "fix" the problem. The pasted command downloads
and executes an infostealer (most commonly Lumma or Vidar). Crypto professionals are high-value targets
because local wallets and browser extension seed phrases are harvested alongside general credentials.

- 25,000+ compromised sites delivering ClickFix lures observed
- Heavily used by Lazarus Group and affiliate clusters in 2024-2025
- Frequently combined with EtherHiding delivery chain

---

### Wallet Drainer Kits — `drainer`

**Model:** Drainer-as-a-Service (DaaS)  
**Dominant kit:** Inferno Drainer (~40-45% market share)

Wallet drainer kits are sold or leased to affiliates who deploy phishing pages that simulate legitimate
dApp connect flows. When a victim connects their wallet and signs a malicious transaction, the kit
executes asset transfers on their behalf. Smart contracts are used for C2 and fee splitting between kit
developer and affiliate.

- $83.85 M in confirmed losses in 2025 (ScamSniffer)
- Inferno Drainer holds ~40-45% of the DaaS market
- Kits increasingly target ERC-20 permit signatures to drain without a second confirmation prompt
- Popular lures: fake NFT mints, fake airdrop claims, fake DEX front-ends

---

### Ice Phishing — `ice_phishing`

**Mechanism:** Malicious ERC-20/ERC-721 approval; EIP-7702 exploits

Ice phishing does not steal private keys. Instead the victim is tricked into signing a `setApprovalForAll`
or `approve` transaction that grants the attacker unlimited spending rights over a token contract. The
attacker then drains the approved tokens in a separate transaction. EIP-7702 (account abstraction)
introduced new approval delegation primitives that have been observed in ice-phishing campaigns from
early 2025.

- Often combined with lookalike dApp front-ends
- No seed phrase exposure; victims may not notice until funds are gone
- Difficult to reverse once signed on-chain

---

### Address Poisoning — `address_poisoning`

**Scale:** 270 M+ attempts observed; $83.8 M+ in losses

Address poisoning exploits the habit of copy-pasting wallet addresses from transaction history. The
attacker sends a zero-value (or dust) transaction from a wallet whose first and last characters match
the victim's intended recipient. The lookalike address then appears in the victim's history; when the
victim next copies an address from history they may pick the attacker's address instead.

- Highly automated; single infrastructure clusters generate millions of poisoning transactions
- Particularly effective against users of hardware wallets who rely on history for address verification
- Countermeasure: always verify the full 42-character address, not just first/last characters

---

### Pig Butchering — `pig_butchering`

**Origin:** Southeast Asia (Myanmar, Cambodia, Laos compound operations)  
**Model:** Long-con relationship fraud

Pig butchering (sha zhu pan) begins with unsolicited contact on dating apps, social media, or WhatsApp.
The scammer builds a relationship over weeks or months before introducing a "can't miss" crypto
investment opportunity. Victims are directed to a fraudulent exchange where early withdrawals are
permitted to build trust; eventually the victim deposits large sums and the platform disappears or
invents fees to block withdrawal.

- Average victim payment: $2,764 (FBI IC3)
- Operations industrialised with trafficked forced labour in SE Asia
- Infrastructure: lookalike exchange domains, fake trading apps, KYC-bypass onboarding flows

---

### Blockchain Domain Abuse — `impersonation` (tracked via `type`: `ens` / `unstoppable` / `handshake` / `namecoin`)

> There is no `blockchain-domain-abuse` tag. The naming system is recorded in the `type` field
> (`ens`, `unstoppable`, `handshake`, `namecoin`); the threat itself is tagged `impersonation` (or a
> more specific tag such as `drainer` / `phishing` where applicable).

**Platforms affected:**
- ENS (Ethereum Name Service): 2.7 M+ registered names
- Unstoppable Domains: 4.6 M+ registered names
- Handshake (HNS): decentralised TLD registry
- Namecoin: `.bit` TLD

Blockchain-based naming systems issue domain NFTs that resolve via browser plugins or gateway services.
Because they are stored on-chain they cannot be seized via ICANN or registrar abuse processes. Attackers
register ENS names that impersonate exchanges or wallets (e.g., `metamask.eth`) and use gateway URLs
(e.g., `metamask.eth.limo`) to serve phishing pages through traditional browsers.

- Takedown-resistant by design; only the NFT owner can transfer
- Gateway services (eth.limo, eth.link) may be contacted for abuse filtering
- Handshake TLDs resolve only via HNS-aware resolvers or gateways

---

### Smishing / Lighthouse — `smishing`

**Attribution:** Smishing Triad (Chinese-language PaaS)  
**Infrastructure:** Alibaba Cloud, rotating short-link domains

Lighthouse is a Chinese-language phishing-as-a-service platform operated by a group researchers call
Smishing Triad. It provides affiliates with SMS sending infrastructure, lure templates in multiple
languages, and hosted phishing pages that impersonate postal services, toll operators, banks, and
crypto exchanges. The platform has been observed targeting users of major exchanges with fake security
alert lures.

- Alibaba Cloud heavily represented in DNS and hosting infrastructure
- Short-lived domains; average lifespan measured in days
- Template library includes MetaMask, Coinbase, Binance, and Kraken lures
- See also: Investigation 12 (xcrucpst.boats) in internal case archive

---

### Additional Tags (brief reference)

The remaining tags in the 20-item controlled vocabulary (exact schema values, underscored):

| Tag | Summary |
|---|---|
| `phishing` | Credential or seed-phrase harvesting page |
| `fake_exchange` | Lookalike or entirely fabricated exchange UI; used in pig-butchering and credential theft |
| `fake_wallet` | Trojanised wallet app or lookalike wallet-connect page |
| `fake_airdrop` | Fake token airdrop requiring wallet connection or upfront gas fee |
| `rug_pull` | Token or NFT project that abandons liquidity after fundraising |
| `investment_scam` | Fraudulent investment / yield platform or scheme (covers Ponzi-style structures) |
| `nft_scam` | Fake minting page, counterfeit collection, or NFT-targeted phishing |
| `defi_impersonation` | Lookalike or fraudulent DeFi protocol front-end |
| `c2_infrastructure` | Command-and-control infrastructure (EtherHiding, traditional HTTP C2) |
| `credential_stealer` | Web or host-based credential harvesting; exfils to attacker server |
| `impersonation` | Brand, protocol, or public figure impersonation not covered by a more specific tag |
| `typosquat` | Lookalike domain relying on misspelling or character substitution |
| `cryptojacking` | Browser/host cryptomining (CoinMiner, cryptojacking); sourced from URLhaus |

> Removed from earlier drafts: `vishing`, `ponzi`, `blockchain-domain-abuse`, and
> `malware-distribution` are **not** in the schema. Voice phishing has no dedicated tag; Ponzi
> schemes map to `investment_scam`; blockchain naming abuse is captured via `type` + `impersonation`;
> malware delivery is tagged by its technique (e.g. `clickfix`, `etherhiding`, `c2_infrastructure`).
