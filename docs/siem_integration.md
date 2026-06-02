# SIEM Integration

How to load Web3 Threat Tracker exports into your SIEM for DNS and web request monitoring.

The recommended export for SIEM use is `data/exports/malicious_only.csv` (severity = MALICIOUS) or
`data/exports/high_confidence.csv` (confidence = HIGH). For maximum coverage at the cost of false
positives, use `data/exports/all_domains.csv` with a severity filter applied inside your SIEM query.

---

## CrowdStrike NG-SIEM (LogScale)

### 1. Prepare the lookup file

Download the CSV export:

```bash
# From the pipeline output directory
cp data/exports/malicious_only.csv web3_malicious.csv
```

The CSV must have `domain` as the first column. The pipeline output already satisfies this.

> **Size note:** `malicious_only.csv` is ~450K rows (~60+ MB). Some LogScale tiers cap lookup-file
> size or slow noticeably on very large lookups. If you hit a limit, start with
> `high_confidence.csv` (only multi-source-corroborated entries, ~7K rows / <1 MB) and/or shard by
> tag using `data/exports/by_tag/<tag>.csv`. Test ingestion limits in your environment first.

### 2. Upload as a Lookup File

1. In the LogScale UI navigate to your repository
2. Go to **Settings > Lookup Files**
3. Click **New Lookup File** and upload `web3_malicious.csv`
4. Name it `web3_malicious` and set the key field to `domain`

### 3. Query example

Match DNS requests against the lookup file:

```logscale
#event_simpleName=DnsRequest
| match(file="web3_malicious.csv", field=DomainName)
| table([ComputerName, UserName, DomainName, severity, confidence, tags])
```

> **Note:** This feed contains domains only; `ip_addresses` is not populated. Use the
> DomainName-based DNS query above. For IP coverage, resolve domains downstream or add an IP feed.

Filter to high-confidence malicious only within the query:

```logscale
#event_simpleName=DnsRequest
| match(file="web3_malicious.csv", field=DomainName)
| confidence = "HIGH"
| table([ComputerName, UserName, DomainName, tags, first_seen])
```

> **All entries are `severity = MALICIOUS` by design** — this is a blocklist feed (the only other
> value present is a single `LEGITIMATE` allowlist baseline). `RISKY` and `SUSPICIOUS` exist in the
> schema but are never produced by the pipeline, so filtering on them returns nothing. Tune
> detections using `confidence` (HIGH = corroborated by 2+ sources) and `tags`, not `severity`.

### 4. Keeping the lookup current

The CSV/DB exports are **build artifacts** — they are not committed to git, so `git pull` will
not refresh them. Get a fresh feed one of two ways:

- **Recommended — GitHub Release asset.** A dated release (`vYYYY.MM.DD`) is published daily at
  07:00 UTC with the freshest exports attached. Download the asset directly:

  ```bash
  gh release download --pattern malicious_only.csv --dir . --clobber
  # or: curl -L -o web3_malicious.csv <release-asset-url>
  ```

- **Local regeneration.** After `git pull`, rebuild the exports yourself:

  ```bash
  python -m scripts.export_csv   # writes data/exports/*.csv
  ```

Then re-upload to LogScale (daily recommended). The LogScale API can automate the upload:

```bash
curl -s -X PUT \
  -H "Authorization: Bearer $LOGSCALE_TOKEN" \
  -F "file=@web3_malicious.csv" \
  "https://<your-logscale-host>/api/v1/repositories/<repo>/files/web3_malicious.csv"
```

---

## Splunk

### 1. Upload as a lookup table

Place the CSV in Splunk's lookup directory or upload via the UI:

1. Go to **Settings > Lookups > Lookup table files**
2. Click **New Lookup Table File**
3. Upload `malicious_only.csv`, name it `web3_threats.csv`
4. Create a lookup definition: **Settings > Lookups > Lookup definitions > New**
   - Name: `web3_threats`
   - Type: File-based
   - Lookup file: `web3_threats.csv`

### 2. SPL query examples

Basic DNS lookup:

```spl
index=dns
| lookup web3_threats domain AS query OUTPUT severity, confidence, tags
| where isnotnull(severity)
| table _time, src, query, severity, confidence, tags
```

Enrich proxy logs with threat intelligence:

```spl
index=proxy
| lookup web3_threats domain AS cs_host OUTPUT severity, confidence, tags, first_seen
| where severity="MALICIOUS" AND confidence="HIGH"
| stats count BY cs_host, severity, tags, src_ip
| sort -count
```

Alert on new web3 threat hits (last 24 hours):

```spl
index=dns earliest=-24h
| lookup web3_threats domain AS query OUTPUT severity, confidence, tags, first_seen
| where isnotnull(severity)
| dedup query
| table query, severity, confidence, tags, first_seen
| sort confidence
```

> All feed entries are `severity = MALICIOUS`, so filtering on severity does not narrow results.
> Differentiate on `confidence` (e.g. `confidence="HIGH"`) and `tags` instead.

Tag-specific investigation (e.g., wallet drainers only):

```spl
index=proxy
| lookup web3_threats domain AS cs_host OUTPUT severity, confidence, tags
| where like(tags, "%drainer%")
| stats values(cs_host) AS domains, dc(src_ip) AS unique_users BY tags
```

### 3. Automatic refresh

Use the Splunk Scheduled Search or a cron job to re-download and replace the lookup file on a
daily basis. The Splunk REST API endpoint for lookup updates:

```bash
curl -k -u admin:$SPLUNK_PASS \
  -F "output_mode=json" \
  -F "contents=@malicious_only.csv" \
  "https://<splunk-host>:8089/servicesNS/nobody/search/data/lookup-table-files/web3_threats.csv"
```

---

## Generic CSV Import

For any SIEM or security tool that accepts a flat CSV threat feed:

### Minimum required columns

| Column | Description |
|---|---|
| `domain` | The threat domain (use as your lookup key) |
| `severity` | Always `MALICIOUS` in this feed (a single `LEGITIMATE` baseline aside); `RISKY`/`SUSPICIOUS` are schema-reserved and not produced |
| `confidence` | `HIGH`, `MEDIUM`, or `LOW` |
| `tags` | Pipe-separated tag list (e.g., `drainer\|impersonation`) |
| `first_seen` | ISO 8601 timestamp |

### Recommended pre-filtering

Before importing, filter to the records most relevant to your environment:

```bash
# High-confidence malicious only (recommended starting point)
python -c "
import csv, sys
reader = csv.DictReader(open('data/exports/all_domains.csv'))
writer = None
for row in reader:
    if row['severity'] == 'MALICIOUS' and row['confidence'] == 'HIGH':
        if writer is None:
            writer = csv.DictWriter(sys.stdout, fieldnames=row.keys())
            writer.writeheader()
        writer.writerow(row)
"
```

Or using the pipeline's built-in export:

```bash
python -m scripts.export_csv
# writes all_domains.csv, malicious_only.csv, high_confidence.csv,
# and by_tag/<tag>.csv to data/exports/
```

### Update cadence recommendations

| Use case | Recommended cadence |
|---|---|
| Production block list | Daily |
| Alert enrichment | Daily or on-demand |
| Threat hunting reference | Weekly |
| Historical investigation | On-demand |

Automated daily refresh via cron:

```bash
# crontab entry — runs at 06:00 UTC daily
0 6 * * * cd /opt/web3-threat-tracker && git pull && python -m scripts.export_csv && /opt/siem-upload.sh
```
