// 回测引擎 + 内置策略库。纯本地计算，100 股整数倍成交，含手续费。
import { ma, macd, rsi } from './indicators.js';

/** 计算 max drawdown（按权益曲线）。 */
function maxDrawdown(equity) {
  let peak = equity[0];
  let mdd = 0;
  for (const v of equity) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > mdd) mdd = dd;
  }
  return mdd;
}

/** 由权益曲线算年化收益、最大回撤、夏普。 */
function metrics(initial, equity) {
  const returns = [];
  for (let i = 1; i < equity.length; i++) {
    const prev = equity[i - 1];
    if (prev > 0) returns.push((equity[i] - prev) / prev);
  }
  const finalRaw = equity[equity.length - 1];
  const totalReturn = initial > 0 ? (finalRaw - initial) / initial : 0;
  const mdd = maxDrawdown(equity);
  let sharpe = null;
  if (returns.length > 2) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);
    if (std > 0) sharpe = +( (mean / std) * Math.sqrt(252) ).toFixed(2);
  }
  const years = equity.length / 252;
  const annualized = years > 0 ? +(( (1 + totalReturn) ** (1 / years) - 1) * 100).toFixed(2) : null;
  return { final: +finalRaw.toFixed(2), totalReturnPct: +(totalReturn * 100).toFixed(2), annualizedPct: annualized, maxDrawdownPct: +(mdd * 100).toFixed(2), sharpe };
}

/** 内置策略库：compute(bars, params) 返回逐 bar 持仓状态（1 持多 / -1 空仓 / 0 观望或数据不足）。 */
export const strategies = {
  ma_cross: {
    label: '双均线交叉',
    params: { fast: { type: 'integer', default: 5 }, slow: { type: 'integer', default: 20 } },
    compute(bars, p) {
      const closes = bars.map((b) => b.close);
      const fast = ma(closes, p.fast);
      const slow = ma(closes, p.slow);
      return closes.map((_, i) => {
        if (fast[i] == null || slow[i] == null) return 0;
        return fast[i] > slow[i] ? 1 : -1;
      });
    },
  },
  macd_cross: {
    label: 'MACD 柱体方向',
    params: {},
    compute(bars) {
      const closes = bars.map((b) => b.close);
      const { hist } = macd(closes);
      return closes.map((_, i) => {
        if (hist[i] == null) return 0;
        return hist[i] > 0 ? 1 : -1;
      });
    },
  },
  rsi_reversal: {
    label: 'RSI 超买超卖',
    params: { low: { type: 'integer', default: 30 }, high: { type: 'integer', default: 70 } },
    compute(bars, p) {
      const closes = bars.map((b) => b.close);
      const r = rsi(closes, 14);
      return closes.map((_, i) => {
        if (r[i] == null) return 0;
        if (r[i] < p.low) return 1;
        if (r[i] > p.high) return -1;
        return 0;
      });
    },
  },
};

/**
 * 运行回测。
 * @param {Array<{date,open,high,low,close,volume}>} bars
 * @param {string} strategyName
 * @param {Record<string,number>} params
 */
export function runBacktest(bars, strategyName, params = {}, { initial = 100000, feeRate = 0.0003 } = {}) {
  const strat = strategies[strategyName];
  if (!strat) throw new Error(`未知策略 ${strategyName}，可选：${Object.keys(strategies).join(', ')}`);
  // 合并策略默认参数（compute 依赖 fast/slow/low/high）
  const effective = {};
  for (const [k, spec] of Object.entries(strat.params || {})) {
    effective[k] = params[k] != null ? Number(params[k]) : spec.default;
  }
  const signals = strat.compute(bars, effective);
  let cash = initial;
  let shares = 0;
  let entryPrice = 0;
  let entryDate = '';
  const equity = [];
  const trades = [];

  for (let i = 0; i < bars.length; i++) {
    const price = bars[i].close;
    const sig = signals[i];
    if (sig === 1 && shares === 0 && price > 0) {
      // 全仓买入，100 股整数倍
      const lots = Math.floor((cash * (1 - feeRate)) / price / 100) * 100;
      if (lots > 0) {
        shares = lots;
        cash -= shares * price * (1 + feeRate);
        entryPrice = price;
        entryDate = bars[i].date;
      }
    } else if (sig === -1 && shares > 0 && price > 0) {
      cash += shares * price * (1 - feeRate);
      const pnl = (price - entryPrice) * shares;
      trades.push({
        buyDate: entryDate,
        buyPrice: +entryPrice.toFixed(3),
        sellDate: bars[i].date,
        sellPrice: +price.toFixed(3),
        shares,
        pnl: +pnl.toFixed(2),
        pnlPct: entryPrice > 0 ? +(((price - entryPrice) / entryPrice) * 100).toFixed(2) : 0,
      });
      shares = 0;
      entryPrice = 0;
      entryDate = '';
    }
    equity.push(cash + shares * price);
  }

  const m = metrics(initial, equity);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl <= 0).length;
  return {
    strategy: strategyName,
    label: strat.label,
    params,
    initial,
    ...m,
    tradeCount: trades.length,
    winRate: trades.length ? +((wins / trades.length) * 100).toFixed(2) : null,
    trades: trades.slice(-30),
    holdingShares: shares,
    equityCurve: equity,
    barCount: bars.length,
  };
}