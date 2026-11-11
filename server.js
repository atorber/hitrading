#!/usr/bin/env node
// HiTrading 独立本地 HTTP 服务：任何本机程序（Python/R/脚本）都可调用的 A股接口。
// 与 Harness GUI 共享同一份 SQLite 存储（自选/持仓/预警）。
// 启动：node server.js   配置：HITRADING_PORT / HITRADING_TOKEN / HITRADING_DB
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { getWeibos } from './lib/weibo.js';
import { runOp } from './lib/ops.js';
import { openStore, defaultDbPath } from './lib/db.js';

const SKILL_PATH = new URL('./skills/hitrading/SKILL.md', import.meta.url);

const PORT = Number(process.env.HITRADING_PORT || 8099);
const HOST = process.env.HITRADING_HOST || '127.0.0.1';
const TOKEN = process.env.HITRADING_TOKEN || '';
const DB_PATH = process.env.HITRADING_DB || defaultDbPath();

const store = openStore(DB_PATH);
const tables = {
  watchlist: store.table('watchlist'),
  positions: store.table('positions'),
  alerts: store.table('alerts'),
  powerful: store.table('powerful'),
  weibo: store.table('weibo'),
};

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  });
  res.end(body);
};

function coerce(value) {
  if (value === '' || value == null) return undefined;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return json(res, 204, {});

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // 鉴权（可选）
    if (TOKEN) {
      const auth = req.headers['authorization'] || '';
      const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const supplied = bearer || url.searchParams.get('token');
      if (supplied !== TOKEN) return json(res, 401, { ok: false, error: 'unauthorized' });
    }

    if (url.pathname === '/health') {
      return json(res, 200, { ok: true, value: { service: 'hitrading', time: new Date().toISOString() } });
    }

    // 其他 Agent 可直接拉取 SKILL.md 安装
    if (url.pathname === '/skill.md' || url.pathname === '/skill') {
      const md = await readFile(SKILL_PATH, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      });
      return res.end(md);
    }

    let op;
    let args = {};
    if (req.method === 'POST' && (url.pathname === '/' || url.pathname === '/api')) {
      const body = await readBody(req);
      op = body.op;
      args = body.args ?? {};
    } else if (url.pathname === '/api' || url.pathname === '/') {
      for (const [k, v] of url.searchParams.entries()) {
        if (k === 'op') continue;
        const cv = coerce(v);
        args[k] = cv;
      }
      op = url.searchParams.get('op');
      // symbols 必须始终是数组：单个纯数字代码会被上面的 coerce 变成 number
      if (op && args.symbols !== undefined && !Array.isArray(args.symbols)) {
        args.symbols = String(args.symbols).split(',').filter(Boolean);
      }
    } else {
      return json(res, 404, { ok: false, error: 'not found: use /api?op=<op>&... or POST /api {op, args}' });
    }

    if (!op) return json(res, 400, { ok: false, error: 'missing op' });

    // 微博提取依赖 Harness 的模型通道，独立服务不可用
    if (op === 'weibo.extract') {
      return json(res, 400, { ok: false, error: '微博提取需要使用 Harness 内的面板或 Agent 工具（独立服务没有模型通道）' });
    }
    // weibo 列表附带提取标记
    if (op === 'weibo') return json(res, 200, { ok: true, value: await getWeibos(args, tables) });

    const value = await runOp(op, args, tables);
    return json(res, 200, { ok: true, value });
  } catch (e) {
    return json(res, 400, { ok: false, error: e?.message || String(e) });
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[HiTrading] 端口 ${PORT} 已被占用（服务可能已在运行），本进程退出。`);
    process.exit(0);
  }
  throw err;
});

// 由 Harness 插件 spawn 时，父插件退出/卸载导致父进程消失，本服务应随之退出（避免成孤儿占端口）
const parentPid = Number(process.env.HITRADING_PARENT_PID || 0);
if (parentPid > 0) {
  const watcher = setInterval(() => {
    try {
      process.kill(parentPid, 0); // 信号 0 仅探测进程是否存在
    } catch {
      process.exit(0);
    }
  }, 5000);
  watcher.unref();
}

server.listen(PORT, HOST, () => {
  console.log(`[HiTrading] 本地 HTTP 服务已启动：http://${HOST}:${PORT}`);
  console.log(`[HiTrading] 示例：curl -s "http://${HOST}:${PORT}/api?op=quote&symbols=600519,000001"`);
  console.log(`[HiTrading] 存储：${DB_PATH}${TOKEN ? '（token 鉴权已启用）' : ''}`);
});