// 技术指标：MA / MACD / RSI / KDJ，纯本地计算，输入收盘价序列。

export function ma(values, n) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    out.push(i >= n - 1 ? +(sum / n).toFixed(4) : null);
  }
  return out;
}

export function ema(values, n) {
  const k = 2 / (n + 1);
  const out = [];
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    prev = prev === null ? values[i] : values[i] * k + prev * (1 - k);
    out.push(+(prev).toFixed(4));
  }
  return out;
}

export function macd(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const dif = closes.map((_, i) => +(emaFast[i] - emaSlow[i]).toFixed(4));
  const dea = ema(dif, signal);
  const hist = dif.map((d, i) => +((d - dea[i]) * 2).toFixed(4));
  return { dif, dea, hist };
}

export function rsi(closes, n = 14) {
  const out = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }
    const chg = closes[i] - closes[i - 1];
    const gain = chg > 0 ? chg : 0;
    const loss = chg < 0 ? -chg : 0;
    if (i <= n) {
      avgGain += gain;
      avgLoss += loss;
      if (i === n) {
        avgGain /= n;
        avgLoss /= n;
      } else {
        out.push(null);
        continue;
      }
    } else {
      avgGain = (avgGain * (n - 1) + gain) / n;
      avgLoss = (avgLoss * (n - 1) + loss) / n;
    }
    out.push(avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2));
  }
  return out;
}

export function kdj(highs, lows, closes, n = 9) {
  const K = [];
  const D = [];
  const J = [];
  let k = 50;
  let d = 50;
  for (let i = 0; i < closes.length; i++) {
    const from = Math.max(0, i - n + 1);
    const hh = Math.max(...highs.slice(from, i + 1));
    const ll = Math.min(...lows.slice(from, i + 1));
    const rsv = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    const j = 3 * k - 2 * d;
    K.push(+k.toFixed(2));
    D.push(+d.toFixed(2));
    J.push(+j.toFixed(2));
  }
  return { k: K, d: D, j: J };
}

/** 返回序列末值（null 安全）。 */
export const last = (arr) => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return arr[i];
  return null;
};