'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const McpClient = require('./mcp-client');
const { token, port, mcpBaseUrl } = require('./config');

if (!token) {
  console.error('[错误] 缺少 MCP Token。请设置环境变量 MCD_MCP_TOKEN，或在 local.config.json 中配置 token（该文件已被 .gitignore 忽略，不会入库）。');
  process.exit(1);
}

const mcp = new McpClient({ token, baseUrl: mcpBaseUrl });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

const PUBLIC_DIR = path.join(__dirname, 'public');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // ---- API ----
  if (p === '/api/health') {
    return sendJSON(res, 200, { ok: true, time: new Date().toISOString() });
  }

  if (p === '/api/login' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      let parsed = {};
      if (body) {
        try {
          parsed = JSON.parse(body);
        } catch (_) {
          parsed = {};
        }
      }
      // 用一次只读调用验证 Token 有效性（真实鉴权在 MCP 服务端，以 Bearer Token 为准）
      const t = await mcp.callTool('now-time-info', {});
      sendJSON(res, 200, {
        ok: true,
        account: parsed.account || '',
        serverTime: (t && t.data && t.data.formatted) || null,
      });
    } catch (e) {
      sendJSON(res, 401, { ok: false, error: e.message });
    }
    return;
  }

  if (p === '/api/tool' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const { name, args } = JSON.parse(body || '{}');
      if (!name) return sendJSON(res, 400, { ok: false, error: '缺少工具名 name' });
      const result = await mcp.callTool(name, args || {});
      sendJSON(res, 200, { ok: true, result });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: e.message });
    }
    return;
  }

  // ---- Static ----
  let pathname = p === '/' ? '/index.html' : p;
  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJSON(res, 403, { error: 'forbidden' });
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`麦当劳优惠点餐一体化平台已启动 → http://localhost:${port}`);
});
