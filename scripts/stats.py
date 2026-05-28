# scripts/stats.py
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from scripts.models import Entry
from scripts.normalize import load_entries_from_yaml


def generate_stats(entries: list[Entry]) -> dict:
    by_severity = Counter(e.severity for e in entries)
    by_confidence = Counter(e.confidence for e in entries)
    by_type = Counter(e.type for e in entries)

    by_tag = Counter()
    for e in entries:
        by_tag.update(e.tags)

    by_source = Counter()
    for e in entries:
        by_source.update(e.sources)

    return {
        "total": len(entries),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "by_severity": dict(by_severity),
        "by_confidence": dict(by_confidence),
        "by_tag": dict(by_tag.most_common()),
        "by_source": dict(by_source.most_common()),
        "by_type": dict(by_type),
    }


def main():
    base = Path(__file__).parent.parent
    entries_dir = base / "data" / "entries"
    stats_path = base / "data" / "exports" / "stats.json"

    all_entries = []
    for yaml_file in sorted(entries_dir.glob("*.yaml")):
        all_entries.extend(load_entries_from_yaml(str(yaml_file)))

    stats = generate_stats(all_entries)
    stats_path.parent.mkdir(parents=True, exist_ok=True)
    with open(stats_path, "w") as f:
        json.dump(stats, f, indent=2)

    print(f"Stats: {stats['total']} entries")
    for sev, count in stats["by_severity"].items():
        print(f"  {sev}: {count}")


if __name__ == "__main__":
    main()
