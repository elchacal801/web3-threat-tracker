"""Build labels.json from CSV label sources.

Reads labels/entities.csv (manually curated) and labels/ofac.csv (if present),
merges them into site/data/labels.json keyed by lowercase address.
"""

import csv
import json
import sys
from pathlib import Path


def read_label_csv(path: Path) -> list[dict]:
    """Read a labels CSV file. Returns list of row dicts."""
    if not path.exists():
        return []
    rows = []
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def merge_labels(sources: list[list[dict]]) -> dict:
    """Merge multiple label sources into a single dict keyed by lowercase address.

    Later sources override earlier ones for the same address.
    Output format: { "0x...": {"name": "...", "type": "...", "chain": 1} }
    """
    merged = {}
    for rows in sources:
        for row in rows:
            addr = row.get("address", "").lower().strip()
            if not addr:
                continue
            chain = int(row.get("chain", 1))
            merged[addr] = {
                "name": row.get("entity", "Unknown"),
                "type": row.get("category", ""),
                "chain": chain,
            }
    return merged


def build_labels(base_dir: Path | None = None) -> dict:
    """Build the merged labels dict from all CSV sources."""
    base = base_dir or Path(__file__).parent.parent
    labels_dir = base / "labels"

    sources = []
    # Manual curated labels (base)
    entities_csv = labels_dir / "entities.csv"
    sources.append(read_label_csv(entities_csv))

    # OFAC sanctioned addresses (overlay)
    ofac_csv = labels_dir / "ofac.csv"
    sources.append(read_label_csv(ofac_csv))

    return merge_labels(sources)


def write_labels_json(labels: dict, output_path: Path) -> None:
    """Write labels dict to JSON file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(labels, f, separators=(",", ":"), sort_keys=True)


def main():
    base = Path(__file__).parent.parent
    labels = build_labels(base)
    output_path = base / "site" / "data" / "labels.json"
    write_labels_json(labels, output_path)
    print(f"Labels: {len(labels)} entries written to {output_path}")


if __name__ == "__main__":
    main()
