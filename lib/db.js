// 跨进程共享的持久化存储：SQLite（node:sqlite 内置，Node ≥ 22）。
// Harness 插件与独立 HTTP 服务共用同一份 db，多进程并发安全（WAL + busy_timeout）。
import { DatabaseSync } from 'node:sqlite';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdirSync, existsSync, readFileSync, renameSync, statSync } from 'node:fs';

export function defaultDbPath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'storages', 'hitrading.db');
}

/**
 * 早期版本用 storage-domain 把数据存在同目录的 hitrading.json。
 * 若当前库对应表为空而旧文件有数据，则一次性导入并把旧文件改名为 .migrated（幂等）。
 * @returns {{migrated:boolean, counts?:Record<string,number>}}
 */
export function migrateLegacyJson(dbPath, store) {
  const jsonPath = dbPath.replace(/\.db$/i, '.json');
  if (!existsSync(jsonPath)) return { migrated: false };

  let doc;
  try {
    doc = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch {
    return { migrated: false }; // 坏文件不动它
  }
  const tables = doc && doc.tables;
  if (!tables || typeof tables !== 'object') return { migrated: false };

  const counts = {};
  let total = 0;
  for (const [table, records] of Object.entries(tables)) {
    if (!records || typeof records !== 'object') continue;
    const handle = store.table(table);
    for (const [key, value] of Object.entries(records)) {
      // 不覆盖新库中已有的记录
      if (handle.get(key) !== undefined) continue;
      handle.put(key, value);
      total += 1;
      counts[table] = (counts[table] || 0) + 1;
    }
  }

  if (total > 0) {
    try {
      renameSync(jsonPath, `${jsonPath}.migrated`); // 已完成迁移，避免重复导入
    } catch { /* 改名失败不影响已导入的数据 */ }
  }
  return { migrated: total > 0, counts };
}

/**
 * 打开共享存储，返回与 domain 表同构的接口（使 lib/ops.js 无需改动）。
 * @param {string} [dbPath]
 */
/**
 * 每小时最多做一次一致性快照（hitrading.db.bak），用于误删误改后找回。
 * 用 VACUUM INTO 生成独立副本，包含 WAL 中尚未 checkpoint 的最新写入。
 */
function backupIfStale(db, dbPath) {
  try {
    const bak = `${dbPath}.bak`;
    if (existsSync(bak) && Date.now() - statSync(bak).mtimeMs < 3600_000) return false;
    const escaped = bak.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${escaped}'`);
    return true;
  } catch {
    return false;
  }
}

export function openStore(dbPath = defaultDbPath()) {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL;');
  db.exec(`CREATE TABLE IF NOT EXISTS hitrading_kv (
    table_name TEXT NOT NULL,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    PRIMARY KEY (table_name, key)
  )`);

  const stmt = {
    get: db.prepare('SELECT value FROM hitrading_kv WHERE table_name = ? AND key = ?'),
    put: db.prepare('INSERT INTO hitrading_kv (table_name, key, value) VALUES (?, ?, ?) ON CONFLICT(table_name, key) DO UPDATE SET value = excluded.value'),
    del: db.prepare('DELETE FROM hitrading_kv WHERE table_name = ? AND key = ?'),
    keys: db.prepare('SELECT key FROM hitrading_kv WHERE table_name = ?'),
    entries: db.prepare('SELECT key, value FROM hitrading_kv WHERE table_name = ?'),
    size: db.prepare('SELECT COUNT(*) AS n FROM hitrading_kv WHERE table_name = ?'),
  };

  function table(name) {
    return {
      get(key) {
        const row = stmt.get.get(name, key);
        return row ? JSON.parse(row.value) : undefined;
      },
      put(key, value) {
        stmt.put.run(name, key, JSON.stringify(value));
      },
      delete(key) {
        const r = stmt.del.run(name, key);
        return r.changes > 0;
      },
      keys() {
        return stmt.keys.all(name).map((r) => r.key);
      },
      entries() {
        return stmt.entries.all(name).map((r) => [r.key, JSON.parse(r.value)]);
      },
      get size() {
        return stmt.size.get(name).n;
      },
      update(key, fn) {
        const cur = this.get(key);
        if (cur === undefined) throw new Error(`no record '${key}' in table '${name}'`);
        const next = fn(cur);
        this.put(key, next);
        return next;
      },
    };
  }

  const store = { table, close: () => db.close() };

  // 旧版本数据（storage-domain 的 hitrading.json）一次性迁入当前库
  try {
    const result = migrateLegacyJson(dbPath, store);
    if (result.migrated) {
      const detail = Object.entries(result.counts || {}).map(([t, n]) => `${t}:${n}`).join(', ');
      console.log(`[HiTrading] 已从旧 hitrading.json 迁移数据（${detail}）`);
    }
  } catch (e) {
    console.warn(`[HiTrading] 旧数据迁移失败（不影响新库使用）：${e?.message || e}`);
  }

  backupIfStale(db, dbPath);

  return store;
}