import csv
import logging
import subprocess
from pathlib import Path

from scripts.ingest.base import BaseIngester
from scripts.models import Entry

logger = logging.getLogger(__name__)

REPO_URL = "https://github.com/forta-network/labelled-datasets.git"

CHAIN_MAP = {
    "1": "ethereum", "10": "optimism", "56": "bsc",
    "137": "polygon", "42161": "arbitrum",
}


class FortaIngester(BaseIngester):
    SOURCE_NAME = "forta"
    OUTPUT_DIR = "forta"

    def fetch(self) -> dict:
        repo_dir = self.output_dir / "repo"
        if (repo_dir / ".git").exists():
            subprocess.run(["git", "-C", str(repo_dir), "pull", "--quiet"], check=True)
        elif not (repo_dir / "labels").exists():
            subprocess.run(["git", "clone", "--depth=1", REPO_URL, str(repo_dir)], check=True)

        result = {"phishing": [], "contracts": []}
        labels_dir = repo_dir / "labels"
        for chain_dir in labels_dir.iterdir():
            if not chain_dir.is_dir():
                continue
            chain_id = chain_dir.name
            blockchain = CHAIN_MAP.get(chain_id, "other")
            phishing_file = chain_dir / "phishing_scams.csv"
            if phishing_file.exists():
                with open(phishing_file, newline="") as f:
                    for row in csv.DictReader(f):
                        row["_blockchain"] = blockchain
                        result["phishing"].append(row)
            contracts_file = chain_dir / "malicious_smart_contracts.csv"
            if contracts_file.exists():
                with open(contracts_file, newline="") as f:
                    for row in csv.DictReader(f):
                        row["_blockchain"] = blockchain
                        result["contracts"].append(row)
        return result

    def parse(self, raw_data: dict) -> list[Entry]:
        entries = []
        seen = set()
        for row in raw_data.get("phishing", []):
            addr = row.get("address", "").lower()
            if not addr or addr in seen:
                continue
            seen.add(addr)
            entries.append(Entry(
                domain=addr, type="smart_contract", severity="MALICIOUS",
                confidence="MEDIUM", tags=["phishing"], sources=["forta"],
                first_seen=self.now, last_seen=self.now, added_by="automated",
                blockchain_network=row.get("_blockchain", "ethereum"),
                wallet_addresses=[addr], notes=row.get("etherscan_tag"),
            ))
        for row in raw_data.get("contracts", []):
            addr = row.get("contract_address", "").lower()
            if not addr or addr in seen:
                continue
            seen.add(addr)
            entries.append(Entry(
                domain=addr, type="smart_contract", severity="MALICIOUS",
                confidence="MEDIUM", tags=["drainer"], sources=["forta"],
                first_seen=self.now, last_seen=self.now, added_by="automated",
                blockchain_network=row.get("_blockchain", "ethereum"),
                smart_contract_addresses=[addr], notes=row.get("notes"),
            ))
        return entries


def main():
    logging.basicConfig(level=logging.INFO)
    ingester = FortaIngester()
    entries = ingester.run()
    print(f"Forta: {len(entries)} entries ingested")


if __name__ == "__main__":
    main()
