from __future__ import annotations

import asyncio
import csv
import json
import re
import uuid
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from Bio import SeqIO
from Bio.Align import PairwiseAligner
from Bio.Blast import NCBIWWW, NCBIXML
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

app = FastAPI(title="Sequence Alignment Tool API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOADS_DIR = DATA_DIR / "uploads"
RESULTS_DIR = DATA_DIR / "results"
for directory in (UPLOADS_DIR, RESULTS_DIR):
    directory.mkdir(parents=True, exist_ok=True)

SUPPORTED_SEQUENCE_TYPES = {"dna", "rna", "protein"}
NUCLEOTIDE_TYPES = {"dna", "rna"}
PROTEIN_TYPES = {"protein"}
MAX_NCBI_RESULTS = 500

NUCLEOTIDE_ALPHABET = set("ACGTRYSWKMBDHVNU")
PROTEIN_ALPHABET = set("ABCDEFGHIKLMNPQRSTVWXYZUO*")

SUPPORTED_DATABASES: Dict[str, Dict[str, str]] = {
    "nt": {
        "label": "Nucleotide collection (nt)",
        "target_type": "nucleotide",
    },
    "refseq_rna": {
        "label": "RefSeq RNA",
        "target_type": "nucleotide",
    },
    "nr": {
        "label": "Non-redundant protein sequences (nr)",
        "target_type": "protein",
    },
    "swissprot": {
        "label": "Swiss-Prot",
        "target_type": "protein",
    },
    "pdb": {
        "label": "Protein Data Bank (PDB)",
        "target_type": "protein",
    },
}

job_status_store: Dict[str, Dict[str, Any]] = {}


@app.get("/")
async def health_check():
    return {
        "status": "healthy",
        "message": "Sequence Alignment Tool API is running",
        "version": app.version,
    }


@app.get("/databases")
async def get_databases():
    return {
        "databases": {key: value["label"] for key, value in SUPPORTED_DATABASES.items()},
        "metadata": SUPPORTED_DATABASES,
        "max_ncbi_results": MAX_NCBI_RESULTS,
    }


@app.get("/jobs")
async def list_jobs(limit: int = Query(50, ge=1, le=500)):
    jobs = list(job_status_store.values())

    for path in RESULTS_DIR.glob("*.json"):
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        if not any(job.get("job_id") == data.get("job_id") for job in jobs):
            jobs.append(data)

    jobs.sort(key=lambda item: item.get("timestamp") or item.get("created_at") or "", reverse=True)
    return {"jobs": jobs[:limit], "count": min(len(jobs), limit)}


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def _result_path(job_id: str, suffix: str) -> Path:
    return RESULTS_DIR / f"{job_id}_{suffix}.json"


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def _parse_fasta_records(content: str) -> List[Any]:
    return list(SeqIO.parse(StringIO(content), "fasta"))


def _extract_sequence_from_text(content: str) -> Tuple[str, Dict[str, Any]]:
    records = _parse_fasta_records(content)
    if records:
        first_record = records[0]
        return str(first_record.seq), {
            "record_count": len(records),
            "record_id": first_record.id,
            "input_format": "fasta",
        }

    return content, {
        "record_count": 1,
        "record_id": None,
        "input_format": "raw",
    }


def _clean_sequence(sequence: str, sequence_type: str) -> str:
    sequence = re.sub(r"\s+", "", sequence).upper()
    sequence = sequence.replace("-", "")

    if not sequence:
        raise HTTPException(status_code=400, detail="Empty sequence provided")

    alphabet = PROTEIN_ALPHABET if sequence_type == "protein" else NUCLEOTIDE_ALPHABET
    invalid = sorted({char for char in sequence if char not in alphabet})
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Sequence contains invalid characters for {sequence_type}: {''.join(invalid[:20])}",
        )

    if sequence_type == "rna":
        return sequence.replace("U", "T")
    return sequence


def _validate_common_params(
    sequence_type: str,
    target_type: str,
    database: Optional[str] = None,
    min_identity: Optional[float] = None,
    max_identity: Optional[float] = None,
    result_count: Optional[int] = None,
) -> None:
    if sequence_type not in SUPPORTED_SEQUENCE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported sequence_type: {sequence_type}")
    if target_type not in SUPPORTED_SEQUENCE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported target_type: {target_type}")

    if min_identity is not None and max_identity is not None:
        if not (0 <= min_identity <= 100 and 0 <= max_identity <= 100):
            raise HTTPException(status_code=400, detail="Identity thresholds must be between 0 and 100")
        if min_identity > max_identity:
            raise HTTPException(status_code=400, detail="min_identity cannot be greater than max_identity")

    if result_count is not None and not (1 <= result_count <= MAX_NCBI_RESULTS):
        raise HTTPException(
            status_code=400,
            detail=f"result_count must be between 1 and {MAX_NCBI_RESULTS}",
        )

    if database:
        if database not in SUPPORTED_DATABASES:
            raise HTTPException(status_code=400, detail=f"Database {database} is not supported")
        database_kind = SUPPORTED_DATABASES[database]["target_type"]
        if target_type in NUCLEOTIDE_TYPES and database_kind != "nucleotide":
            raise HTTPException(
                status_code=400,
                detail=f"Database {database} is for protein targets; choose nt/refseq_rna or set target_type=protein",
            )
        if target_type in PROTEIN_TYPES and database_kind != "protein":
            raise HTTPException(
                status_code=400,
                detail=f"Database {database} is for nucleotide targets; choose nr/swissprot/pdb or set target_type=dna/rna",
            )


def choose_blast_program(sequence_type: str, target_type: str) -> str:
    if sequence_type in NUCLEOTIDE_TYPES and target_type in NUCLEOTIDE_TYPES:
        return "blastn"
    if sequence_type in PROTEIN_TYPES and target_type in PROTEIN_TYPES:
        return "blastp"
    if sequence_type in NUCLEOTIDE_TYPES and target_type in PROTEIN_TYPES:
        return "blastx"
    if sequence_type in PROTEIN_TYPES and target_type in NUCLEOTIDE_TYPES:
        return "tblastn"
    raise HTTPException(status_code=400, detail="Unsupported BLAST type combination")


def _alignment_metrics(sequence_a: str, sequence_b: str, sequence_type: str, mode: str = "global") -> Dict[str, Any]:
    clean_a = _clean_sequence(sequence_a, sequence_type)
    clean_b = _clean_sequence(sequence_b, sequence_type)

    aligner = PairwiseAligner()
    aligner.mode = mode
    aligner.match_score = 1.0
    aligner.mismatch_score = 0.0
    aligner.open_gap_score = -1.0
    aligner.extend_gap_score = -0.5

    alignment = aligner.align(clean_a, clean_b)[0]
    coordinates = alignment.coordinates
    aligned_length = 0
    matches = 0

    for index in range(coordinates.shape[1] - 1):
        q0, q1 = int(coordinates[0, index]), int(coordinates[0, index + 1])
        s0, s1 = int(coordinates[1, index]), int(coordinates[1, index + 1])
        q_span = abs(q1 - q0)
        s_span = abs(s1 - s0)
        block_length = max(q_span, s_span)
        aligned_length += block_length

        if q_span and s_span:
            for offset in range(min(q_span, s_span)):
                if clean_a[q0 + offset] == clean_b[s0 + offset]:
                    matches += 1

    identity = (matches / aligned_length) * 100 if aligned_length else 0.0
    return {
        "identity": round(identity, 2),
        "matches": matches,
        "aligned_length": aligned_length,
        "score": round(float(alignment.score), 2),
    }


def calculate_identity(seq1: str, seq2: str) -> float:
    return _alignment_metrics(seq1, seq2, "dna")["identity"]


def _run_ncbi_blast(
    query_sequence: str,
    sequence_type: str,
    target_type: str,
    database: str,
    result_count: int,
    expect_value: float,
    megablast: bool,
    email: Optional[str],
) -> List[Dict[str, Any]]:
    blast_program = choose_blast_program(sequence_type, target_type)
    NCBIWWW.tool = "seq-process"
    if email:
        NCBIWWW.email = email

    kwargs: Dict[str, Any] = {
        "program": blast_program,
        "database": database,
        "sequence": query_sequence,
        "hitlist_size": result_count,
        "expect": expect_value,
        "format_type": "XML",
    }
    if blast_program == "blastn":
        kwargs["megablast"] = megablast

    result_handle = NCBIWWW.qblast(**kwargs)
    results: List[Dict[str, Any]] = []

    try:
        for blast_record in NCBIXML.parse(result_handle):
            for alignment in blast_record.alignments:
                for hsp in alignment.hsps:
                    identity_percent = (hsp.identities / hsp.align_length) * 100 if hsp.align_length else 0.0
                    query_cover = (
                        (abs(hsp.query_end - hsp.query_start) + 1) / blast_record.query_length * 100
                        if blast_record.query_length
                        else 0.0
                    )
                    results.append(
                        {
                            "accession": alignment.accession,
                            "hit_id": alignment.hit_id,
                            "title": alignment.title,
                            "length": alignment.length,
                            "identity": round(identity_percent, 2),
                            "query_cover": round(query_cover, 2),
                            "identities": hsp.identities,
                            "positives": getattr(hsp, "positives", None),
                            "gaps": hsp.gaps,
                            "align_length": hsp.align_length,
                            "score": hsp.score,
                            "bits": hsp.bits,
                            "e_value": hsp.expect,
                            "query_start": hsp.query_start,
                            "query_end": hsp.query_end,
                            "subject_start": hsp.sbjct_start,
                            "subject_end": hsp.sbjct_end,
                            "query_alignment": hsp.query,
                            "subject_alignment": hsp.sbjct,
                            "match_line": hsp.match,
                        }
                    )
    finally:
        result_handle.close()

    return results


async def run_blast_analysis(
    job_id: str,
    query_sequence: str,
    sequence_type: str,
    target_type: str,
    database: str,
    min_identity: float,
    max_identity: float,
    result_count: int,
    expect_value: float = 10.0,
    megablast: bool = True,
    email: Optional[str] = None,
    input_metadata: Optional[Dict[str, Any]] = None,
):
    blast_program = choose_blast_program(sequence_type, target_type)
    job_status_store[job_id] = {
        "job_id": job_id,
        "status": "processing",
        "message": f"Calling NCBI BLAST with {blast_program}",
        "program": blast_program,
        "database": database,
        "created_at": _now(),
    }

    try:
        raw_results = await asyncio.to_thread(
            _run_ncbi_blast,
            query_sequence,
            sequence_type,
            target_type,
            database,
            result_count,
            expect_value,
            megablast,
            email,
        )

        filtered_results = [
            result for result in raw_results if min_identity <= result["identity"] <= max_identity
        ][:result_count]

        result_data = {
            "job_id": job_id,
            "status": "completed",
            "message": f"BLAST analysis completed. Found {len(filtered_results)} matching HSPs.",
            "analysis_type": "blast",
            "program": blast_program,
            "database": database,
            "sequence_type": sequence_type,
            "target_type": target_type,
            "query_length": len(query_sequence),
            "filters": {
                "min_identity": min_identity,
                "max_identity": max_identity,
                "result_count": result_count,
                "expect_value": expect_value,
            },
            "input": input_metadata or {},
            "results": filtered_results,
            "result_count": len(filtered_results),
            "timestamp": _now(),
        }

        _write_json(_result_path(job_id, "blast_results"), result_data)
        job_status_store[job_id] = result_data

    except Exception as exc:
        error_data = {
            "job_id": job_id,
            "status": "failed",
            "analysis_type": "blast",
            "program": blast_program,
            "database": database,
            "message": f"BLAST analysis failed: {exc}",
            "error": str(exc),
            "timestamp": _now(),
        }
        _write_json(_result_path(job_id, "error"), error_data)
        job_status_store[job_id] = error_data


@app.post("/submit-sequence")
async def submit_sequence(
    sequence: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    sequence_type: str = Form("dna"),
    target_type: str = Form("dna"),
    database: str = Form("nt"),
    min_identity: float = Form(30.0),
    max_identity: float = Form(100.0),
    result_count: int = Form(100),
    expect_value: float = Form(10.0),
    megablast: bool = Form(True),
    email: Optional[str] = Form(None),
):
    _validate_common_params(
        sequence_type,
        target_type,
        database=database,
        min_identity=min_identity,
        max_identity=max_identity,
        result_count=result_count,
    )
    if expect_value <= 0:
        raise HTTPException(status_code=400, detail="expect_value must be greater than 0")
    if not sequence and not file:
        raise HTTPException(status_code=400, detail="Either sequence or file must be provided")

    input_metadata: Dict[str, Any] = {"source": "text"}
    if sequence:
        raw_sequence, parsed_metadata = _extract_sequence_from_text(sequence.strip())
        input_metadata.update(parsed_metadata)
    else:
        assert file is not None
        content = await file.read()
        try:
            content_str = content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(status_code=400, detail="Uploaded file must be UTF-8 text") from exc

        job_upload_id = str(uuid.uuid4())
        safe_name = Path(file.filename or "input.fasta").name
        upload_path = UPLOADS_DIR / f"{job_upload_id}_{safe_name}"
        upload_path.write_bytes(content)

        raw_sequence, parsed_metadata = _extract_sequence_from_text(content_str)
        input_metadata.update(parsed_metadata)
        input_metadata.update({"source": "file", "filename": safe_name, "saved_path": str(upload_path)})

    query_sequence = _clean_sequence(raw_sequence, sequence_type)
    job_id = str(uuid.uuid4())

    asyncio.create_task(
        run_blast_analysis(
            job_id,
            query_sequence,
            sequence_type,
            target_type,
            database,
            min_identity,
            max_identity,
            result_count,
            expect_value,
            megablast,
            email,
            input_metadata,
        )
    )

    return {
        "job_id": job_id,
        "status": "submitted",
        "message": "BLAST analysis started",
        "program": choose_blast_program(sequence_type, target_type),
        "query_length": len(query_sequence),
    }


def _load_job_result(job_id: str) -> Dict[str, Any]:
    if job_id in job_status_store:
        return job_status_store[job_id]

    for suffix in ("blast_results", "pairwise_results", "error"):
        path = _result_path(job_id, suffix)
        if path.exists():
            data = json.loads(path.read_text())
            job_status_store[job_id] = data
            return data

    raise HTTPException(status_code=404, detail="Job not found")


@app.get("/job-status/{job_id}")
async def get_job_status(job_id: str):
    return _load_job_result(job_id)


def _rows_to_csv(rows: Iterable[Dict[str, Any]]) -> StringIO:
    output = StringIO()
    rows = list(rows)
    if not rows:
        output.write("")
        output.seek(0)
        return output

    fieldnames = list(rows[0].keys())
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    output.seek(0)
    return output


@app.get("/results/{job_id}")
async def download_result(job_id: str, format: str = Query("json", pattern="^(json|csv)$")):
    result = _load_job_result(job_id)
    filename = f"{job_id}.{format}"

    if format == "json":
        return JSONResponse(
            result,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    if result.get("analysis_type") == "pairwise":
        rows = result.get("pairwise_details", [])
    else:
        rows = result.get("results", [])

    output = _rows_to_csv(rows)
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _unique_name(name: str, used_names: Dict[str, int]) -> str:
    base_name = name or f"seq_{len(used_names) + 1}"
    if base_name not in used_names:
        used_names[base_name] = 1
        return base_name

    used_names[base_name] += 1
    return f"{base_name}_{used_names[base_name]}"


def _sequence_stats(name: str, sequence: str, sequence_type: str) -> Dict[str, Any]:
    stats = {"name": name, "length": len(sequence)}
    if sequence_type in NUCLEOTIDE_TYPES:
        gc_count = sequence.count("G") + sequence.count("C")
        stats["gc_percent"] = round((gc_count / len(sequence)) * 100, 2) if sequence else 0.0
    return stats


def _run_pairwise_alignment(
    content_str: str,
    sequence_type: str,
    alignment_mode: str,
    max_sequences: int,
) -> Dict[str, Any]:
    records = _parse_fasta_records(content_str)
    if len(records) < 2:
        raise HTTPException(status_code=400, detail="At least 2 FASTA sequences are required")
    if len(records) > max_sequences:
        raise HTTPException(status_code=400, detail=f"Too many sequences; limit is {max_sequences}")

    sequences: List[str] = []
    names: List[str] = []
    used_names: Dict[str, int] = {}

    for record in records:
        clean_sequence = _clean_sequence(str(record.seq), sequence_type)
        sequences.append(clean_sequence)
        names.append(_unique_name(record.id, used_names))

    n = len(sequences)
    identity_matrix = [[100.0 for _ in range(n)] for _ in range(n)]
    score_matrix = [[0.0 for _ in range(n)] for _ in range(n)]
    heatmap_data: List[Dict[str, Any]] = []
    pairwise_details: List[Dict[str, Any]] = []

    for i in range(n):
        for j in range(i, n):
            if i == j:
                metrics = {
                    "identity": 100.0,
                    "matches": len(sequences[i]),
                    "aligned_length": len(sequences[i]),
                    "score": float(len(sequences[i])),
                }
            else:
                metrics = _alignment_metrics(sequences[i], sequences[j], sequence_type, alignment_mode)

            identity_matrix[i][j] = identity_matrix[j][i] = metrics["identity"]
            score_matrix[i][j] = score_matrix[j][i] = metrics["score"]

            if i < j:
                pairwise_details.append(
                    {
                        "sequence_a": names[i],
                        "sequence_b": names[j],
                        "identity": metrics["identity"],
                        "matches": metrics["matches"],
                        "aligned_length": metrics["aligned_length"],
                        "score": metrics["score"],
                    }
                )

    for i in range(n):
        for j in range(n):
            heatmap_data.append({"x": names[j], "y": names[i], "value": identity_matrix[i][j]})

    job_id = str(uuid.uuid4())
    return {
        "job_id": job_id,
        "status": "completed",
        "analysis_type": "pairwise",
        "message": f"Pairwise alignment completed for {n} sequences",
        "sequence_type": sequence_type,
        "alignment_mode": alignment_mode,
        "sequence_names": names,
        "sequence_stats": [_sequence_stats(names[i], sequences[i], sequence_type) for i in range(n)],
        "identity_matrix": identity_matrix,
        "score_matrix": score_matrix,
        "heatmap_data": heatmap_data,
        "pairwise_details": pairwise_details,
        "timestamp": _now(),
    }


@app.post("/pairwise-alignment")
async def pairwise_alignment(
    file: UploadFile = File(...),
    sequence_type: str = Form("dna"),
    alignment_mode: str = Form("global"),
    max_sequences: int = Form(200),
):
    _validate_common_params(sequence_type, sequence_type)
    if alignment_mode not in {"global", "local"}:
        raise HTTPException(status_code=400, detail="alignment_mode must be global or local")
    if not (2 <= max_sequences <= 1000):
        raise HTTPException(status_code=400, detail="max_sequences must be between 2 and 1000")

    content = await file.read()
    try:
        content_str = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Uploaded file must be UTF-8 text") from exc

    safe_name = Path(file.filename or "pairwise.fasta").name
    upload_path = UPLOADS_DIR / f"{uuid.uuid4()}_{safe_name}"
    upload_path.write_bytes(content)

    result = await asyncio.to_thread(
        _run_pairwise_alignment,
        content_str,
        sequence_type,
        alignment_mode,
        max_sequences,
    )
    result["input"] = {"filename": safe_name, "saved_path": str(upload_path)}

    _write_json(_result_path(result["job_id"], "pairwise_results"), result)
    job_status_store[result["job_id"]] = result
    return result


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
