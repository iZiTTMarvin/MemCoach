#!/bin/bash
# 一键清除所有面试数据，用于调试

DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="$DIR/data"

read -p "⚠ 将清除所有面试记录、向量记忆和个人画像，是否继续？[y/N] " confirm
[[ "$confirm" =~ ^[yY]$ ]] || { echo "已取消"; exit 0; }

# 清空数据库
sqlite3 "$DATA_DIR/interviews.db" "DELETE FROM memory_vectors; DELETE FROM sessions;" 2>/dev/null

# 清空个人画像
echo '{}' > "$DATA_DIR/user_profile/profile.json"
rm -f "$DATA_DIR/user_profile/insights/"*.md

echo "已清除全部数据"
