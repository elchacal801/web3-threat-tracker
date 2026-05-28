from dataclasses import dataclass, field, fields
from typing import Optional
from urllib.parse import urlparse


def _normalize_domain(raw: str) -> str:
    """Normalize a domain: lowercase, strip protocol/www/trailing slash."""
    d = raw.strip().lower()
    if "://" in d:
        d = urlparse(d).hostname or d
    if d.startswith("www."):
        d = d[4:]
    d = d.rstrip("/")
    return d


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
