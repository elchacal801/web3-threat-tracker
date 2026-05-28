import csv
import pytest
from pathlib import Path
from scripts.ingest.ingest_forta import FortaIngester


@pytest.fixture
def mock_repo(tmp_path):
    labels_dir = tmp_path / "data" / "sources" / "forta" / "repo" / "labels" / "1"
    labels_dir.mkdir(parents=True)

    phishing_file = labels_dir / "phishing_scams.csv"
    with open(phishing_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["address", "is_contract", "etherscan_tag", "etherscan_labels"])
        writer.writerow(["0xdead1234567890abcdef1234567890abcdef1234", "True", "Fake_Phishing", "phish-hack"])
        writer.writerow(["0xbeef1234567890abcdef1234567890abcdef1234", "False", "Fake_Phishing", "phish-hack"])

    contracts_file = labels_dir / "malicious_smart_contracts.csv"
    with open(contracts_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["contract_address", "contract_tag", "contract_creator", "contract_creation_tx",
                          "contract_creator_tag", "source", "notes", "contract_creator_etherscan_label"])
        writer.writerow(["0xaaaa1234567890abcdef1234567890abcdef1234", "exploit", "0xbbbb", "0xtx1",
                          "Exploiter", "etherscan", "Drain contract"])

    return tmp_path


def test_parse_phishing_scams(mock_repo):
    ingester = FortaIngester(base_dir=str(mock_repo))
    raw = ingester.fetch()
    entries = ingester.parse(raw)
    phishing_entries = [e for e in entries if "phishing" in e.tags]
    assert len(phishing_entries) >= 1


def test_parse_malicious_contracts(mock_repo):
    ingester = FortaIngester(base_dir=str(mock_repo))
    raw = ingester.fetch()
    entries = ingester.parse(raw)
    contract_entries = [e for e in entries if e.type == "smart_contract"]
    assert len(contract_entries) >= 1
