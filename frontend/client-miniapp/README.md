# 微信小程序客户端说明

本目录是独立于后端代码的微信小程序客户端工程，位置为 `frontend/client-miniapp`，不会和 Go 后端代码混在一起。

## 技术形态

- 原生微信小程序
- JavaScript + WXML + WXSS
- 主包 + 分包结构
- 真实接口默认指向 `http://127.0.0.1:18082`
- 开发态支付回调代理默认指向 `http://127.0.0.1:4174`

## 页面结构

- 主包
  - 首页 `pages/home/index`
  - 订单 `pages/order/index`
  - 发布 `pages/publish/index`
  - 安全 `pages/safety/index`
  - 我的 `pages/profile/index`
- 乘客分包
  - 匹配列表 `packages/passenger/match-list/index`
  - 行程详情 `packages/passenger/trip-detail/index`
  - 支付确认 `packages/passenger/payment-confirm/index`
- 通用分包
  - 订单详情 `packages/common/order-detail/index`
- 车主分包
  - 车辆管理 `packages/driver/vehicles/index`
  - 驾驶证认证 `packages/driver/license/index`
  - 钱包 `packages/driver/wallet/index`

## 当前已接入的真实链路

- 开发 code 登录 / 微信登录
- 首页搜索匹配
- 行程详情与同行申请
- 乘客 / 车主双视角订单中心
- 订单详情
- 支付单创建 + 本地模拟支付成功回调
- 发布行程
- 紧急联系人
- 资料更新与实名认证
- 车辆管理
- 驾驶证提交
- 钱包余额与流水

## 微信开发者工具导入

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择 `D:\GoLang\workspace\sfc\frontend\client-miniapp`。
4. 使用已有 AppID 或测试号导入。
5. 在“详情 -> 本地设置”中关闭：
   - 不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书
6. 确认本机后端实例已启动：
   - 小程序接口：`18082`
   - 本地支付模拟代理：`4174`

## 推荐联调账号

- 乘客：`passenger-alpha`
- 车主：`driver-alpha`

如果需要完整闭环数据，也可以继续使用之前已验证过的 E2E 账号和订单数据。

## 本地校验

在 `frontend/client-miniapp` 目录执行：

```bash
node scripts/verify-miniapp.js
```

校验内容包括：

- `app.json` 路由引用的页面是否存在
- 每个页面是否具备 `js/json/wxml/wxss`
- 每个页面引用的组件是否存在
- 全部 JSON 文件是否合法

## 注意事项

- 微信小程序访问本地 `http://127.0.0.1:18082` 主要用于开发者工具联调，真机调试时需要换成局域网地址或正式域名。
- 支付页里的“模拟支付成功”不会伪造前端状态，而是通过 `4174` 代理向真实后端回调，再回查真实订单与支付状态。
- 常用路线接口当前只返回名称摘要，因此发布页会展示后端路线摘要，同时继续使用本地路线预设承接经纬度输入。
