#!/usr/bin/env python3
"""
测试NCBI BLAST API调用
"""

from Bio.Blast import NCBIWWW, NCBIXML
from io import StringIO

def test_ncbi_blast():
    """测试NCBI BLAST API"""
    # 使用一个小的测试序列
    test_sequence = "ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG"
    
    print("正在调用NCBI BLAST API...")
    print(f"查询序列长度: {len(test_sequence)}")
    
    try:
        # 调用BLASTn对nt数据库
        result_handle = NCBIWWW.qblast(
            program="blastn",
            database="nt",
            sequence=test_sequence,
            hitlist_size=5,
            expect=10.0,
            format_type="XML"
        )
        
        print("BLAST请求成功发送！")
        
        # 解析结果
        blast_records = NCBIXML.parse(result_handle)
        hit_count = 0
        
        for blast_record in blast_records:
            for alignment in blast_record.alignments:
                for hsp in alignment.hsps:
                    identity_percent = (hsp.identities / hsp.align_length) * 100
                    print(f"命中 {hit_count + 1}:")
                    print(f"  Accession: {alignment.accession}")
                    print(f"  标题: {alignment.title[:60]}...")
                    print(f"  长度: {alignment.length}")
                    print(f"  一致性: {identity_percent:.2f}%")
                    print(f"  E值: {hsp.expect}")
                    print(f"  比对长度: {hsp.align_length}")
                    hit_count += 1
                    if hit_count >= 3:  # 只显示前3个结果
                        break
                if hit_count >= 3:
                    break
            if hit_count >= 3:
                break
        
        result_handle.close()
        print(f"\n总共找到 {hit_count} 个匹配结果")
        
    except Exception as e:
        print(f"BLAST调用失败: {e}")
        print("可能的原因:")
        print("- 网络连接问题")
        print("- NCBI服务器暂时不可用")
        print("- 请求过于频繁（NCBI有速率限制）")

if __name__ == "__main__":
    test_ncbi_blast()