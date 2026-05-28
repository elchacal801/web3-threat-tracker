import logging
import os
import time
from pathlib import Path

import requests

from scripts.ingest.base import BaseIngester
from scripts.models import Entry, _normalize_domain

logger = logging.getLogger(__name__)

API_BASE = "https://api.chainabuse.com/v0"

CATEGORY_MAP = {
    "phishing": ["phishing"],
    "rugpull": ["rug_pull"],
    "scam": ["investment_scam"],
    "theft": ["drainer"],
    "ransomware": ["credential_stealer"],
    "sextortion": ["investment_scam"],
    "fake_exchange": ["fake_exchange"],
    "fake_airdrop": ["fake_airdrop"],
    "impersonation": ["impersonation"],
}


def _map_chainabuse_category(category: str) -> list[str]:
    return CATEGORY_MAP.get(category.lower(), ["phishing"])


class ChainabuseIngester(BaseIngester):
    SOURCE_NAME = "chainabuse"
    OUTPUT_DIR = "chainabuse"

    def __init__(self, base_dir=None, api_key=None):
        super().__init__(base_dir)
        self.api_key = api_key or os.environ.get("CHAINABUSE_API_KEY", "")

    def fetch(self) -> list[dict]:
        if not self.api_key:
            logger.warning("CHAINABUSE_API_KEY not set, skipping API fetch")
            return []
        all_reports = []
        page = 1
        while True:
            try:
                resp = requests.get(
                    f"{API_BASE}/reports",
                    auth=(self.api_key, self.api_key),
                    params={"page": page, "perPage": 50},
                    timeout=30,
                )
                resp.raise_for_status()
            except requests.RequestException as e:
                logger.error(f"[chainabuse] API request failed (page {page}): {e}")
                break
            data = resp.json()
            reports = data if isinstance(data, list) else data.get("reports", [])
            if not reports:
                break
            all_reports.extend(reports)
            page += 1
            time.sleep(1)
            if page > 100:
                break
        return all_reports

    def parse(self, raw_data: list[dict]) -> list[Entry]:
        seen = set()
        entries = []
        for report in raw_data:
            domain_raw = report.get("domain")
            if not domain_raw:
                continue
            domain = _normalize_domain(domain_raw)
            if not domain or domain in seen:
                continue
            seen.add(domain)
            wallets = []
            blockchain = None
            for addr_info in (report.get("addresses") or []):
                if addr_info.get("address"):
                    wallets.append(addr_info["address"])
                if not blockchain and addr_info.get("chain"):
                    blockchain = addr_info["chain"].lower()
            category = report.get("category", "phishing")
            tags = _map_chainabuse_category(category)
            created = report.get("createdAt", self.now)
            entries.append(Entry(
                domain=domain, type="traditional_domain", severity="MALICIOUS",
                confidence="MEDIUM", tags=tags, sources=["chainabuse"],
                first_seen=created, last_seen=self.now, added_by="automated",
                wallet_addresses=sorted(wallets) if wallets else None,
                blockchain_network=blockchain, notes=report.get("description"),
            ))
        return entries


def main():
    logging.basicConfig(level=logging.INFO)
    ingester = ChainabuseIngester()
    entries = ingester.run()
    print(f"Chainabuse: {len(entries)} entries ingested")


if __name__ == "__main__":
    main()
