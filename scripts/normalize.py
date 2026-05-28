import sys
from pathlib import Path
from typing import Optional

import yaml

from scripts.models import Entry

SEVERITY_ORDER = {"LEGITIMATE": 0, "SUSPICIOUS": 1, "RISKY": 2, "MALICIOUS": 3}
CONFIDENCE_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def severity_rank(severity: str) -> int:
    return SEVERITY_ORDER.get(severity, -1)


def confidence_rank(confidence: str) -> int:
    return CONFIDENCE_ORDER.get(confidence, -1)


def _union_lists(a: Optional[list], b: Optional[list]) -> Optional[list]:
    """Union two optional lists, preserving uniqueness."""
    if a is None and b is None:
        return None
    combined = set(a or []) | set(b or [])
    return sorted(combined) if combined else None


def merge_entries(a: Entry, b: Entry) -> Entry:
    """Merge two entries for the same domain. Takes highest severity/confidence,
    earliest first_seen, latest last_seen, unions list fields."""
    severity = a.severity if severity_rank(a.severity) >= severity_rank(b.severity) else b.severity
    confidence = a.confidence if confidence_rank(a.confidence) >= confidence_rank(b.confidence) else b.confidence
    first_seen = min(a.first_seen, b.first_seen)
    last_seen = max(a.last_seen, b.last_seen)

    return Entry(
        domain=a.domain,
        url=a.url or b.url,
        type=a.type,
        severity=severity,
        confidence=confidence,
        tags=sorted(set(a.tags) | set(b.tags)),
        sources=sorted(set(a.sources) | set(b.sources)),
        first_seen=first_seen,
        last_seen=last_seen,
        added_by=a.added_by,
        registrar=a.registrar or b.registrar,
        registration_date=a.registration_date or b.registration_date,
        whois_privacy=a.whois_privacy if a.whois_privacy is not None else b.whois_privacy,
        nameservers=_union_lists(a.nameservers, b.nameservers),
        hosting_provider=a.hosting_provider or b.hosting_provider,
        ip_addresses=_union_lists(a.ip_addresses, b.ip_addresses),
        asn=a.asn or b.asn,
        ssl_issuer=a.ssl_issuer or b.ssl_issuer,
        ssl_validity_days=a.ssl_validity_days or b.ssl_validity_days,
        ssl_subject_alt_names=_union_lists(a.ssl_subject_alt_names, b.ssl_subject_alt_names),
        blockchain_network=a.blockchain_network or b.blockchain_network,
        wallet_addresses=_union_lists(a.wallet_addresses, b.wallet_addresses),
        smart_contract_addresses=_union_lists(a.smart_contract_addresses, b.smart_contract_addresses),
        ens_name=a.ens_name or b.ens_name,
        unstoppable_domain=a.unstoppable_domain or b.unstoppable_domain,
        transaction_hashes=_union_lists(a.transaction_hashes, b.transaction_hashes),
        notes=a.notes or b.notes,
        references=_union_lists(a.references, b.references),
        related_domains=_union_lists(a.related_domains, b.related_domains),
    )


def normalize_and_dedup(entries: list[Entry]) -> list[Entry]:
    """Deduplicate entries by domain, merging duplicates."""
    by_domain: dict[str, Entry] = {}
    for entry in entries:
        key = entry.domain
        if key in by_domain:
            by_domain[key] = merge_entries(by_domain[key], entry)
        else:
            by_domain[key] = entry
    return sorted(by_domain.values(), key=lambda e: e.domain)


def load_entries_from_yaml(filepath: str) -> list[Entry]:
    """Load entries from a YAML file."""
    with open(filepath) as f:
        data = yaml.safe_load(f) or []
    return [Entry.from_dict(d) for d in data]


def save_entries_to_yaml(entries: list[Entry], filepath: str) -> None:
    """Save entries to a YAML file."""
    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    data = [e.to_dict() for e in entries]
    with open(filepath, "w") as f:
        yaml.dump(data, f, default_flow_style=False, sort_keys=False)


def shard_entries(entries: list[Entry], output_dir: str) -> None:
    """Shard entries into alphabetical YAML files (a.yaml, b.yaml, ..., numeric.yaml)."""
    shards: dict[str, list[Entry]] = {}
    for entry in entries:
        first_char = entry.domain[0].lower() if entry.domain else "_"
        if first_char.isalpha():
            shard_key = first_char
        else:
            shard_key = "numeric"
        shards.setdefault(shard_key, []).append(entry)

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    for key, shard_entries_list in sorted(shards.items()):
        save_entries_to_yaml(shard_entries_list, str(out / f"{key}.yaml"))


def main():
    """CLI: load all entries, normalize, dedup, shard to data/entries/."""
    entries_dir = Path(__file__).parent.parent / "data" / "entries"
    all_entries = []
    for yaml_file in sorted(entries_dir.glob("*.yaml")):
        all_entries.extend(load_entries_from_yaml(str(yaml_file)))

    deduped = normalize_and_dedup(all_entries)
    shard_entries(deduped, str(entries_dir))
    print(f"Normalized: {len(all_entries)} → {len(deduped)} entries")


if __name__ == "__main__":
    main()
