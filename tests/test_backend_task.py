#!/usr/bin/env python3
"""
测试后台BLAST任务执行
"""

import asyncio
from backend.main import run_blast_analysis

async def test_blast_task():
    """测试BLAST后台任务"""
    job_id = "test_job_123"
    query_sequence = "ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG"
    sequence_type = "dna"
    target_type = "dna" 
    database = "nt"
    min_identity = 30.0
    max_identity = 99.0
    result_count = 5
    
    print(f"开始执行BLAST任务，Job ID: {job_id}")
    
    try:
        await run_blast_analysis(
            job_id,
            query_sequence,
            sequence_type,
            target_type,
            database,
            min_identity,
            max_identity,
            result_count
        )
        print("BLAST任务执行完成")
    except Exception as e:
        print(f"BLAST任务执行失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_blast_task())