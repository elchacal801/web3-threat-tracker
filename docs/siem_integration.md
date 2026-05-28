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

Match web requests (HTTP/HTTPS) against the lookup file:

```logscale
#event_simpleName=NetworkConnectIP4
| match(file="web3_malicious.csv", field=RemoteAddressIP4, column=ip_addresses)
| table([ComputerName, UserName, RemoteAddressIP4, severity, confidence, tags])
```

Filter to high-confidence malicious only within the query:

```logscale
#event_simpleName=DnsRequest
| match(file="web3_malicious.csv", field=DomainName)
| confidence = "HIGH"
| severity = "MALICIOUS"
| table([ComputerName, UserName, DomainName, tags, first_seen])
```

### 4. Keeping the lookup current

Re-download and re-upload the CSV on a schedule (daily recommended). The LogScale API can be
used to automate this:

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
| where isnotnull(severity) AND severity IN ("MALICIOUS", "RISKY")
| dedup query
| table query, severity, confidence, tags, first_seen
| sort severity
```

Tag-specific investigation (e.g., wallet drainers only):

```spl
index=proxy
| lookup web3_threats domain AS cs_host OUTPUT severity, confidence, tags
| where like(tags, "%wallet-drainer%")
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
| `severity` | `MALICIOUS`, `RISKY`, `SUSPICIOUS`, or `LEGITIMATE` |
| `confidence` | `HIGH`, `MEDIUM`, or `LOW` |
| `tags` | Pipe-separated tag list (e.g., `wallet-drainer\|impersonation`) |
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
python -m web3_threat_tracker.pipeline --export high_confidence
# outputs data/exports/high_confidence.csv
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
0 6 * * * cd /opt/web3-threat-tracker && git pull && python -m web3_threat_tracker.pipeline && /opt/siem-upload.sh
```
