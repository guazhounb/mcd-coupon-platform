# 麦麦优惠管家 · 麦当劳优惠点餐一体化平台

基于 [open.mcd.cn MCP](https://open.mcd.cn/mcp/doc) 的麦当劳优惠点餐一体化 Web 平台。
完整还原「登录 → 就近选店 → 一键领券并显示可用优惠 → 点餐 → 用券结算 → 在线支付 → 订单保存」全流程。

> 麦当劳风格设计，无 AI 机器味；后端零依赖（仅用 Node.js 内置模块），前端为原生单页应用。

## 功能流程

1. **登录**
   - **账号登录**：输入会员账号 + 密码（服务端以 MCP Bearer Token 鉴权）。
   - **扫码登录**：使用本地生成的二维码，在麦当劳 App 扫码授权后一键登录（二维码本地生成，不依赖第三方服务）。
2. **就近选店**
   - 支持「到店自取 / 得来速 / 麦乐送 / 企业团餐」四种取餐方式。
   - **自动获取当前位置**：浏览器定位后，经反向地理编码得到城市与商圈，自动查找附近门店。
   - **手动选择城市**：提供热门城市选项卡，选择城市后填写位置关键词搜索。
   - 外送 / 团餐先选配送地址再选门店。
3. **自动领券 + 可用优惠** —— 调用 `auto-bind-coupons` 自动领取所有可用优惠券，
   并通过 `query-store-coupons` 展示当前门店可用优惠（按券 ID 分组）。
4. **点餐** —— `query-meals` 拉取菜单（分类 + 餐品图/价），加入餐篮。
5. **用券结算** —— `calculate-price` 自动把可用券匹配到对应餐品并算出优惠后价格；
   到店场景选择堂食/外带取餐方式，外送场景填写备注。
6. **提交订单与在线支付** —— `create-order` 下单，返回订单号与 `payH5Url` 支付链接：
   - **立即在线支付**：打开支付 H5 页面完成付款。
   - **扫码支付**：本地生成支付二维码，使用麦当劳 App 扫码付款。
   - **复制支付链接 / 查询支付状态**：`query-order` 读取 `orderStatus`（如「待支付」）。
   - 若网页无法拉起支付，提示用户复制链接或截图二维码，在麦当劳 App 内完成支付。
   - 订单保存支持「一键保存订单小票（PNG）」「复制订单信息」「取消订单」。

## 界面与体验优化

- **全屏显示**：顶栏提供全屏切换按钮（Fullscreen API），全屏下内容区更宽松、点餐网格自适应更宽。
- **按钮不拥挤**：统一加大内边距与按钮间距，按钮最小高度 ≥ 48px，点击区域舒适。
- **麦当劳红黄风格**：品牌色与卡片化布局，贴近官方 App 观感。

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
- `public/lib/qrcode.js`：本地二维码生成库（Kazuhiko Arase 的 qrcode-generator，MIT），用于登录二维码与支付二维码，避免把支付链接泄露给第三方服务。

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
    ├── app.js
    └── lib/
        └── qrcode.js  # 本地二维码生成（登录 / 支付）
```

## 目标用户

- **精打细算的麦当劳常客**：希望每次点餐都自动用上所有可用优惠券、最大化优惠力度的人。
- **怕麻烦的普通消费者**：不想在 App 里逐个找券、比价、核对可用门店，希望「打开即用、一键最优」。
- **外地/出差用户**：到陌生城市需要快速找到就近可服务门店并下单的人。
- **开发者 / 参赛交流**：想参考「麦当劳 MCP 一体化落地」实现方案的开发者。

## 使用示例

```text
1) 打开应用首页，选择「扫码登录」用麦当劳 App 扫码，或输入会员账号登录。
2) 进入选店页，点击「自动获取当前位置」一键定位附近门店；
   或点选城市选项卡（北京/上海/广州…）+ 输入位置关键词手动搜索。
3) 选定门店后系统自动「一键领取」所有可用优惠券，并展示当前门店可用优惠清单。
4) 进入菜单，把想吃的餐品加入餐篮（如：巨无霸 ×1、麦辣鸡腿堡 ×2）。
5) 点击「结算」，系统调用 calculate-price 自动用券，实时显示优惠后价格。
6) 点击「提交订单」→ 拿到官方支付链接，选择：
   - 立即在线支付（打开 payH5Url 支付页）
   - 扫码支付（本地生成支付二维码，App 扫码付）
   - 若网页无法拉起，复制链接或截图二维码到麦当劳 App 内支付
7) 支付后「一键保存订单小票（PNG）」或「复制订单信息」留存。
```

## 接口与 MCP 工具对应

| 前端动作 | MCP 工具 |
| --- | --- |
| 登录校验 | `now-time-info` |
| 扫码登录（本地） | 本地二维码 + 授权确认 |
| 附近门店 | `query-nearby-stores` |
| 配送地址 | `delivery-query-addresses` / `delivery-query-stores` |
| 一键领券 | `auto-bind-coupons` |
| 门店可用券 | `query-store-coupons` |
| 菜单 | `query-meals` |
| 算价（用券） | `calculate-price` |
| 下单 | `create-order`（返回 `payH5Url`） |
| 查询支付状态 | `query-order`（读取 `orderStatus`） |
| 取消订单 | `cancel-order` |

## 安全说明

- Token 仅在服务端持有，前端永远不直接接触 Token。
- 所有 MCP 调用经后端代理，规避浏览器跨域与密钥泄露。
- 登录 / 支付二维码均由前端本地生成，支付链接不上传任何第三方服务。

---

## 本项目需满足的 Issue 要求

> 本仓库关联的 GitHub Issue 要求请见仓库 Issue 详情（共 12 条，依据 open.mcd.cn/mcp/doc 全量能力整理）。
