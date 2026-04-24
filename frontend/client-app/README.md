# 顺风车客户端前端工程

这是一个和 Go 后端完全分离的独立前端目录，专门承接客户端 UI 的开发与逐页 React 化工作。

## 当前目标

1. 承接 `output/client-ui-final` 中已经定稿的客户端 HTML 设计页。
2. 把 `docs/顺风车前端开发文档.md` 与 `docs/顺风车OpenAPI接口清单.md` 中和客户端相关的信息映射到页面级工作台。
3. 为后续的真实业务实现预留统一的页面清单、状态稿和接口契约入口。

## 目录说明

```text
frontend/client-app/
  public/design/          # 复制进来的客户端定稿 HTML / CSS
  src/
    data/
      clientWorkbench.ts  # 页面清单、接口契约、开发洞察
    App.tsx               # 客户端开发工作台
    App.css               # 工作台样式
    index.css             # 全局样式
```

## 本地运行

```bash
cd frontend/client-app
npm install
npm run dev
```

## 当前实现方式

- 左侧：页面目录、搜索、分类筛选。
- 中间：客户端设计页预览区，直接加载 `public/design` 中的页面原稿。
- 右侧：关键状态、接口契约和开发建议，方便后续逐页替换成真实 React 页面。

## 下一步建议

1. 先从 `首页搜索`、`匹配列表`、`行程详情`、`支付确认` 四页开始做真实 React 组件替换。
2. 同步补 `services/`、`mocks/` 和统一状态枚举，把页面层从设计预览过渡到真实数据流。
3. 对 `优惠券`、`客服与帮助` 这类尚缺客户端契约的页面，先补接口定义再继续深入开发。
