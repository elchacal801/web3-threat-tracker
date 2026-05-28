import csv
import io
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

import requests

from scripts.ingest.base import BaseIngester
from scripts.models import Entry, _normalize_domain

logger = logging.getLogger(__name__)

CRYPTO_TARGETS = {
    "coinbase", "metamask", "binance", "kraken", "gemini", "crypto.com",
    "blockchain.com", "trust wallet", "phantom", "opensea", "uniswap",
    "pancakeswap", "aave", "compound", "luno", "bitfinex", "kucoin",
    "bybit", "okx", "gate.io", "huobi", "ftx", "celsius", "nexo",
    "blockfi", "ledger", "trezor", "exodus", "atomic wallet",
    "bitcoin", "ethereum", "solana", "cardano", "polkadot",
    "sushiswap", "curve", "1inch", "dydx", "blur",
}


class PhishTankIngester(BaseIngester):
    SOURCE_NAME = "phishtank"
    OUTPUT_DIR = "phishtank"

    def __init__(self, base_dir=None, app_key=None):
        super().__init__(base_dir)
        self.app_key = app_key or os.environ.get("PHISHTANK_APP_KEY", "")

    def fetch(self) -> list[dict]:
        key_segment = self.app_key if self.app_key else ""
        url = f"http://data.phishtank.com/data/{key_segment}/online-valid.csv"
        resp = requests.get(url, headers={"User-Agent": "phishtank/web3-threat-tracker"}, timeout=120)
        resp.raise_for_status()
        reader = csv.DictReader(io.StringIO(resp.text))
        return list(reader)

    def parse(self, raw_data: list[dict]) -> list[Entry]:
        seen = set()
        entries = []
        for row in raw_data:
            target = (row.get("target") or "").lower()
            if not any(ct in target for ct in CRYPTO_TARGETS):
                continue
            url = row.get("url", "")
            parsed = urlparse(url)
            domain = _normalize_domain(parsed.hostname or "")
            if not domain or domain in seen:
                continue
            seen.add(domain)
            submission_time = row.get("submission_time", self.now)
            entries.append(Entry(
                domain=domain, url=url, type="traditional_domain",
                severity="MALICIOUS", confidence="HIGH", tags=["phishing"],
                sources=["phishtank"], first_seen=submission_time,
                last_seen=self.now, added_by="automated",
            ))
        return entries


def main():
    logging.basicConfig(level=logging.INFO)
    ingester = PhishTankIngester()
    entries = ingester.run()
    print(f"PhishTank: {len(entries)} crypto-related entries ingested")


if __name__ == "__main__":
    main()
