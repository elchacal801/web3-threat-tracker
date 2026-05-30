import json
import shutil
import sys
from pathlib import Path

from scripts.build_labels import build_labels, write_labels_json
from scripts.models import Entry
from scripts.normalize import load_entries_from_yaml


def _shard_key(domain: str) -> str:
    """Return the shard key for a domain: a-z for alpha, 'numeric' for everything else."""
    first = domain[0].lower() if domain else "_"
    return first if first.isalpha() else "numeric"


def build_search_index_shards(entries: list[Entry]) -> dict[str, list[dict]]:
    """Build per-letter search index shards with compact keys."""
    shards: dict[str, list[dict]] = {}
    for entry in sorted(entries, key=lambda e: e.domain):
        key = _shard_key(entry.domain)
        shards.setdefault(key, []).append({
            "d": entry.domain,
            "s": entry.severity,
            "c": entry.confidence,
            "t": sorted(entry.tags),
            "src": sorted(entry.sources),
        })
    return shards


def build_search_index(entries: list[Entry]) -> list[dict]:
    """Build flat search index (for backward compat in tests). Returns sorted list."""
    result = []
    for shard in build_search_index_shards(entries).values():
        result.extend(shard)
    return sorted(result, key=lambda e: e["d"])


def write_search_index_shards(shards: dict[str, list[dict]], output_dir: str) -> dict:
    """Write per-letter index shards and manifest. Returns manifest dict."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key, shard_data in sorted(shards.items()):
        with open(out / f"{key}.json", "w") as f:
            json.dump(shard_data, f, separators=(",", ":"))
        manifest[key] = len(shard_data)
    with open(out / "manifest.json", "w") as f:
        json.dump(manifest, f, indent=2)
    return manifest


def build_detail_shards(entries: list[Entry], output_dir: str) -> None:
    """Build per-letter JSON detail files with full entry data."""
    shards: dict[str, list[dict]] = {}
    for entry in sorted(entries, key=lambda e: e.domain):
        key = _shard_key(entry.domain)
        shards.setdefault(key, []).append(entry.to_dict())

    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    for key, shard_data in sorted(shards.items()):
        with open(out / f"{key}.json", "w") as f:
            json.dump(shard_data, f, separators=(",", ":"))


def main():
    base = Path(__file__).parent.parent
    entries_dir = base / "data" / "entries"
    site_data_dir = base / "site" / "data"
    index_dir = site_data_dir / "index"
    details_dir = site_data_dir / "details"

    all_entries = []
    for yaml_file in sorted(entries_dir.glob("*.yaml")):
        all_entries.extend(load_entries_from_yaml(str(yaml_file)))

    print(f"Building site data from {len(all_entries)} entries...")

    # Build sharded search index
    shards = build_search_index_shards(all_entries)
    manifest = write_search_index_shards(shards, str(index_dir))
    total = sum(manifest.values())
    max_shard = max(manifest.values()) if manifest else 0
    print(f"Search index: {total} entries across {len(manifest)} shards (largest: {max_shard})")

    # Build detail shards
    build_detail_shards(all_entries, str(details_dir))
    shard_count = len(list(details_dir.glob("*.json")))
    print(f"Detail shards: {shard_count} files")

    # Build labels.json
    labels = build_labels(base)
    labels_path = site_data_dir / "labels.json"
    write_labels_json(labels, labels_path)
    print(f"Labels: {len(labels)} entries written to {labels_path}")

    # Copy stats.json
    stats_src = base / "data" / "exports" / "stats.json"
    if stats_src.exists():
        site_data_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(stats_src, site_data_dir / "stats.json")
        print("Copied stats.json")


if __name__ == "__main__":
    main()
