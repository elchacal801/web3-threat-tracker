"""OFAC SDN list ingester -- extracts cryptocurrency addresses from the SDN CSV.

Downloads the OFAC SDN CSV and searches for cryptocurrency address patterns
(ETH 0x addresses, BTC addresses) embedded in the remarks/ID fields.
Outputs to labels/ofac.csv in the standard labels schema.
"""

import csv
import io
import logging
import re
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

SDN_CSV_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv"

# Patterns for crypto addresses embedded in SDN data
ETH_ADDR_RE = re.compile(r"\b(0x[0-9a-fA-F]{40})\b")
BTC_ADDR_RE = re.compile(r"\b((?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62})\b")

# Chain IDs for output
CHAIN_ETH = 1
CHAIN_BTC = 0  # BTC has no EVM chain ID; use 0 as convention

VALID_CATEGORIES = {"cex", "dex", "bridge", "mixer", "sanctioned", "token", "defi", "nft"}


def fetch_sdn_csv(url: str = SDN_CSV_URL, timeout: int = 30) -> str:
    """Download the OFAC SDN CSV file. Returns raw text content."""
    logger.info(f"Fetching OFAC SDN list from {url}")
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.text


def parse_addresses_from_sdn(raw_csv: str) -> list[dict]:
    """Parse cryptocurrency addresses from SDN CSV text.

    The SDN CSV has variable columns. Crypto addresses appear in remark/ID fields,
    often as "Digital Currency Address - XBT ..." or "Digital Currency Address - ETH ...".
    We scan every field of every row for address patterns.

    Returns list of dicts with keys: chain, address, entity, category, source, confidence.
    """
    results = []
    seen = set()

    reader = csv.reader(io.StringIO(raw_csv))
    for row in reader:
        if not row:
            continue

        # SDN CSV: col 0 = entry ID, col 1 = SDN name, rest = various fields
        entity_name = row[1].strip() if len(row) > 1 else "OFAC SDN"
        full_text = " ".join(row)

        # Check if this row mentions digital currency at all (performance filter)
        if "digital currency" not in full_text.lower() and "0x" not in full_text:
            # Still check for raw ETH addresses even without the keyword
            if not ETH_ADDR_RE.search(full_text):
                continue

        # Extract ETH addresses
        for match in ETH_ADDR_RE.finditer(full_text):
            addr = match.group(1).lower()
            if addr not in seen:
                seen.add(addr)
                results.append({
                    "chain": CHAIN_ETH,
                    "address": addr,
                    "entity": f"OFAC: {entity_name}",
                    "category": "sanctioned",
                    "source": "ofac",
                    "confidence": "high",
                })

        # Extract BTC addresses
        for match in BTC_ADDR_RE.finditer(full_text):
            addr = match.group(1)
            if addr not in seen:
                seen.add(addr)
                results.append({
                    "chain": CHAIN_BTC,
                    "address": addr,
                    "entity": f"OFAC: {entity_name}",
                    "category": "sanctioned",
                    "source": "ofac",
                    "confidence": "high",
                })

    logger.info(f"Extracted {len(results)} cryptocurrency addresses from SDN list")
    return results


def write_ofac_csv(entries: list[dict], output_path: str | Path) -> None:
    """Write parsed OFAC entries to CSV in the standard labels schema."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["chain", "address", "entity", "category", "source", "confidence"])
        writer.writeheader()
        for entry in entries:
            writer.writerow(entry)
    logger.info(f"Wrote {len(entries)} OFAC entries to {output_path}")


def main(url: str = SDN_CSV_URL) -> None:
    """Run the full OFAC ingestion pipeline."""
    base = Path(__file__).parent.parent.parent
    output_path = base / "labels" / "ofac.csv"

    try:
        raw_csv = fetch_sdn_csv(url)
    except requests.RequestException as e:
        logger.error(f"Failed to fetch OFAC SDN list: {e}")
        return

    entries = parse_addresses_from_sdn(raw_csv)
    if entries:
        write_ofac_csv(entries, output_path)
    else:
        logger.warning("No cryptocurrency addresses found in SDN list")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
