# 麦当劳优惠点餐一体化平台 · Issue 草案（依据 open.mcd.cn/mcp/doc）

> 本文件为依据麦当劳中国开放平台 MCP 文档（https://open.mcd.cn/mcp/doc）梳理的功能验收清单。
> 待 GitHub MCP 连接器在本会话可用后，由自动化脚本逐条提交为仓库 Issue。

---

## 1. 【门店】就近门店选择（四种取餐方式）
- 调用 `query-nearby-stores`（到店自取 beType=1 / 得来速 beType=5）与 `delivery-query-stores`（麦乐送 beType=2 / 企业团餐 beType=6）。
- 支持按城市 + 关键词检索门店，返回门店名称、地址、营业状态、距离、storeCode、beCode。
- 用户选定门店后进入优惠与点餐流程。
- 验收：可检索、可切换取餐方式、可确认门店。

## 2. 【优惠券】一键领取全部可用券
- 调用 `auto-bind-coupons` 自动领取「麦麦省」全部可领取优惠券。
- 兼容「暂无可领取的优惠券」等业务态（券已领过时不应报错）。
- 验收：点击后静默/友好提示领取结果，不中断流程。

## 3. 【优惠券】当前门店可用优惠展示
- 调用 `available-coupons`（可领）与 `query-my-coupons`（已领取），结合 `query-store-coupons`（门店维度）展示当前门店可用优惠。
- 按券 ID 分组展示：券名称、优惠力度、适用商品、有效期、使用门槛。
- 验收：列表清晰、与所选门店强相关、券状态准确。

## 4. 【点餐】门店菜单与餐品详情
- 调用 `query-meals`（按 storeCode / orderType / beType 拉取菜单，含分类、餐品、图片、价格、促销标签）。
- 调用 `query-meal-detail` 查看套餐 round、子项、特制选项（modification：selectedKey / unselectedKey 规则）。
- 验收：菜单可浏览、套餐可展开、特制项可按规则选择。

## 5. 【结算】算价 + 用券 + 下单
- `calculate-price` 计算价格，自动把优惠券匹配到对应餐品；取 `takeWayList[].code` 作为 `takeWayCode`（orderType=1 必传）。
- `create-order` 下单（到店/外送参数区分：beCode、addressId、takeWayCode、items[].couponId/couponCode、remark、needTableware）。
- 返回 `orderId` 与 `payH5Url`，引导用户支付。
- `cancel-order` 支持取消（必填 `cancelReasonCode`）。
- 验收：算价正确应用优惠、下单成功、可取消。

## 6. 【订单】订单查询与管理
- 调用 `query-order` / `query-order-list` 查询订单状态与详情。
- 验收：可查看历史/当前订单、状态同步。

## 7. 【麦乐送】配送地址管理
- 调用 `delivery-create-address` 与 `delivery-query-addresses`，管理收货人/电话/城市/地址/门牌号。
- orderType=2 场景下 `create-order` 必传 `addressId`。
- 验收：可新增、可选址、下单可关联。

## 8. 【团餐】企业团餐下单
- beType=6 + `query-meal-assistance`（预算金额、人数、gmServiceCode）+ `delivery-query-stores` 选门店。
- 验收：引导预算/人数、可下单。

## 9. 【积分】积分商城兑换
- `mall-points-products` / `mall-product-detail` 查询可兑换商品（虚拟券 spuCategory=1 / 实物 spuCategory=2）。
- `mall-create-order` 兑换（实物需 addressId，单商品单订单、多商品排队下单）。
- 验收：可浏览、可兑换、返回 couponCodes。

## 10. 【活动】派对与体验活动
- `party-order-create` 与 `query-party-*` 支持生日派对 / 主题派对 / 麦麦体验营 / 品鉴会 / 读书会 / 积分兑换活动（shopId=5，需选城市/门店/日期/场次）。
- 验收：活动可检索、可下单。

## 11. 【账户】账户与拓展能力
- `query-my-account` 账户信息；`draw-lottery` / `query-my-prizes` 抽奖与奖品；`query-survey-coupon` 问卷券；`now-time-info` 服务端时间。
- 验收：能力可用、时间以服务端为准。

## 12. 【工程】鉴权、健壮性、2FA
- MCP 鉴权：Bearer Token（`Authorization: Bearer <token>`），服务端无状态、无需 Mcp-Session-Id。
- 错误处理：空数据、业务态（如无可领券）、网络异常均需友好提示，不中断主流程。
- 适配账号 2FA / Authenticator 验证流程。
- 验收：Token 仅存服务端、密钥不入仓、异常可恢复。
