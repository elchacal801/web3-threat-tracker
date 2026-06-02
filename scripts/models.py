import ipaddress
import re
from dataclasses import dataclass, field, fields
from typing import Optional
from urllib.parse import urlparse

# A DNS-style hostname: dot-separated labels of alphanumerics/underscores, with
# hyphens allowed internally. Mirrors the domain pattern in entry.schema.json so
# code-level filtering and schema validation agree. (Domains are lowercased by
# _normalize_domain before this is applied.)
_HOSTNAME_RE = re.compile(
    r"^[a-z0-9_]([a-z0-9_\-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_\-]*[a-z0-9_])?)*$"
)


def _to_punycode(d: str) -> str:
    """Convert internationalized (non-ASCII) labels to ASCII-compatible (punycode)
    form so homograph/IDN domains dedupe with their encoded representation. ASCII
    labels (including underscores) are left untouched."""
    if d.isascii():
        return d
    out = []
    for label in d.split("."):
        if label and not label.isascii():
            try:
                label = label.encode("idna").decode("ascii")
            except (UnicodeError, ValueError):
                pass  # leave un-encodable labels as-is rather than crashing
        out.append(label)
    return ".".join(out)


def _normalize_domain(raw: str) -> str:
    """Normalize a domain: lowercase, strip protocol/www/trailing slash and dot,
    convert IDN labels to punycode."""
    d = raw.strip().lower()
    if "://" in d:
        d = urlparse(d).hostname or d
    if d.startswith("www."):
        d = d[4:]
    d = d.rstrip("/")
    # A trailing dot is the DNS root label; strip it so "x.com." and "x.com"
    # dedupe together and match how DNS query logs are typically recorded.
    d = d.rstrip(".")
    return _to_punycode(d)


def is_valid_domain(domain: str) -> bool:
    """Whether a normalized domain belongs in a domain threat feed.

    Rejects empty strings and bare IP addresses (those belong in IP-based
    detection rules, not a DNS-domain lookup). Accepts 0x smart-contract
    addresses and hostnames (underscores allowed — real phishing hosts on
    hosting platforms use them)."""
    if not domain:
        return False
    if domain.startswith("0x") and len(domain) == 42:
        return all(c in "0123456789abcdefABCDEF" for c in domain[2:])
    try:
        ipaddress.ip_address(domain)
        return False  # a bare IP is not a domain
    except ValueError:
        pass
    # Reject anything that isn't a clean hostname (URLs with paths, whitespace,
    # leading/trailing dots) — they can't be matched as a DNS domain.
    return bool(_HOSTNAME_RE.match(domain.lower()))


@dataclass
class Entry:
    domain: str
    type: str
    severity: str
    confidence: str
    tags: list[str]
    sources: list[str]
    first_seen: str
    last_seen: str
    added_by: str
    url: Optional[str] = None
    registrar: Optional[str] = None
    registration_date: Optional[str] = None
    whois_privacy: Optional[bool] = None
    nameservers: Optional[list[str]] = None
    hosting_provider: Optional[str] = None
    ip_addresses: Optional[list[str]] = None
    asn: Optional[str] = None
    ssl_issuer: Optional[str] = None
    ssl_validity_days: Optional[int] = None
    ssl_subject_alt_names: Optional[list[str]] = None
    blockchain_network: Optional[str] = None
    wallet_addresses: Optional[list[str]] = None
    smart_contract_addresses: Optional[list[str]] = None
    ens_name: Optional[str] = None
    unstoppable_domain: Optional[str] = None
    transaction_hashes: Optional[list[str]] = None
    notes: Optional[str] = None
    references: Optional[list[str]] = None
    related_domains: Optional[list[str]] = None

    def __post_init__(self):
        self.domain = _normalize_domain(self.domain)

    def to_dict(self) -> dict:
        """Convert to dict, excluding None-valued optional fields."""
        result = {}
        for f in fields(self):
            val = getattr(self, f.name)
            if val is not None:
                result[f.name] = val
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "Entry":
        """Create Entry from a dict, ignoring unknown keys."""
        known = {f.name for f in fields(cls)}
        filtered = {k: v for k, v in data.items() if k in known}
        return cls(**filtered)
