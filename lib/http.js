// HTTP 封装：超时、请求头、GBK 解码。纯 Node fetch，无第三方依赖。
import { TextDecoder } from 'node:util';

const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * 抓取文本，可选 GBK 解码。
 * @param {string} url
 * @param {{headers?: Record<string,string>, timeoutMs?: number, decode?: 'utf-8'|'gbk'}} opts
 * @returns {Promise<string>}
 */
export async function fetchText(url, { headers = {}, timeoutMs = 10000, decode = 'utf-8' } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`timeout ${timeoutMs}ms: ${url}`)), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': DEFAULT_UA, Accept: '*/*', ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return new TextDecoder(decode === 'gbk' ? 'gb18030' : 'utf-8').decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

/** 抓取 JSON（假定响应为 UTF-8 JSON）。 */
export async function fetchJson(url, { headers = {}, timeoutMs = 10000 } = {}) {
  const text = await fetchText(url, { headers, timeoutMs, decode: 'utf-8' });
  // 新浪系接口可能带 jsonp 包裹，剥掉 var _= 与尾部分号
  const cleaned = text.replace(/^[^{]*\(/, '').replace(/\);?\s*$/, '');
  return JSON.parse(cleaned);
}