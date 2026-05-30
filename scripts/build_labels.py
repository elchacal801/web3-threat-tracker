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
            raw_addr = row.get("address", "").strip()
            if not raw_addr:
                continue
            raw_chain = row.get("chain", "1").strip()
            try:
                chain: int | str = int(raw_chain)
            except ValueError:
                chain = raw_chain  # non-numeric chain IDs (e.g. "solana", "bitcoin")
            # EVM addresses are case-insensitive; lowercase for consistent lookup.
            # Non-EVM (Solana, Bitcoin) addresses are case-sensitive; preserve case.
            if isinstance(chain, int):
                addr = raw_addr.lower()
            else:
                addr = raw_addr
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
