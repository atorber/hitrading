# HiTrading — A股投资助手插件

[![CI](https://github.com/atorber/hitrading/actions/workflows/ci.yml/badge.svg)](https://github.com/atorber/hitrading/actions/workflows/ci.yml) [![Release](https://github.com/atorber/hitrading/actions/workflows/release.yml/badge.svg)](https://github.com/atorber/hitrading/releases) [![Docs](https://github.com/atorber/hitrading/actions/workflows/docs.yml/badge.svg)](https://atorber.github.io/hitrading/)

运行在当前 DeepSeek Harness 内的 Cordis 插件。为 Agent 提供 **11 个 A股工具**，并在 Web GUI 左侧栏挂出 **HiTrading 交互控制台**（11 个 Tab，所有模块都有 UI）。

> 纯分析与跟踪，**不连接券商、不真实下单**；所有结论附投资风险提示，数据来自公开免费接口。

仓库：[github.com/atorber/hitrading](https://github.com/atorber/hitrading) · 官网文档：[atorber.github.io/hitrading](https://atorber.github.io/hitrading/) · 包名 `@atorber/hitrading` · MIT

## 交互控制台（UI）

左侧栏点 HiTrading 图标打开，含 6 个 Tab，全部通过 `/api/hitrading` 实时读写 Host 数据：

| Tab | 能做什么 |
|---|---|
| 行情自选 | 加自选（可批量、带关注度+领域+多标签）、实时行情表、**关注度/领域/标签筛选**、点击个股看 **K线图 + 指标** 详情 |
| 量能 | 沪深京成交额趋势、情绪仪表（三档操作参考：谨慎区/过渡区/参与区）、涨跌家数对比、涨停跌停统计、指数涨跌与明细表 |
| 强势股 | 按交易日看当日涨幅 > 7% 的股票：左侧日期导航（最近 10 日）、涨停/连板、首封时间、行业、最新涨跌、一键加自选 |
| 选股 | 排序字段 + 区间过滤（市盈率/市值/涨跌幅/换手）+ 结果表 |
| 持仓 | 建仓/清仓表单 + 实时市值与盈亏 |
| 回测 | 策略选择 + 参数 + **权益曲线图** + 收益/回撤/夏普/胜率 |
| 龙虎榜 | 独立 Tab：资金摘要、多空分歧榜、上榜原因、净买额排序、只看自选 |
| 资讯 | 快讯（分类标记）/ 公告（类型分类）/ 微博（博主筛选、互动数、**提取股票**） |
| 预警 | 价格/涨跌幅规则增删 + 触发状态 |
| Agent 技能 | 11 个工具的提示词示例（可复制 / **一键试用**：新开一个会话并把提示词填进输入框，确认后回车发送）+ 给其他 Agent 安装 SKILL.md 的说明与全文 |
| API | 独立 HTTP 服务接口文档（参数表 + 请求/响应示例） |
| 使用说明 | 整体上手引导、Tab 速览、数据与存储说明 |

## Agent 工具

| 工具 | 说明 |
|---|---|
| `hitrading_quote` | 批量实时行情（腾讯/新浪） |
| `hitrading_kline` | 历史 K线（日/周/月/分钟，新浪） |
| `hitrading_analysis` | 个股技术面（MA/MACD/RSI/KDJ）+ 基本面概览 |
| `hitrading_screen` | 全市场排序 + 区间过滤选股（新浪） |
| `hitrading_market_energy` | 沪深京三市日成交额 + 量能状态（东财） |
| `hitrading_powerful` | 强势股：按交易日查当日涨幅>7%（涨停/连板/行业，东财） |
| `hitrading_watchlist` | 自选股管理（持久化）+ 关注度分级 + 领域分类（大金融/消费/周期/科技）+ 多标签 |
| `hitrading_portfolio` | 本地持仓与盈亏（持久化） |
| `hitrading_weibo` | 微博监控（本地 Weibo Crawler）+ **提取股票**（模型解析写入自选） |
| `hitrading_news` | 快讯 / 个股公告 / 龙虎榜（东方财富） |
| `hitrading_backtest` | 内置策略回测（双均线/MACD/RSI） |
| `hitrading_alert` | 价格/涨跌幅预警（定时器轮询，GUI 内看触发状态） |

## 数据持久化

自选股 / 持仓 / 预警规则存在 **SQLite**（`node:sqlite` 内置，WAL 模式），文件：

```
~/.dsh/storages/hitrading.db
```

**同一份 db 被 Harness 插件与独立 HTTP 服务共用**，因此 GUI、Agent 工具、外部程序三方的增删改实时互通（多进程并发由 SQLite WAL 保证）。可用 `HITRADING_DB` 环境变量覆盖路径。

数据保护：

- **旧数据自动迁移**：早期版本存在同目录的 `hitrading.json`，首次启动时会自动导入当前库（不覆盖已有记录），导入后把旧文件改名为 `hitrading.json.migrated`。
- **每小时自动快照**：`hitrading.db.bak`（`VACUUM INTO` 生成的一致性副本，含 WAL 中未 checkpoint 的写入）。误删可把 `.bak` 复制回 `.db` 恢复。
- 面板里的「移除自选 / 清仓 / 删除预警」均有二次确认。

## 外部程序通过 HTTP 访问（量化脚本）

插件加载时会**自动拉起**独立服务（`server.js`），默认监听 `127.0.0.1:8099`，无需手动启动；插件停用/卸载时子进程随之关闭。

面板**头部右侧常驻服务状态**（绿点=运行中 / 红点=已停止）与 **启动 / 停止 / 重启** 三个按钮；状态每 5 秒自动刷新。

> 也可在 Harness 未运行时手动启动：`node server.js`（或 `npm run start:api`）。端口已被占用时新进程会自行退出，不会冲突。

配置：`HITRADING_PORT`（默认 8099）、`HITRADING_HOST`（默认 127.0.0.1）、`HITRADING_TOKEN`（可选，设置后需带 `Authorization: Bearer <token>`）、`HITRADING_DB`（默认 `~/.dsh/storages/hitrading.db`）。

接口统一返回 `{ ok, value }` 或 `{ ok: false, error }`：

- `GET /health`
- `GET /api?op=<op>&...`
- `POST /api`，body `{ "op": "<op>", "args": {...} }`

`op` 与 Agent 工具同名：`quote` / `kline` / `analysis` / `screen` / `watchlist.list|add|remove` / `portfolio.list|add|remove` / `news` / `backtest` / `alerts.list|create|delete`。

```python
import requests
B = "http://127.0.0.1:8099"

# 实时行情
print(requests.get(f"{B}/api", params={"op": "quote", "symbols": "600519,000001"}).json()["value"]["quotes"])

# K线
print(requests.get(f"{B}/api", params={"op": "kline", "symbol": "600519", "period": "day", "limit": 60}).json())

# 选股
print(requests.get(f"{B}/api", params={"op": "screen", "sort": "changepercent", "pctMin": 5, "limit": 30}).json())

# 自选（与 GUI 共享同一份数据）
requests.post(f"{B}/api", json={"op": "watchlist.add", "args": {"symbols": ["600519"]}})
```

> 该服务与 Harness 插件共享同一 SQLite，写入实时互相可见。预警**定时检查**只由 Harness 插件（GUI 运行时）执行；独立服务提供规则的增删查。

## 给其他 Agent 使用（SKILL.md）

本仓库提供一份可直接安装的 skill：`skills/hitrading/SKILL.md`，内含启动方式、全部接口、示例与任务配方。

**做法：把这份文件放进目标 Agent 的技能目录即可**，安装交给 Agent 自己完成。

```bash
# 通用：把 <技能目录> 换成你的（如 ~/.agents/skills、~/.claude/skills、~/.cursor/skills）
curl -o <技能目录>/hitrading/SKILL.md http://127.0.0.1:8099/skill.md
```

或者直接把这句话发给目标 Agent：

> 请把 http://127.0.0.1:8099/skill.md 安装到你的 skills 目录（例如 ~/.agents/skills/hitrading/SKILL.md），然后按其中的说明使用 A股能力。

前提是 HiTrading 的本地服务已启动（`node server.js`）。

## 目录结构

```
index.js            # Host 入口：工具 + /api/hitrading 路由 + 定时器 + 免责声明
client.js           # Client 入口：sidebar 图标 + 6-Tab 交互控制台
server.js           # 独立本地 HTTP 服务（供外部程序/量化脚本）
lib/ops.js          # 单一真相源：11 个操作（工具/路由/独立服务共用）
lib/db.js           # 跨进程共享的 SQLite 存储
lib/*.js            # 数据适配（http/quotes/kline/market/news/backtest/indicators/symbol）
cordis.patch.yml    # Loader 插入行
locale/*.json       # 中英双语标题/描述
icon.svg            # 图标
```

## 安装

### 从 GitHub 安装（推荐）

对 Harness 的对话说：

> 帮我安装 GitHub 上的插件：https://github.com/atorber/hitrading

或直接在 Harness 内通过 `plugin_manager` 安装（`install_bundle`，target 填 `https://github.com/atorber/hitrading`）。安装程序会自动拉取仓库、解析 `@deepseek-ai/dsh-tools` peer 依赖并应用插件补丁。

要求：DeepSeek Harness ≥ 0.2.2-rc.1（peer 依赖 `@deepseek-ai/dsh-tools@^0.2.2-rc.1`）。

### 从本地目录安装（开发）

```bash
git clone https://github.com/atorber/hitrading.git
# 在 Harness 内：plugin_manager install_bundle target=<仓库绝对路径>
```

安装后 `hitrading` 插件激活，在左侧栏出现 HiTrading 图标与面板，对话中可用上述 11 个工具。

## 本地开发注意

本插件在 Host 侧 `import` 了 `@deepseek-ai/dsh-tools`（工具定义）。**从 GitHub/registry 安装时**该包由 pnpm 按 `peerDependencies` 自动装进 profile，开箱即用；**本地 `link:` 开发时** pnpm 不会为 link 依赖装 peer，Node ESM 又从插件真实路径向上解析 `node_modules`（插件目录不在 DSH 安装树内），因此需在插件目录建立指向 DSH 安装树的软链：

```bash
cd /path/to/hitrading
mkdir -p node_modules
DSH_NPM_ROOT=$(dirname "$(dirname "$(readlink -f "$(which dsh)")")")/node_modules
ln -sfn "$DSH_NPM_ROOT/@deepseek-ai" node_modules/@deepseek-ai
```

> 该软链指向当前 DSH 安装（npx 缓存）路径，已列入 `.gitignore`；若 DSH 从新的 npx 缓存启动，需重建软链。