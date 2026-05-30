import csv
from pathlib import Path

from scripts.ingest.ingest_ofac import parse_addresses_from_sdn, write_ofac_csv


MOCK_SDN_CSV = """\
12345,"EVIL ACTOR","individual",,,,,,,"Digital Currency Address - ETH 0xDeaDbEeF00000000000000000000000000000001; alt ID"
12346,"ANOTHER BAD GUY","individual",,,,,,,"Digital Currency Address - XBT bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4; Digital Currency Address - ETH 0x1234567890abcdef1234567890ABCDEF12345678"
12347,"LEGIT PERSON","individual",,,,,,,"No crypto here"
12348,"SNEAKY ACTOR","individual",,,,,,,"some field 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa embedded"
"""


def test_parse_eth_addresses():
    results = parse_addresses_from_sdn(MOCK_SDN_CSV)
    eth_addrs = [r["address"] for r in results if r["chain"] == 1]
    assert "0xdeadbeef00000000000000000000000000000001" in eth_addrs
    assert "0x1234567890abcdef1234567890abcdef12345678" in eth_addrs
    assert "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" in eth_addrs


def test_parse_btc_addresses():
    results = parse_addresses_from_sdn(MOCK_SDN_CSV)
    btc_addrs = [r["address"] for r in results if r["chain"] == 0]
    assert "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" in btc_addrs


def test_all_entries_are_sanctioned():
    results = parse_addresses_from_sdn(MOCK_SDN_CSV)
    for r in results:
        assert r["category"] == "sanctioned"
        assert r["source"] == "ofac"
        assert r["confidence"] == "high"


def test_entity_names_include_ofac_prefix():
    results = parse_addresses_from_sdn(MOCK_SDN_CSV)
    for r in results:
        assert r["entity"].startswith("OFAC: ")


def test_deduplication():
    duped_csv = """\
1,"ACTOR A","individual",,,,,,,"0xDeaDbEeF00000000000000000000000000000001"
2,"ACTOR B","individual",,,,,,,"0xdeadbeef00000000000000000000000000000001"
"""
    results = parse_addresses_from_sdn(duped_csv)
    eth_addrs = [r["address"] for r in results if r["chain"] == 1]
    assert eth_addrs.count("0xdeadbeef00000000000000000000000000000001") == 1


def test_empty_csv():
    results = parse_addresses_from_sdn("")
    assert results == []


def test_no_crypto_rows():
    csv_text = '1,"NORMAL PERSON","individual",,,,,,,"No addresses"\n'
    results = parse_addresses_from_sdn(csv_text)
    assert results == []


def test_write_ofac_csv(tmp_path):
    entries = [
        {"chain": 1, "address": "0xdead", "entity": "OFAC: Test", "category": "sanctioned", "source": "ofac", "confidence": "high"},
    ]
    out = tmp_path / "ofac.csv"
    write_ofac_csv(entries, out)
    assert out.exists()
    with open(out, newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert len(rows) == 1
    assert rows[0]["address"] == "0xdead"
    assert rows[0]["category"] == "sanctioned"
