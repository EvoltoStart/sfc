# 顺风车 MySQL 表结构文档

## 1. 文档目标

本文档用于沉淀顺风车项目一期 MySQL 表结构设计，供以下角色直接使用：

1. 后端开发
2. 数据库建模人员
3. 测试数据准备人员
4. 运维与 DBA

本文档定位为“开发级表结构草案”，重点覆盖：

1. 核心表
2. 字段类型
3. 索引建议
4. 表间关系
5. 一期必须实现的审计与风控字段

---

## 2. 设计总原则

### 2.1 引擎与字符集

统一建议：

1. Engine：`InnoDB`
2. Charset：`utf8mb4`
3. Collation：`utf8mb4_general_ci`

### 2.2 主键约定

统一建议：

1. 主键使用 `bigint unsigned`
2. 应用层生成雪花 ID 或使用数据库自增二选一
3. 对外展示的业务编号用独立字段，例如 `order_no`、`out_trade_no`

### 2.3 时间字段约定

统一建议：

1. `created_at datetime(3) not null`
2. `updated_at datetime(3) not null`
3. 软删除可使用 `deleted_at datetime(3) null`

### 2.4 金额字段约定

统一建议：

1. 所有金额使用“分”为单位
2. 字段类型使用 `bigint`
3. 不在 MySQL 中直接使用浮点数保存金额

### 2.5 坐标与距离字段约定

统一建议：

1. 经纬度使用 `decimal(11,7)`
2. 距离使用 `int unsigned`，单位米
3. 时长使用 `int unsigned`，单位秒

### 2.6 JSON 字段约定

以下场景允许使用 JSON：

1. 规则快照
2. 第三方响应摘要
3. 定价输入输出日志
4. 风控扩展信息

---

## 3. 表清单总览

### 3.1 用户与认证

1. `user`
2. `realname_auth`
3. `emergency_contact`

### 3.2 车主与车辆

1. `driver_profile`
2. `driver_license`
3. `vehicle`

### 3.3 行程与匹配

1. `route_template`
2. `trip`
3. `trip_waypoint`
4. `join_request`
5. `trip_match_candidate`

### 3.4 订单与支付

1. `ride_order`
2. `order_status_log`
3. `order_price`
4. `payment_order`
5. `refund_order`
6. `settlement_record`

### 3.5 钱包

1. `wallet_account`
2. `wallet_ledger`
3. `withdraw_record`

### 3.6 安全与风控

1. `trip_trace_point`
2. `trip_trace_summary`
3. `audio_record_meta`
4. `sos_event`
5. `rule_snapshot`
6. `pricing_audit_log`
7. `frequency_limit_log`
8. `risk_event`
9. `operation_audit_log`

### 3.7 管理后台与运营

1. `admin_user`
2. `admin_role`
3. `admin_permission`
4. `admin_user_role`
5. `admin_role_permission`
6. `audit_task`
7. `complaint_ticket`
8. `ops_case_record`
9. `cms_banner`
10. `cms_article`

---

## 4. 用户与认证表设计

## 4.1 `user`

表说明：

1. 存储用户基础信息
2. 兼容乘客与车主双角色

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| open_id | varchar(64) | 是 |  | 微信 openId |
| union_id | varchar(64) | 否 | null | 微信 unionId |
| mobile | varchar(20) | 否 | null | 手机号 |
| nickname | varchar(64) | 是 | '' | 昵称 |
| avatar_url | varchar(255) | 否 | null | 头像 |
| realname_status | varchar(32) | 是 | 'PENDING' | 实名状态 |
| user_status | varchar(32) | 是 | 'NORMAL' | 用户状态 |
| driver_enabled | tinyint unsigned | 是 | 0 | 是否开通车主能力 |
| last_login_at | datetime(3) | 否 | null | 最后登录时间 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |
| deleted_at | datetime(3) | 否 | null | 软删除时间 |

索引建议：

1. `primary key (id)`
2. `unique key uk_open_id (open_id)`
3. `key idx_mobile (mobile)`
4. `key idx_user_status (user_status)`

## 4.2 `realname_auth`

表说明：

1. 存储实名认证记录
2. 支持审核通过和驳回

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| user_id | bigint unsigned | 是 |  | 用户 ID |
| real_name | varchar(32) | 是 |  | 姓名 |
| id_card_cipher | varchar(255) | 是 |  | 加密身份证号 |
| id_card_masked | varchar(32) | 是 |  | 脱敏身份证号 |
| auth_status | varchar(32) | 是 | 'PENDING' | 审核状态 |
| reject_reason | varchar(255) | 否 | null | 驳回原因 |
| submitted_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 提交时间 |
| reviewed_at | datetime(3) | 否 | null | 审核时间 |
| reviewer_id | bigint unsigned | 否 | null | 审核人 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_user_id (user_id)`
2. `key idx_auth_status (auth_status)`

## 4.3 `emergency_contact`

表说明：

1. 用户紧急联系人表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| user_id | bigint unsigned | 是 |  | 用户 ID |
| name | varchar(32) | 是 |  | 联系人姓名 |
| mobile | varchar(20) | 是 |  | 联系人手机号 |
| relation | varchar(32) | 是 |  | 关系 |
| is_default | tinyint unsigned | 是 | 0 | 是否默认 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_user_id (user_id)`
2. `key idx_user_default (user_id, is_default)`

---

## 5. 车主与车辆表设计

## 5.1 `driver_profile`

表说明：

1. 车主扩展资料

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| user_id | bigint unsigned | 是 |  | 用户 ID |
| driver_status | varchar(32) | 是 | 'PENDING' | 车主状态 |
| rating | decimal(3,2) | 是 | 5.00 | 评分 |
| completed_order_count | int unsigned | 是 | 0 | 完成单数 |
| special_line_status | varchar(32) | 是 | 'NONE' | 专线状态 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_user_id (user_id)`
2. `key idx_driver_status (driver_status)`

## 5.2 `driver_license`

表说明：

1. 驾驶证认证材料

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| user_id | bigint unsigned | 是 |  | 用户 ID |
| license_no_cipher | varchar(255) | 是 |  | 加密驾驶证号 |
| license_no_masked | varchar(32) | 是 |  | 脱敏驾驶证号 |
| issue_date | date | 是 |  | 发证日期 |
| expire_date | date | 是 |  | 到期日期 |
| image_url | varchar(255) | 是 |  | 证件图 |
| auth_status | varchar(32) | 是 | 'PENDING' | 审核状态 |
| reject_reason | varchar(255) | 否 | null | 驳回原因 |
| submitted_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 提交时间 |
| reviewed_at | datetime(3) | 否 | null | 审核时间 |
| reviewer_id | bigint unsigned | 否 | null | 审核人 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_user_id (user_id)`
2. `key idx_auth_status (auth_status)`

## 5.3 `vehicle`

表说明：

1. 车主车辆表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| user_id | bigint unsigned | 是 |  | 所属用户 |
| plate_no_cipher | varchar(255) | 是 |  | 加密车牌 |
| plate_no_masked | varchar(32) | 是 |  | 脱敏车牌 |
| brand | varchar(64) | 是 |  | 品牌 |
| model | varchar(64) | 是 |  | 车型 |
| color | varchar(32) | 是 |  | 颜色 |
| seat_count | tinyint unsigned | 是 | 4 | 座位数 |
| vehicle_image_url | varchar(255) | 否 | null | 车辆图片 |
| auth_status | varchar(32) | 是 | 'PENDING' | 审核状态 |
| is_default | tinyint unsigned | 是 | 0 | 是否默认车 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_user_id (user_id)`
2. `key idx_auth_status (auth_status)`
3. `key idx_user_default (user_id, is_default)`

---

## 6. 行程与匹配表设计

## 6.1 `route_template`

表说明：

1. 常用路线模板

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| user_id | bigint unsigned | 是 |  | 用户 ID |
| route_name | varchar(64) | 是 |  | 路线名称 |
| start_name | varchar(128) | 是 |  | 起点名 |
| start_lat | decimal(11,7) | 是 |  | 起点纬度 |
| start_lng | decimal(11,7) | 是 |  | 起点经度 |
| end_name | varchar(128) | 是 |  | 终点名 |
| end_lat | decimal(11,7) | 是 |  | 终点纬度 |
| end_lng | decimal(11,7) | 是 |  | 终点经度 |
| time_period | varchar(64) | 否 | null | 时间段描述 |
| is_default | tinyint unsigned | 是 | 0 | 是否默认 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_user_id (user_id)`
2. `key idx_user_default (user_id, is_default)`

## 6.2 `trip`

表说明：

1. 车主发布的行程主表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| driver_user_id | bigint unsigned | 是 |  | 车主 ID |
| vehicle_id | bigint unsigned | 是 |  | 车辆 ID |
| start_name | varchar(128) | 是 |  | 起点名 |
| start_lat | decimal(11,7) | 是 |  | 起点纬度 |
| start_lng | decimal(11,7) | 是 |  | 起点经度 |
| end_name | varchar(128) | 是 |  | 终点名 |
| end_lat | decimal(11,7) | 是 |  | 终点纬度 |
| end_lng | decimal(11,7) | 是 |  | 终点经度 |
| depart_at | datetime(3) | 是 |  | 出发时间 |
| seat_total | tinyint unsigned | 是 | 1 | 可载人数 |
| seat_available | tinyint unsigned | 是 | 1 | 剩余座位 |
| price_total_fen | bigint | 是 | 0 | 总费用 |
| mileage_fee_fen | bigint | 是 | 0 | 里程费 |
| toll_fee_fen | bigint | 是 | 0 | 高速费 |
| service_fee_fen | bigint | 是 | 0 | 服务费 |
| distance_meter | int unsigned | 是 | 0 | 行程距离 |
| route_score | decimal(5,2) | 是 | 0.00 | 顺路度 |
| trip_status | varchar(32) | 是 | 'PUBLISHED' | 行程状态 |
| route_rule_snapshot_id | bigint unsigned | 否 | null | 顺路度规则快照 ID |
| frequency_rule_snapshot_id | bigint unsigned | 否 | null | 频控规则快照 ID |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |
| deleted_at | datetime(3) | 否 | null | 软删除时间 |

索引建议：

1. `key idx_driver_depart_at (driver_user_id, depart_at)`
2. `key idx_trip_status (trip_status)`
3. `key idx_depart_at (depart_at)`

## 6.3 `trip_waypoint`

表说明：

1. 行程途经点表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| trip_id | bigint unsigned | 是 |  | 行程 ID |
| seq_no | smallint unsigned | 是 | 1 | 顺序 |
| point_name | varchar(128) | 是 |  | 途经点名称 |
| lat | decimal(11,7) | 是 |  | 纬度 |
| lng | decimal(11,7) | 是 |  | 经度 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_trip_seq (trip_id, seq_no)`

## 6.4 `join_request`

表说明：

1. 乘客对车主行程发起的申请
2. 申请对象独立于正式订单对象

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| trip_id | bigint unsigned | 是 |  | 行程 ID |
| passenger_user_id | bigint unsigned | 是 |  | 乘客 ID |
| start_name | varchar(128) | 是 |  | 实际上车点 |
| start_lat | decimal(11,7) | 是 |  | 纬度 |
| start_lng | decimal(11,7) | 是 |  | 经度 |
| end_name | varchar(128) | 是 |  | 实际下车点 |
| end_lat | decimal(11,7) | 是 |  | 纬度 |
| end_lng | decimal(11,7) | 是 |  | 经度 |
| request_status | varchar(32) | 是 | 'PENDING_DRIVER_CONFIRM' | 申请状态 |
| accepted_at | datetime(3) | 否 | null | 接受时间 |
| rejected_at | datetime(3) | 否 | null | 拒绝时间 |
| cancelled_at | datetime(3) | 否 | null | 乘客取消时间 |
| expired_at | datetime(3) | 否 | null | 过期时间 |
| rejected_reason | varchar(255) | 否 | null | 拒绝原因 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_trip_id (trip_id)`
2. `key idx_passenger_id (passenger_user_id)`
3. `unique key uk_trip_passenger_status (trip_id, passenger_user_id, request_status)`

## 6.5 `trip_match_candidate`

表说明：

1. 匹配结果缓存表，可选
2. 用于存储某次匹配的候选结果

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| trip_id | bigint unsigned | 是 |  | 行程 ID |
| passenger_user_id | bigint unsigned | 是 |  | 乘客 ID |
| route_score | decimal(5,2) | 是 | 0.00 | 顺路度 |
| estimated_fee_fen | bigint | 是 | 0 | 预估费用 |
| sort_score | decimal(10,4) | 是 | 0.0000 | 排序分 |
| calc_snapshot_id | bigint unsigned | 是 |  | 快照 ID |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_passenger_created (passenger_user_id, created_at)`
2. `key idx_trip_id (trip_id)`

---

## 7. 订单与支付表设计

## 7.1 `ride_order`

表说明：

1. 正式订单主表
2. 仅在车主接受 `join_request` 后创建

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_no | varchar(64) | 是 |  | 订单号 |
| trip_id | bigint unsigned | 是 |  | 行程 ID |
| join_request_id | bigint unsigned | 是 |  | 申请 ID |
| driver_user_id | bigint unsigned | 是 |  | 车主 ID |
| passenger_user_id | bigint unsigned | 是 |  | 乘客 ID |
| order_status | varchar(32) | 是 | 'PENDING_PASSENGER_PAY' | 订单状态 |
| board_confirmed_at | datetime(3) | 否 | null | 上车确认时间 |
| arrival_confirmed_at | datetime(3) | 否 | null | 到达确认时间 |
| cancel_reason | varchar(255) | 否 | null | 取消原因 |
| exception_flag | tinyint unsigned | 是 | 0 | 异常标记 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_order_no (order_no)`
2. `key idx_trip_id (trip_id)`
3. `key idx_driver_status (driver_user_id, order_status)`
4. `key idx_passenger_status (passenger_user_id, order_status)`

## 7.2 `order_status_log`

表说明：

1. 订单状态流转日志

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 是 |  | 订单 ID |
| from_status | varchar(32) | 否 | null | 原状态 |
| to_status | varchar(32) | 是 |  | 新状态 |
| operator_type | varchar(32) | 是 |  | 操作者类型 |
| operator_id | bigint unsigned | 否 | null | 操作者 ID |
| remark | varchar(255) | 否 | null | 备注 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_order_created (order_id, created_at)`

## 7.3 `order_price`

表说明：

1. 订单费用明细

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 是 |  | 订单 ID |
| mileage_fee_fen | bigint | 是 | 0 | 里程费 |
| toll_fee_fen | bigint | 是 | 0 | 高速费 |
| service_fee_fen | bigint | 是 | 0 | 平台服务费 |
| discount_amount_fen | bigint | 是 | 0 | 优惠金额 |
| payable_amount_fen | bigint | 是 | 0 | 应付金额 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_order_id (order_id)`

## 7.4 `payment_order`

表说明：

1. 支付单表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| biz_order_id | bigint unsigned | 是 |  | 业务订单 ID |
| out_trade_no | varchar(64) | 是 |  | 商户订单号 |
| pay_channel | varchar(32) | 是 | 'WECHAT' | 支付渠道 |
| pay_status | varchar(32) | 是 | 'INIT' | 支付状态 |
| total_amount_fen | bigint | 是 | 0 | 支付金额 |
| paid_at | datetime(3) | 否 | null | 支付时间 |
| callback_payload | json | 否 | null | 回调摘要 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_out_trade_no (out_trade_no)`
2. `key idx_biz_order_id (biz_order_id)`
3. `key idx_pay_status (pay_status)`

## 7.5 `refund_order`

表说明：

1. 退款单表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| payment_order_id | bigint unsigned | 是 |  | 支付单 ID |
| refund_no | varchar(64) | 是 |  | 退款单号 |
| refund_amount_fen | bigint | 是 | 0 | 退款金额 |
| refund_status | varchar(32) | 是 | 'INIT' | 退款状态 |
| refund_reason | varchar(255) | 是 |  | 退款原因 |
| refunded_at | datetime(3) | 否 | null | 退款完成时间 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_refund_no (refund_no)`
2. `key idx_payment_order_id (payment_order_id)`

## 7.6 `settlement_record`

表说明：

1. 订单结算记录

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 是 |  | 订单 ID |
| driver_user_id | bigint unsigned | 是 |  | 车主 ID |
| settle_amount_fen | bigint | 是 | 0 | 结算金额 |
| service_fee_fen | bigint | 是 | 0 | 平台服务费 |
| settle_status | varchar(32) | 是 | 'INIT' | 结算状态 |
| settled_at | datetime(3) | 否 | null | 结算时间 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_order_id (order_id)`
2. `key idx_driver_status (driver_user_id, settle_status)`

---

## 8. 钱包与提现表设计

## 8.1 `wallet_account`

表说明：

1. 钱包账户主表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| user_id | bigint unsigned | 是 |  | 用户 ID |
| available_amount_fen | bigint | 是 | 0 | 可用余额 |
| frozen_amount_fen | bigint | 是 | 0 | 冻结余额 |
| total_income_fen | bigint | 是 | 0 | 累计收入 |
| total_withdraw_fen | bigint | 是 | 0 | 累计提现 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_user_id (user_id)`

## 8.2 `wallet_ledger`

表说明：

1. 钱包流水表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| account_id | bigint unsigned | 是 |  | 账户 ID |
| biz_type | varchar(32) | 是 |  | 业务类型 |
| change_amount_fen | bigint | 是 | 0 | 变动金额 |
| balance_after_fen | bigint | 是 | 0 | 变动后余额 |
| biz_no | varchar(64) | 否 | null | 业务编号 |
| remark | varchar(255) | 否 | null | 备注 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_account_created (account_id, created_at)`
2. `key idx_biz_type (biz_type)`
3. `key idx_biz_no (biz_no)`

## 8.3 `withdraw_record`

表说明：

1. 提现记录表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| user_id | bigint unsigned | 是 |  | 用户 ID |
| account_id | bigint unsigned | 是 |  | 钱包账户 ID |
| withdraw_no | varchar(64) | 是 |  | 提现单号 |
| amount_fen | bigint | 是 | 0 | 提现金额 |
| withdraw_status | varchar(32) | 是 | 'PENDING' | 提现状态 |
| channel | varchar(32) | 是 | 'WECHAT' | 提现渠道 |
| processed_at | datetime(3) | 否 | null | 处理时间 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_withdraw_no (withdraw_no)`
2. `key idx_user_status (user_id, withdraw_status)`

---

## 9. 安全与风控表设计

## 9.1 `trip_trace_point`

表说明：

1. 轨迹点明细表
2. 数据量大，后续可按月分表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 是 |  | 订单 ID |
| lat | decimal(11,7) | 是 |  | 纬度 |
| lng | decimal(11,7) | 是 |  | 经度 |
| speed | decimal(6,2) | 否 | null | 速度 |
| source_type | varchar(32) | 是 | 'CLIENT' | 来源类型 |
| recorded_at | datetime(3) | 是 |  | 记录时间 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_order_recorded (order_id, recorded_at)`

## 9.2 `trip_trace_summary`

表说明：

1. 轨迹汇总表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 是 |  | 订单 ID |
| total_distance_meter | int unsigned | 是 | 0 | 总里程 |
| total_duration_second | int unsigned | 是 | 0 | 总时长 |
| abnormal_flag | tinyint unsigned | 是 | 0 | 异常标记 |
| start_at | datetime(3) | 否 | null | 起始时间 |
| end_at | datetime(3) | 否 | null | 结束时间 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_order_id (order_id)`

## 9.3 `audio_record_meta`

表说明：

1. 录音元数据表
2. 一期可以先只存元数据

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 是 |  | 订单 ID |
| file_url | varchar(255) | 是 |  | 文件地址 |
| duration_second | int unsigned | 是 | 0 | 时长 |
| enabled_by_user | tinyint unsigned | 是 | 1 | 是否用户手动开启 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_order_id (order_id)`

## 9.4 `sos_event`

表说明：

1. SOS 报警事件

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 是 |  | 订单 ID |
| user_id | bigint unsigned | 是 |  | 触发用户 ID |
| current_lat | decimal(11,7) | 否 | null | 当前纬度 |
| current_lng | decimal(11,7) | 否 | null | 当前经度 |
| remark | varchar(255) | 否 | null | 备注 |
| event_status | varchar(32) | 是 | 'PENDING' | 处理状态 |
| triggered_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 触发时间 |
| handler_id | bigint unsigned | 否 | null | 处理人 |
| handled_at | datetime(3) | 否 | null | 处理时间 |
| result_note | varchar(255) | 否 | null | 处理结果 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_order_id (order_id)`
2. `key idx_status_triggered (event_status, triggered_at)`

## 9.5 `rule_snapshot`

表说明：

1. 规则快照通用表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| rule_type | varchar(32) | 是 |  | 规则类型 |
| rule_version | varchar(32) | 是 |  | 规则版本 |
| snapshot_json | json | 是 |  | 快照 JSON |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_rule_type_created (rule_type, created_at)`

## 9.6 `pricing_audit_log`

表说明：

1. 定价审计日志

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| trip_id | bigint unsigned | 是 |  | 行程 ID |
| pricing_input_json | json | 是 |  | 定价入参 |
| pricing_result_json | json | 是 |  | 定价结果 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_trip_created (trip_id, created_at)`

## 9.7 `frequency_limit_log`

表说明：

1. 接单频控校验日志

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| driver_user_id | bigint unsigned | 是 |  | 车主 ID |
| city_code | varchar(32) | 是 |  | 城市编码 |
| trip_type | varchar(32) | 是 |  | 市内/跨城 |
| current_day_count | int unsigned | 是 | 0 | 当日次数 |
| current_month_count | int unsigned | 是 | 0 | 当月次数 |
| rule_snapshot_id | bigint unsigned | 是 |  | 规则快照 ID |
| passed | tinyint unsigned | 是 | 0 | 是否通过 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_driver_created (driver_user_id, created_at)`
2. `key idx_city_created (city_code, created_at)`

## 9.8 `risk_event`

表说明：

1. 泛化风险事件表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 否 | null | 订单 ID |
| user_id | bigint unsigned | 否 | null | 关联用户 |
| risk_type | varchar(32) | 是 |  | 风险类型 |
| risk_level | varchar(16) | 是 |  | 风险等级 |
| content | varchar(255) | 是 |  | 风险内容 |
| extra_json | json | 否 | null | 扩展信息 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_order_type (order_id, risk_type)`
2. `key idx_user_type (user_id, risk_type)`

## 9.9 `operation_audit_log`

表说明：

1. 操作审计日志
2. 用于记录后台导出、审核、处理等行为

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| operator_id | bigint unsigned | 否 | null | 操作者 ID |
| operator_type | varchar(32) | 是 |  | 操作者类型 |
| action | varchar(64) | 是 |  | 动作 |
| biz_type | varchar(32) | 是 |  | 业务类型 |
| biz_id | bigint unsigned | 否 | null | 业务 ID |
| request_id | varchar(64) | 否 | null | 请求 ID |
| extra_json | json | 否 | null | 扩展信息 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_operator_created (operator_id, created_at)`
2. `key idx_biz_type_id (biz_type, biz_id)`

---

## 10. 管理后台与运营表设计

## 10.1 `admin_user`

表说明：

1. 后台账号主表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| username | varchar(64) | 是 |  | 登录账号 |
| password_hash | varchar(255) | 是 |  | 密码哈希 |
| display_name | varchar(64) | 是 |  | 展示名称 |
| mobile | varchar(20) | 否 | null | 手机号 |
| status | varchar(32) | 是 | 'ENABLED' | 账号状态 |
| last_login_at | datetime(3) | 否 | null | 最后登录时间 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_username (username)`
2. `key idx_status (status)`

## 10.2 `admin_role`

表说明：

1. 后台角色表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| role_code | varchar(64) | 是 |  | 角色编码 |
| role_name | varchar(64) | 是 |  | 角色名称 |
| status | varchar(32) | 是 | 'ENABLED' | 状态 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_role_code (role_code)`

## 10.3 `admin_permission`

表说明：

1. 后台权限点表
2. 同时支持菜单权限与按钮权限

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| permission_code | varchar(128) | 是 |  | 权限编码 |
| permission_name | varchar(64) | 是 |  | 权限名称 |
| permission_type | varchar(32) | 是 | 'MENU' | MENU/BUTTON |
| parent_code | varchar(128) | 否 | null | 父级权限编码 |
| sort_no | int unsigned | 是 | 0 | 排序号 |
| status | varchar(32) | 是 | 'ENABLED' | 状态 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_permission_code (permission_code)`
2. `key idx_parent_code (parent_code)`

## 10.4 `admin_user_role`

表说明：

1. 后台账号与角色关联表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| admin_user_id | bigint unsigned | 是 |  | 后台账号 ID |
| admin_role_id | bigint unsigned | 是 |  | 角色 ID |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `unique key uk_user_role (admin_user_id, admin_role_id)`

## 10.5 `admin_role_permission`

表说明：

1. 后台角色与权限关联表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| admin_role_id | bigint unsigned | 是 |  | 角色 ID |
| admin_permission_id | bigint unsigned | 是 |  | 权限 ID |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `unique key uk_role_permission (admin_role_id, admin_permission_id)`

## 10.6 `audit_task`

表说明：

1. 审核任务主表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| task_type | varchar(32) | 是 |  | 任务类型 |
| biz_id | bigint unsigned | 是 |  | 业务 ID |
| task_status | varchar(32) | 是 | 'PENDING' | 审核状态 |
| applicant_user_id | bigint unsigned | 是 |  | 申请人 |
| reviewer_id | bigint unsigned | 否 | null | 审核人 |
| result_note | varchar(255) | 否 | null | 结果说明 |
| submitted_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 提交时间 |
| reviewed_at | datetime(3) | 否 | null | 审核时间 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_task_type_status (task_type, task_status)`
2. `key idx_applicant_id (applicant_user_id)`

## 10.7 `complaint_ticket`

表说明：

1. 投诉工单表

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| order_id | bigint unsigned | 是 |  | 订单 ID |
| complainant_user_id | bigint unsigned | 是 |  | 投诉人 |
| ticket_status | varchar(32) | 是 | 'OPEN' | 工单状态 |
| category | varchar(32) | 是 |  | 分类 |
| content | varchar(500) | 是 |  | 内容 |
| handler_id | bigint unsigned | 否 | null | 处理人 |
| handled_at | datetime(3) | 否 | null | 处理时间 |
| result_note | varchar(255) | 否 | null | 处理结果 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_order_id (order_id)`
2. `key idx_status_created (ticket_status, created_at)`

## 10.8 `ops_case_record`

表说明：

1. 运营人工处理记录

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| biz_type | varchar(32) | 是 |  | 业务类型 |
| biz_id | bigint unsigned | 是 |  | 业务 ID |
| handler_id | bigint unsigned | 是 |  | 处理人 |
| action | varchar(64) | 是 |  | 处理动作 |
| content | varchar(500) | 否 | null | 处理说明 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |

索引建议：

1. `key idx_biz_type_id (biz_type, biz_id)`

## 10.9 `cms_banner`

表说明：

1. 轮播图配置

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| title | varchar(64) | 是 |  | 标题 |
| image_url | varchar(255) | 是 |  | 图片地址 |
| link_url | varchar(255) | 否 | null | 跳转链接 |
| sort_no | int unsigned | 是 | 0 | 排序号 |
| status | varchar(32) | 是 | 'ENABLED' | 状态 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `key idx_status_sort (status, sort_no)`

## 10.10 `cms_article`

表说明：

1. 协议与帮助中心文章

字段设计：

| 字段名 | 类型 | 非空 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| id | bigint unsigned | 是 |  | 主键 |
| article_type | varchar(32) | 是 |  | 文章类型 |
| title | varchar(128) | 是 |  | 标题 |
| content | longtext | 是 |  | 内容 |
| status | varchar(32) | 是 | 'DRAFT' | 状态 |
| created_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 创建时间 |
| updated_at | datetime(3) | 是 | CURRENT_TIMESTAMP(3) | 更新时间 |

索引建议：

1. `unique key uk_article_type (article_type)`

---

## 11. 表关系说明

### 11.1 关键关系

1. `user` 1 对多 `emergency_contact`
2. `user` 1 对 1 `driver_profile`
3. `user` 1 对多 `vehicle`
4. `user` 1 对多 `route_template`
5. `trip` 1 对多 `trip_waypoint`
6. `trip` 1 对多 `join_request`
7. `join_request` 0..1 对 1 `ride_order`
8. `trip` 1 对多 `ride_order`
9. `ride_order` 1 对 1 `order_price`
10. `ride_order` 1 对多 `order_status_log`
11. `ride_order` 1 对 1 `payment_order`
12. `payment_order` 1 对多 `refund_order`
13. `ride_order` 1 对 1 `settlement_record`
14. `ride_order` 1 对多 `trip_trace_point`
15. `ride_order` 1 对 1 `trip_trace_summary`
16. `ride_order` 1 对多 `sos_event`
17. `admin_user` 多对多 `admin_role`，通过 `admin_user_role`
18. `admin_role` 多对多 `admin_permission`，通过 `admin_role_permission`

### 11.2 一期外键策略

建议：

1. 逻辑上设计外键关系
2. 生产环境是否启用 MySQL 外键可根据团队习惯决定
3. 即使不启用物理外键，也要在代码和 migration 中维护引用关系

---

## 12. 分表与扩展建议

### 12.1 后续可能需要分表的表

1. `trip_trace_point`
2. `wallet_ledger`
3. `operation_audit_log`
4. `pricing_audit_log`
5. `frequency_limit_log`

### 12.2 后续可迁移出 MySQL 的数据

1. 轨迹明细可迁移到时序存储
2. 审计日志可部分迁移到日志系统
3. 录音文件本身放对象存储，不放数据库

---

## 13. 一期建表顺序建议

推荐顺序：

1. `user`
2. `realname_auth`
3. `emergency_contact`
4. `driver_profile`
5. `driver_license`
6. `vehicle`
7. `route_template`
8. `rule_snapshot`
9. `admin_user`
10. `admin_role`
11. `admin_permission`
12. `admin_user_role`
13. `admin_role_permission`
14. `trip`
15. `trip_waypoint`
16. `join_request`
17. `ride_order`
18. `order_status_log`
19. `order_price`
20. `payment_order`
21. `refund_order`
22. `settlement_record`
23. `wallet_account`
24. `wallet_ledger`
25. `withdraw_record`
26. `trip_trace_point`
27. `trip_trace_summary`
28. `sos_event`
29. `pricing_audit_log`
30. `frequency_limit_log`
31. `audit_task`
32. `complaint_ticket`
33. `ops_case_record`
34. `cms_banner`
35. `cms_article`

---

## 14. 最终建议

一期数据库设计最重要的不是表数量，而是以下四件事必须从第一天就设计对：

1. 金额全部用分存储
2. 状态机日志独立留表
3. 顺路度、频控、定价必须有快照或审计日志
4. 轨迹、SOS、导出等安全动作必须能追溯

只要这四件事先做稳，后续做专线、补贴、会员、跨平台扩展时，数据库层就不会推倒重来。
