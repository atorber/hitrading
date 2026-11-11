# HiTrading — A股投资助手插件 设计文档

> 版本 v1.0 · 状态：待确认
> 本文档为确认基线；确认后据此实现，任何偏离先更新本文档。

## 1. 背景与目标

HiTrading 是运行在当前 DeepSeek Harness 内的 **Cordis 插件**，为 Agent 与用户提供 A股（沪深）投资辅助能力：

- **Agent 侧**：注册一组 A股工具（行情、K线、分析、选股、自选/持仓、快讯/公告/龙虎榜、微博、回测、预警），Agent 在对话中按需调用。
- **UI 侧**：在 Web GUI 挂出面板与工具结果可视化（K线图、数据表、自选/持仓列表）。
- **定位**：纯分析与跟踪，**不连接券商、不真实下单**；所有结论附投资风险提示。

## 2. 范围（一期全量）

七大能力全部落地，按实现依赖顺序组织（先做数据层，再往上叠）：

| 序号 | 能力 | 形态 |
|---|---|---|
| C1 | 行情查询 | 工具 + 面板 |
| C2 | 个股分析（基本面 + 技术面） | 工具 + 工具卡片 |
| C3 | 选股/条件筛选 | 工具 + 面板 |
| C4 | 自选股与持仓跟踪 | 工具 + 面板 |
| C5 | 策略回测 | 工具 + 工具卡片 |
| C6 | 资讯/公告/资金流向 | 工具 |
| C7 | 预警与定时推送（GUI 内） | 工具 + 面板 + 定时器 |

## 3. 数据源与适配层

### 3.1 选型结论（本机已实测）

| 用途 | 主源 | 兜底 | 实测 |
|---|---|---|---|
| 实时行情 | 腾讯 `qt.gtimg.cn` | 新浪 `hq.sinajs.cn` | ✅ 可用（GBK，需解码） |
| K线/历史 | 新浪 `quotes.sina.cn/cn/api/...getKLineData` | — | ✅ 返回 JSON |
| 列表/排名/板块 | 东方财富 `datacenter-web.eastmoney.com` | — | ✅ JSON |
| 龙虎榜/资金流/公告/北向 | 东方财富 `datacenter-web` | — | ✅ JSON（龙虎榜已验） |
| 基本面/财务（可选增强） | Tushare（需 token） | — | 待接入，token 存 credentials |

> 注：东财 `push2`/`push2his` 行情接口在本机实测返回 `HTTP 000`（连接重置），判定为当前网络环境对域名的限制，不作为主源；保留为可选降级。

### 3.2 适配层设计（Host 端 `lib/` ）

- `http.js`：Node `fetch` 封装 + 超时 + 重试 + 多源降级（腾讯→新浪→东财按用途路由）。
- `gbk.js`：GBK → UTF-8 解码（腾讯/新浪实时行情的编码处理）。
- `cache.js`：TTL 内存缓存（实时行情 ~3s，日线/财务 ~5min，避免重复请求被限流）。
- `parsers/`：各源的响应解析器，统一为内部数据结构（见 §6）。

## 4. 架构分层

```
hitrading/                      # 单个 bundle 包 @atorber/hitrading（GitHub: atorber/hitrading）
├── index.js                    # Host 入口：apply(ctx, config)
├── client.js                   # Client 入口：UI 面板 + 工具卡片渲染
├── cordis.patch.yml            # Loader 插入行
├── package.json                # bundle 声明 + dsh.client
├── icon.svg                    # 原创图标
├── locale/{zh,en}.json         # title/description 双语
├── lib/                        # Host 数据适配与领域逻辑
│   ├── http.js  gbk.js  cache.js
│   ├── parsers/ (tencent.js sina.js eastmoney.js tushare.js)
│   ├── quotes.js  kline.js  fundamentals.js  screen.js
│   ├── news.js  backtest.js  indicators.js
│   └── domain.js  store.js     # 持久化 domain 定义与读写
└── tools/                      # 工具定义（register）
    ├── quote.js  kline.js  analysis.js  screen.js
    ├── watchlist.js  portfolio.js  news.js  backtest.js  alert.js
```

- **Host（index.js）**：注册 11 个工具、声明持久化 domain、启动预警定时器、注入系统提示（风险声明 + 工具使用指引）。
- **Client（client.js）**：注册 `sidebar.panellist` 面板入口、`tool.call.toolview` 工具结果渲染（K线图/表）、`settings.section` 设置页。

## 5. Agent 工具集

统一前缀 `hitrading_`。每个 `ToolDefinition` 含 `name/description/parameters/output(render)/execute`。

| 工具 | 参数 | 返回 | 覆盖 |
|---|---|---|---|
| `hitrading_quote` | `symbols[]`（如 `600519`/`000001`） | 现价、涨跌幅、成交额、换手等 | C1 |
| `hitrading_kline` | `symbol`, `period`(day/week/minute), `limit`/日期范围, `adjust` | OHLCV 数组 + 简单技术指标 | C1 C2 |
| `hitrading_analysis` | `symbol` | 技术面（MA/MACD/RSI/KDJ）+ 基本面概览（PE/PB/市值） | C2 |
| `hitrading_screen` | 条件：PE/市值/涨跌幅/换手/量比范围、排序 | 匹配股票列表（含关键指标） | C3 |
| `hitrading_watchlist` | `action`(add/remove/list) + `symbols` | 自选列表 + 实时行情 | C4 |
| `hitrading_portfolio` | `action`(add/remove/list) + `{symbol,shares,cost}` | 持仓 + 现价 + 盈亏 | C4 |
| `hitrading_news` | `symbol?`, `type`(news/announcement/lhb/north) | 资讯/公告/龙虎榜/北向资金列表 | C6 |
| `hitrading_backtest` | `symbol`, `strategy`(名称+参数), `period`, `initial` | 收益/回撤/夏普/交易明细/权益曲线 | C5 |
| `hitrading_alert` | `action`(create/list/delete) + 规则`{symbol,condition,value}` | 预警规则列表 | C7 |

> `hitrading_backtest` 一期为 **内置策略库**（双均线、MACD 金叉、RSI 超卖、突破等参数化策略），纯本地 JS 回算，不上云、不依赖外部回测引擎；后续可扩展自定义策略。

## 6. 数据模型与持久化

### 6.1 最终方案：SQLite（跨进程共享）

自选股 / 持仓 / 预警规则存 **SQLite**（Node ≥ 22 内置 `node:sqlite`，WAL 模式），文件：

```
~/.dsh/storages/hitrading.db
```

- **同一份 db 被三方共用**：Harness 插件（工具 + 面板路由）、独立 HTTP 服务（`server.js`）、外部量化脚本——增删改实时互通，多进程并发由 SQLite WAL + busy_timeout 保证。
- 存储封装在 `lib/db.js`（`openStore(dbPath)` → `table(name)`），暴露与之前 domain 表同构的接口（`get/put/delete/keys/entries/size/update`），所以 `lib/ops.js` 无需改动即可切换后端。
- 路径可用 `HITRADING_DB` 环境变量覆盖。

> 说明：早期设计用 Harness 的 `storage-domain`（JSON，落盘 `~/.dsh/storages/hitrading.json`）。为满足「外部程序共享同一份自选/持仓/预警」，domain 的内存缓存无法跨进程可见，故改为 SQLite。此变更已落地并验证。

### 6.2 表结构

| 表 | key | value |
|---|---|---|
| `watchlist` | 股票代码 | `{ symbol, name, addedAt, note? }` |
| `positions` | 股票代码 | `{ symbol, name, shares, costPrice, openedAt }` |
| `alerts` | 预警 id | `{ id, symbol, name, condition, value, enabled, createdAt, triggered?, lastTriggeredAt? }` |

### 6.3 规模化说明

- 真正的落盘量只是人肉维护的列表（几 KB～几十 KB），SQLite/WAL 完全够用；行情/K线/财务/资讯一律实时拉取 + 内存 TTL 缓存，不落盘。
- 未来若需本地大时序（历史缓存/回测结果库），仍用同一 `node:sqlite` 加表即可，无需换栈。

## 7. UI 面板

- **面板入口**：`sidebar.panellist` 注册 HiTrading 图标，打开后展示「自选股行情 / 持仓盈亏 / 预警列表」三个视图（共享 host 主题 token）。
- **工具结果可视化**：`tool.call.toolview` 按 wire name 注册 — `hitrading_kline` 渲染 K线图（自绘 SVG/Canvas），`hitrading_quote`/`screen`/`news` 渲染数据表，`hitrading_backtest` 渲染权益曲线。
- **设置页**：`settings.section` — 数据源偏好、可选 Tushare token 绑定、缓存设置。
- **预警提醒**：`timer` 轮询 + 阈值判断，触达在 GUI 内提示（具体通知挂载点在实现阶段用 `Slots.listSubTree` 确定，优先 `shell.overlay` 或面板内高亮）。

## 8. 合规与风险提示

- 插件不为真实交易；工具描述与系统提示均声明「结果仅供研究参考，不构成投资建议」。
- `systemPrompt.section` 注入固定免责声明与工具使用指引。
- 数据来源为公开免费接口，不保证实时性与准确性；面板标注数据源与刷新时间。

## 9. 实现顺序（里程碑）

1. **M1 数据层**：http/gbk/cache + 腾讯/新浪/东财 parser，quote/kline 走通。
2. **M2 工具层**：注册 quote/kline/analysis；`systemPrompt.section` 接入风险声明。
3. **M3 持久化 + UI 骨架**：domain 声明；面板入口 + K线/表卡片。
4. **M4 全量工具**：screen/watchlist/portfolio/news/backtest/alert。
5. **M5 预警定时 + 设置页 + 双语元数据 + 图标**：收尾与验证。

## 10. 验证标准

- `plugin_manager install_bundle` 返回 `application: applied`。
- `Tool.listTools` / `Config.listConfigs` 能查到 HiTrading 工具与配置。
- Host 端工具实际调用成功返回 A股数据（真实行情，非 mock）。
- UI 面板与工具卡片在 Web GUI 渲染（无浏览器时以 slot 注册 + 资源检查为准，并如实报告未验证项）。

## 11. 实现备注（2026-11-06 已落地）

- 全部 11 个工具 + 持久化 domain + 预警定时器 + sidebar 面板已实现并端到端验证；数据源为腾讯/新浪行情 + 新浪K线/列表 + 东财 push2/push2his/push2ex（量能、强势股、龙虎榜/公告/快讯）。强势股按日缓存进 SQLite（powerful 表）：历史日首次访问扫描全市场日K（约 20 秒）后落盘，之后秒出。
- **本地 bundle 的 @deepseek-ai 依赖解析**：Host 侧 import 了 `dsh-tools`（工具定义）。registry 只有旧版（0.0.1-rc.1），与运行时（0.2.2-rc.1）不一致，不可写成 npm 依赖；本地 `link:` 安装下 ESM 从插件真实路径解析，需在插件目录建指向 DSH 安装树的 `node_modules/@deepseek-ai` 软链（详见 README「本地开发注意」）。
- **预警触达**：一期为「面板/工具列表可见触发状态」——`ctx.timer` 轮询（交易时段）检测规则，触发后写 `triggered` + `lastTriggeredAt` 到 domain；`hitrading_alert list` 与面板可见「已触发」。弹窗式提醒与实时面板数据需 Host→Client 数据通道（`useResource`/Remote），列为后续增强。
- **面板定位**：client 侧注册 `sidebar.panellist`（图标）+ `main`（key=`hitrading` 页面，keyed slot），经 `Slots.listSubTree` 验证 `hitrading` occupant 已激活。**已从「说明导航页」升级为 14-Tab 交互控制台**（行情自选/量能/强势股/选股/持仓/回测/快讯/公告/微博/龙虎榜/预警/Agent 技能/API/使用说明）：Host 把 11 个操作抽成单一真相源 `lib/ops.js`，并经 `ctx.connection.fetch.register` 暴露鉴权路由 `/api/hitrading`（GET/POST，JSON）；client 端各视图通过同源 `fetch('/api/hitrading')` 实时读写，含 K线图（SVG）、权益曲线图、表单与增删交互。
- **跨进程共享与外部接入**：持久化由 storage-domain 改为 **SQLite（`node:sqlite`，WAL）** `~/.dsh/storages/hitrading.db`，插件/面板/独立服务三方共享；独立服务 `server.js` 暴露同一套 op 的 HTTP API（默认 `127.0.0.1:8099`）。其他 Agent 通过 `skills/hitrading/SKILL.md`（`install-skill.sh` 可一键装到 `~/.agents/skills`、`~/.claude/skills`、`~/.cursor/skills`；或 `GET /skill.md` 拉取）接入；`hitrading` skill 已在本机三个目录安装成功。