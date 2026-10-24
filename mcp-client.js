'use strict';

/**
 * 麦当劳 MCP（mcp.mcd.cn）Streamable HTTP 客户端
 * - 远程托管、无状态：每个请求通过 Bearer Token 鉴权
 * - 初始化握手后调用 tools/call
 * - 优先返回 structuredContent（已解析的 JSON），缺省时回退解析 content[].text
 */

class McpClient {
  constructor({ token, baseUrl = 'https://mcp.mcd.cn', protocolVersion = '2024-11-05' }) {
    this.token = token;
    this.baseUrl = baseUrl;
    this.protocolVersion = protocolVersion;
    this.initialized = false;
    this.sessionId = null;
  }

  _headers(extra = {}) {
    const h = {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.token}`,
    };
    if (this.sessionId) h['Mcp-Session-Id'] = this.sessionId;
    return { ...h, ...extra };
  }

  async _post(body, captureSession = false) {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(body),
    });

    if (captureSession) {
      const sid = res.headers.get('mcp-session-id') || res.headers.get('Mcp-Session-Id');
      if (sid) this.sessionId = sid;
    }

    const ct = res.headers.get('content-type') || '';
    const text = await res.text();

    // 通知类响应（如 notifications/initialized）常为 202 无响应体
    if (!text) return {};

    if (ct.includes('text/event-stream')) {
      return this._parseSSE(text, body.id);
    }
    try {
      return JSON.parse(text);
    } catch (_) {
      return {};
    }
  }

  _parseSSE(text, id) {
    const messages = [];
    for (const block of text.split('\n\n')) {
      for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim();
          try {
            messages.push(JSON.parse(payload));
          } catch (_) {
            /* ignore non-json */
          }
        }
      }
    }
    let msg = messages.find((m) => m.id === id);
    if (!msg && messages.length) msg = messages[messages.length - 1];
    return msg || {};
  }

  async ensureInit() {
    if (this.initialized) return;
    // 部分实现会返回 Mcp-Session-Id；本服务为无状态，但按规范完成握手更稳妥
    await this._post(
      {
        jsonrpc: '2.0',
        id: 'init',
        method: 'initialize',
        params: {
          protocolVersion: this.protocolVersion,
          capabilities: {},
          clientInfo: { name: 'mcd-coupon-platform', version: '1.0.0' },
        },
      },
      true
    );
    await this._post({ jsonrpc: '2.0', method: 'notifications/initialized' });
    this.initialized = true;
  }

  async callTool(name, args = {}) {
    await this.ensureInit();
    const id = `call-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;
    const res = await this._post({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args || {} },
    });

    if (res.error) {
      throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
    }
    const result = res.result || {};
    if (result.isError) {
      const text = result.content && result.content[0] ? result.content[0].text : '未知错误';
      throw new Error(text);
    }
    if (result.structuredContent) return result.structuredContent;
    const text = result.content && result.content[0] ? result.content[0].text : '';
    return this._extractJSON(text);
  }

  _extractJSON(text) {
    if (!text) return { raw: '' };
    const idx = text.lastIndexOf('{"success"');
    if (idx >= 0) {
      try {
        return JSON.parse(text.slice(idx));
      } catch (_) {
        /* fallthrough */
      }
    }
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (_) {
        /* fallthrough */
      }
    }
    return { raw: text };
  }
}

module.exports = McpClient;
