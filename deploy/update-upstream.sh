#!/usr/bin/env bash
# 同步上游「算法层」更新并重新部署。
#
# 只同步 lib/ziwei/（排盘引擎）与 scripts/regression/（回归测试），
# 不动 app/、components/、lib/ai/ 这些本地改造过的部分。
#
# 用法：
#   ./deploy/update-upstream.sh           # 同步 + 跑回归 + 构建 + 部署
#   DRY_RUN=1 ./deploy/update-upstream.sh # 只看上游改了什么，不动文件
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PKG=(lib/ziwei scripts/regression package.json package-lock.json)
PATCH="deploy/patches/0001-lunar-input.patch"

echo "== 1. 拉取上游（remote: upstream）=="
git fetch upstream
BEHIND="$(git rev-list --count HEAD..upstream/main)"
echo "落后 upstream/main ${BEHIND} 个提交"
if [ "$BEHIND" = "0" ]; then
  echo "上游没有新提交，结束。"
  exit 0
fi

echo
echo "== 2. 引擎层改了这些文件 =="
git diff --stat HEAD..upstream/main -- "${PKG[@]}" | tail -30

if [ "${DRY_RUN:-0}" = "1" ]; then
  echo
  echo "DRY_RUN=1：只看不改。"
  exit 0
fi

if [ -n "$(git status --porcelain)" ]; then
  echo
  echo "⚠️  工作区有未提交的改动。建议先提交，避免更新后分不清哪些是自己的："
  echo "    git add -A && git commit -m 'wip: 本地改造'"
  exit 1
fi

echo
echo "== 3. 只取上游的引擎 + 测试 + 依赖清单 =="
git checkout upstream/main -- "${PKG[@]}"

echo "== 4. 重新打上本地补丁（农历输入）=="
if git apply --check "$PATCH" 2>/dev/null; then
  git apply "$PATCH"
  echo "已应用：$PATCH"
else
  echo "⚠️ 补丁打不上（上游可能改过 lib/ziwei/share.ts）。"
  echo "   请手工把农历转换那段加回 formToBirthInfo()，再执行："
  echo "   pnpm build && ./deploy/deploy.sh"
  exit 1
fi

echo
echo "== 5. 依赖有变化就重装 =="
git diff --quiet HEAD -- package.json || pnpm install

echo
echo "== 6. 跑回归测试 =="
pnpm test

echo
echo "== 7. 部署 =="
./deploy/deploy.sh

echo
echo "== 完成。别忘了把引擎更新一起提交：git add -A && git commit -m 'chore: 同步上游算法' =="
