---
name: hitrading
description: >-
  A股行情、个股技术面分析、选股筛选、自选股与持仓管理、策略回测、快讯/公告/龙虎榜/微博。
  Use this skill when the user asks about Chinese A-share (沪深 A股) data: realtime
  quotes for a stock code like 600519/000001, K-line history, MA/MACD/RSI/KDJ
  indicators, screening stocks by PE/market-cap/change/turnover, managing a
  watchlist or portfolio, running a moving-average/MACD/RSI backtest, or reading
  A-share news flashes, announcements, 龙虎榜 and Weibo monitoring. Data and analysis only — never places
  real brokerage orders.
metadata:
  author: hitrading
  version: 1.0.0
---

# HiTrading — A股数据与分析能力

通过本机 HTTP 服务访问 A股行情与分析能力。服务与 HiTrading 面板、DeepSeek Harness 内的 Agent 工具共享同一份 SQLite 数据，读写实时互通。

> 所有结果仅供研究参考，**不构成投资建议**。数据来自公开免费接口，可能存在延迟或误差。

## 一、服务地址

默认监听 `http://127.0.0.1:8099`。**HiTrading 插件加载时会自动拉起该服务，通常无需手动启动**；若 Harness 未运行或服务未启动，再手动执行：

```bash
cd /Users/luyuchao/Documents/workgo/hitrading
node server.js
```

先做一次自检（连不上再考虑启动服务）：

```bash
curl -s http://127.0.0.1:8099/health
# {"ok":true,"value":{"service":"hitrading","time":"..."}}
```

可选环境变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| `HITRADING_PORT` | `8099` | 监听端口 |
| `HITRADING_HOST` | `127.0.0.1` | 绑定地址 |
| `HITRADING_TOKEN` | 空 | 设置后所有请求需带 `Authorization: Bearer <token>` |
| `HITRADING_DB` | `~/.dsh/storages/hitrading.db` | SQLite 路径 |

## 二、调用约定

- 统一入口：`GET /api?op=<op>&<参数>` 或 `POST /api`，body `{"op":"<op>","args":{...}}`
- 返回：成功 `{"ok":true,"value":...}`；失败 `{"ok":false,"error":"原因"}`（HTTP 400）
- 代码格式：6 位 A股代码（`600519`、`000001`、`300750`），也接受 `sh600519` / `600519.SH`
- 数组参数：GET 用逗号分隔（`symbols=600519,000001`），POST 用 JSON 数组
- 数值参数在 GET 中会自动转成数字

## 三、数据读取（只读）

### suggest — 证券模糊搜索（股票/ETF，名称/拼音/代码）

参数：`q`（关键词，必填）、`count`（1~10，默认 8）

```bash
curl -s "http://127.0.0.1:8099/api?op=suggest&q=茅台"
curl -s "http://127.0.0.1:8099/api?op=suggest&q=gzmt"
```

返回 `value.items[]`：`market(sh/sz) code name pinyin`。覆盖 A股（主板/创业板/科创板）与场内 ETF（含 QDII-ETF），排除指数/港股/场外基金。用户说「把茅台/沪深300ETF 加自选」而未给代码时，先 `suggest` 拿代码再 `watchlist.add`。

### quote — 实时行情

参数：`symbols`（数组，必填）

```bash
curl -s "http://127.0.0.1:8099/api?op=quote&symbols=600519,000001"
```

返回 `value.quotes[]`，每项含：`code name price prevClose open high low volume(手) amount(万元) change pctChange(%) turnover(%) pe pb totalMcap(亿) floatMcap amplitude limitUp limitDown time source`。

### kline — 历史 K线

参数：`symbol`（必填）、`period`（`day`/`week`/`month`/`m5`/`m15`/`m30`/`m60`，默认 day）、`limit`（1~1000，默认 60）

```bash
curl -s "http://127.0.0.1:8099/api?op=kline&symbol=600519&period=day&limit=60"
```

返回 `value.bars[]`：`date open high low close volume(股)`。

### analysis — 技术面 + 估值概览

参数：`symbol`（必填）

```bash
curl -s "http://127.0.0.1:8099/api?op=analysis&symbol=600519"
```

返回 `value.indicators`：`ma5 ma10 ma20 ma60 dif dea hist macdSignal rsi14 rsiSignal k d j kdjSignal close`，以及 `value.quote`（同 quote 单项）和 `value.bars`（最近 120 根日线）。

### screen — 全市场选股

参数：`sort`（`amount`/`changepercent`/`turnoverratio`/`mktcap`）、`limit`（1~300，默认 30）、`peMin peMax mcapMinYi mcapMaxYi pctMin pctMax turnoverMin`

```bash
curl -s "http://127.0.0.1:8099/api?op=screen&sort=changepercent&pctMin=5&turnoverMin=3&limit=20"
```

返回 `value.rows[]`：`code symbol name price change pctChange prevClose open high low volume amount pe pb totalMcapYi floatMcapYi turnover`。

### energy — 市场量能（沪深京日成交额）

参数：`days`（`20`/`40`/`60`，默认 20）

```bash
curl -s "http://127.0.0.1:8099/api?op=energy&days=20"
```

返回 `value.stats`：`date total delta ma5 rangeAvg rangeMax rangeMin pctSh pctCyb pctKc vsMa5Pct status`（金额单位：亿元；`status` 为 放量/平量/缩量，规则：最新合计较 5 日均额 ±10%）；
`value.breadth`：`up down flat limitUp limitDown total upRatio`（当日涨跌家数与涨停跌停，数据源限流时缺省）；
`value.sentiment`：`score label zone{key,label,sustained,hint} parts{amount,breadth,limit} latestAmount ma5Amount vsMa5Pct`——情绪评估（0-100）：量能40% + 涨跌家数35% + 涨停跌停25%；量能档位遵循「1万亿以下谨慎区、1.5万亿以上参与区（持续=强力做多，不持续=警惕头部）」；
`value.series[]`：`date sh sz bj total delta ma5 pctSh pctCyb pctKc`（按日期升序，最后一条为最新交易日）。

口径：沪市=上证指数成交额，深市=深证综指成交额，京市=北证50成分股成交额（北交所无全市场指数）；盘中最新一根为当日累计值。

### powerful — 强势股（当日涨幅 > 7%）

参数：`date`（`YYYY-MM-DD`，可选，默认最新交易日；仅支持最近 10 个交易日）

```bash
curl -s "http://127.0.0.1:8099/api?op=powerful"
curl -s "http://127.0.0.1:8099/api?op=powerful&date=2026-11-06"
```

返回 `value.items[]`：`code name pct(当日涨幅%) close(前复权收盘) industry zt{ lbc(连板) fbt(首封) fund(封单,元) zbc(炸板) zttj{days,ct} } latestPct latestPrice(当前实时涨跌/价)`；
`value.dates[]`（降序）：`date count isLatest` —— 最近 10 个交易日每日强势股数量；
`value.stats`：`count ztCount maxLbc avgPct`。
历史日期首次查询会扫描全市场日K（约 20 秒）并按日缓存进 SQLite，之后秒出。

### weibo — 微博监控与股票提取

参数：`action`（`list` 查看 / `extract` 提取股票）、`page`、`pageSize`（1~50）、`userId`、`keyword`、`days`、`batch`（extract 条数，1~50，默认 20）

```bash
# 列表（需本地 Weibo Crawler 服务，默认 127.0.0.1:15001）
curl -s "http://127.0.0.1:8099/api?op=weibo&pageSize=10"
curl -s "http://127.0.0.1:8099/api?op=weibo&keyword=DRAM&days=3"
```

`extract` 用模型解析未提取的微博，把提到的 A股标的写入自选（已存在只更新最后提及时间），并对微博打「已提取」标记、不重复处理。**仅 Harness 内可用**（需要模型通道，独立 8099 服务不支持）：

```bash
# 在 Harness 对话里说：把微博里提到的股票提取出来
```

返回 `value.items[]`：`id screenName text createdAt attitudes comments reposts extracted{at,stocks[]}`；
`extract` 返回 `processed pendingLeft withStocks added[] updated[] message`。

### news — 快讯 / 公告 / 龙虎榜

参数：`type`（`news`/`announcement`/`lhb`，必填）、`symbol`（公告可按代码过滤）、`count`（1~50，默认 20）

```bash
curl -s "http://127.0.0.1:8099/api?op=news&type=news&count=10"
curl -s "http://127.0.0.1:8099/api?op=news&type=announcement&symbol=600519"
curl -s "http://127.0.0.1:8099/api?op=news&type=lhb&count=20"
```

- `news`：`title summary showTime code`
- `announcement`：`code name title noticeDate artCode`
- `lhb`：`date code name close changeRate netBuyAmt(元) buyAmt sellAmt reason turnover`

### backtest — 策略回测

参数：`symbol`（必填）、`strategy`（`ma_cross`/`macd_cross`/`rsi_reversal`，必填）、`limit`（默认 250）、`initial`（默认 100000）、`fast`/`slow`（ma_cross，默认 5/20）、`rsiLow`/`rsiHigh`（rsi_reversal，默认 30/70）

```bash
curl -s "http://127.0.0.1:8099/api?op=backtest&symbol=000001&strategy=ma_cross&limit=250"
```

返回：`final totalReturnPct annualizedPct maxDrawdownPct sharpe tradeCount winRate trades[](buyDate buyPrice sellDate sellPrice shares pnl pnlPct) holdingShares equityCurve[] barCount`。

## 四、本地数据读写（与 GUI 共享）

### 自选股

自选股支持**关注度**分级（`basic` 基础股（默认）/ `selected` 精选股 / `trading` 交易股）、**领域分类**（单选，可空：`finance` 大金融 / `consumer` 消费 / `cyclical` 周期 / `tech` 科技）与**多标签**（每只≤10个，单个≤12字）。

```bash
# 查询（含实时行情）
curl -s "http://127.0.0.1:8099/api?op=watchlist.list"

# 按关注度、领域或标签过滤（domain=none 查未分类）
curl -s "http://127.0.0.1:8099/api?op=watchlist.list&tier=selected"
curl -s "http://127.0.0.1:8099/api?op=watchlist.list&domain=tech"
curl -s "http://127.0.0.1:8099/api?op=watchlist.list&domain=none"
curl -s "http://127.0.0.1:8099/api?op=watchlist.list&tag=白酒"

# 新增（可指定关注度、领域与标签）
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"watchlist.add","args":{"symbols":["600519","000001"],"tier":"selected","domain":"consumer","tags":["白酒","核心资产"]}}'

# 修改关注度
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"watchlist.setTier","args":{"symbols":["600519"],"tier":"trading"}}'

# 设置领域分类（单选；传空 domain 清除）
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"watchlist.setDomain","args":{"symbols":["600519"],"domain":"consumer"}}'

# 设置标签（全量替换）
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"watchlist.setTags","args":{"symbols":["600519"],"tags":["白酒","龙头"]}}'

# 删除
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"watchlist.remove","args":{"symbols":["600519"]}}'
```

`list` 返回 `items[]`：`symbol name price pctChange tier tags addedAt pctN`，另含 `counts`（各关注度数量）与 `tagCloud`（各标签数量）。`pctN` 为 `{1,2,3,4,5,10,15,20,30}` 各周期的累计涨跌幅：T-n = 最新价较 T-(n+1) 日收盘（近 n+1 个交易日，如 T-1 为近 2 日累计）。旧数据无 `tier`/`tags` 时视为 `basic`/空。

### 持仓

```bash
# 查询（含实时市值/盈亏，含 totalPnl / totalValue）
curl -s "http://127.0.0.1:8099/api?op=portfolio.list"

# 建仓
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"portfolio.add","args":{"symbol":"000001","shares":100,"costPrice":11.5}}'

# 清仓
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"portfolio.remove","args":{"symbol":"000001"}}'
```

`list` 返回 `items[]`：`symbol name shares costPrice price marketValue pnl pnlPct`。

### 预警

```bash
# 查询（triggered=true 表示已触发）
curl -s "http://127.0.0.1:8099/api?op=alerts.list"

# 创建：600519 价格上破 1500
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"alerts.create","args":{"symbol":"600519","condition":"price_above","value":1500}}'

# 删除
curl -s -X POST http://127.0.0.1:8099/api -H "Content-Type: application/json" \
  -d '{"op":"alerts.delete","args":{"id":"<规则id>"}}'
```

`condition` 可选：`price_above`（价高于）/`price_below`（价低于）/`pct_above`（涨幅高于）/`pct_below`（涨幅低于）。

> 预警的**定时检查**由 HiTrading 面板（Harness 运行时）执行；本服务提供规则的增删查与 `triggered` 状态读取。

## 五、Python 封装示例

```python
import requests

class HiTrading:
    def __init__(self, base="http://127.0.0.1:8099", token=None):
        self.base = base
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

    def _post(self, op, **args):
        r = requests.post(f"{self.base}/api", json={"op": op, "args": args},
                          headers=self.headers, timeout=30)
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("error"))
        return data["value"]

    def _get(self, op, **params):
        r = requests.get(f"{self.base}/api", params={"op": op, **params},
                         headers=self.headers, timeout=30)
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(data.get("error"))
        return data["value"]

    def quotes(self, *symbols):      return self._get("quote", symbols=",".join(symbols))["quotes"]
    def kline(self, symbol, period="day", limit=60):
        return self._get("kline", symbol=symbol, period=period, limit=limit)["bars"]
    def analysis(self, symbol):      return self._get("analysis", symbol=symbol)
    def screen(self, **filters):     return self._get("screen", **filters)["rows"]
    def news(self, type="news", **kw): return self._get("news", type=type, **kw)["items"]
    def backtest(self, symbol, strategy="ma_cross", **kw):
        return self._post("backtest", symbol=symbol, strategy=strategy, **kw)

    def watchlist(self):             return self._get("watchlist.list")["items"]
    def watch_add(self, *symbols):   return self._post("watchlist.add", symbols=list(symbols))
    def watch_remove(self, *symbols):return self._post("watchlist.remove", symbols=list(symbols))

    def portfolio(self):             return self._get("portfolio.list")
    def position_add(self, symbol, shares, cost_price):
        return self._post("portfolio.add", symbol=symbol, shares=shares, costPrice=cost_price)
    def position_remove(self, symbol): return self._post("portfolio.remove", symbol=symbol)

    def alerts(self):                return self._get("alerts.list")["items"]
    def alert_add(self, symbol, condition, value):
        return self._post("alerts.create", symbol=symbol, condition=condition, value=value)
    def alert_remove(self, rule_id): return self._post("alerts.delete", id=rule_id)

# 用法
ht = HiTrading()
print(ht.quotes("600519", "000001"))
print(ht.screen(sort="changepercent", pctMin=5, limit=10))
ht.watch_add("600519")
```

## 六、常见任务配方

**看某只股票现在什么情况**
1. `analysis` 拿指标与估值 → 2. 需要走势时 `kline` 取日线 → 3. 汇报时说明数据时间与「不构成投资建议」。

**找符合条件的股票**
1. `screen` 用 `sort` + 区间过滤 → 2. 对命中前列的股票用 `quote`/`analysis` 复核 → 3. 输出表格并注明筛选条件。

**跟踪自己的持仓**
1. `portfolio.list` 取市值与盈亏 → 2. 结合 `news`（公告/龙虎榜）补充事件 → 3. 区分「数据事实」与「你的判断」。

**验证一个策略想法**
1. `backtest` 选 `ma_cross`/`macd_cross`/`rsi_reversal` → 2. 对比 `totalReturnPct`/`maxDrawdownPct`/`sharpe` → 3. 明确说明是历史回测，未来不可预知。

## 七、边界与注意事项

- **只做分析，不做交易**：本服务不连接券商，无下单能力。
- 数据是公开免费源的聚合结果，**不保证实时与准确**；任何结论都要标注来源与时间。
- 写操作（`watchlist.add`/`portfolio.add`/`alerts.create` 等）会立即改变本机共享数据，**会影响 HiTrading 面板与 Harness 内 Agent 看到的内容**，执行前确认用户意图。
- 服务未启动时先启动它；若开启 `HITRADING_TOKEN`，所有请求都要带 Bearer token。
- 所有输出需附「仅供研究参考，不构成投资建议」。