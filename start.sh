#!/bin/bash

# Sequence Alignment Tool 启动脚本
# 确保在bio环境中运行

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 初始化conda（如果需要）
eval "$(conda shell.bash hook)"

echo "Starting Sequence Alignment Tool..."

# 检查conda是否可用
if ! command -v conda &> /dev/null; then
    echo "Error: conda is not installed or not in PATH"
    echo "Please install Miniconda or Anaconda first"
    exit 1
fi

# 检查是否在bio环境中
if [[ "$CONDA_DEFAULT_ENV" != "bio" ]]; then
    echo "Warning: Not in bio environment. Activating bio environment..."
    # 如果bio环境不存在，先创建它
    if ! conda env list | grep -q "^bio\s"; then
        echo "bio environment not found. Creating it from environment.yml..."
        conda env create -f "$SCRIPT_DIR/environment.yml"
        conda activate bio
    else
        conda activate bio
    fi
fi

# 再次验证环境是否正确激活
if [[ "$CONDA_DEFAULT_ENV" != "bio" ]]; then
    echo "Error: Failed to activate bio environment"
    echo "Please run 'source activate_bio.sh' manually first"
    exit 1
fi

# 检查BLAST+是否安装
if ! command -v blastn &> /dev/null; then
    echo "Error: BLAST+ is not installed. Installing via conda..."
    conda install -c bioconda blast -y
    
    if ! command -v blastn &> /dev/null; then
        echo "Error: Failed to install BLAST+"
        exit 1
    fi
fi

# 启动后端服务
echo "Starting backend service..."
cd "$SCRIPT_DIR/backend" || exit 1
python main.py &
BACKEND_PID=$!

# 等待后端启动
sleep 3

# 启动前端服务
echo "Starting frontend service..."
cd "$SCRIPT_DIR/frontend" || exit 1
if [[ ! -d node_modules ]]; then
    echo "Frontend dependencies not found. Running npm install..."
    npm install
fi
HOST=127.0.0.1 BROWSER=none DANGEROUSLY_DISABLE_HOST_CHECK=true npm start &
FRONTEND_PID=$!

echo "Services started!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "Access the application at: http://localhost:3000"
echo ""
echo "To stop services, press Ctrl+C"

trap 'echo "Stopping services..."; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null' INT TERM EXIT

# 等待任意进程结束
wait $BACKEND_PID $FRONTEND_PID
