import { defineTool } from '@deepseek-ai/dsh-tools';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeSymbols } from './lib/symbol.js';
import { getQuotes } from './lib/quotes.js';
import { openStore } from './lib/db.js';
import { getWeibos, extractStocksFromWeibos, weiboExtractStats } from './lib/weibo.js';
import { runOp, strategies, TIERS, DOMAINS, PCT_N } from './lib/ops.js';

const SKILL_PATH = new URL('./skills/hitrading/SKILL.md', import.meta.url);
/** 独立 HTTP 服务脚本的绝对路径（与插件同目录）。 */
const SERVER_PATH = fileURLToPath(new URL('./server.js', import.meta.url));

/** Host 服务依赖。 */
export const inject = ['tools', 'systemPrompt', 'timer', 'connection', 'llm'];

const DISCLAIMER =
  'HiTrading 提供的 A股行情、指标、选股与分析结果仅供研究参考，不构成任何投资建议。' +
  '数据来自公开免费接口，可能存在延迟或误差；请自行核实并独立决策，投资有风险。';

const errMsg = (e) => (e && e.message ? e.message : String(e));

function toTable(rows, cols) {
  const head = `| ${cols.map((c) => c.label).join(' | ')} |`;
  const sep = `| ${cols.map(() => '---').join(' | ')} |`;
  const body = rows.map((r) => `| ${cols.map((c) => c.render(r)).join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
}

// ---------- render helpers ----------
function renderQuotes(v) {
  if (v.error) return `HiTrading 行情查询失败：${v.error}`;
  if (!v.quotes?.length) return '未查询到行情。';
  const cols = [
    { label: '代码', render: (r) => r.code }, { label: '名称', render: (r) => r.name },
    { label: '现价', render: (r) => r.price }, { label: '最新涨跌幅%', render: (r) => r.pctChange },
    { label: '市盈率', render: (r) => r.pe }, { label: '市净率', render: (r) => r.pb },
    { label: '总市值(亿)', render: (r) => r.totalMcap }, { label: '换手率%', render: (r) => r.turnover },
  ];
  return `${toTable(v.quotes, cols)}\n数据源：${v.source}，北京时间。`;
}

function renderKline(v) {
  if (v.error) return `HiTrading K线查询失败：${v.error}`;
  if (!v.bars?.length) return '未查询到 K线数据。';
  const bars = v.bars.slice(-60);
  const cols = [
    { label: '日期', render: (r) => r.date }, { label: '开', render: (r) => r.open },
    { label: '高', render: (r) => r.high }, { label: '低', render: (r) => r.low },
    { label: '收', render: (r) => r.close }, { label: '成交量(股)', render: (r) => r.volume },
  ];
  return `${v.symbol} ${v.period} K线（显示最近 ${bars.length} 条，共 ${v.bars.length} 条）：\n${toTable(bars, cols)}`;
}

function renderAnalysis(v) {
  if (v.error) return `HiTrading 个股分析失败：${v.error}`;
  const f = (n) => (n == null ? '-' : n);
  const ind = v.indicators || {};
  return [
    `## ${v.quote?.name ?? v.symbol}（${v.symbol}）`,
    `现价 ${f(v.quote?.price)}，涨跌幅 ${f(v.quote?.pctChange)}%，市盈率 ${f(v.quote?.pe)}，市净率 ${f(v.quote?.pb)}，总市值 ${f(v.quote?.totalMcap)} 亿。`,
    `MA5 ${f(ind.ma5)} / MA10 ${f(ind.ma10)} / MA20 ${f(ind.ma20)} / MA60 ${f(ind.ma60)}`,
    `MACD：DIF ${f(ind.dif)}，DEA ${f(ind.dea)}，柱 ${f(ind.hist)}（${ind.macdSignal}）`,
    `RSI(14) ${f(ind.rsi14)}（${ind.rsiSignal}）；KDJ：K ${f(ind.k)}，D ${f(ind.d)}，J ${f(ind.j)}（${ind.kdjSignal}）。`,
    '以上为技术指标数值，仅描述现状，不构成买卖建议。',
  ].join('\n');
}

function renderScreens(v) {
  if (v.error) return `HiTrading 选股失败：${v.error}`;
  if (!v.rows?.length) return '未筛出符合条件的股票。';
  const cols = [
    { label: '代码', render: (r) => r.code }, { label: '名称', render: (r) => r.name },
    { label: '现价', render: (r) => r.price }, { label: '涨跌幅%', render: (r) => r.pctChange },
    { label: '市盈率', render: (r) => r.pe }, { label: '市净率', render: (r) => r.pb },
    { label: '总市值(亿)', render: (r) => r.totalMcapYi }, { label: '换手率%', render: (r) => r.turnover },
  ];
  return `按「${v.sortLabel}」筛选，命中 ${v.rows.length} 只：\n${toTable(v.rows, cols)}`;
}

function renderEnergy(v) {
  if (v.error) return `HiTrading 量能查询失败：${v.error}`;
  const st = v.stats || {};
  const f = (n) => (n == null ? '-' : n);
  const pct = (n) => (n == null ? '-' : `${n}%`);
  const lines = [
    `## 市场量能（最近 ${v.days} 个交易日）`,
    `最新交易日 ${f(st.date)}：沪深京合计 ${f(st.total)} 亿（较前日 ${f(st.delta)} 亿），5 日均额 ${f(st.ma5)} 亿，量能状态「${f(st.status)}」（较 5 日均额 ${f(st.vsMa5Pct)}%）。`,
    `区间均额 ${f(st.rangeAvg)} 亿，最高 ${f(st.rangeMax)} 亿，最低 ${f(st.rangeMin)} 亿。`,
    `当日指数：上证 ${st.pctSh == null ? '-' : st.pctSh + '%'}，创业板 ${st.pctCyb == null ? '-' : st.pctCyb + '%'}，科创50 ${st.pctKc == null ? '-' : st.pctKc + '%'}。`,
  ];
  const rows = [...(v.series || [])].reverse().slice(0, 20);
  if (rows.length) {
    lines.push(toTable(rows, [
      { label: '日期', render: (r) => r.date },
      { label: '沪市(亿)', render: (r) => r.sh }, { label: '深市(亿)', render: (r) => r.sz },
      { label: '京市(亿)', render: (r) => r.bj }, { label: '合计(亿)', render: (r) => r.total },
      { label: '较前日(亿)', render: (r) => r.delta },
      { label: '上证涨跌', render: (r) => pct(r.pctSh) }, { label: '创业板涨跌', render: (r) => pct(r.pctCyb) },
      { label: '科创50涨跌', render: (r) => pct(r.pctKc) },
    ]));
  }
  lines.push('口径：沪市=上证指数成交额，深市=深证综指成交额，京市=北证50成分股成交额（北交所无全市场指数）。以上为市场数据，不构成投资建议。');
  return lines.join('\n');
}

function renderPowerful(v) {
  if (v.error) return `HiTrading 强势股查询失败：${v.error}`;
  const f = (n) => (n == null ? '-' : n);
  const st = v.stats || {};
  const pct = (n) => (n == null ? '-' : `${n > 0 ? '+' : ''}${n}%`);
  const lines = [
    `## 强势股（${v.date} 当日涨幅 > ${v.pct}%）`,
    `${f(st.count)} 只（其中涨停 ${f(st.ztCount)} 只，最高连板 ${f(st.maxLbc) ?? '-'}，平均涨幅 ${f(st.avgPct)}%）。${v.note || ''}`,
    `最近交易日概览：${(v.dates || []).map((d) => `${d.date.slice(5)} ${d.count != null ? d.count + '只' : '未统计'}`).join(' / ')}`,
  ];
  const rows = (v.items || []).slice(0, 60);
  if (rows.length) {
    lines.push(toTable(rows, [
      { label: '代码', render: (r) => r.code }, { label: '名称', render: (r) => r.name },
      { label: '当日涨幅%', render: (r) => r.pct },
      { label: '涨停', render: (r) => (r.zt ? `${r.zt.lbc ?? 1}连板` : '-') },
      { label: '行业', render: (r) => r.industry || '-' },
      { label: '最新涨跌%', render: (r) => pct(r.latestPct) },
    ]));
    if ((v.items || []).length > rows.length) lines.push(`…共 ${v.items.length} 只，仅显示前 60 只。`);
  }
  lines.push('以上为市场数据，仅供研究参考，不构成投资建议。');
  return lines.join('\n');
}

function renderWeibo(v) {
  if (v.error) return `HiTrading 微博查询失败：${v.error}`;
  // 任务状态形态
  if (v.status) {
    const lines = [`微博提取任务：${v.status}${v.cancelRequested ? '（正在停止）' : ''}`];
    if (v.processed != null) lines.push(`已处理 ${v.processed} 条微博，含个股 ${v.withStocks ?? 0} 条；剩余待提取 ${v.remaining ?? '-'} 条。`);
    if (v.added?.length) lines.push(`新增自选：${v.added.map((x) => `${x.name}(${x.code})`).join('、')}`);
    if (v.updated?.length) lines.push(`更新提及：${v.updated.map((x) => `${x.name}(${x.code})`).join('、')}`);
    if (v.message) lines.push(v.message);
    if (v.error) lines.push(`错误：${v.error}`);
    return lines.join('\n');
  }
  // 提取结果形态
  if (v.processed !== undefined) {
    const lines = [`微博股票提取：${v.message || ''}`];
    if (v.raw) lines.push(`模型原始输出：\n${v.raw}`);
    if (v.added?.length) lines.push(`新增自选：${v.added.map((x) => `${x.name}(${x.code})`).join('、')}`);
    if (v.updated?.length) lines.push(`更新提及：${v.updated.map((x) => `${x.name}(${x.code})`).join('、')}`);
    if (v.withStocks != null) lines.push(`含个股的微博 ${v.withStocks} 条；剩余待提取 ${v.pendingLeft ?? 0} 条。`);
    return lines.join('\n');
  }
  const items = v.items || [];
  if (!items.length) return '未查询到微博。';
  const lines = items.map((w, i) => {
    const stats = `赞${w.attitudes} 评${w.comments} 转${w.reposts}`;
    return `${i + 1}. [${w.createdAt}] @${w.screenName}（${stats}）\n   ${(w.text || '').replace(/\s+/g, ' ').slice(0, 100)}`;
  });
  const bloggers = v.bloggers?.length ? `\n监控博主：${v.bloggers.map((b) => b.name).join('、')}` : '';
  return `微博监控（第 ${v.page} 页 / 共 ${v.total} 条）：\n${lines.join('\n')}${bloggers}\n以上为社交媒体内容，仅供参考，不构成投资建议。`;
}

function renderList(v, title, columns, emptyText) {
  if (v.error) return `${title}失败：${v.error}`;
  if (!v.items?.length) return emptyText;
  return `${title}（${v.items.length} 条）：\n${toTable(v.items, columns)}`;
}

function renderWatchlist(v) {
  const tnCols = PCT_N.map((n) => ({
    label: `T-${n}`, render: (r) => {
      const v = r.pctN?.[String(n)] ?? r.pctN?.[n];
      return v == null ? '-' : `${v}%`;
    },
  }));
  const body = renderList(v, '自选股', [
    { label: '代码', render: (r) => r.symbol }, { label: '名称', render: (r) => r.name },
    { label: '现价', render: (r) => r.price }, { label: '涨跌幅%', render: (r) => r.pctChange },
    ...tnCols,
    { label: '关注度', render: (r) => TIERS[r.tier] ?? '基础股' },
    { label: '领域', render: (r) => DOMAINS[r.domain] ?? '-' },
    { label: '标签', render: (r) => (r.tags?.length ? r.tags.join('、') : '-') },
    { label: '加入时间', render: (r) => r.addedAt?.slice(0, 10) },
  ], '自选股为空。');
  const cloud = v.tagCloud?.length
    ? `\n标签统计：${v.tagCloud.map((t) => `${t.tag}(${t.count})`).join('、')}`
    : '';
  return body + cloud + '\n最新涨跌幅%：最新价相对上一交易日收盘（当日涨跌）。\nT-n%：最新价相对 T-(n+1) 日收盘的累计涨跌幅（如 T-1 为近 2 个交易日累计，T-10 为近 11 个交易日累计）。';
}

function renderPortfolio(v) {
  return renderList(v, '持仓', [
    { label: '代码', render: (r) => r.symbol }, { label: '名称', render: (r) => r.name },
    { label: '持股', render: (r) => r.shares }, { label: '成本价', render: (r) => r.costPrice },
    { label: '现价', render: (r) => r.price }, { label: '最新涨跌幅', render: (r) => (r.pctChange == null ? '-' : `${r.pctChange >= 0 ? '+' : ''}${r.pctChange}%`) },
    { label: '市值', render: (r) => r.marketValue },
    { label: '盈亏', render: (r) => r.pnl }, { label: '盈亏%', render: (r) => r.pnlPct },
  ], '持仓为空。');
}

function renderAlerts(v) {
  return renderList(v, '预警规则', [
    { label: 'ID', render: (r) => r.id }, { label: '代码', render: (r) => r.symbol },
    { label: '名称', render: (r) => r.name }, { label: '条件', render: (r) => r.condition },
    { label: '阈值', render: (r) => r.value },
    { label: '状态', render: (r) => (r.triggered ? '已触发' : r.enabled ? '监控中' : '停用') },
    { label: '最近触发', render: (r) => (r.lastTriggeredAt ? r.lastTriggeredAt.slice(0, 16).replace('T', ' ') : '-') },
  ], '预警规则为空。');
}

function renderNews(v) {
  if (v.error) return `HiTrading 资讯查询失败：${v.error}`;
  const items = v.items ?? [];
  if (!items.length) return '未查询到资讯。';
  const lines = items.map((n, i) => `${i + 1}. [${n.date ?? n.showTime ?? ''}] ${n.title ?? n.summary}`).join('\n');
  return `${v.title}（${items.length} 条）：\n${lines}`;
}

function renderBacktest(v) {
  if (v.error) return `HiTrading 回测失败：${v.error}`;
  const f = (n) => (n == null ? '-' : n);
  const lines = [
    `## 回测结果：${v.symbol} · ${v.label}`,
    `初始资金 ${f(v.initial)}，期末 ${f(v.final)}，总收益 ${f(v.totalReturnPct)}%，年化 ${f(v.annualizedPct)}%。`,
    `最大回撤 ${f(v.maxDrawdownPct)}%，夏普 ${f(v.sharpe)}，交易 ${f(v.tradeCount)} 笔，胜率 ${f(v.winRate)}%。`,
  ];
  if (v.trades?.length) {
    lines.push('最近交易：');
    lines.push(toTable(v.trades, [
      { label: '买入日', render: (t) => t.buyDate }, { label: '卖出日', render: (t) => t.sellDate },
      { label: '买入价', render: (t) => t.buyPrice }, { label: '卖出价', render: (t) => t.sellPrice },
      { label: '盈亏%', render: (t) => t.pnlPct },
    ]));
  }
  lines.push('以上为历史数据回测，不构成投资建议，未来表现不可预知。');
  return lines.join('\n');
}

// ---------- apply ----------
export function apply(ctx) {
  const store = openStore();
  ctx.effect(() => () => { weiboDisposed = true; store.close(); });
  const tables = {
    watchlist: store.table('watchlist'),
    positions: store.table('positions'),
    alerts: store.table('alerts'),
    powerful: store.table('powerful'),   // 强势股按日缓存
    weibo: store.table('weibo'),         // 微博股票提取标记
  };

  // 微博「提取股票」：用会话默认模型解析微博正文里的 A股标的
  const pickModel = () => {
    const def = ctx.get('agentDefaultModel');
    const sel = def && typeof def.currentSelection === 'function' ? def.currentSelection() : null;
    if (sel?.provider && sel?.model) return { provider: sel.provider, model: sel.model };
    const provider = (ctx.llm.listProviders() || [])[0];
    if (!provider) throw new Error('没有可用的模型 Provider');
    const model = (ctx.llm.listModels(provider.id) || [])[0];
    if (!model) throw new Error(`Provider ${provider.id} 没有可用模型`);
    return { provider: provider.id, model: model.id };
  };

  const llmText = async ({ system, user, maxTokens = 1500 }) => {
    const route = pickModel();
    let text = '';
    let finish = null;
    const stream = ctx.llm.stream({
      provider: route.provider,
      model: route.model,
      maxTokens,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
      purpose: 'hitrading-weibo-extract',
    });
    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') text += chunk.text;
      else if (chunk.type === 'finish') finish = chunk.reason;
    }
    if (finish?.kind === 'error') throw new Error(`模型调用失败：${finish.failure?.message || finish.failure?.code || '未知错误'}`);
    if (finish?.kind === 'max-tokens') throw new Error('模型输出超过上限被截断，请减小 batch 后重试');
    if (finish?.kind === 'aborted') throw new Error('模型调用被取消');
    if (!text.trim()) throw new Error('模型没有返回内容');
    return text;
  };

  const EXTRACT_SYSTEM = [
    '你是 A股标的抽取器。输入是若干条微博，每条带 id。',
    '任务：找出每条微博明确提到的 A股上市公司（沪深京主板/创业板/科创板/北交所股票、A股上市 ETF）。',
    '规则：',
    '1. 只提取明确指代上市公司或 A股 ETF 的名称/代码；板块、行业、概念、指数、海外公司、港股、美股都不要。',
    '2. 名称要写公司常用简称（如“君正股份”），有 6 位代码就填 code，不确定就省略 code。',
    '3. 同一条微博里重复出现的同一家公司只保留一次。',
    '4. 没有任何股票时给空数组。',
    '只输出 JSON，不要解释、不要 Markdown。格式：',
    '{"items":[{"id":"微博id","stocks":[{"code":"600519","name":"贵州茅台"}]}]}',
  ].join('\n');

  // ----- 微博提取：后台任务 -----
  const WEIBO_TASK_KEY = 'task:current';
  let weiboTask = null;
  let weiboDisposed = false;

  const saveWeiboTask = (t) => {
    weiboTask = t;
    try { tables.weibo.put(WEIBO_TASK_KEY, t); } catch { /* 持久化失败不影响运行 */ }
    return t;
  };
  const loadWeiboTask = () => {
    try { return tables.weibo.get(WEIBO_TASK_KEY) || null; } catch { return null; }
  };
  const mergeStocks = (base, extra) => {
    const m = new Map((base || []).map((x) => [x.code, x]));
    for (const x of extra || []) if (!m.has(x.code)) m.set(x.code, x);
    return [...m.values()];
  };

  // 上次任务因宿主重启中断：标记为 interrupted，避免永远显示「进行中」
  {
    const stale = loadWeiboTask();
    if (stale?.status === 'running') {
      saveWeiboTask({ ...stale, status: 'interrupted', error: '宿主重启导致任务中断', finishedAt: new Date().toISOString() });
    }
  }

  const runWeiboTask = async ({ batch = 20, maxBatches = 20 } = {}) => {
    const id = `w${Date.now()}`;
    saveWeiboTask({
      id, status: 'running', batch, maxBatches,
      processed: 0, batches: 0, withStocks: 0,
      added: [], updated: [], remaining: null,
      startedAt: new Date().toISOString(), finishedAt: null, error: null,
    });
    try {
      for (let i = 0; i < maxBatches; i++) {
        if (weiboDisposed) throw new Error('插件已卸载，任务终止');
        if (weiboTask.cancelRequested) { weiboTask.status = 'cancelled'; break; }
        const runBatch = async (size) => extractStocksFromWeibos({
          batch: size,
          tables,
          analyze: async ({ items, pending }) => {
            const payload = items.map((w) => `[${w.id}] @${w.screenName}：${w.text}`).join('\n');
            return llmText({
              system: EXTRACT_SYSTEM,
              user: `共 ${items.length} 条微博需要抽取（还有 ${pending} 条待处理）：\n${payload}`,
              // 每条微博可能抽出多只股票：按 260 token/条 预留，上限 8000
              maxTokens: Math.min(8000, 800 + items.length * 260),
            });
          },
        });
        // 单批失败（如模型输出异常）：减半重试一次，仍失败则记录后继续后面的批次
        let r;
        let lastErr = null;
        for (const size of [batch, Math.max(3, Math.ceil(batch / 2))]) {
          try { r = await runBatch(size); lastErr = null; break; }
          catch (e) { lastErr = e; }
        }
        if (!r) {
          weiboTask.failedBatches = (weiboTask.failedBatches || 0) + 1;
          weiboTask.lastError = errMsg(lastErr);
          saveWeiboTask(weiboTask);
          if (weiboTask.failedBatches >= 3) throw new Error(`连续 ${weiboTask.failedBatches} 批失败：${weiboTask.lastError}`);
          continue;
        }
        if (!r.processed) { weiboTask.note = r.message || '没有新的微博需要提取'; break; }
        weiboTask.processed += r.processed;
        weiboTask.batches += 1;
        weiboTask.withStocks += r.withStocks || 0;
        weiboTask.added = mergeStocks(weiboTask.added, r.added);
        weiboTask.updated = mergeStocks(weiboTask.updated, r.updated);
        weiboTask.remaining = r.pendingLeft ?? null;
        saveWeiboTask(weiboTask);
        if (!r.pendingLeft) break;
      }
      if (weiboTask.status === 'running') weiboTask.status = 'done';
    } catch (e) {
      weiboTask.status = 'error';
      weiboTask.error = errMsg(e);
    } finally {
      weiboTask.finishedAt = new Date().toISOString();
      delete weiboTask.cancelRequested;
      saveWeiboTask(weiboTask);
      ctx.logger.info(`[HiTrading] 微博提取任务结束：${weiboTask.status}，共处理 ${weiboTask.processed} 条`);
    }
  };

  const weiboOps = {
    // 提取任务状态（Host 侧持有：脱离 HTTP 请求生命周期，离开页面/切 Tab 不中断）
    'weibo.extract': async (args = {}) => {
      if (weiboTask?.status === 'running') {
        return { ...weiboTask, alreadyRunning: true, message: '提取任务已在后台运行' };
      }
      void runWeiboTask({
        batch: Math.min(50, Math.max(1, Number(args.batch) || 20)),
        maxBatches: Math.min(50, Math.max(1, Number(args.maxBatches) || 20)),
      });
      // runWeiboTask 在首个 await 前已同步置为 running
      return { ...weiboTask, message: '提取任务已启动（后台运行，离开页面不会中断）' };
    },
    'weibo.task': async () => weiboTask || loadWeiboTask() || { status: 'idle' },
    'weibo.cancel': async () => {
      if (weiboTask?.status !== 'running') return { ...(weiboTask || { status: 'idle' }), message: '当前没有运行中的任务' };
      weiboTask.cancelRequested = true;
      saveWeiboTask(weiboTask);
      return { ...weiboTask, message: '已请求停止，当前批次结束后退出' };
    },
    'weibo.stats': async (args = {}) => weiboExtractStats({ tables, sample: Number(args.sample) || 50 }),
  };

  ctx.systemPrompt.section({ name: 'hitrading:disclaimer', order: 9000, text: DISCLAIMER });

  // 客户端面板使用的鉴权 HTTP 路由（同源 /api/hitrading）
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/hitrading',
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      try {
        let op;
        let args;
        if (request.method === 'GET') {
          const url = new URL(request.url);
          op = url.searchParams.get('op');
          args = Object.fromEntries(url.searchParams.entries());
          delete args.op;
          for (const k of Object.keys(args)) {
            const v = args[k];
            if (v === '') { delete args[k]; continue; }
            if (/^-?\d+(\.\d+)?$/.test(v)) args[k] = Number(v);
            else if (v === 'true') args[k] = true;
            else if (v === 'false') args[k] = false;
          }
          if (args.symbols !== undefined && !Array.isArray(args.symbols)) {
            args.symbols = String(args.symbols).split(',').filter(Boolean);
          }
        } else {
          const body = await request.json().catch(() => ({}));
          op = body.op;
          args = body.args ?? body;
          if (body.op) delete args.op;
        }
        if (op === 'skill.doc') {
          const content = await readFile(SKILL_PATH, 'utf8');
          return Response.json({ ok: true, value: { path: 'skills/hitrading/SKILL.md', content } });
        }
        // 服务状态与启停（面板头部按钮）
        if (op && Object.prototype.hasOwnProperty.call(serviceOps, op)) {
          return Response.json({ ok: true, value: await serviceOps[op]() });
        }
        // 微博提取需要 Host 的模型通道（独立 8099 服务不支持）
        if (op && Object.prototype.hasOwnProperty.call(weiboOps, op)) {
          return Response.json({ ok: true, value: await weiboOps[op](args) });
        }
        const value = await runOp(op, args, tables);
        return Response.json({ ok: true, value });
      } catch (e) {
        return Response.json({ ok: false, error: errMsg(e) }, { status: 400 });
      }
    },
  }), 'hitrading: api route');

  // 1) 行情
  ctx.tools.register(defineTool({
    name: 'hitrading_quote',
    description: '查询沪深 A股/场内基金(ETF)实时行情（现价、涨跌幅、市盈率、市净率、市值、换手率等）。入参为 6 位代码数组（股票或 ETF），一次可查多只。',
    parameters: { symbols: { type: 'array', required: true, items: { type: 'string' }, description: '6 位 A股代码数组，如 ["600519","000001","300750"]' } },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderQuotes(v) }] },
    execute: (args) => runOp('quote', args, tables),
    presentCall: (a) => ({ card: 'generic', title: 'A股行情查询', rawInput: a.symbols }),
  }));

  // 2) K线
  ctx.tools.register(defineTool({
    name: 'hitrading_kline',
    description: '获取单只 A股的历史 K线（日线/周线/月线或分钟线），用于走势判断与技术分析。返回开高低收与成交量。',
    parameters: {
      symbol: { type: 'string', required: true, description: '6 位 A股代码，如 600519' },
      period: { type: 'string', enum: ['day', 'week', 'month', 'm5', 'm15', 'm30', 'm60'], description: '周期：day 日线，week 周线，month 月线，m5/m15/m30/m60 分钟线；默认 day' },
      limit: { type: 'integer', description: '返回条数，1~1000，默认 60' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderKline(v) }] },
    execute: (args) => runOp('kline', args, tables),
    presentCall: (a) => ({ card: 'generic', title: 'A股K线', rawInput: { symbol: a.symbol, period: a.period } }),
  }));

  // 3) 分析
  ctx.tools.register(defineTool({
    name: 'hitrading_analysis',
    description: '对单只 A股做技术与基本面概览：计算 MA/MACD/RSI/KDJ 关键指标并结合现价、估值给出数值化解读。结果仅描述现状，不构成买卖建议。',
    parameters: { symbol: { type: 'string', required: true, description: '6 位 A股代码，如 600519' } },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderAnalysis(v) }] },
    execute: (args) => runOp('analysis', args, tables),
    presentCall: (a) => ({ card: 'generic', title: 'A股个股分析', rawInput: { symbol: a.symbol } }),
  }));

  // 4) 选股
  ctx.tools.register(defineTool({
    name: 'hitrading_screen',
    description: '按成交额/涨跌幅/换手率/市值等对全市场 A股排序，并可叠加市盈率、市值、涨跌幅、换手率等区间过滤，返回匹配股票列表。',
    parameters: {
      sort: { type: 'string', enum: ['amount', 'changepercent', 'turnoverratio', 'mktcap'], description: '排序字段：amount=成交额，changepercent=涨跌幅，turnoverratio=换手率，mktcap=总市值；默认 amount' },
      limit: { type: 'integer', description: '最多返回条数，1~300，默认 30' },
      peMin: { type: 'number', description: '市盈率下限（>0）' }, peMax: { type: 'number', description: '市盈率上限' },
      mcapMinYi: { type: 'number', description: '总市值下限（亿元）' }, mcapMaxYi: { type: 'number', description: '总市值上限（亿元）' },
      pctMin: { type: 'number', description: '涨跌幅下限（%）' }, pctMax: { type: 'number', description: '涨跌幅上限（%）' },
      turnoverMin: { type: 'number', description: '换手率下限（%）' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderScreens(v) }] },
    execute: (args) => runOp('screen', args, tables),
    presentCall: (a) => ({ card: 'generic', title: 'A股选股筛选', rawInput: a }),
  }));

  // 5) 市场量能
  ctx.tools.register(defineTool({
    name: 'hitrading_market_energy',
    description: '查询沪深京三市日成交额（亿元）与主要指数当日涨跌幅：返回最近 20/40/60 个交易日的成交额序列、5 日均额、区间最高/最低、量能状态（放量/平量/缩量）。',
    parameters: {
      days: { type: 'integer', enum: [20, 40, 60], description: '统计区间交易日数：20（默认）/40/60' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderEnergy(v) }] },
    execute: (args) => runOp('energy', args, tables),
    presentCall: () => ({ card: 'generic', title: '市场量能' }),
  }));

  // 6) 自选
  ctx.tools.register(defineTool({
    name: 'hitrading_watchlist',
    description: '管理自选股：加入、移除、查看（含实时行情），可为每只设置关注度（基础股/精选股/交易股，默认基础股）、领域分类（大金融/消费/周期/科技，单选，默认空）与多个标签（如 ["白酒","核心资产"]），并可按关注度、领域或标签筛选。',
    parameters: {
      action: { type: 'string', required: true, enum: ['add', 'remove', 'list', 'set-tier', 'set-tags', 'set-domain'], description: 'add 加入 / remove 移除 / list 查看 / set-tier 设置关注度 / set-tags 设置标签 / set-domain 设置领域分类' },
      symbols: { type: 'array', items: { type: 'string' }, description: '6 位 A股代码数组（add/remove/set-tier/set-tags/set-domain 时必填）' },
      tier: { type: 'string', enum: ['basic', 'selected', 'trading'], description: '关注度：basic 基础股（默认）/ selected 精选股 / trading 交易股；add 与 set-tier 可用' },
      domain: { type: 'string', enum: ['finance', 'consumer', 'cyclical', 'tech'], description: '领域分类（单选）：finance 大金融 / consumer 消费 / cyclical 周期 / tech 科技；add 与 set-domain 可用，set-domain 传空清除' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签数组（每只最多 10 个，单个≤12字）：add 时随新增写入；set-tags 时全量替换' },
      tag: { type: 'string', description: 'list 时按单个标签过滤，如 tag=白酒' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderWatchlist(v) }] },
    execute: ({ action, symbols, tier, domain, tags, tag }) => runOp(
      action === 'set-tier' ? 'watchlist.setTier' : action === 'set-domain' ? 'watchlist.setDomain' : action === 'set-tags' ? 'watchlist.setTags' : `watchlist.${action}`,
      { symbols, tier, domain, tags, tag },
      tables,
    ),
    presentCall: (a) => ({ card: 'generic', title: '自选股管理', rawInput: a }),
  }));

  // 7) 强势股
  ctx.tools.register(defineTool({
    name: 'hitrading_powerful',
    description: '查询强势股：指定交易日（默认最新交易日）全市场涨幅超过 7% 的股票（含涨停连板、行业板块、最新涨跌），并返回最近 10 个交易日每天的强势股数量。历史日期首次查询会扫描全市场日K（约 20 秒）并缓存。',
    parameters: {
      date: { type: 'string', description: '交易日 YYYY-MM-DD（可选，默认最新交易日；仅支持最近 10 个交易日）' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderPowerful(v) }] },
    execute: (args) => runOp('powerful', args, tables),
    presentCall: (a) => ({ card: 'generic', title: '强势股', rawInput: a.date || '最新交易日' }),
  }));

  // 8) 微博监控
  ctx.tools.register(defineTool({
    name: 'hitrading_weibo',
    description: '微博监控：action=list 查询已入库微博（按时间倒序，支持博主/关键词/近 N 天过滤，带点赞/评论/转发数）；action=extract 用模型解析未提取微博里的 A股标的并写入自选（已存在则只更新最后提及时间，已提取过的微博不重复处理）。需本地已运行 Weibo Crawler 服务（默认 127.0.0.1:15001）。',
    parameters: {
      action: { type: 'string', enum: ['list', 'extract', 'task', 'cancel'], description: 'list 查看（默认）/ extract 启动提取任务 / task 查询任务进度 / cancel 停止任务' },
      page: { type: 'integer', description: '页码，默认 1' },
      pageSize: { type: 'integer', description: '每页条数 1~50，默认 30' },
      userId: { type: 'string', description: '按博主 user_id 过滤（可选）' },
      keyword: { type: 'string', description: '关键词过滤（可选）' },
      days: { type: 'integer', description: '只看最近 N 天（可选）' },
      batch: { type: 'integer', description: 'extract 时本次处理条数 1~50，默认 20' },
      debug: { type: 'boolean', description: 'extract 时返回模型原始输出，用于排查解析问题' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderWeibo(v) }] },
    execute: (args) => {
      if (args.action === 'extract' || args.action === 'task' || args.action === 'cancel') {
        return weiboOps[`weibo.${args.action}`](args);
      }
      return getWeibos(args, tables);
    },
    presentCall: (a) => ({ card: 'generic', title: '微博监控', rawInput: a }),
  }));

  // 9) 持仓
  ctx.tools.register(defineTool({
    name: 'hitrading_portfolio',
    description: '管理本地持仓：记录持股数与成本价，查看实时市值与盈亏。数据持久化在本机，不连接券商。',
    parameters: {
      action: { type: 'string', required: true, enum: ['add', 'remove', 'list'], description: 'add 建仓 / remove 清仓 / list 查看' },
      symbol: { type: 'string', description: '6 位 A股代码（add/remove 时必填）' },
      shares: { type: 'integer', description: '持股数量（股，add 时必填）' },
      costPrice: { type: 'number', description: '成本价（元，add 时必填）' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderPortfolio(v) }] },
    execute: ({ action, symbol, shares, costPrice }) => runOp(`portfolio.${action}`, { symbol, shares, costPrice }, tables),
    presentCall: (a) => ({ card: 'generic', title: '持仓管理', rawInput: a }),
  }));

  // 10) 资讯
  ctx.tools.register(defineTool({
    name: 'hitrading_news',
    description: '获取 A股资讯：快讯（news）、个股公告（announcement，需代码）、龙虎榜（lhb，全市场最近交易日）。',
    parameters: {
      type: { type: 'string', required: true, enum: ['news', 'announcement', 'lhb'], description: '类型：news 快讯 / announcement 公告 / lhb 龙虎榜' },
      symbol: { type: 'string', description: '6 位 A股代码，announcement 类型可选填（不填查全部公告）' },
      count: { type: 'integer', description: '返回条数，默认 20，上限 50' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderNews(v) }] },
    execute: (args) => runOp('news', args, tables),
    presentCall: (a) => ({ card: 'generic', title: 'A股资讯', rawInput: a }),
  }));

  // 11) 回测
  ctx.tools.register(defineTool({
    name: 'hitrading_backtest',
    description: '对单只 A股跑内置量化策略回测（双均线 / MACD / RSI 超买超卖），输出收益、回撤、夏普、胜率与最近交易。纯本地计算。',
    parameters: {
      symbol: { type: 'string', required: true, description: '6 位 A股代码' },
      strategy: { type: 'string', required: true, enum: Object.keys(strategies), description: `策略：${Object.entries(strategies).map(([k, s]) => `${k}=${s.label}`).join('，')}` },
      limit: { type: 'integer', description: '回看 K线条数（日线），默认 250（约 1 年）' },
      initial: { type: 'number', description: '初始资金，默认 100000' },
      fast: { type: 'integer', description: 'ma_cross 快线周期，默认 5' },
      slow: { type: 'integer', description: 'ma_cross 慢线周期，默认 20' },
      rsiLow: { type: 'integer', description: 'rsi_reversal 超卖阈值，默认 30' },
      rsiHigh: { type: 'integer', description: 'rsi_reversal 超买阈值，默认 70' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderBacktest(v) }] },
    execute: (args) => runOp('backtest', args, tables),
    presentCall: (a) => ({ card: 'generic', title: 'A股策略回测', rawInput: { symbol: a.symbol, strategy: a.strategy } }),
  }));

  // 12) 预警
  ctx.tools.register(defineTool({
    name: 'hitrading_alert',
    description: '管理预警规则：创建、查看、删除。规则可设价格/涨跌幅阈值（GUI 内提醒，见后续定时器）。',
    parameters: {
      action: { type: 'string', required: true, enum: ['create', 'list', 'delete'], description: 'create 创建 / list 查看 / delete 删除' },
      symbol: { type: 'string', description: '6 位 A股代码（create 时必填）' },
      condition: { type: 'string', enum: ['price_above', 'price_below', 'pct_above', 'pct_below'], description: '条件：price_above 高于价 / price_below 低于价 / pct_above 涨幅高于 / pct_below 涨幅低于' },
      value: { type: 'number', description: '阈值（价格元或涨跌幅%）' },
      id: { type: 'string', description: '创建时返回的规则 ID（delete 时必填）' },
    },
    output: { schema: { type: 'json' }, render: (_a, v) => [{ type: 'text', text: renderAlerts(v) }] },
    execute: ({ action, symbol, condition, value, id }) => runOp(`alerts.${action}`, { symbol, condition, value, id }, tables),
    presentCall: (a) => ({ card: 'generic', title: '预警管理', rawInput: a }),
  }));

  // 预警定时器：每 60s 检查启用中的规则（交易时段内）
  ctx.effect(() => {
    const inTradingHours = () => {
      const now = new Date();
      const day = now.getDay();
      if (day === 0 || day === 6) return false;
      const m = now.getHours() * 60 + now.getMinutes();
      return m >= 9 * 60 + 25 && m <= 15 * 60 + 5;
    };
    const check = async () => {
      if (!inTradingHours()) return;
      const enabled = [...tables.alerts.entries()].map(([, r]) => r).filter((r) => r.enabled);
      if (enabled.length === 0) return;
      try {
        const { quotes } = await getQuotes(normalizeSymbols([...new Set(enabled.map((r) => r.symbol))]));
        const qmap = new Map(quotes.map((q) => [q.code, q]));
        for (const r of enabled) {
          const q = qmap.get(r.symbol);
          if (!q || q.price == null) continue;
          let nowTriggered = false;
          if (r.condition === 'price_above') nowTriggered = q.price >= r.value;
          else if (r.condition === 'price_below') nowTriggered = q.price <= r.value;
          else if (r.condition === 'pct_above') nowTriggered = q.pctChange != null && q.pctChange >= r.value;
          else if (r.condition === 'pct_below') nowTriggered = q.pctChange != null && q.pctChange <= r.value;
          if (nowTriggered && !r.triggered) {
            await tables.alerts.update(r.id, (cur) => ({ ...cur, triggered: true, lastTriggeredAt: new Date().toISOString() }));
            ctx.logger.info(`[HiTrading] 预警触发：${r.name}(${r.symbol}) ${r.condition} ${r.value}`);
          } else if (!nowTriggered && r.triggered) {
            await tables.alerts.update(r.id, (cur) => ({ ...cur, triggered: false }));
          }
        }
      } catch (e) {
        ctx.logger.warn(`[HiTrading] 预警检查失败：${errMsg(e)}`);
      }
    };
    const dispose = ctx.timer.interval(() => { void check(); }, 60_000);
    void check();
    return dispose;
  });

  // ---------- 独立 HTTP 服务：可启停的托管 ----------
  const SERVICE_PORT = Number(process.env.HITRADING_PORT || 8099);
  let svcChild = null;
  let svcStartedAt = null;
  let svcLastExit = null;

  const relayStream = (stream, level) => {
    if (!stream) return;
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split('\n')) {
        const text = line.trim();
        if (text) ctx.logger[level](`[HiTrading·服务] ${text}`);
      }
    });
  };

  function svcSpawn() {
    if (svcChild && svcChild.exitCode === null && !svcChild.killed) return;
    try {
      const c = spawn(process.execPath, [SERVER_PATH], {
        env: { ...process.env, HITRADING_PARENT_PID: String(process.pid) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      svcChild = c;
      svcStartedAt = new Date().toISOString();
      relayStream(c.stdout, 'info');
      relayStream(c.stderr, 'warn');
      c.on('error', (e) => ctx.logger.warn(`[HiTrading] 外部 HTTP 服务错误：${errMsg(e)}`));
      c.on('exit', (code) => {
        svcLastExit = { code, at: new Date().toISOString() };
        if (svcChild === c) svcChild = null;
        ctx.logger.warn(`[HiTrading] 外部 HTTP 服务已退出（code=${code}）。`);
      });
    } catch (e) {
      ctx.logger.warn(`[HiTrading] 外部 HTTP 服务启动失败：${errMsg(e)}`);
    }
  }

  function svcKill() {
    const c = svcChild;
    svcChild = null;
    if (c) {
      try { c.kill(); } catch { /* 已退出 */ }
    }
  }

  async function svcProbe() {
    try {
      const res = await fetch(`http://127.0.0.1:${SERVICE_PORT}/health`, { signal: AbortSignal.timeout(800) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function svcStatus() {
    const up = await svcProbe();
    return {
      port: SERVICE_PORT,
      running: up,
      managed: !!(svcChild && svcChild.exitCode === null && !svcChild.killed),
      pid: svcChild && svcChild.exitCode === null ? svcChild.pid : null,
      startedAt: svcStartedAt,
      lastExit: svcLastExit,
    };
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // 插件加载即启动；卸载即关闭
  ctx.effect(() => {
    svcSpawn();
    return () => svcKill();
  });

  // 服务控制：供面板按钮调用（也走同一条 /api/hitrading 路由）
  const serviceOps = {
    'service.status': async () => svcStatus(),
    'service.start': async () => {
      if (await svcProbe()) return { ...(await svcStatus()), message: '服务已在运行' };
      svcSpawn();
      await wait(900);
      return { ...(await svcStatus()), message: '已启动' };
    },
    'service.stop': async () => {
      if (!(svcChild && svcChild.exitCode === null)) {
        const up = await svcProbe();
        return { ...(await svcStatus()), stopped: !up, message: up ? '该服务非插件启动，无法停止' : '服务未运行' };
      }
      svcKill();
      await wait(400);
      return { ...(await svcStatus()), stopped: true, message: '已停止' };
    },
    'service.restart': async () => {
      svcKill();
      await wait(400);
      svcSpawn();
      await wait(900);
      return { ...(await svcStatus()), message: '已重启' };
    },
  };
}