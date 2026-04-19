# 顺风车 OpenAPI 接口清单

## 1. 文档目标

本文档用于沉淀顺风车项目一期的接口契约，作为以下角色的统一基线：

1. 小程序前端
2. 后台前端
3. Go 后端
4. 测试与联调

本文档不替代正式 OpenAPI YAML，但已经达到可直接开发和联调的粒度。

---

## 2. 接口设计约定

### 2.1 基础约定

1. 接口前缀统一为 `/api/v1`
2. 管理后台接口统一以 `/api/v1/admin` 开头
3. 返回体统一使用 `code + message + data + requestId`
4. 所有分页列表接口统一支持 `page`、`pageSize`
5. 所有金额字段后端统一用“分”为存储单位，对外返回时可同时给格式化字段

### 2.2 请求头约定

公共请求头：

1. `Authorization: Bearer <token>`
2. `X-Client-Type: miniapp | admin`
3. `X-Trace-Id: <trace-id>`

### 2.3 统一返回结构

```json
{
  "code": 0,
  "message": "ok",
  "data": {},
  "requestId": "b4d9ef7f8d9d4c33"
}
```

### 2.4 分页返回结构

```json
{
  "list": [],
  "page": 1,
  "pageSize": 20,
  "total": 120
}
```

### 2.5 通用错误码

1. `USER_NOT_LOGIN`
2. `USER_FORBIDDEN`
3. `PARAM_INVALID`
4. `RESOURCE_NOT_FOUND`
5. `REPEAT_SUBMIT`
6. `ORDER_STATUS_INVALID`
7. `TRIP_STATUS_INVALID`
8. `DRIVER_NOT_VERIFIED`
9. `ROUTE_SCORE_NOT_PASS`
10. `FREQUENCY_LIMIT_EXCEEDED`
11. `PAYMENT_FAILED`
12. `REFUND_FAILED`
13. `INTERNAL_ERROR`

### 2.6 通用枚举

#### 申请状态

1. `PENDING_DRIVER_CONFIRM`
2. `ACCEPTED`
3. `REJECTED`
4. `CANCELLED`
5. `EXPIRED`

#### 订单状态

1. `PENDING_PASSENGER_PAY`
2. `PENDING_DEPART`
3. `IN_PROGRESS`
4. `PENDING_ARRIVAL_CONFIRM`
5. `COMPLETED`
6. `CANCELLED`
7. `EXCEPTION_HANDLING`
8. `REFUNDED`

#### 行程状态

1. `DRAFT`
2. `PUBLISHED`
3. `MATCHING`
4. `CONFIRMED`
5. `IN_PROGRESS`
6. `COMPLETED`
7. `CANCELLED`

#### 审核状态

1. `PENDING`
2. `REVIEWING`
3. `APPROVED`
4. `REJECTED`

---

## 3. 认证与会话接口

## 3.1 微信登录

### `POST /api/v1/auth/wx-login`

说明：

1. 小程序通过 `wx.login` 获取 code 后调用
2. 首次登录自动创建用户

鉴权：

1. 否

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| code | string | 是 | 微信登录 code |
| encryptedData | string | 否 | 手机号等扩展信息 |
| iv | string | 否 | 微信解密 iv |

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| token | string | 登录 token |
| userId | number | 用户 ID |
| isNewUser | boolean | 是否新用户 |
| roleFlags | object | 角色标记 |
| profile | object | 用户资料摘要 |

关键错误码：

1. `PARAM_INVALID`
2. `INTERNAL_ERROR`

## 3.2 获取当前会话

### `GET /api/v1/auth/session`

说明：

1. 前端启动时校验 token 可用性

鉴权：

1. 是

返回字段：

1. `userId`
2. `nickname`
3. `avatarUrl`
4. `realnameStatus`
5. `driverVerified`
6. `roles`

## 3.3 退出登录

### `POST /api/v1/auth/logout`

说明：

1. 主动退出会话

鉴权：

1. 是

请求体：

1. 无

返回字段：

1. `success`

---

## 4. 用户与资料接口

## 4.1 获取我的资料

### `GET /api/v1/me/profile`

鉴权：

1. 是

返回字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| userId | number | 用户 ID |
| nickname | string | 昵称 |
| avatarUrl | string | 头像 |
| mobileMasked | string | 脱敏手机号 |
| realnameStatus | string | 实名状态 |
| driverVerified | boolean | 是否车主认证完成 |
| vehicleVerifiedCount | number | 已认证车辆数 |

## 4.2 更新我的资料

### `PUT /api/v1/me/profile`

鉴权：

1. 是

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| nickname | string | 否 | 昵称 |
| avatarUrl | string | 否 | 头像 URL |

返回字段：

1. `success`
2. `profile`

## 4.3 提交实名认证

### `POST /api/v1/me/realname/submit`

鉴权：

1. 是

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| realName | string | 是 | 真实姓名 |
| idCardNo | string | 是 | 身份证号 |

返回字段：

1. `authId`
2. `authStatus`

## 4.4 获取实名认证状态

### `GET /api/v1/me/realname/status`

鉴权：

1. 是

返回字段：

1. `authStatus`
2. `rejectReason`
3. `submittedAt`
4. `reviewedAt`

## 4.5 获取紧急联系人列表

### `GET /api/v1/me/emergency-contacts`

鉴权：

1. 是

返回字段：

1. `list[].id`
2. `list[].name`
3. `list[].mobileMasked`
4. `list[].relation`
5. `list[].isDefault`

## 4.6 新增紧急联系人

### `POST /api/v1/me/emergency-contacts`

鉴权：

1. 是

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 姓名 |
| mobile | string | 是 | 手机号 |
| relation | string | 是 | 关系 |
| isDefault | boolean | 否 | 是否默认 |

返回字段：

1. `contactId`
2. `success`

## 4.7 修改紧急联系人

### `PUT /api/v1/me/emergency-contacts/{id}`

鉴权：

1. 是

路径参数：

1. `id`

请求体：

1. `name`
2. `mobile`
3. `relation`
4. `isDefault`

返回字段：

1. `success`

## 4.8 删除紧急联系人

### `DELETE /api/v1/me/emergency-contacts/{id}`

鉴权：

1. 是

返回字段：

1. `success`

---

## 5. 车主与车辆接口

## 5.1 获取车主资料

### `GET /api/v1/driver/profile`

鉴权：

1. 是

返回字段：

1. `driverStatus`
2. `rating`
3. `completedOrderCount`
4. `specialLineStatus`
5. `licenseStatus`

## 5.2 获取车辆列表

### `GET /api/v1/driver/vehicles`

鉴权：

1. 是

返回字段：

1. `list[].id`
2. `list[].brand`
3. `list[].model`
4. `list[].color`
5. `list[].plateNoMasked`
6. `list[].seatCount`
7. `list[].authStatus`
8. `list[].isDefault`

## 5.3 新增车辆

### `POST /api/v1/driver/vehicles`

鉴权：

1. 是

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| brand | string | 是 | 品牌 |
| model | string | 是 | 型号 |
| color | string | 是 | 颜色 |
| plateNo | string | 是 | 车牌号 |
| seatCount | number | 是 | 座位数 |
| vehicleImageUrl | string | 否 | 车辆图 |

返回字段：

1. `vehicleId`
2. `authStatus`

## 5.4 修改车辆

### `PUT /api/v1/driver/vehicles/{id}`

鉴权：

1. 是

请求体：

1. `brand`
2. `model`
3. `color`
4. `seatCount`
5. `vehicleImageUrl`

返回字段：

1. `success`

## 5.5 设置默认车辆

### `POST /api/v1/driver/vehicles/{id}/set-default`

鉴权：

1. 是

返回字段：

1. `success`

## 5.6 提交驾驶证认证

### `POST /api/v1/driver/license/submit`

鉴权：

1. 是

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| licenseNo | string | 是 | 驾驶证号 |
| issueDate | string | 是 | 发证日期 |
| expireDate | string | 是 | 到期日期 |
| imageUrl | string | 是 | 驾驶证图片 |

返回字段：

1. `licenseId`
2. `authStatus`

## 5.7 获取驾驶证状态

### `GET /api/v1/driver/license/status`

鉴权：

1. 是

返回字段：

1. `authStatus`
2. `rejectReason`
3. `submittedAt`
4. `reviewedAt`

---

## 6. 常用路线接口

## 6.1 获取常用路线列表

### `GET /api/v1/route-templates`

鉴权：

1. 是

返回字段：

1. `list[].id`
2. `list[].routeName`
3. `list[].startName`
4. `list[].endName`
5. `list[].timePeriod`
6. `list[].isDefault`

## 6.2 新增常用路线

### `POST /api/v1/route-templates`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| routeName | string | 是 | 路线名 |
| startName | string | 是 | 起点名 |
| startLat | number | 是 | 起点纬度 |
| startLng | number | 是 | 起点经度 |
| endName | string | 是 | 终点名 |
| endLat | number | 是 | 终点纬度 |
| endLng | number | 是 | 终点经度 |
| waypoints | array | 否 | 途经点 |
| timePeriod | string | 否 | 常用时间段 |

返回字段：

1. `routeTemplateId`
2. `success`

## 6.3 修改常用路线

### `PUT /api/v1/route-templates/{id}`

请求体：

1. 与新增一致

返回字段：

1. `success`

## 6.4 删除常用路线

### `DELETE /api/v1/route-templates/{id}`

返回字段：

1. `success`

## 6.5 设置默认路线

### `POST /api/v1/route-templates/{id}/set-default`

返回字段：

1. `success`

---

## 7. 行程与匹配接口

## 7.1 行程费用预览

### `POST /api/v1/trips/price-preview`

说明：

1. 发布行程页修改路线后实时调用

鉴权：

1. 是

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| startLat | number | 是 | 起点纬度 |
| startLng | number | 是 | 起点经度 |
| endLat | number | 是 | 终点纬度 |
| endLng | number | 是 | 终点经度 |
| waypoints | array | 否 | 途经点 |
| seatCount | number | 是 | 可载人数 |

返回字段：

1. `mileageFeeFen`
2. `tollFeeFen`
3. `serviceFeeFen`
4. `totalFeeFen`
5. `distanceMeter`

## 7.2 顺路度预校验

### `POST /api/v1/trips/route-score-preview`

说明：

1. 发布前或搜索前调用

请求体：

1. `startLat`
2. `startLng`
3. `endLat`
4. `endLng`
5. `waypoints`

返回字段：

1. `routeScore`
2. `passed`
3. `ruleSnapshotId`
4. `message`

## 7.3 发布行程

### `POST /api/v1/trips`

鉴权：

1. 是

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| vehicleId | number | 是 | 车辆 ID |
| startName | string | 是 | 起点名称 |
| startLat | number | 是 | 起点纬度 |
| startLng | number | 是 | 起点经度 |
| endName | string | 是 | 终点名称 |
| endLat | number | 是 | 终点纬度 |
| endLng | number | 是 | 终点经度 |
| waypoints | array | 否 | 途经点 |
| departAt | string | 是 | 出发时间 |
| seatTotal | number | 是 | 可载人数 |

返回字段：

1. `tripId`
2. `tripStatus`
3. `routeScore`
4. `pricePreview`
5. `frequencyCheck`

关键错误码：

1. `DRIVER_NOT_VERIFIED`
2. `ROUTE_SCORE_NOT_PASS`
3. `FREQUENCY_LIMIT_EXCEEDED`

## 7.4 获取我的行程列表

### `GET /api/v1/trips/my`

查询参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | string | 否 | 行程状态 |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页数量 |

返回字段：

1. `list[].tripId`
2. `list[].departAt`
3. `list[].routeSummary`
4. `list[].seatTotal`
5. `list[].seatAvailable`
6. `list[].applyCount`
7. `list[].tripStatus`

## 7.5 获取行程详情

### `GET /api/v1/trips/{id}`

返回字段：

1. `tripId`
2. `driverInfo`
3. `routeInfo`
4. `routeScore`
5. `priceInfo`
6. `tripStatus`
7. `seatAvailable`
8. `safetyInfo`

## 7.6 取消行程

### `POST /api/v1/trips/{id}/cancel`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| reason | string | 是 | 取消原因 |

返回字段：

1. `success`
2. `tripStatus`

## 7.7 搜索匹配列表

### `POST /api/v1/search/matches`

鉴权：

1. 是

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| startName | string | 是 | 起点名 |
| startLat | number | 是 | 起点纬度 |
| startLng | number | 是 | 起点经度 |
| endName | string | 是 | 终点名 |
| endLat | number | 是 | 终点纬度 |
| endLng | number | 是 | 终点经度 |
| departAt | string | 是 | 出发时间 |
| minRouteScore | number | 否 | 最低顺路度 |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页数量 |

返回字段：

1. `list[].tripId`
2. `list[].driverInfo`
3. `list[].departAt`
4. `list[].seatAvailable`
5. `list[].routeScore`
6. `list[].estimatedFeeFen`
7. `list[].sortScore`

---

## 8. 同行申请与订单接口

## 8.1 发起同行申请

### `POST /api/v1/join-requests`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| tripId | number | 是 | 行程 ID |
| startName | string | 是 | 实际上车点 |
| startLat | number | 是 | 纬度 |
| startLng | number | 是 | 经度 |
| endName | string | 是 | 实际下车点 |
| endLat | number | 是 | 纬度 |
| endLng | number | 是 | 经度 |

返回字段：

1. `joinRequestId`
2. `requestStatus`

关键错误码：

1. `REPEAT_SUBMIT`
2. `TRIP_STATUS_INVALID`

## 8.2 获取我的申请列表

### `GET /api/v1/join-requests/my`

说明：

1. 用于乘客侧查看自己发起的同行申请
2. 返回对象为 `join_request`，不是正式订单

查询参数：

1. `role`
2. `status`
3. `page`
4. `pageSize`

返回字段：

1. `list[].recordType`，固定为 `JOIN_REQUEST`
2. `list[].joinRequestId`
3. `list[].tripId`
4. `list[].requestStatus`
5. `list[].routeSummary`
6. `list[].driverInfo`
7. `list[].createdAt`

## 8.3 获取申请详情

### `GET /api/v1/join-requests/{id}`

说明：

1. 返回对象为申请详情
2. 用于“待确认”“已拒绝”“已取消”等申请态详情页

返回字段：

1. `recordType`，固定为 `JOIN_REQUEST`
2. `joinRequestId`
3. `tripId`
4. `requestStatus`
5. `driverInfo`
6. `routeInfo`
7. `startPoint`
8. `endPoint`
9. `acceptedAt`
10. `rejectedAt`
11. `cancelledAt`
12. `expiredAt`

## 8.4 取消申请

### `POST /api/v1/join-requests/{id}/cancel`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| reason | string | 否 | 取消原因 |

返回字段：

1. `success`
2. `requestStatus`

## 8.5 获取车主待处理申请列表

### `GET /api/v1/driver/join-requests`

查询参数：

1. `tripId`
2. `status`
3. `page`
4. `pageSize`

返回字段：

1. `list[].joinRequestId`
2. `list[].tripId`
3. `list[].passengerInfo`
4. `list[].applyAt`
5. `list[].historyOrderCount`
6. `list[].creditTags`
7. `list[].requestStatus`

## 8.6 接受同行申请

### `POST /api/v1/driver/join-requests/{id}/accept`

说明：

1. 接受后当前申请进入 `ACCEPTED`
2. 系统同步创建正式订单，订单状态进入 `PENDING_PASSENGER_PAY`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| remark | string | 否 | 备注 |

返回字段：

1. `orderId`
2. `orderStatus`
3. `payExpireAt`

## 8.7 拒绝同行申请

### `POST /api/v1/driver/join-requests/{id}/reject`

请求体：

1. `reason`

返回字段：

1. `success`
2. `requestStatus`

## 8.8 获取订单列表

### `GET /api/v1/orders`

说明：

1. 只返回正式订单对象 `ride_order`
2. 不返回待车主确认的申请记录

查询参数：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| role | string | 否 | passenger/driver |
| status | string | 否 | 订单状态 |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页数量 |

返回字段：

1. `list[].recordType`，固定为 `ORDER`
2. `list[].orderId`
3. `list[].orderNo`
4. `list[].joinRequestId`
5. `list[].routeSummary`
6. `list[].departAt`
7. `list[].driverInfo` 或 `passengerInfo`
8. `list[].orderStatus`
9. `list[].payableAmountFen`

## 8.9 获取订单详情

### `GET /api/v1/orders/{id}`

返回字段：

1. `recordType`，固定为 `ORDER`
2. `orderId`
3. `orderNo`
4. `joinRequestId`
5. `orderStatus`
6. `driverInfo`
7. `passengerInfo`
8. `routeInfo`
9. `priceInfo`
10. `boardConfirmedAt`
11. `arrivalConfirmedAt`
12. `trackSummary`
13. `safetyActions`
14. `settlementInfo`

## 8.10 确认上车

### `POST /api/v1/orders/{id}/confirm-board`

说明：

1. 仅乘客可操作

请求体：

1. 无

返回字段：

1. `success`
2. `orderStatus`
3. `boardConfirmedAt`

关键错误码：

1. `ORDER_STATUS_INVALID`

## 8.11 确认到达

### `POST /api/v1/orders/{id}/confirm-arrival`

说明：

1. 仅乘客可操作
2. 调用成功后触发结算

返回字段：

1. `success`
2. `orderStatus`
3. `arrivalConfirmedAt`
4. `settlementTriggered`

## 8.12 取消订单

### `POST /api/v1/orders/{id}/cancel`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| reason | string | 是 | 取消原因 |

返回字段：

1. `success`
2. `orderStatus`
3. `refundInfo`

---

## 9. 支付、退款、钱包接口

## 9.1 创建支付单

### `POST /api/v1/payments/orders`

说明：

1. 用于乘客支付车费

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| orderId | number | 是 | 订单 ID |

返回字段：

1. `paymentOrderId`
2. `outTradeNo`
3. `payParams`
4. `payExpireAt`

## 9.2 查询支付状态

### `GET /api/v1/payments/{orderId}/status`

返回字段：

1. `payStatus`
2. `paidAt`
3. `amountFen`

## 9.3 微信支付回调

### `POST /api/v1/payments/callback/wechat`

说明：

1. 微信服务端调用
2. 后端需要验签和幂等

鉴权：

1. 否，按微信回调签名校验

返回字段：

1. 微信规范响应

## 9.4 发起退款

### `POST /api/v1/refunds`

说明：

1. 后台或系统内部调用为主

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| orderId | number | 是 | 订单 ID |
| refundReason | string | 是 | 退款原因 |
| refundAmountFen | number | 是 | 退款金额 |

返回字段：

1. `refundOrderId`
2. `refundStatus`

## 9.5 获取钱包账户

### `GET /api/v1/wallet/account`

返回字段：

1. `availableAmountFen`
2. `frozenAmountFen`
3. `totalIncomeFen`
4. `totalWithdrawFen`

## 9.6 获取钱包流水

### `GET /api/v1/wallet/ledger`

查询参数：

1. `bizType`
2. `page`
3. `pageSize`

返回字段：

1. `list[].ledgerId`
2. `list[].bizType`
3. `list[].changeAmountFen`
4. `list[].balanceAfterFen`
5. `list[].bizNo`
6. `list[].createdAt`

## 9.7 发起提现

### `POST /api/v1/wallet/withdraws`

请求体：

1. `amountFen`
2. `bankCardId` 或 `withdrawChannel`

返回字段：

1. `withdrawId`
2. `withdrawStatus`

---

## 10. 安全能力接口

## 10.1 获取安全配置

### `GET /api/v1/safety/config`

返回字段：

1. `shareEnabled`
2. `defaultShareContactIds`
3. `recordEnabled`
4. `recordNotice`

## 10.2 更新安全配置

### `PUT /api/v1/safety/config`

请求体：

1. `shareEnabled`
2. `defaultShareContactIds`
3. `recordEnabled`

返回字段：

1. `success`

## 10.3 生成行程分享链接

### `POST /api/v1/safety/share-links`

请求体：

1. `orderId`
2. `contactIds`

返回字段：

1. `shareUrl`
2. `expireAt`

## 10.4 发起 SOS

### `POST /api/v1/safety/sos`

请求体：

1. `orderId`
2. `currentLat`
3. `currentLng`
4. `remark`

返回字段：

1. `sosEventId`
2. `eventStatus`
3. `notified`

## 10.5 批量上传轨迹点

### `POST /api/v1/safety/trace-points/batch`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| orderId | number | 是 | 订单 ID |
| points | array | 是 | 轨迹点数组 |

`points[]` 字段：

1. `lat`
2. `lng`
3. `speed`
4. `recordedAt`

返回字段：

1. `acceptedCount`
2. `success`

## 10.6 获取轨迹汇总

### `GET /api/v1/safety/trace-summary/{orderId}`

返回字段：

1. `totalDistanceMeter`
2. `totalDurationSecond`
3. `abnormalFlag`
4. `startAt`
5. `endAt`

---

## 11. 后台认证、工作台与审核接口

## 11.1 后台登录

### `POST /api/v1/admin/auth/login`

鉴权：

1. 否

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| username | string | 是 | 后台账号 |
| password | string | 是 | 登录密码 |

返回字段：

1. `token`
2. `adminUserId`
3. `displayName`
4. `roles`

## 11.2 获取后台会话

### `GET /api/v1/admin/auth/session`

鉴权：

1. 后台登录

返回字段：

1. `adminUserId`
2. `username`
3. `displayName`
4. `status`
5. `roles`

## 11.3 获取后台权限

### `GET /api/v1/admin/auth/permissions`

鉴权：

1. 后台登录

返回字段：

1. `menus[]`
2. `buttons[]`
3. `dataScopes[]`

## 11.4 获取工作台数据

### `GET /api/v1/admin/dashboard`

鉴权：

1. 后台登录

返回字段：

1. `todayOrderCount`
2. `inProgressOrderCount`
3. `exceptionOrderCount`
4. `pendingAuditCount`
5. `todaySosCount`
6. `todayIncomeFen`
7. `pendingWithdrawCount`
8. `complaintCount`

## 11.5 获取审核列表

### `GET /api/v1/admin/audits`

查询参数：

1. `taskType`
2. `taskStatus`
3. `page`
4. `pageSize`

返回字段：

1. `list[].auditTaskId`
2. `list[].taskType`
3. `list[].bizId`
4. `list[].applicantName`
5. `list[].taskStatus`
6. `list[].submittedAt`

## 11.6 获取审核详情

### `GET /api/v1/admin/audits/{id}`

返回字段：

1. `auditTaskId`
2. `taskType`
3. `taskStatus`
4. `applicantInfo`
5. `materialList`
6. `historyLogs`

## 11.7 审核通过

### `POST /api/v1/admin/audits/{id}/approve`

请求体：

1. `remark`

返回字段：

1. `success`
2. `taskStatus`

## 11.8 审核驳回

### `POST /api/v1/admin/audits/{id}/reject`

请求体：

1. `remark`

返回字段：

1. `success`
2. `taskStatus`

---

## 12. 后台订单与风控接口

## 12.1 获取后台订单列表

### `GET /api/v1/admin/orders`

查询参数：

1. `orderStatus`
2. `tripStatus`
3. `driverKeyword`
4. `passengerKeyword`
5. `startTime`
6. `endTime`
7. `abnormalFlag`
8. `page`
9. `pageSize`

返回字段：

1. `list[].orderId`
2. `list[].orderNo`
3. `list[].driverName`
4. `list[].passengerName`
5. `list[].orderStatus`
6. `list[].routeSummary`
7. `list[].payableAmountFen`
8. `list[].abnormalFlag`

## 12.2 获取后台订单详情

### `GET /api/v1/admin/orders/{id}`

返回字段：

1. `orderInfo`
2. `driverInfo`
3. `passengerInfo`
4. `routeInfo`
5. `statusLogs`
6. `priceInfo`
7. `paymentInfo`
8. `refundInfo`
9. `settlementInfo`
10. `riskInfo`
11. `traceSummary`

## 12.3 获取订单轨迹明细

### `GET /api/v1/admin/risk/trace/{orderId}`

返回字段：

1. `orderId`
2. `tracePoints[]`
3. `summary`
4. `abnormalTags`

## 12.4 获取 SOS 记录

### `GET /api/v1/admin/risk/sos-events`

查询参数：

1. `status`
2. `orderNo`
3. `startTime`
4. `endTime`
5. `page`
6. `pageSize`

返回字段：

1. `list[].sosEventId`
2. `list[].orderNo`
3. `list[].userName`
4. `list[].triggeredAt`
5. `list[].eventStatus`
6. `list[].handlerName`

## 12.5 获取超时预警记录

### `GET /api/v1/admin/risk/timeout-alerts`

返回字段：

1. `list[].orderId`
2. `list[].orderNo`
3. `list[].estimatedArrivalAt`
4. `list[].currentDelayMinute`
5. `list[].alertStatus`

## 12.6 获取顺路度日志

### `GET /api/v1/admin/risk/route-score-logs`

查询参数：

1. `tripId`
2. `driverUserId`
3. `passed`
4. `startTime`
5. `endTime`

返回字段：

1. `list[].snapshotId`
2. `list[].tripId`
3. `list[].routeScore`
4. `list[].passed`
5. `list[].ruleVersion`
6. `list[].createdAt`

## 12.7 获取接单频控日志

### `GET /api/v1/admin/risk/frequency-logs`

返回字段：

1. `list[].logId`
2. `list[].driverUserId`
3. `list[].cityCode`
4. `list[].tripType`
5. `list[].currentDayCount`
6. `list[].currentMonthCount`
7. `list[].passed`
8. `list[].createdAt`

## 12.8 获取定价日志

### `GET /api/v1/admin/risk/pricing-logs`

返回字段：

1. `list[].pricingLogId`
2. `list[].tripId`
3. `list[].distanceMeter`
4. `list[].mileageFeeFen`
5. `list[].tollFeeFen`
6. `list[].serviceFeeFen`
7. `list[].createdAt`

---

## 13. 后台财务与内容接口

## 13.1 获取财务流水

### `GET /api/v1/admin/finance/ledger`

查询参数：

1. `bizType`
2. `orderNo`
3. `startTime`
4. `endTime`
5. `page`
6. `pageSize`

返回字段：

1. `list[].ledgerId`
2. `list[].bizType`
3. `list[].orderNo`
4. `list[].changeAmountFen`
5. `list[].operatorName`
6. `list[].createdAt`

## 13.2 获取订单资金流水

### `GET /api/v1/admin/finance/order-ledger/{orderId}`

返回字段：

1. `orderId`
2. `paymentFlows[]`
3. `refundFlows[]`
4. `settlementFlows[]`
5. `serviceFeeSummary`

## 13.3 获取提现列表

### `GET /api/v1/admin/finance/withdraws`

返回字段：

1. `list[].withdrawId`
2. `list[].userName`
3. `list[].amountFen`
4. `list[].withdrawStatus`
5. `list[].createdAt`

## 13.4 获取财务报表

### `GET /api/v1/admin/finance/reports`

查询参数：

1. `dimension`
2. `startDate`
3. `endDate`

返回字段：

1. `incomeSummary`
2. `serviceFeeSummary`
3. `orderSummary`
4. `withdrawSummary`

## 13.5 获取轮播图列表

### `GET /api/v1/admin/cms/banners`

返回字段：

1. `list[].bannerId`
2. `list[].title`
3. `list[].imageUrl`
4. `list[].linkUrl`
5. `list[].sortNo`
6. `list[].status`

## 13.6 新增轮播图

### `POST /api/v1/admin/cms/banners`

请求体：

1. `title`
2. `imageUrl`
3. `linkUrl`
4. `sortNo`
5. `status`

返回字段：

1. `bannerId`
2. `success`

## 13.7 修改轮播图

### `PUT /api/v1/admin/cms/banners/{id}`

请求体：

1. 与新增一致

返回字段：

1. `success`

## 13.8 获取文章内容

### `GET /api/v1/admin/cms/articles/{type}`

说明：

1. `type` 取值：`USER_AGREEMENT`、`PRIVACY_POLICY`、`SAFETY_NOTICE`、`HELP_CENTER`

返回字段：

1. `articleId`
2. `title`
3. `content`
4. `status`
5. `updatedAt`

## 13.9 更新文章内容

### `PUT /api/v1/admin/cms/articles/{type}`

请求体：

1. `title`
2. `content`
3. `status`

返回字段：

1. `success`

---

## 14. 接口联调顺序建议

建议按以下顺序联调：

1. `auth/wx-login`
2. `me/profile`
3. `driver/license/submit`、`driver/vehicles`
4. `trips/price-preview`、`trips/route-score-preview`
5. `trips`
6. `search/matches`
7. `join-requests`
8. `join-requests/my`、`driver/join-requests`
9. `driver/join-requests/{id}/accept`
10. `payments/orders`
11. `orders/{id}/confirm-board`
12. `orders/{id}/confirm-arrival`
13. `wallet/account`
14. `safety/sos`
15. `admin/auth/login`
16. `admin/dashboard`
17. `admin/orders`
18. `admin/risk/*`

---

## 15. 后续建议

本文档建议后续再补两类文件：

1. 正式 `openapi.yaml`
2. 接口字段 DTO 文档

如果后面要进入真正的前后端并行开发，建议优先把：

1. 登录
2. 发布行程
3. 搜索匹配
4. 申请与接受
5. 支付
6. 上下车确认

这 6 条主链路接口先冻结，其他接口可以边开发边补齐。
