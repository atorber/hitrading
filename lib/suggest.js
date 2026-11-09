// 股票模糊搜索：腾讯 smartbox（按名称/拼音/代码，实测可用）。
// 返回 v_hint="market~code~name~pinyin~type^..."，名称为 \uXXXX 转义；无结果为 "N"。
import { fetchText } from './http.js';

const SMARTBOX_REFERER = 'https://gu.qq.com/';

/** 解码 smartbox 的 \uXXXX 转义名称。 */
function decodeName(s) {
  return String(s).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * 按关键词模糊搜索 A股（名称/拼音/代码前缀均可）。
 * @param {string} keyword 关键词，非空
 * @param {number} count 最多返回条数，默认 8
 * @returns {Promise<Array<{market:string, code:string, name:string, pinyin:string}>>}
 */
export async function suggestStocks(keyword, { count = 8 } = {}) {
  const q = String(keyword || '').trim();
  if (!q) return [];
  const url = `https://smartbox.gtimg.cn/s3/?v=2&q=${encodeURIComponent(q)}&t=all`;
  const text = await fetchText(url, { headers: { Referer: SMARTBOX_REFERER }, decode: 'gbk', timeoutMs: 6000 });
  const m = text.match(/v_hint="(.*)"/s);
  const raw = m ? m[1] : '';
  if (!raw || raw === 'N') return [];
  const out = [];
  for (const entry of raw.split('^')) {
    const f = entry.split('~');
    if (f.length < 5) continue;
    const [market, code, name, pinyin, type] = f;
    // A股 + 场内 ETF：GP-A（主板/创业板）、GP-A-KCB（科创板）、ETF、QDII-ETF；排除指数(ZS)、港股(hk GP)、场外/ LOF/REIT 等其他
    if (!type.startsWith('GP-A') && type !== 'ETF' && type !== 'QDII-ETF') continue;
    out.push({ market: market.toLowerCase(), code, name: decodeName(name), pinyin });
    if (out.length >= count) break;
  }
  return out;
}