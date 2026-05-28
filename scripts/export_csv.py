# scripts/export_csv.py
import csv
import sys
from pathlib import Path
from typing import Optional

from scripts.models import Entry
from scripts.normalize import load_entries_from_yaml

CSV_COLUMNS = [
    "domain", "severity", "confidence", "tags", "type", "first_seen", "last_seen",
    "ip_addresses", "asn", "hosting_provider", "registrar", "blockchain_network",
    "wallet_addresses", "sources",
]


def _entry_to_row(entry: Entry) -> dict:
    return {
        "domain": entry.domain,
        "severity": entry.severity,
        "confidence": entry.confidence,
        "tags": "|".join(sorted(entry.tags)),
        "type": entry.type,
        "first_seen": entry.first_seen,
        "last_seen": entry.last_seen,
        "ip_addresses": "|".join(entry.ip_addresses) if entry.ip_addresses else "",
        "asn": entry.asn or "",
        "hosting_provider": entry.hosting_provider or "",
        "registrar": entry.registrar or "",
        "blockchain_network": entry.blockchain_network or "",
        "wallet_addresses": "|".join(entry.wallet_addresses) if entry.wallet_addresses else "",
        "sources": "|".join(sorted(entry.sources)),
    }


def _write_csv(entries: list[Entry], filepath: str) -> None:
    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    with open(filepath, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for entry in entries:
            writer.writerow(_entry_to_row(entry))


def export_all(entries: list[Entry], filepath: str) -> None:
    _write_csv(entries, filepath)


def export_filtered(entries: list[Entry], filepath: str, *,
                    severity: Optional[str] = None,
                    confidence: Optional[str] = None,
                    tag: Optional[str] = None) -> None:
    filtered = entries
    if severity:
        filtered = [e for e in filtered if e.severity == severity]
    if confidence:
        filtered = [e for e in filtered if e.confidence == confidence]
    if tag:
        filtered = [e for e in filtered if tag in e.tags]
    _write_csv(filtered, filepath)


def main():
    base = Path(__file__).parent.parent
    entries_dir = base / "data" / "entries"
    exports_dir = base / "data" / "exports"
    by_tag_dir = exports_dir / "by_tag"

    all_entries = []
    for yaml_file in sorted(entries_dir.glob("*.yaml")):
        all_entries.extend(load_entries_from_yaml(str(yaml_file)))

    export_all(all_entries, str(exports_dir / "all_domains.csv"))
    export_filtered(all_entries, str(exports_dir / "malicious_only.csv"), severity="MALICIOUS")
    export_filtered(all_entries, str(exports_dir / "high_confidence.csv"), confidence="HIGH")

    all_tags = set()
    for entry in all_entries:
        all_tags.update(entry.tags)
    for tag in sorted(all_tags):
        export_filtered(all_entries, str(by_tag_dir / f"{tag}.csv"), tag=tag)

    print(f"Exported {len(all_entries)} entries to {exports_dir}")


if __name__ == "__main__":
    main()
