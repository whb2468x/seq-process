#!/bin/bash

# 自动激活bio环境的shell函数
# 将此函数添加到 ~/.bashrc 或 ~/.zshrc 中以启用自动激活功能

auto_activate_bio() {
    # 获取当前目录
    local current_dir="$(pwd)"
    
    # 检查当前目录或父目录中是否存在项目标识文件
    # 我们使用 activate_bio.sh 作为项目标识
    local project_root=""
    local temp_dir="$current_dir"
    
    # 向上查找直到找到 activate_bio.sh 文件或到达根目录
    while [[ "$temp_dir" != "/" && "$temp_dir" != "." ]]; do
        if [[ -f "$temp_dir/activate_bio.sh" ]]; then
            project_root="$temp_dir"
            break
        fi
        temp_dir="$(dirname "$temp_dir")"
    done
    
    # 如果找到了项目根目录
    if [[ -n "$project_root" ]]; then
        # 检查是否已经在bio环境中
        if [[ "$CONDA_DEFAULT_ENV" != "bio" ]]; then
            # 检查conda是否可用
            if command -v conda &> /dev/null; then
                # 检查bio环境是否存在
                if conda env list | grep -q "^bio\s"; then
                    echo "Auto-activating bio environment for seq-process project..."
                    conda activate bio
                else
                    echo "Warning: bio environment not found. Please run 'source activate_bio.sh' first from the project root."
                fi
            else
                echo "Warning: conda not found. Please install Miniconda/Anaconda."
            fi
        fi
    fi
}

# 设置PROMPT_COMMAND来在每次显示提示符前检查目录
if [[ -n "$PROMPT_COMMAND" ]]; then
    PROMPT_COMMAND="auto_activate_bio;$PROMPT_COMMAND"
else
    PROMPT_COMMAND="auto_activate_bio"
fi

# 使用说明：
# 1. 将此文件内容复制到 ~/.bashrc 文件末尾
# 2. 或者在 ~/.bashrc 中添加：source /path/to/auto_activate_bio.sh
# 3. 重新加载配置：source ~/.bashrc
#
# 注意：/path/to/ 应该替换为 auto_activate_bio.sh 文件的实际路径，
# 但 auto_activate_bio.sh 脚本本身不包含硬编码的项目路径，
# 它会动态检测项目根目录。