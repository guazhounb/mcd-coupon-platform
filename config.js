'use strict';

/**
 * 配置加载：优先读取环境变量 MCD_MCP_TOKEN，
 * 其次读取本地 gitignore 的 local.config.json（不入库）。
 * 切勿将真实 Token 提交到 GitHub。
 */
const fs = require('fs');
const path = require('path');

function loadToken() {
  if (process.env.MCD_MCP_TOKEN) return process.env.MCD_MCP_TOKEN;
  try {
    const local = path.join(__dirname, 'local.config.json');
    const cfg = JSON.parse(fs.readFileSync(local, 'utf8'));
    if (cfg && cfg.token) return cfg.token;
  } catch (_) {
    /* ignore */
  }
  return '';
}

module.exports = {
  token: loadToken(),
  port: parseInt(process.env.PORT || '3000', 10),
  mcpBaseUrl: process.env.MCD_MCP_BASE_URL || 'https://mcp.mcd.cn',
};
