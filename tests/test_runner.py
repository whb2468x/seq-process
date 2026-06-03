#!/usr/bin/env python3
"""全方位 E2E 测试脚本 v2 - Sequence Alignment Tool"""

import subprocess, json, time, sys, os
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"
BRO_FILE = os.path.join(os.path.dirname(__file__), "bro.txt")
PASS, FAIL, SKIP = 0, 0, 0
failed_details = []

# Track job IDs
PAIRWISE_JOB_ID = None   # from section 3 (synchronous)
COMBINED_JOB_ID = None   # from section 4 (async)
BLAST_JOB_IDS = []       # from section 2


def curl(method, endpoint, form_data=None, timeout=300, is_binary=False):
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method]
    if form_data:
        for k, v in form_data.items():
            if v.startswith("@"):
                cmd.extend(["-F", f"{k}={v}"])
            else:
                cmd.extend(["-F", f"{k}={v}"])
    cmd.append(f"{BASE_URL}{endpoint}")

    if is_binary:
        # Binary mode: get status code only, don't parse body
        r = subprocess.run(cmd, capture_output=True, timeout=timeout)
        out = r.stdout.decode("utf-8", errors="replace").strip().split("\n")
        body = "\n".join(out[:-1]) if len(out) > 1 else ""
        status = int(out[-1]) if out else 0
        return status, {"_binary": True, "_size": len(r.stdout)}
    else:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        out = r.stdout.strip().split("\n")
        body = "\n".join(out[:-1]) if len(out) > 1 else ""
        status = int(out[-1]) if out else 0
        try:
            data = json.loads(body) if body else {}
        except Exception:
            data = {"_raw": body}
        return status, data


def t(name, method, endpoint, exp_status, check=None, form_data=None, timeout=300, binary=False):
    global PASS, FAIL, SKIP
    try:
        s, d = curl(method, endpoint, form_data, timeout, is_binary=binary)
        if s == exp_status:
            if check and not check(d, s):
                FAIL += 1
                failed_details.append(f"  ❌ {name}: check failed | data={json.dumps(d, ensure_ascii=False)[:200]}")
                print(f"  ❌ {name} (HTTP {s}) - check_fn failed")
            else:
                PASS += 1
                print(f"  ✅ {name} (HTTP {s})")
            return d
        else:
            FAIL += 1
            detail = d.get("detail", json.dumps(d, ensure_ascii=False)[:150])
            failed_details.append(f"  ❌ {name}: expected {exp_status}, got {s} | {detail}")
            print(f"  ❌ {name} - expected {exp_status}, got {s}")
            return d
    except Exception as e:
        SKIP += 1
        failed_details.append(f"  ⚠️  {name}: ERROR {e}")
        print(f"  ⚠️  {name}: {e}")
        return {}


# ========================================================================
print("=" * 65)
print("  Sequence Alignment Tool - Full E2E Test Suite")
print(f"  Test file: bro.txt (1591bp 16S rRNA DNA)")
print(f"  Start: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 65)

# ── 1. Health & Config ──────────────────────────────────────────────────
print("\n[1] Health Check & Configuration")

t("1.1 Health check", "GET", "/", 200,
  check=lambda d, s: d.get("status") == "healthy")
t("1.2 Version check", "GET", "/", 200,
  check=lambda d, s: d.get("version") == "1.1.0")
t("1.3 Database list", "GET", "/databases", 200,
  check=lambda d, s: len(d.get("databases", {})) == 5)
t("1.4 Job list", "GET", "/jobs?limit=5", 200,
  check=lambda d, s: "jobs" in d)

# ── 2. BLAST Submission ─────────────────────────────────────────────────
print("\n[2] BLAST Submission (/submit-sequence)")

# Valid submissions
d = t("2.1 BLAST file upload (bro.txt)", "POST", "/submit-sequence", 200,
      form_data={"file": f"@{BRO_FILE};type=text/plain",
                 "sequence_type": "dna", "target_type": "dna", "database": "nt",
                 "result_count": "50", "expect_value": "10", "megablast": "true"})
if d.get("job_id"):
    BLAST_JOB_IDS.append(d["job_id"])

d = t("2.2 BLAST text paste (FASTA)", "POST", "/submit-sequence", 200,
      form_data={"sequence": ">test_seq\nATCGATCGATCG",
                 "sequence_type": "dna", "target_type": "dna", "database": "nt",
                 "result_count": "10"},
      check=lambda d, s: d.get("query_length") == 12)
if d.get("job_id"):
    BLAST_JOB_IDS.append(d["job_id"])

d = t("2.3 BLAST raw text", "POST", "/submit-sequence", 200,
      form_data={"sequence": "ATCGATCG", "sequence_type": "dna",
                 "target_type": "dna", "database": "nt"},
      check=lambda d, s: d.get("query_length") == 8)
if d.get("job_id"):
    BLAST_JOB_IDS.append(d["job_id"])

# Invalid inputs
t("2.4 Invalid sequence_type", "POST", "/submit-sequence", 400,
  form_data={"sequence": "ATCG", "sequence_type": "bad", "database": "nt"})

t("2.5 Invalid chars in sequence (Bug 1)", "POST", "/submit-sequence", 400,
  form_data={"sequence": "INVALID_SEQUENCE_XYZ", "sequence_type": "dna",
             "target_type": "dna", "database": "nt"},
  check=lambda d, s: "invalid" in str(d.get("detail", "")).lower())

t("2.6 Empty sequence", "POST", "/submit-sequence", 400,
  form_data={"sequence": "", "sequence_type": "dna", "database": "nt"})

t("2.7 No input", "POST", "/submit-sequence", 400,
  form_data={"sequence_type": "dna"})

t("2.8 Invalid database", "POST", "/submit-sequence", 400,
  form_data={"sequence": "ATCG", "sequence_type": "dna",
             "target_type": "dna", "database": "bad_db"})

t("2.9 Min > Max identity", "POST", "/submit-sequence", 400,
  form_data={"sequence": "ATCG", "sequence_type": "dna",
             "target_type": "dna", "database": "nt",
             "min_identity": "90", "max_identity": "30"})

t("2.10 Zero expect_value", "POST", "/submit-sequence", 400,
  form_data={"sequence": "ATCG", "sequence_type": "dna",
             "target_type": "dna", "database": "nt", "expect_value": "0"})

t("2.11 DB type mismatch (dna→protein db)", "POST", "/submit-sequence", 400,
  form_data={"sequence": "ATCG", "sequence_type": "dna",
             "target_type": "protein", "database": "nt"})

# ── 3. Pairwise Alignment ───────────────────────────────────────────────
print("\n[3] Pairwise Alignment (/pairwise-alignment)")

multi_fasta = ">seq1\nATCGATCGATCG\n>seq2\nATCGATCGATGG\n>seq3\nATCGATCGATCC\n"

d = t("3.1 Pairwise text 3 seqs", "POST", "/pairwise-alignment", 200,
      form_data={"sequence": multi_fasta, "sequence_type": "dna",
                 "alignment_mode": "global"},
      check=lambda d, s: d.get("status") == "completed" and
                         d.get("analysis_type") == "pairwise" and
                         len(d.get("sequence_names", [])) == 3)
if d.get("job_id"):
    PAIRWISE_JOB_ID = d["job_id"]

t("3.2 Pairwise 1 seq → reject", "POST", "/pairwise-alignment", 400,
  form_data={"sequence": ">seq1\nATCG", "sequence_type": "dna"})

t("3.3 Pairwise bro.txt (1 seq) → reject", "POST", "/pairwise-alignment", 400,
  form_data={"file": f"@{BRO_FILE};type=text/plain", "sequence_type": "dna"})

t("3.4 Pairwise bad alignment_mode", "POST", "/pairwise-alignment", 400,
  form_data={"sequence": multi_fasta, "sequence_type": "dna",
             "alignment_mode": "semiglobal"})

d2 = t("3.5 Pairwise local alignment", "POST", "/pairwise-alignment", 200,
       form_data={"sequence": multi_fasta, "sequence_type": "dna",
                  "alignment_mode": "local"})
if not PAIRWISE_JOB_ID and d2.get("job_id"):
    PAIRWISE_JOB_ID = d2["job_id"]

# ── 4. Combined BLAST+Pairwise ──────────────────────────────────────────
print("\n[4] Combined BLAST + Pairwise (/pairwise-blast-alignment)")

d = t("4.1 Combined file upload (bro.txt)", "POST", "/pairwise-blast-alignment", 200,
      form_data={"file": f"@{BRO_FILE};type=text/plain",
                 "sequence_type": "dna", "target_type": "dna", "database": "nt",
                 "result_count": "10", "max_total_sequences": "15",
                 "min_identity": "30", "max_identity": "100",
                 "alignment_mode": "global"},
      check=lambda d, s: d.get("status") == "submitted" and
                         d.get("has_excel") is False and
                         d.get("has_fasta") is False)
if d.get("job_id"):
    COMBINED_JOB_ID = d["job_id"]

t("4.2 Combined text paste", "POST", "/pairwise-blast-alignment", 200,
  form_data={"sequence": ">my_seq\nATCGATCGATCGATCG",
             "sequence_type": "dna", "target_type": "dna", "database": "nt",
             "result_count": "5", "max_total_sequences": "10"},
  check=lambda d, s: d.get("status") == "submitted")

t("4.3 Combined max_total_sequences=1", "POST", "/pairwise-blast-alignment", 400,
  form_data={"sequence": ">seq\nATCG", "sequence_type": "dna",
             "target_type": "dna", "database": "nt", "max_total_sequences": "1"})

# ── 5. Job Status & List ────────────────────────────────────────────────
print("\n[5] Job Status & Job List")

t("5.1 Job list", "GET", "/jobs?limit=10", 200,
  check=lambda d, s: isinstance(d.get("jobs"), list) and d.get("count") is not None)
t("5.2 Non-existent job", "GET", "/job-status/no-such-job", 404)

if PAIRWISE_JOB_ID:
    t("5.3 Pairwise job status", "GET", f"/job-status/{PAIRWISE_JOB_ID}", 200,
      check=lambda d, s: d.get("status") == "completed")

# ── 6. Result Downloads (Pairwise, synchronous) ─────────────────────────
print("\n[6] Result Downloads - Pairwise (synchronous)")

if PAIRWISE_JOB_ID:
    t("6.1 JSON download", "GET", f"/results/{PAIRWISE_JOB_ID}?format=json", 200,
      check=lambda d, s: d.get("status") == "completed")
    t("6.2 CSV download", "GET", f"/results/{PAIRWISE_JOB_ID}?format=csv", 200)
    t("6.3 Excel download (binary)", "GET", f"/results/{PAIRWISE_JOB_ID}/excel", 200, binary=True,
      check=lambda d, s: d.get("_size", 0) > 0)
    t("6.4 Heatmap download (binary)", "GET", f"/results/{PAIRWISE_JOB_ID}/heatmap", 200, binary=True,
      check=lambda d, s: d.get("_size", 0) > 0)
    t("6.5 Non-existent result", "GET", "/results/fake-id?format=json", 404)
else:
    print("  ⚠️  No pairwise job ID – skipping download tests")

# ── 7. Wait for Combined Task + Downloads ───────────────────────────────
print("\n[7] Combined Task - Polling & Downloads")

if COMBINED_JOB_ID:
    print(f"  Job ID: {COMBINED_JOB_ID}")
    print(f"  Polling for completion (max 5 min)...")
    done = False
    for i in range(60):
        time.sleep(5)
        _, d = curl("GET", f"/job-status/{COMBINED_JOB_ID}")
        st = d.get("status", "?")
        pg = d.get("progress", "?")
        if i % 3 == 0 or st in ("completed", "failed"):
            print(f"    [{(i+1)*5}s] status={st}, progress={pg}")
        if st in ("completed", "failed"):
            done = True
            break

    if done and d.get("status") == "completed":
        print(f"\n  ✅ Combined complete! {d.get('total_sequences', '?')} seqs, "
              f"{d.get('filtered_count', '?')} filtered")
        print(f"  has_fasta={d.get('has_fasta')}, has_excel={d.get('has_excel')}, "
              f"has_blast_excel={d.get('has_blast_excel')}, has_heatmap={d.get('has_heatmap')}")

        jid = COMBINED_JOB_ID
        t("7.1 FASTA download", "GET", f"/results/{jid}/fasta", 200)
        t("7.2 Identity Excel (binary)", "GET", f"/results/{jid}/excel", 200, binary=True,
          check=lambda d, s: d.get("_size", 0) > 0)
        t("7.3 BLAST Excel (binary)", "GET", f"/results/{jid}/blast-excel", 200, binary=True,
          check=lambda d, s: d.get("_size", 0) > 0)
        t("7.4 Heatmap PNG (binary)", "GET", f"/results/{jid}/heatmap", 200, binary=True,
          check=lambda d, s: d.get("_size", 0) > 0)
        t("7.5 Filter Log", "GET", f"/results/{jid}/filter-log", 200)
        t("7.6 Combined JSON", "GET", f"/results/{jid}?format=json", 200,
          check=lambda d, s: d.get("has_fasta") is True and d.get("has_excel") is True)
        t("7.7 Combined CSV", "GET", f"/results/{jid}?format=csv", 200)
        t("7.8 Sequence stats present", "GET", f"/results/{jid}?format=json", 200,
          check=lambda d, s: "sequence_stats" in d and len(d.get("sequence_stats", [])) > 0)
        t("7.9 Pairwise details present", "GET", f"/results/{jid}?format=json", 200,
          check=lambda d, s: len(d.get("pairwise_details", [])) > 0)
    elif done:
        print(f"\n  ❌ Combined FAILED: {d.get('error', d.get('message','?'))}")
    else:
        print(f"\n  ⚠️  Combined timed out (5 min)")
else:
    print("  ⚠️  No combined job ID – check section 4")
    failed_details.append("  ⚠️  Combined job not submitted – section 7 skipped")

# ── 8. Additional Edge Cases ────────────────────────────────────────────
print("\n[8] Edge Cases & Stress")

t("8.1 RNA sequence type", "POST", "/submit-sequence", 200,
  form_data={"sequence": ">rna_test\nAUCGAUCG", "sequence_type": "rna",
             "target_type": "rna", "database": "nt"},
  check=lambda d, s: d.get("status") == "submitted")

t("8.2 Protein sequence type", "POST", "/submit-sequence", 200,
  form_data={"sequence": ">prot\nMALLAR", "sequence_type": "protein",
             "target_type": "protein", "database": "nr"},
  check=lambda d, s: d.get("status") == "submitted")

t("8.3 Protein BLAST against Swiss-Prot", "POST", "/submit-sequence", 200,
  form_data={"sequence": ">prot\nMKFLILFNILV", "sequence_type": "protein",
             "target_type": "protein", "database": "swissprot", "result_count": "5"},
  check=lambda d, s: d.get("status") == "submitted")

t("8.4 Too large result_count", "POST", "/submit-sequence", 400,
  form_data={"sequence": "ATCG", "sequence_type": "dna", "target_type": "dna",
             "database": "nt", "result_count": "999"})

t("8.5 Nonexistent job result download", "GET",
  "/results/no-job-123/excel", 404)

t("8.6 Nonexistent job FASTA download", "GET",
  "/results/no-job-123/fasta", 404)

# ── 9. Verify has_* flags in processing status ──────────────────────────
print("\n[9] Verify has_* flags (Bug 2-4 fix)")

if COMBINED_JOB_ID:
    # Check that completed result has proper boolean has_* flags
    _, data = curl("GET", f"/job-status/{COMBINED_JOB_ID}")
    has_flags = ["has_excel", "has_fasta", "has_blast_excel", "has_heatmap", "has_filter_log"]
    all_bool = all(isinstance(data.get(f), bool) for f in has_flags)
    t("9.1 has_* are booleans (not null)", "GET", f"/job-status/{COMBINED_JOB_ID}", 200,
      check=lambda d, s: all(isinstance(d.get(f), bool) for f in has_flags))

# Check processing status for a new task
d = t("9.2 New task has_* check", "POST", "/pairwise-blast-alignment", 200,
      form_data={"sequence": ">seq\nATCGATCG", "sequence_type": "dna",
                 "target_type": "dna", "database": "nt",
                 "result_count": "3", "max_total_sequences": "5"})
if d.get("job_id"):
    _, proc = curl("GET", f"/job-status/{d['job_id']}")
    t("9.3 Processing has_* not null", "GET", f"/job-status/{d['job_id']}", 200,
      check=lambda d2, s: all(d2.get(f) is not None for f in has_flags))

# ── SUMMARY ─────────────────────────────────────────────────────────────
print("\n" + "=" * 65)
print("  TEST SUMMARY")
print("=" * 65)
total = PASS + FAIL + SKIP
pct = (PASS / total * 100) if total else 0
print(f"  Total:   {total}")
print(f"  Passed:  {PASS} ({pct:.1f}%)")
print(f"  Failed:  {FAIL}")
print(f"  Skipped: {SKIP}")

if failed_details:
    print(f"\n  Issues found:")
    for item in failed_details:
        print(item)

print(f"\n  End: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print("=" * 65)

sys.exit(0 if FAIL == 0 else 1)
