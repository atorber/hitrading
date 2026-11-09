// K线：新浪 kline（已实测）。period 支持 day 与分钟。
import { fetchJson } from './http.js';

const SINA_REFERER = 'https://finance.sina.com.cn/';

const PERIOD_SCALE = {
  day: 240,
  week: 1680,
  month: 720,
  m5: 5,
  m15: 15,
  m30: 30,
  m60: 60,
};

/**
 * 获取 K线（前复权/不复权由 sina 决定，当前返回不复权日线）。
 * @param {{sina:string, code:string}} symbol
 * @param {string} period day|week|month|m5|m15|m30|m60
 * @param {number} limit 条数，默认 60，上限 1000
 */
export async function getKline(symbol, { period = 'day', limit = 60 } = {}) {
  const scale = PERIOD_SCALE[period] ?? 240;
  const n = Math.max(1, Math.min(1000, limit | 0));
  const url =
    `https://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_=/CN_MarketDataService.getKLineData` +
    `?symbol=${symbol.sina}&scale=${scale}&ma=no&datalen=${n}`;
  const data = await fetchJson(url, { headers: { Referer: SINA_REFERER }, timeoutMs: 8000 });
  const bars = (Array.isArray(data) ? data : []).map((b) => ({
    date: b.day,
    open: Number(b.open),
    high: Number(b.high),
    low: Number(b.low),
    close: Number(b.close),
    volume: Number(b.volume) || 0, // 股
  }));
  return { symbol: symbol.code, period, bars };
}