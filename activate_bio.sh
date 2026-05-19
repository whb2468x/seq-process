#!/bin/bash

# 自动激活bio环境脚本
# 使用方法: source activate_bio.sh

# 获取脚本所在目录的绝对路径（相对路径解决方案）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 检查conda是否可用
if ! command -v conda &> /dev/null; then
    echo "Error: conda is not installed or not in PATH"
    echo "Please install Miniconda or Anaconda first"
    exit 1
fi

eval "$(conda shell.bash hook)"

# 检查bio环境是否存在
if ! conda env list | grep -q "^bio\s"; then
    echo "Warning: bio environment not found"
    echo "Creating bio environment from environment.yml..."
    conda env create -f "$SCRIPT_DIR/environment.yml"
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to create bio environment"
        exit 1
    fi

    echo "bio environment created and dependencies installed successfully!"
else
    echo "bio environment already exists"
    if [[ "$UPDATE_BIO_ENV" == "1" ]]; then
        echo "Updating bio environment from environment.yml..."
        conda env update -n bio -f "$SCRIPT_DIR/environment.yml" --prune
    else
        echo "Skipping dependency update. Run 'UPDATE_BIO_ENV=1 source activate_bio.sh' to sync environment.yml."
    fi
fi

# 激活bio环境
echo "Activating bio environment..."
conda activate bio

# 验证环境是否正确激活
if [[ "$CONDA_DEFAULT_ENV" == "bio" ]]; then
    echo "✅ Successfully activated bio environment"
    echo "Current working directory: $(pwd)"
    echo "Project root: $SCRIPT_DIR"
    echo "You can now run the project using: ./start.sh"
else
    echo "❌ Failed to activate bio environment"
    exit 1
fi
