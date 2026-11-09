// 实时行情：腾讯主源，新浪兜底。统一输出结构。
import { fetchText } from './http.js';

const TENCENT_REFERER = 'https://finance.qq.com/';
const SINA_REFERER = 'https://finance.sina.com.cn/';

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 解析腾讯 quote 行为统一结构。 */
function parseTencent(line) {
  const m = line.match(/v_(\w+)="(.*)"/);
  if (!m) return null;
  const p = m[2].split('~');
  if (p.length < 40) return null;
  const price = num(p[3]);
  const prevClose = num(p[4]);
  const change = num(p[31]);
  const pct = num(p[32]);
  return {
    code: p[2],
    name: p[1],
    price,
    prevClose,
    open: num(p[5]),
    high: num(p[33]),
    low: num(p[34]),
    volume: num(p[36]), // 手
    amount: num(p[37]), // 万元
    change,
    pctChange: pct,
    turnover: num(p[38]), // 换手率 %
    pe: num(p[39]), // TTM
    pb: num(p[46]),
    totalMcap: num(p[45]), // 亿元
    floatMcap: num(p[44]), // 亿元
    amplitude: num(p[43]), // 振幅 %
    limitUp: num(p[47]),
    limitDown: num(p[48]),
    time: p[30],
    source: 'tencent',
  };
}

/** 解析新浪 quote 行（兜底，字段较少）。 */
function parseSina(line) {
  const m = line.match(/hq_str_(\w+)="(.*)"/);
  if (!m) return null;
  const p = m[2].split(',');
  if (p.length < 10 || !p[0]) return null;
  const price = num(p[3]);
  const prevClose = num(p[2]);
  const change = price != null && prevClose != null ? +(price - prevClose).toFixed(4) : null;
  const pct = change != null && prevClose ? +((change / prevClose) * 100).toFixed(2) : null;
  return {
    code: m[1].replace(/^(sh|sz|bj)/, ''),
    name: p[0],
    price,
    prevClose,
    open: num(p[1]),
    high: num(p[4]),
    low: num(p[5]),
    volume: num(p[8]) != null ? Math.round(num(p[8]) / 100) : null, // 股→手
    amount: num(p[9]) != null ? +(num(p[9]) / 10000).toFixed(2) : null, // 元→万元
    change,
    pctChange: pct,
    turnover: null,
    pe: null,
    pb: null,
    totalMcap: null,
    floatMcap: null,
    amplitude: null,
    limitUp: null,
    limitDown: null,
    time: `${p[p.length - 3] || ''}${p[p.length - 2] || ''}`,
    source: 'sina',
  };
}

/**
 * 批量实时行情。symbols 为 A股代码数组（见 lib/symbol.js 规范化结果）。
 * @param {Array<{tencent:string, sina:string, code:string}>} symbols
 * @returns {Promise<{quotes:Array, source:string}>}
 */
export async function getQuotes(symbols) {
  const codes = symbols.map((s) => s.tencent);
  const text = await fetchText(`https://qt.gtimg.cn/q=${codes.join(',')}`, {
    headers: { Referer: TENCENT_REFERER },
    decode: 'gbk',
    timeoutMs: 8000,
  });
  const lines = text.split(';').map((s) => s.trim()).filter(Boolean);
  const got = lines.map(parseTencent).filter(Boolean);

  // 若腾讯缺失部分代码，用新浪补齐
  if (got.length < symbols.length) {
    const gotCodes = new Set(got.map((q) => q.code));
    const missing = symbols.filter((s) => !gotCodes.has(s.code));
    const sinaText = await fetchText(`https://hq.sinajs.cn/list=${missing.map((s) => s.sina).join(',')}`, {
      headers: { Referer: SINA_REFERER },
      decode: 'gbk',
      timeoutMs: 8000,
    });
    const sinaGot = sinaText.split('\n').map((s) => s.trim()).filter(Boolean).map(parseSina).filter(Boolean);
    got.push(...sinaGot);
  }
  return { quotes: got, source: got.some((q) => q.source === 'tencent') ? 'tencent(+sina)' : 'sina' };
}