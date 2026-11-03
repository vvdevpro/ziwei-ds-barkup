# 部署说明

目标机器：`ss`（36.137.204.109，root，密钥 `~/.ssh/ss_key.pem`）。

## 当前形态

| 项 | 值 |
|---|---|
| 运行方式 | Node 22 standalone（**不是 Docker**，见下） |
| 代码位置 | `/opt/ziwei/app` |
| Node | `/opt/node/bin/node`（v22.14.0，官方 tarball 解压） |
| 进程管理 | systemd：`systemctl status ziwei` |
| 端口 | 3000（`PORT` 在 unit 文件里） |
| 环境变量 | `/opt/ziwei/app.env`（chmod 600，含 AI key） |
| 日志 | `journalctl -u ziwei -f` |

## 为什么不是 Docker

服务器上装了 Docker 26，但 `docker build` 拉 `node:22-alpine` 时
`registry-1.docker.io` TLS 握手超时（国内网络），镜像拉不下来。
换成本机构建 standalone + 服务器只装 Node，反而更快更稳。

## 发新版本

```bash
./deploy/deploy.sh
```

脚本会：本机 build → 打 tar → scp 到 `/root/ziwei.tar.gz` → 服务器解包到
`/opt/ziwei/app` → `systemctl restart ziwei` → 本地自检。

## 同步上游算法更新

上游（github.com/Renhuai123/ziwei-doushu）会持续修排盘口径，改动几乎都在
`lib/ziwei/` 与 `scripts/regression/`。本地改造过 `app/`、`components/`、
`lib/ai/`，所以**不要 `git pull`**，只取引擎层：

```bash
./deploy/update-upstream.sh          # 看差异 → 取引擎 → 打补丁 → 跑回归 → 构建 → 部署
DRY_RUN=1 ./deploy/update-upstream.sh  # 只看上游改了什么，不动文件
```

脚本做的事：

1. `git fetch` 并显示落后几个提交
2. 只 `git checkout origin/main -- lib/ziwei scripts/regression package.json package-lock.json`
3. 重新应用本地补丁 `deploy/patches/0001-lunar-input.patch`（农历输入改动，上游没有）
4. 依赖有变化才 `pnpm install`
5. `pnpm test`（16 条排盘回归，不过就不部署）
6. 调 `./deploy/deploy.sh`

**前置条件**：工作区必须是干净的（先 `git add -A && git commit`）。否则脚本会拒绝执行，
避免把"上游的改动"和"你的改动"混在一起分不清。

如果补丁打不上（说明上游也改过 `share.ts`），脚本会停下并提示手工合并。

## 首次部署（已完成，留档）

1. 服务器装 Node：下载 `node-v22.14.0-linux-x64.tar.xz` 解压到 `/opt/node`
2. 上传 standalone；`/opt/ziwei/app.env` 放 AI key（600 权限）
3. `cp deploy/ziwei.service /etc/systemd/system/` → `systemctl daemon-reload`
4. `systemctl enable --now ziwei`

## 常用命令

```bash
systemctl status ziwei
journalctl -u ziwei -f
systemctl restart ziwei
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/chart
```
