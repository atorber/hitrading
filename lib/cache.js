// 极简 TTL 内存缓存：避免短时间重复请求被数据源限流。
export class TtlCache {
  constructor() {
    this.map = new Map();
  }
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expireAt) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }
  set(key, value, ttlMs) {
    this.map.set(key, { value, expireAt: Date.now() + ttlMs });
  }
  clear() {
    this.map.clear();
  }
}