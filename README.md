# Sequence Alignment Tool

Sequence Alignment Tool 是一个用于序列比对和 identity 计算的 Web 工具。项目包含 FastAPI 后端和 React 前端，支持两类分析：

- 调用 NCBI 远程 BLAST，对单条 FASTA 或原始序列进行数据库检索。
- 对多序列 FASTA 文件做本地两两比对，生成 identity 矩阵、score 矩阵、热图数据和两两明细。

## 功能概览

- 支持 DNA、RNA、Protein 三类输入序列。
- 根据输入类型和目标类型自动选择 `blastn`、`blastp`、`blastx` 或 `tblastn`。
- 根据目标类型自动过滤可用 BLAST 数据库。
- 支持 `nt`、`refseq_rna`、`nr`、`swissprot`、`pdb` 数据库。
- 支持 identity 范围、E-value、结果数量和 Megablast 参数。
- 支持文本粘贴序列，也支持上传 FASTA、FA、FAA、FNA、TXT 等文本文件。
- 后端保存任务结果，前端提供最近任务列表。
- 支持结果下载为 JSON 或 CSV。
- 本地 pairwise alignment 支持 global 和 local 模式。
- Pairwise 结果包含序列统计、identity 矩阵、score 矩阵、热图数据和两两明细。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Backend | FastAPI, Uvicorn, Biopython |
| Frontend | React, Axios |
| Environment | Conda, Node.js 20 |
| BLAST | Biopython `NCBIWWW` 远程调用，Conda 环境包含 BLAST+ |

## 项目结构

```text
seq-process/
├── backend/
│   ├── main.py              # FastAPI 应用、BLAST 调用、pairwise alignment 逻辑
│   └── requirements.txt     # pip 备用依赖清单
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.js           # React 主界面
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── package.json
│   └── package-lock.json
├── activate_bio.sh          # 创建或激活 bio conda 环境
├── auto_activate_bio.sh     # 可选的 shell 自动激活辅助脚本
├── environment.yml          # Conda 环境定义
├── start.sh                 # 同时启动后端和前端
├── test_core.py             # 不依赖网络的核心单元测试
├── test_backend_task.py     # BLAST 后台任务测试
├── test_blast.py            # NCBI 远程 BLAST 连通性测试
└── README.md
```

运行时会生成以下目录，它们包含用户上传文件、分析结果、缓存或构建产物，默认不提交到 Git：

- `backend/data/uploads/`
- `backend/data/results/`
- `backend/results/`
- `data/`
- `frontend/node_modules/`
- `frontend/build/`
- `__pycache__/`

## 环境要求

- Linux 或 macOS shell 环境
- Conda 或 Miniconda
- 可访问 NCBI 的网络连接，只有远程 BLAST 功能需要

推荐使用项目自带的 Conda 环境，环境名固定为 `bio`。`environment.yml` 使用 Python 最低版本约束而不是锁死单一小版本，日常推荐 Python 3.11 或 3.12；如果 Conda 能解析出兼容依赖，更高版本也可以使用。

## 安装

首次使用：

```bash
source activate_bio.sh
```

该脚本会执行以下操作：

- 检查 Conda 是否可用。
- 如果 `bio` 环境不存在，则根据 `environment.yml` 创建环境。
- 如果 `bio` 环境已存在，则直接激活环境。
- 激活完成后提示可以运行 `./start.sh`。

依赖发生变化时，可以同步更新环境：

```bash
UPDATE_BIO_ENV=1 source activate_bio.sh
```

也可以手动创建环境：

```bash
conda env create -f environment.yml
conda activate bio
```

已有环境时手动更新：

```bash
conda env update -n bio -f environment.yml --prune
conda activate bio
```

## 启动应用

进入项目根目录后运行：

```bash
source activate_bio.sh
./start.sh
```

`start.sh` 会：

- 确认当前处于 `bio` 环境。
- 检查 BLAST+ 是否可用，缺失时尝试通过 Conda 安装。
- 启动 FastAPI 后端。
- 检查 `frontend/node_modules`，缺失时自动运行 `npm install`。
- 启动 React 前端。

默认访问地址：

- Frontend UI: <http://localhost:3000>
- Backend API: <http://localhost:8000>
- API docs: <http://localhost:8000/docs>

停止服务时，在运行 `start.sh` 的终端按 `Ctrl+C`。

## 使用说明

### NCBI BLAST

1. 打开前端页面。
2. 在 BLAST 页面粘贴 FASTA 或原始序列，也可以上传序列文件。
3. 选择输入序列类型、目标序列类型和数据库。
4. 设置 E-value、identity 范围、结果数量等参数。
5. 可选填写邮箱，便于 NCBI 识别请求来源。
6. 提交后等待任务完成。
7. 完成后可在页面查看结果，并下载 JSON 或 CSV。

BLAST 程序选择规则：

| 输入类型 | 目标类型 | 程序 |
| --- | --- | --- |
| DNA/RNA | DNA/RNA | `blastn` |
| Protein | Protein | `blastp` |
| DNA/RNA | Protein | `blastx` |
| Protein | DNA/RNA | `tblastn` |

数据库兼容规则：

| 数据库 | 目标类型 |
| --- | --- |
| `nt` | nucleotide |
| `refseq_rna` | nucleotide |
| `nr` | protein |
| `swissprot` | protein |
| `pdb` | protein |

### Pairwise Alignment

1. 切换到 Pairwise 页面。
2. 上传包含多条序列的 FASTA 文件。
3. 选择序列类型和比对模式。
4. 提交后查看 identity matrix、heatmap 和 pair details。
5. 可下载 JSON 或 CSV。

Pairwise alignment 使用 Biopython `PairwiseAligner`，默认评分：

- match: `1.0`
- mismatch: `0.0`
- gap open: `-1.0`
- gap extend: `-0.5`

## API 接口

### `GET /`

健康检查。

### `GET /databases`

返回支持的数据库、数据库元信息和最大 NCBI 结果数量。

### `GET /jobs`

返回最近任务。

查询参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `limit` | `50` | 返回任务数量，范围 1 到 500 |

### `POST /submit-sequence`

提交远程 NCBI BLAST 任务。请求类型为 `multipart/form-data`。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `sequence` | 无 | FASTA 或原始序列文本，和 `file` 至少提供一个 |
| `file` | 无 | UTF-8 文本序列文件，和 `sequence` 至少提供一个 |
| `sequence_type` | `dna` | `dna`、`rna` 或 `protein` |
| `target_type` | `dna` | `dna`、`rna` 或 `protein` |
| `database` | `nt` | BLAST 数据库 |
| `min_identity` | `30.0` | 最小 identity 百分比 |
| `max_identity` | `100.0` | 最大 identity 百分比 |
| `result_count` | `100` | 结果数量，范围 1 到 500 |
| `expect_value` | `10.0` | BLAST E-value，必须大于 0 |
| `megablast` | `true` | 仅对 nucleotide-to-nucleotide BLAST 有意义 |
| `email` | 无 | NCBI 请求邮箱，可选 |

### `GET /job-status/{job_id}`

查询任务状态或完整结果。

### `GET /results/{job_id}`

下载任务结果。

查询参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `format` | `json` | `json` 或 `csv` |

### `POST /pairwise-alignment`

上传多序列 FASTA 文件并执行本地两两比对。请求类型为 `multipart/form-data`。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `file` | 必填 | UTF-8 FASTA 文件 |
| `sequence_type` | `dna` | `dna`、`rna` 或 `protein` |
| `alignment_mode` | `global` | `global` 或 `local` |
| `max_sequences` | `200` | 最大序列数量，范围 2 到 1000 |

## 测试和验证

不依赖网络的核心测试：

```bash
conda activate bio
python -m unittest test_core.py
```

前端生产构建：

```bash
conda activate bio
cd frontend
npm run build
```

后端本地健康检查：

```bash
conda activate bio
uvicorn backend.main:app --host 127.0.0.1 --port 8000
curl http://127.0.0.1:8000/
```

远程 BLAST 连通性测试会访问 NCBI，耗时和成功率取决于网络和 NCBI 服务状态：

```bash
conda activate bio
python test_blast.py
```

## NCBI BLAST 注意事项

- 远程 BLAST 依赖网络和 NCBI 服务状态。
- 本项目限制单次请求最多 500 条结果，避免超出 NCBI 远程调用的合理范围。
- 高频请求可能触发 NCBI 限流。
- 建议填写 NCBI 账号邮箱。它不是登录认证，也不会自动获得更高配额；NCBI 官方建议 API 请求提供 `email` 和 `tool` 参数，便于识别请求来源并在出现问题时联系使用者。
- 远程 BLAST 任务可能需要数分钟完成，前端会轮询任务状态。

## 数据和隐私

- 用户上传文件会保存到 `backend/data/uploads/`。
- 分析结果会保存到 `backend/data/results/`。
- 这些运行数据默认被 `.gitignore` 排除，不会发布到仓库。
- 如果处理敏感序列，发布或共享项目前请确认运行数据目录没有被手动加入版本控制。

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
