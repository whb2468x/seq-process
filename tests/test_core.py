import unittest

from fastapi import HTTPException

from backend.main import (
    _alignment_metrics,
    _clean_sequence,
    _run_pairwise_alignment,
    _validate_common_params,
    choose_blast_program,
)


class CoreBehaviorTests(unittest.TestCase):
    def test_blast_program_selection(self):
        self.assertEqual(choose_blast_program("dna", "dna"), "blastn")
        self.assertEqual(choose_blast_program("rna", "protein"), "blastx")
        self.assertEqual(choose_blast_program("protein", "protein"), "blastp")
        self.assertEqual(choose_blast_program("protein", "dna"), "tblastn")

    def test_database_compatibility_validation(self):
        with self.assertRaises(HTTPException):
            _validate_common_params("dna", "dna", database="nr")
        with self.assertRaises(HTTPException):
            _validate_common_params("protein", "protein", database="nt")

    def test_sequence_cleaning(self):
        self.assertEqual(_clean_sequence("ac gu\n", "rna"), "ACGT")
        with self.assertRaises(HTTPException):
            _clean_sequence("ACGT!", "dna")

    def test_alignment_identity(self):
        metrics = _alignment_metrics("ACGT", "ACGA", "dna")
        self.assertEqual(metrics["identity"], 75.0)
        self.assertEqual(metrics["matches"], 3)
        self.assertEqual(metrics["aligned_length"], 4)

    def test_pairwise_alignment_matrix(self):
        result = _run_pairwise_alignment(">seq1\nACGT\n>seq2\nACGA\n", "dna", "global", 10)
        self.assertEqual(result["sequence_names"], ["seq1", "seq2"])
        self.assertEqual(result["identity_matrix"], [[100.0, 75.0], [75.0, 100.0]])
        self.assertEqual(result["pairwise_details"][0]["identity"], 75.0)


if __name__ == "__main__":
    unittest.main()
