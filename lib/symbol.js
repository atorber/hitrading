// A股代码规范化：600519 / 000001 / sh600519 / 600519.SH → 统一 { code, market, tencent, eastmoneySecid, sina }
const PREFIX_RE = /^(sh|sz|bj)/i;
const SUFFIX_RE = /\.(sh|sz|ss|sz|bj)$/i;

/**
 * 规范化一个 A股代码。
 * @param {string|number} input
 * @returns {{ code: string, market: 'sh'|'sz'|'bj', tencent: string, eastmoneySecid: string, sina: string }}
 */
export function normalizeSymbol(input) {
  let s = String(input).trim().toLowerCase();
  s = s.replace(PREFIX_RE, '').replace(SUFFIX_RE, '').replace(/[^0-9]/g, '');
  if (!/^\d{6}$/.test(s)) throw new Error(`无效的 A股代码: ${input}`);
  const first = s[0];
  const p2 = s.slice(0, 2); // 前两位（深市基金段判断）
  let market;
  if (first === '6' || first === '5' || first === '9') market = 'sh';          // 沪股票 / 5x 场内基金 / 900 B股
  else if (p2 === '15' || p2 === '16') market = 'sz';                          // 深市基金：159 ETF / 150 分级 / 16x LOF
  else if (first === '1') market = 'sh';                                       // 11x 沪可转债
  else if (first === '0' || first === '3' || first === '2') market = 'sz';     // 深股票 / 12x 深可转债
  else if (first === '8' || first === '4') market = 'bj';
  else market = 'sh';
  return {
    code: s,
    market,
    tencent: `${market}${s}`,
    eastmoneySecid: market === 'sh' ? `1.${s}` : `0.${s}`,
    sina: `${market}${s}`,
  };
}

/** @param {Array<string|number>} inputs @returns 去重后的规范化结果数组 */
export function normalizeSymbols(inputs) {
  const seen = new Set();
  const out = [];
  for (const i of inputs) {
    let n;
    try {
      n = normalizeSymbol(i);
    } catch {
      continue; // 跳过无效项
    }
    if (!seen.has(n.sina)) {
      seen.add(n.sina);
      out.push(n);
    }
  }
  return out;
}