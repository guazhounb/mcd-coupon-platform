# MCP 集成说明（MCP_INTEGRATION.md）

本文档说明本项目「麦麦优惠管家 · 麦当劳优惠点餐一体化平台」实际使用的麦当劳 MCP Server、调用的 Tool、调用流程与业务价值。

## 1. 使用的麦当劳 MCP Server

- **服务地址**：`https://mcp.mcd.cn`
- **接入方式**：MCP Streamable HTTP（远程托管、无状态）
- **鉴权方式**：`Authorization: Bearer <MCD_MCP_TOKEN>`（Token 仅存于服务端，前端不直接接触）
- **参考文档**：<https://open.mcd.cn/mcp/doc>

服务端通过初始化握手（`initialize` → `notifications/initialized`）后，对 `tools/call` 发起调用，优先解析返回体中的 `structuredContent` 字段（已解析的 JSON），缺省时回退解析 `content[].text`。

## 2. 调用的 MCP Tool 与业务映射

| 前端 / 业务动作 | 调用的 MCP Tool | 说明 |
| --- | --- | --- |
| 登录校验 | `now-time-info` | 以一次只读调用验证 Token 有效性（鉴权在 MCP 服务端以 Bearer Token 为准） |
| 就近门店查询 | `query-nearby-stores` | 按 `beType`（到店/得来速/麦乐送/团餐）、城市与关键词查找附近门店 |
| 配送地址 / 外送门店 | `delivery-query-addresses` / `delivery-query-stores` | 麦乐送场景下先选收货地址再选门店 |
| 一键领取优惠券 | `auto-bind-coupons` | 自动领取账号当前所有可领优惠券（麦麦省等） |
| 我的优惠券 | `query-my-coupons` | 查询已绑定到账号的券 |
| 门店可用券 / 可用优惠 | `query-store-coupons` / `available-coupons` | 展示选定门店当前可用的优惠，按券 ID 分组 |
| 菜单 / 餐品 | `query-meals` / `query-meal-detail` | 拉取该门店可点餐品（分类 + 图 + 价 + 促销标签） |
| 算价（用券结算） | `calculate-price` | 传入餐品与可用券，由 MCP 自动匹配券到对应餐品并算出优惠后价格；支持 `takeWayCode`（堂食/外带） |
| 提交订单 | `create-order` | 下单，返回 `orderId` 与 `payH5Url` 支付链接；支持 `cancelReasonCode` 取消 |
| 订单状态 / 支付状态 | `query-order` | 读取 `orderStatus`（如「待支付」）核对支付状态 |
| 取消订单 | `cancel-order` | 传入 `orderId` 与 `cancelReasonCode` 取消测试/未支付订单 |

## 3. 端到端调用流程

```
1) 登录
   前端 → 后端 /api/login → MCP: now-time-info（校验 Token）
2) 选门店
   前端(自动定位/城市选项卡) → 后端 /api/tool → MCP: query-nearby-stores
   麦乐送分支 → delivery-query-addresses → delivery-query-stores
3) 领券 + 展示可用优惠
   前端 → 后端 /api/tool → MCP: auto-bind-coupons（一键领取）
                              → query-store-coupons / available-coupons（展示当前门店可用优惠）
4) 点餐
   前端 → 后端 /api/tool → MCP: query-meals（菜单）
5) 用券结算
   前端(餐篮 + 选券) → 后端 /api/tool → MCP: calculate-price（自动用券算价）
6) 下单 + 在线支付
   前端 → 后端 /api/tool → MCP: create-order → 返回 orderId + payH5Url
   前端支付页: 立即支付 / 扫码支付(本地生成二维码) / 复制链接 / query-order 查状态
   取消 → cancel-order
7) 订单保存
   前端: 一键保存小票(PNG) / 复制订单信息
```

## 4. 业务价值

- **省心省钱**：把「找券 → 看券 → 点餐 → 用券 → 支付」五步压缩到一个页面，自动领取并自动匹配可用券，结算价格实时可见（实测 ¥19.00 → ¥9.90）。
- **就近便捷**：自动定位 + 反向地理编码，秒级找到最近可服务门店；同时保留手动城市选项卡，适配无定位权限场景。
- **支付闭环**：下单即拿到官方 `payH5Url`，提供网页支付、扫码支付、App 兜底三种路径，覆盖不同设备与网络环境。
- **安全合规**：Token 仅服务端持有，所有 MCP 调用经后端代理，登录/支付二维码本地生成，支付链接不上传任何第三方，符合信息安全与合规要求。

## 5. 复现与验证

- 后端零依赖（仅 Node.js 内置模块），`node server.js` 即可启动，`/api/tool` 统一代理 MCP 调用。
- 已通过端到端验证：登录、门店查询、领券、菜单、算价自动用券、下单（返回 `payH5Url`）、查询支付状态、取消订单均成功。
- 所有调用严格遵循 `https://open.mcd.cn/mcp/doc` 的入参与返回字段（如支付链接字段 `payH5Url`、状态字段 `orderStatus`）。
