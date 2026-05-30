import json
from pathlib import Path

from scripts.build_labels import read_label_csv, merge_labels, build_labels, write_labels_json


def _write_csv(path: Path, rows: list[str]) -> None:
    path.write_text("\n".join(rows) + "\n")


def test_read_label_csv(tmp_path):
    csv_path = tmp_path / "test.csv"
    _write_csv(csv_path, [
        "chain,address,entity,category,source,confidence",
        "1,0xaaaa,Test Exchange,cex,manual,high",
    ])
    rows = read_label_csv(csv_path)
    assert len(rows) == 1
    assert rows[0]["address"] == "0xaaaa"
    assert rows[0]["entity"] == "Test Exchange"


def test_read_missing_csv():
    rows = read_label_csv(Path("/nonexistent/file.csv"))
    assert rows == []


def test_merge_labels_basic():
    source1 = [
        {"chain": "1", "address": "0xAAAA", "entity": "Exchange A", "category": "cex"},
        {"chain": "1", "address": "0xBBBB", "entity": "DEX B", "category": "dex"},
    ]
    result = merge_labels([source1])
    assert "0xaaaa" in result
    assert result["0xaaaa"]["name"] == "Exchange A"
    assert result["0xaaaa"]["type"] == "cex"
    assert result["0xaaaa"]["chain"] == 1


def test_merge_labels_override():
    source1 = [{"chain": "1", "address": "0xaaaa", "entity": "Old Name", "category": "cex"}]
    source2 = [{"chain": "1", "address": "0xAAAA", "entity": "OFAC: Bad Actor", "category": "sanctioned"}]
    result = merge_labels([source1, source2])
    assert result["0xaaaa"]["name"] == "OFAC: Bad Actor"
    assert result["0xaaaa"]["type"] == "sanctioned"


def test_merge_labels_empty_address():
    source = [{"chain": "1", "address": "", "entity": "No Addr", "category": "cex"}]
    result = merge_labels([source])
    assert len(result) == 0


def test_build_labels_from_dir(tmp_path):
    labels_dir = tmp_path / "labels"
    labels_dir.mkdir()
    _write_csv(labels_dir / "entities.csv", [
        "chain,address,entity,category,source,confidence",
        "1,0xaaaa,Exchange A,cex,manual,high",
        "1,0xbbbb,Bridge B,bridge,manual,high",
    ])
    # No ofac.csv -- should still work
    result = build_labels(tmp_path)
    assert len(result) == 2
    assert "0xaaaa" in result
    assert "0xbbbb" in result


def test_build_labels_with_ofac(tmp_path):
    labels_dir = tmp_path / "labels"
    labels_dir.mkdir()
    _write_csv(labels_dir / "entities.csv", [
        "chain,address,entity,category,source,confidence",
        "1,0xaaaa,Exchange A,cex,manual,high",
    ])
    _write_csv(labels_dir / "ofac.csv", [
        "chain,address,entity,category,source,confidence",
        "1,0xcccc,OFAC: Evil Corp,sanctioned,ofac,high",
    ])
    result = build_labels(tmp_path)
    assert len(result) == 2
    assert result["0xcccc"]["name"] == "OFAC: Evil Corp"
    assert result["0xcccc"]["type"] == "sanctioned"


def test_write_labels_json(tmp_path):
    labels = {
        "0xaaaa": {"name": "Test", "type": "cex", "chain": 1},
    }
    out = tmp_path / "data" / "labels.json"
    write_labels_json(labels, out)
    assert out.exists()
    with open(out) as f:
        data = json.load(f)
    assert data["0xaaaa"]["name"] == "Test"
