# 麦麦优惠管家 · 麦当劳优惠点餐一体化平台

基于 [open.mcd.cn MCP](https://open.mcd.cn/mcp/doc) 的麦当劳优惠点餐一体化 Web 平台。
完整还原「登录 → 就近选店 → 一键领券并显示可用优惠 → 点餐 → 用券结算 → 订单保存」全流程。

> 麦当劳风格设计，无 AI 机器味；后端零依赖（仅用 Node.js 内置模块），前端为原生单页应用。

## 功能流程

1. **登录** —— 校验 MCP 服务可用性，进入主流程。
2. **就近选店** —— 支持「到店自取 / 得来速 / 麦乐送 / 企业团餐」四种取餐方式；
   到店与得来速按城市+位置搜索附近门店，外送/团餐先选配送地址再选门店。
3. **自动领券 + 可用优惠** —— 调用 `auto-bind-coupons` 自动领取所有可用优惠券，
   并通过 `query-store-coupons` 展示当前门店可用优惠（按券 ID 分组）。
4. **点餐** —— `query-meals` 拉取菜单（分类 + 餐品图/价），加入餐篮。
5. **用券结算** —— `calculate-price` 自动把可用券匹配到对应餐品并算出优惠后价格；
   到店场景选择堂食/外带取餐方式，外送场景填写备注。
6. **提交订单** —— `create-order` 下单，展示订单号与支付链接；
   支持「一键保存订单小票（PNG）」「复制订单信息」「取消订单」。

## 技术架构

```
浏览器(麦当劳风格SPA)  ──HTTP──▶  Node.js 后端(零依赖)
                                     │  MCP Streamable HTTP (Bearer Token)
                                     ▼
                                mcp.mcd.cn (麦当劳官方 MCP)
```

- `server.js`：HTTP 服务，既托管前端静态资源，又提供 `/api/tool` 代理，把请求安全转发到麦当劳 MCP。
- `mcp-client.js`：麦当劳 MCP 的 Streamable HTTP 客户端（初始化握手 + `tools/call` + 解析 `structuredContent`）。
- `config.js`：读取 Token（环境变量优先，其次 `local.config.json`）。
- `public/`：前端单页应用（`index.html` / `styles.css` / `app.js`）。

## 环境要求

- Node.js ≥ 18（已在 v22 验证）

## 配置 Token（重要）

麦当劳 MCP 使用 Bearer Token 鉴权。**切勿将真实 Token 提交到 GitHub**（已被 `.gitignore` 忽略）。

任选其一：

```bash
# 方式一：环境变量
export MCD_MCP_TOKEN="你的_token"
node server.js

# 方式二：本地配置文件（不入库）
# 新建 local.config.json：
# { "token": "你的_token" }
node server.js
```

## 运行

```bash
npm start          # 等价于 node server.js
# 打开 http://localhost:3000
```

默认端口 3000，可用 `PORT=8080 node server.js` 修改。

## 目录结构

```
mcd-coupon-platform/
├── server.js          # 零依赖 HTTP 服务 + MCP 代理
├── mcp-client.js      # 麦当劳 MCP Streamable HTTP 客户端
├── config.js          # Token 读取
├── package.json
├── .gitignore         # 忽略 local.config.json / .env / node_modules
├── README.md
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```

## 接口与 MCP 工具对应

| 前端动作 | MCP 工具 |
| --- | --- |
| 登录校验 | `now-time-info` |
| 附近门店 | `query-nearby-stores` |
| 配送地址 | `delivery-query-addresses` / `delivery-query-stores` |
| 一键领券 | `auto-bind-coupons` |
| 门店可用券 | `query-store-coupons` |
| 菜单 | `query-meals` |
| 算价（用券） | `calculate-price` |
| 下单 | `create-order` |
| 取消订单 | `cancel-order` |

## 安全说明

- Token 仅在服务端持有，前端永远不直接接触 Token。
- 所有 MCP 调用经后端代理，规避浏览器跨域与密钥泄露。

---

## 本项目需满足的 Issue 要求

> 本仓库关联的 GitHub Issue 要求请填写在此处（或见仓库 Issue 详情），例如：
> - 部署方式 / CI 要求
> - 代码规范、目录约定
> - 必须包含的说明或截图
> - 其它验收标准
