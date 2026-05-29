import json
import shutil
import sys
from pathlib import Path

from scripts.models import Entry
from scripts.normalize import load_entries_from_yaml


def build_search_index(entries: list[Entry]) -> list[dict]:
    """Build compact search index with short keys for minimal file size."""
    index = []
    for entry in sorted(entries, key=lambda e: e.domain):
        index.append({
            "d": entry.domain,
            "s": entry.severity,
            "c": entry.confidence,
            "t": sorted(entry.tags),
            "src": sorted(entry.sources),
        })
    return index


def build_detail_shards(entries: list[Entry], output_dir: str) -> None:
    """Build per-letter JSON detail files with full entry data."""
    shards: dict[str, list[dict]] = {}
    for entry in sorted(entries, key=lambda e: e.domain):
        first_char = entry.domain[0].lower() if entry.domain else "_"
        shard_key = first_char if first_char.isalpha() else "numeric"
        shards.setdefault(shard_key, []).append(entry.to_dict())

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    for key, shard_data in sorted(shards.items()):
        with open(out / f"{key}.json", "w") as f:
            json.dump(shard_data, f, separators=(",", ":"))


def main():
    base = Path(__file__).parent.parent
    entries_dir = base / "data" / "entries"
    site_data_dir = base / "site" / "data"
    details_dir = site_data_dir / "details"

    all_entries = []
    for yaml_file in sorted(entries_dir.glob("*.yaml")):
        all_entries.extend(load_entries_from_yaml(str(yaml_file)))

    print(f"Building site data from {len(all_entries)} entries...")

    site_data_dir.mkdir(parents=True, exist_ok=True)
    index = build_search_index(all_entries)
    with open(site_data_dir / "search-index.json", "w") as f:
        json.dump(index, f, separators=(",", ":"))
    size_mb = (site_data_dir / "search-index.json").stat().st_size / 1048576
    print(f"Search index: {len(index)} entries, {size_mb:.1f}MB")

    build_detail_shards(all_entries, str(details_dir))
    shard_count = len(list(details_dir.glob("*.json")))
    print(f"Detail shards: {shard_count} files")

    stats_src = base / "data" / "exports" / "stats.json"
    if stats_src.exists():
        shutil.copy2(stats_src, site_data_dir / "stats.json")
        print("Copied stats.json")


if __name__ == "__main__":
    main()
