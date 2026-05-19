# Sequence Alignment Tool

一个用于序列比对和 identity 计算的 Web 工具。后端使用 FastAPI + Biopython，支持调用 NCBI BLAST，也支持本地多序列两两比对并生成 identity 矩阵。

## 功能

- 提交 FASTA 或原始序列调用 NCBI BLAST
- 自动选择 `blastn`、`blastp`、`blastx`、`tblastn`
- 根据目标类型过滤可用数据库
- 支持 identity、E-value、结果数、Megablast 参数
- 保存任务结果，支持任务历史查询
- 支持 JSON 和 CSV 下载
- 支持多序列 FASTA 的 global/local pairwise alignment
- 输出 identity 矩阵、score 矩阵、热图数据和两两明细

## 环境

项目使用 conda 管理依赖，环境名固定为 `bio`。

```bash
source activate_bio.sh
```

脚本会：

- 检查 conda 是否可用
- 如果 `bio` 环境不存在，则基于 `environment.yml` 创建
- 如果 `bio` 环境已存在，则直接激活
- 激活 `bio` 环境

需要同步依赖时：

```bash
UPDATE_BIO_ENV=1 source activate_bio.sh
```

也可以手动执行：

```bash
conda env create -f environment.yml
conda activate bio
```

`environment.yml` 使用的是最低 Python 版本约束，而不是锁死单一 Python 小版本。日常推荐 Python 3.11 或 3.12；如果 conda 能解析出兼容依赖，更高版本也可以使用。

已有环境时：

```bash
conda env update -n bio -f environment.yml --prune
conda activate bio
```

## 启动

```bash
source activate_bio.sh
cd frontend && npm install && cd ..
./start.sh
```

如果 `frontend/node_modules` 不存在，`start.sh` 也会自动执行一次 `npm install`。

- Backend API: http://localhost:8000
- Frontend UI: http://localhost:3000
- API docs: http://localhost:8000/docs

## API

- `GET /` 健康检查
- `GET /databases` 数据库和元信息
- `POST /submit-sequence` 提交 NCBI BLAST 任务
- `GET /job-status/{job_id}` 查询任务状态或结果
- `GET /jobs` 最近任务
- `GET /results/{job_id}?format=json|csv` 下载结果
- `POST /pairwise-alignment` 上传多序列 FASTA 进行两两比对

## NCBI BLAST 注意事项

- 远程 BLAST 依赖网络和 NCBI 服务状态
- 本项目限制单次请求最多 500 条结果，避免超出 NCBI 远程调用的合理范围
- 高频请求可能受到 NCBI 限流
- 建议填写 NCBI 账号邮箱。它不是登录认证，也不会自动获得更高配额；但 NCBI 官方建议 API 请求提供 `email` 和 `tool` 参数，便于识别请求来源并在有问题时联系使用者。

## 测试

不依赖网络的核心测试：

```bash
conda activate bio
python -m unittest test_core.py
```

前端构建：

```bash
conda activate bio
cd frontend
npm run build
```

远程 BLAST 连通性测试会访问 NCBI：

```bash
conda activate bio
python test_blast.py
```

## 目录

```text
seq-process/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── data/
│       ├── uploads/
│       └── results/
├── frontend/
│   └── src/
├── environment.yml
├── activate_bio.sh
├── start.sh
└── test_core.py
```
