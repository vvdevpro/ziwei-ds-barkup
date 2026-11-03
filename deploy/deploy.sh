#!/usr/bin/env bash
# 部署到 ss 服务器：本机构建 standalone → 打包 → 上传 → 重启 systemd 服务
# 用法：SERVER=1.2.3.4 SSH_KEY=~/.ssh/id_ed25519 ./deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="${SERVER:?请用 SERVER=你的服务器IP 指定}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SITE_URL="${SITE_URL:-http://${SERVER}:3000}"
SSH="ssh -F /dev/null -i ${SSH_KEY}"
SCP="scp -F /dev/null -i ${SSH_KEY}"

cd "$ROOT"
echo "== 构建（standalone）=="
NEXT_PUBLIC_SITE_URL="$SITE_URL" pnpm build

echo "== 打包 =="
rm -rf .deploy && mkdir -p .deploy/app/.next
cp -a .next/standalone/. .deploy/app/
cp -a .next/static .deploy/app/.next/static
tar czf .deploy/ziwei.tar.gz -C .deploy app

echo "== 上传到 ${SERVER} =="
$SCP .deploy/ziwei.tar.gz "root@${SERVER}:/root/ziwei.tar.gz"

echo "== 解包并重启 =="
$SSH "root@${SERVER}" '
  set -e
  systemctl stop ziwei.service || true
  rm -rf /opt/ziwei/app
  mkdir -p /opt/ziwei
  tar xzf /root/ziwei.tar.gz -C /opt/ziwei
  systemctl start ziwei.service
  sleep 3
  systemctl is-active ziwei.service
  curl -s -o /dev/null -w "本地自检 http=%{http_code}\n" http://127.0.0.1:3000/chart
'
echo "== 完成：${SITE_URL} =="
rm -rf .deploy
