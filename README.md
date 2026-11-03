# 紫微斗数排盘 · 13 维解读

一个能直接用的紫微斗数排盘站：**排盘在浏览器里算**（纯 JS，不需要服务器算力），
**解读走大模型**（服务端代理，key 不落前端）。

> 本仓库是基于 [Renhuai123/ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)
> 的改造版。排盘引擎、古籍原文、回归测试来自上游，原作者 **王多鱼AI**；
> 本仓库在其基础上做了界面与接口层的改造，详见下方「与上游的差异」。

---

## 与上游的差异

| 改动 | 说明 |
|---|---|
| 首页直跳排盘 | 上游的营销落地页（滚动叙事、公告弹窗、限时活动）全部移除，`/` 308 → `/chart` |
| 13 维选项卡解读 | 上游 6 维、单一对话流；本仓库改为 13 维（含兄弟/子女/迁移/人际/田宅/福德/父母）分两行选项卡，面板固定高度、内部滚动 |
| 宫位独立标签 | 点命盘任一宫新增一个专属标签，互不覆盖，可单独关闭 |
| 农历输入 | 支持按农历生日起盘（含闰月识别、自动换算公历回显） |
| AI 接口 | 新增 `/api/interpret`（单盘 13 维）与 `/api/heming`（合盘），OpenAI 兼容 / Anthropic 双协议，SSE 流式 |
| 推理模型适配 | 透传 `reasoning_content`，等待首字期间显示"正在推理"，`max_tokens` 默认 8192 |
| 清理 | 删除 9 个无引用组件、知识库死链路由、倪师逐字稿语料目录等 |

## 功能

- **排盘**：真太阳时校正（经度 + 均时差）、1986–1991 夏令时判定、闰月四种口径、晚子时换日、
  星曜亮度 7 档与流派切换、四化飞星、十二神煞、大限流年
- **解读**：13 维 AI 解读，选项卡式，各自流式生成、各自保留
- **合盘**：双人盘 AI 分析
- **古籍**：骨髓赋 / 紫微斗数全集 / 紫微斗数全书，75 段精选，全文搜索
- **入口**：`/chart` 排盘 · `/heming` 合盘 · `/library` 古籍

## 快速开始

```bash
pnpm install
cp .env.example .env.local     # 填 AI key（不填也能排盘，只是没有解读）
pnpm dev                       # http://localhost:3000
```

其他命令：

```bash
pnpm typecheck   # 全量类型检查
pnpm test        # 14 条排盘回归（紫微铁律、夏令时、立春边界、闰月、日期合法性…）
pnpm build       # 生产构建（standalone 输出）
```

## AI 配置

只从**服务端**读取，key 永远不会进浏览器 bundle。

```bash
# .env.local（已被 .gitignore 忽略，绝不提交）
AI_PROVIDER=openai            # openai | anthropic | deepseek | ollama | mimo
AI_API_KEY=sk-...
AI_BASE_URL=https://api.example.com/v1
AI_MODEL=your-model
```

换厂商只改这三个变量，任何 OpenAI 兼容服务（DeepSeek / Kimi / 通义 / 硅基流动 / 本地 Ollama）都能用；
Anthropic 用 `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`。

> ⚠️ **绝对不要**把 key 写进任何 `.ts`、`.md`、Dockerfile 或 `NEXT_PUBLIC_*` 变量。
> `NEXT_PUBLIC_` 前缀会把值原样打进前端 JS。

## 部署

见 [deploy/README.md](./deploy/README.md)。一条命令：

```bash
./deploy/deploy.sh              # 构建 → 上传 → 重启 → 自检
./deploy/update-upstream.sh     # 同步上游算法更新（只取 lib/ziwei）
```

## 目录结构

```
app/
  page.tsx            首页（308 → /chart）
  chart/              排盘页
  heming/             合盘页
  library/            古籍库（可搜索）
  api/interpret/      单盘解读（SSE）
  api/heming/         合盘分析（SSE）
components/           BirthForm / ChartBoard / PalaceCell / InsightPanel / TimeNav / SiteNav
lib/ziwei/            排盘引擎（算法、四化、格局、真太阳时、夏令时、城市经纬度…）
lib/classics/         古籍原文数据
lib/ai/               模型接入层、命盘简报、prompt
scripts/regression/   排盘回归测试
deploy/               部署脚本与 systemd unit
```

## 许可与归属

| 内容 | 许可 | 来源 |
|---|---|---|
| 代码（`lib/`、`app/`、`components/`） | [MIT](./LICENSE) | 上游 [ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu)（王多鱼AI）+ 本仓库改造 |
| 古籍原文（骨髓赋、全集、全书） | 公有领域 | 明代刊本 |
| 上游数据集（Release 里的解读语料） | [CC BY 4.0](./DATASET-LICENSE) | **不随本仓库分发**，需要请去上游 Releases 下载 |

引用本项目时请保留上游署名：

> 基于 王多鱼AI 的开源项目 [ziwei-doushu](https://github.com/Renhuai123/ziwei-doushu) 改造。

## 免责声明

命理内容仅供参考，不构成医疗、法律、投资建议。AI 生成内容可能存在错误，请自行判断。
