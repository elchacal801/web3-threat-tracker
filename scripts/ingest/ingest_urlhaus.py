import logging
import os
from pathlib import Path

import requests

from scripts.ingest.base import BaseIngester
from scripts.models import Entry, _normalize_domain

logger = logging.getLogger(__name__)

API_BASE = "https://urlhaus-api.abuse.ch/v1"
CRYPTO_TAGS = ["CoinMiner", "coinminer", "cryptojacking", "crypto", "cryptominer"]


class URLhausIngester(BaseIngester):
    SOURCE_NAME = "urlhaus"
    OUTPUT_DIR = "urlhaus"

    def __init__(self, base_dir=None, api_key=None):
        super().__init__(base_dir)
        self.api_key = api_key or os.environ.get("URLHAUS_API_KEY", "")

    def fetch(self) -> list[dict]:
        headers = {}
        if self.api_key:
            headers["Auth-Key"] = self.api_key

        all_urls = []
        for tag in CRYPTO_TAGS:
            try:
                resp = requests.post(
                    f"{API_BASE}/tag/",
                    data={"tag": tag},
                    headers=headers,
                    timeout=60,
                )
                resp.raise_for_status()
            except requests.RequestException as e:
                logger.error(f"[urlhaus] API request failed for tag '{tag}': {e}")
                continue
            data = resp.json()
            if data.get("query_status") == "ok":
                all_urls.extend(data.get("urls", []))
        return all_urls

    def parse(self, raw_data: list[dict]) -> list[Entry]:
        seen = set()
        entries = []
        for item in raw_data:
            host = item.get("host", "")
            domain = _normalize_domain(host)
            if not domain or domain in seen:
                continue
            seen.add(domain)
            date_added = item.get("date_added", self.now)
            entries.append(Entry(
                domain=domain, url=item.get("url"), type="traditional_domain",
                severity="MALICIOUS", confidence="MEDIUM", tags=["credential_stealer"],
                sources=["urlhaus"], first_seen=date_added, last_seen=self.now,
                added_by="automated",
            ))
        return entries


def main():
    logging.basicConfig(level=logging.INFO)
    ingester = URLhausIngester()
    entries = ingester.run()
    print(f"URLhaus: {len(entries)} crypto-related entries ingested")


if __name__ == "__main__":
    main()
