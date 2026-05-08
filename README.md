# SFC 顺风车

SFC 是一个顺风车本地联调项目，当前保留微信小程序、Go 后端和后台管理系统三部分。前台 React Web 客户端已移除，用户端以微信小程序为唯一前台入口。

## 项目范围

- 微信小程序：`frontend/client-miniapp`
- 后台管理系统：`frontend/admin-web`
- 后端 API：`server`
- 联调脚本：`scripts`
- 项目文档：`docs`

## 本地启动

### 后端 API

```bash
cd server
go run ./cmd/api
```

默认监听 `http://127.0.0.1:8080`。本地配置参考 `server/.env.example` 或环境变量，真实密钥不要提交到仓库。

### 后台管理系统

```bash
cd frontend/admin-web
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

本地后台地址为 `http://127.0.0.1:5174`，默认联调账号为 `admin / admin123`。

### 微信小程序

使用微信开发者工具导入：

```text
frontend/client-miniapp
```

开发者工具中关闭“合法域名、web-view、TLS 版本以及 HTTPS 证书”校验。小程序默认访问 `http://127.0.0.1:18082`，不可用时会 fallback 到 `http://127.0.0.1:8080`。

## 一键联调

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run-full-chain-local.ps1 -StopOnExit
```

脚本会复用或启动后端与后台管理系统，并执行全链路冒烟检查。

## 本地验证

```bash
cd server
go test ./...
```

```bash
cd frontend/admin-web
npm run lint
npm run build
```

```bash
node frontend/client-miniapp/scripts/verify-miniapp.js
```

## 当前能力边界

已覆盖本地核心闭环：fake 微信登录、司机认证、车辆、发布行程、搜索匹配、同行申请、接单、订单支付、本地 mock 支付回调、履约、安全、钱包和后台核查。

以下能力仍属于生产化 Todo，不应表述为已完成：

- 真实微信支付商户号、证书、验签、退款和生产回调
- MySQL Store 与生产数据迁移
- 短信、订阅消息和真实地图服务
- 后台异步导出任务
- 监控告警、CI/CD 和部署清单

## 文档入口

- 文档总入口：`docs/README.md`
- 阅读顺序：`docs/00-阅读顺序.md`
- 后端任务文档：`docs/backend-task-docs/`
- 全端联调进度：`docs/backend-task-docs/06-全端功能联调进度.md`

后续开发以任务文档中的 `Done`、`Todo`、`Next` 为状态事实源。
