import { useState } from 'react'
import './App.css'
import {
  auditColumns,
  auditLogStats,
  auditRows,
  auditStats,
  commandFilters,
  contentStats,
  dashboardStats,
  financeColumns,
  financeRows,
  financeStats,
  navItems,
  opsStats,
  orderColumns,
  orderRows,
  orderStats,
  orderTrend,
  reportStats,
  riskPanels,
  riskStats,
  todoQueue,
  tokenGroups,
  userStats,
  type PageKey,
  type ProgressItem,
  type StatItem,
  type TableColumn,
  type TableRow,
} from './adminData'

function App() {
  const [currentPage, setCurrentPage] = useState<PageKey>('dashboard')

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div>
            <p>顺风车后台</p>
            <strong>Admin Console</strong>
          </div>
        </div>
        <div className="sidebar-copy">
          <span className="eyebrow">x1 实现版</span>
          <p>沿用“航迹指挥台”视觉方向，先完成页面骨架和信息密度，再逐步接入后台接口。</p>
        </div>
        <nav className="sidebar-nav" aria-label="后台主导航">
          {navItems.map((item) => {
            const active = item.key === currentPage
            return (
              <button
                key={item.key}
                type="button"
                className={active ? 'nav-item active' : 'nav-item'}
                onClick={() => setCurrentPage(item.key)}
              >
                <span className="nav-code">{item.code}</span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.summary}</small>
                </span>
              </button>
            )
          })}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">当前策略</span>
          <strong>静态页面先工程化</strong>
          <p>后续优先接 `admin/auth`、`dashboard`、`audits`、`orders`、`risk`、`finance` 六条主链路。</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">运营驾驶舱</p>
            <h1>{navItems.find((item) => item.key === currentPage)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-btn">查看会话</button>
            <button type="button" className="ghost-btn">导出日报</button>
            <button type="button" className="primary-btn">进入处置流</button>
          </div>
        </header>

        <div className="command-strip">
          {commandFilters.map((item, index) => (
            <span key={item} className={index === 3 ? 'command-chip alert' : 'command-chip'}>
              {item}
            </span>
          ))}
          <span className="live-pill">自动刷新中 · 30s</span>
        </div>

        <section className="page-stage">{renderPage(currentPage)}</section>
      </main>
    </div>
  )
}

function renderPage(page: PageKey) {
  switch (page) {
    case 'login':
      return <LoginPage />
    case 'dashboard':
      return <DashboardPage />
    case 'audit':
      return <AuditPage />
    case 'orders':
      return <OrdersPage />
    case 'risk':
      return <RiskPage />
    case 'finance':
      return <FinancePage />
    case 'users':
      return <UsersPage />
    case 'ops':
      return <OpsPage />
    case 'content':
      return <ContentPage />
    case 'report':
      return <ReportPage />
    case 'auditlog':
      return <AuditLogPage />
    case 'tokens':
      return <TokensPage />
    default:
      return null
  }
}

function LoginPage() {
  return (
    <div className="page-grid auth-layout">
      <Surface
        title="登录与会话恢复"
        subtitle="所有后台业务页进入前，必须先完成登录、会话恢复、权限点拉取三步。"
        actions={<span className="status-badge info">Session Ready</span>}
      >
        <div className="field-grid">
          <Field label="账号" value="ops-admin@sfcar.com" />
          <Field label="密码" value="••••••••••••" />
          <Field label="短信验证码" value="263941" />
        </div>
        <div className="action-row">
          <button type="button" className="ghost-btn">重置</button>
          <button type="button" className="primary-btn">登录后台</button>
        </div>
      </Surface>
      <Surface title="权限初始化" subtitle="菜单显隐与按钮权限通过权限点矩阵动态控制。">
        <div className="info-list">
          <InfoItem title="页面权限" value="dashboard:view / audit:view / finance:view" />
          <InfoItem title="按钮权限" value="audit:approve / audit:reject / ledger:export" />
          <InfoItem title="路由守卫" value="未登录跳登录，无权限跳 403，按钮无权则不渲染" />
        </div>
      </Surface>
    </div>
  )
}

function DashboardPage() {
  return (
    <div className="page-grid">
      <StatsSection
        title="今日平台态势"
        subtitle="先回答平台是否稳定、哪里最急、哪里最危险、资金是否正常四个问题。"
        stats={dashboardStats}
      />
      <div className="two-col">
        <Surface title="订单趋势与城市热度" subtitle="用最少图形承载运营判断。">
          <ProgressList items={orderTrend} />
        </Surface>
        <Surface title="待办优先队列" subtitle="审核、风控、资金三条链路并排展示。">
          <div className="priority-list">
            {todoQueue.map((item) => (
              <div key={item.title} className={`priority-item ${item.tone}`}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  )
}

function AuditPage() {
  return (
    <div className="page-grid">
      <StatsSection title="资质审核队列" subtitle="列表、摘要、材料查看、历史记录、决策操作形成闭环。" stats={auditStats} />
      <div className="two-col dense-right">
        <Surface title="待审核列表" subtitle="筛选条固定在表格上方，异常项用颜色与文案双表达。">
          <DataTable columns={auditColumns} rows={auditRows} />
        </Surface>
        <Surface title="当前审核摘要" subtitle="右侧抽屉位后续接真实审核详情接口。">
          <div className="insight-card">
            <strong>王磊 / 浙A·8X2P6</strong>
            <p>资料完整度 92%，历史驳回 1 次，本次补传驾驶证副页和行驶证照片。</p>
            <div className="info-list compact">
              <InfoItem title="风险提示" value="证照反光轻微，建议放大复核" />
              <InfoItem title="历史记录" value="2026-04-18 因证件边缘缺失被驳回" />
            </div>
            <div className="action-row">
              <button type="button" className="ghost-btn">驳回补件</button>
              <button type="button" className="primary-btn">通过审核</button>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  )
}

function OrdersPage() {
  return (
    <div className="page-grid">
      <StatsSection title="订单中心" subtitle="重点不是字段多，而是快速定位异常订单并进入详情处理。" stats={orderStats} />
      <Surface title="订单列表" subtitle="搜索、风险标签、支付状态、履约状态并列呈现。">
        <DataTable columns={orderColumns} rows={orderRows} />
      </Surface>
    </div>
  )
}

function RiskPage() {
  return (
    <div className="page-grid">
      <StatsSection title="安全与风控" subtitle="SOS、超时、顺路度、频控、定价日志统一成一条阅读链路。" stats={riskStats} />
      <div className="three-col">
        {riskPanels.map((item) => (
          <Surface key={item.title} title={item.title} subtitle={item.body} tone={item.tone}>
            <div className={`tone-block ${item.tone}`}>
              <span>优先级</span>
              <strong>{item.tone === 'danger' ? 'P0' : item.tone === 'warning' ? 'P1' : 'P2'}</strong>
            </div>
          </Surface>
        ))}
      </div>
    </div>
  )
}

function FinancePage() {
  return (
    <div className="page-grid">
      <StatsSection title="财务中心" subtitle="强调绝对金额、状态、操作人与时间，确保可对账、可追溯。" stats={financeStats} />
      <div className="two-col">
        <Surface title="账务流水" subtitle="后续接 `/api/v1/admin/finance/ledger` 与提现审核接口。">
          <DataTable columns={financeColumns} rows={financeRows} />
        </Surface>
        <Surface title="收入结构" subtitle="折线与柱状对比后续替换成图表库，这里先保留密度与层级。">
          <ProgressList
            items={[
              { label: '平台服务费', value: 76, tone: 'success' },
              { label: '订阅收入', value: 48, tone: 'info' },
              { label: '资源占用费', value: 34, tone: 'brand' },
              { label: '退款补差', value: 12, tone: 'danger' },
            ]}
          />
        </Surface>
      </div>
    </div>
  )
}

function UsersPage() {
  return (
    <div className="page-grid">
      <StatsSection title="用户管理" subtitle="实名、紧急联系人、投诉摘要统一在一页内完成首轮判断。" stats={userStats} />
      <div className="two-col">
        <Surface title="重点用户摘要" subtitle="高频投诉与实名缺失用户优先暴露。">
          <div className="info-list">
            <InfoItem title="高频投诉用户" value="近 7 日共 6 人，建议进入工单详情复核" />
            <InfoItem title="实名缺失" value="123 人仍未补齐实名或证件信息" />
            <InfoItem title="紧急联系人缺失" value="车主端优先补录，影响安全链路" />
          </div>
        </Surface>
        <Surface title="客服工单联动" subtitle="后续与订单详情、风控详情形成跳转联动。">
          <div className="priority-list">
            <div className="priority-item danger">
              <strong>投诉升级 · 乘客王某</strong>
              <p>涉及司机爽约 + 退款争议，需客服与财务同时跟进。</p>
            </div>
            <div className="priority-item warning">
              <strong>实名异常 · 司机何某</strong>
              <p>实名状态与驾驶证状态不一致，建议冻结发布能力。</p>
            </div>
          </div>
        </Surface>
      </div>
    </div>
  )
}

function OpsPage() {
  return (
    <div className="page-grid">
      <StatsSection title="专线运营" subtitle="专线配置、司机管理、补贴记录和服务包配置按运营决策顺序排布。" stats={opsStats} />
      <Surface title="专线状态矩阵" subtitle="优先呈现补贴中的线路和客服值守状态。">
        <ProgressList
          items={[
            { label: '杭州 → 上海', value: 88, tone: 'brand' },
            { label: '义乌 → 杭州', value: 72, tone: 'success' },
            { label: '宁波 → 上海', value: 53, tone: 'warning' },
            { label: '嘉兴 → 苏州', value: 38, tone: 'info' },
          ]}
        />
      </Surface>
    </div>
  )
}

function ContentPage() {
  return (
    <div className="page-grid">
      <StatsSection title="内容配置" subtitle="把草稿、预览、发布三态做实，方便后续接 CMS 接口。" stats={contentStats} />
      <div className="three-col">
        <Surface title="轮播图" subtitle="Banner 列表、上下线、排序与预览。">
          <TagGroup tags={['首页 Banner', '活动专区', '安全提示']} />
        </Surface>
        <Surface title="协议中心" subtitle="用户协议、隐私政策、安全须知版本管理。">
          <TagGroup tags={['用户协议 v2.8', '隐私政策 v2.3', '车主守则 v1.6']} />
        </Surface>
        <Surface title="帮助中心" subtitle="帮助分类、客服联系方式、FAQ 发布。">
          <TagGroup tags={['支付问题', '行程取消', '车主认证', '紧急求助']} />
        </Surface>
      </div>
    </div>
  )
}

function ReportPage() {
  return (
    <div className="page-grid">
      <StatsSection title="报表统计" subtitle="日、周、月周期切换后续接报表接口，这里先完成内容容器。" stats={reportStats} />
      <div className="two-col">
        <Surface title="订单 / 财务 / 用户 / 专线" subtitle="统一使用可扫描标题，减少营销式文案。">
          <ProgressList
            items={[
              { label: '订单完成率', value: 83, tone: 'success' },
              { label: '退款率', value: 19, tone: 'danger' },
              { label: '新用户增长', value: 62, tone: 'brand' },
              { label: '专线复购率', value: 47, tone: 'info' },
            ]}
          />
        </Surface>
        <Surface title="导出任务队列" subtitle="报表导出和审计导出共用一条异步任务体验。">
          <div className="info-list">
            <InfoItem title="订单周报" value="生成中，预计 2 分钟" />
            <InfoItem title="财务对账单" value="已完成，可下载" />
            <InfoItem title="专线月报" value="等待排队" />
          </div>
        </Surface>
      </div>
    </div>
  )
}

function AuditLogPage() {
  return (
    <div className="page-grid">
      <StatsSection title="操作审计" subtitle="行为日志、Request ID 检索与高风险导出提醒统一收口。" stats={auditLogStats} />
      <Surface title="审计链路摘要" subtitle="所有关键动作必须可回看、可定位、可归责。">
        <div className="timeline">
          {[
            '10:28 财务 03 发起提现审核',
            '10:19 运营 02 导出高风险订单列表',
            '09:57 审核专员 04 驳回司机资料',
            '09:41 系统任务执行日报汇总',
          ].map((item) => (
            <div key={item} className="timeline-item">
              <span />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  )
}

function TokensPage() {
  return (
    <div className="page-grid">
      <Surface title="设计 Token 与组件拆分" subtitle="把 `x1` 视觉稿翻译成可维护的前端实现约束。">
        <div className="three-col">
          {tokenGroups.map((group) => (
            <div key={group.title} className="token-group">
              <h3>{group.title}</h3>
              <ul>
                {group.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  )
}

function StatsSection(props: { title: string; subtitle: string; stats: StatItem[] }) {
  const { title, subtitle, stats } = props
  return (
    <Surface title={title} subtitle={subtitle}>
      <div className="stats-grid">
        {stats.map((item) => (
          <article key={item.label} className={`stat-card ${item.tone ?? 'brand'}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.change ? <small>{item.change}</small> : null}
          </article>
        ))}
      </div>
    </Surface>
  )
}

function Surface(props: {
  title: string
  subtitle: string
  children: React.ReactNode
  actions?: React.ReactNode
  tone?: 'brand' | 'info' | 'success' | 'warning' | 'danger'
}) {
  const { title, subtitle, children, actions, tone } = props
  return (
    <section className={tone ? `surface tone-${tone}` : 'surface'}>
      <div className="surface-head">
        <div>
          <span className="eyebrow">模块</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

function ProgressList(props: { items: ProgressItem[] }) {
  return (
    <div className="progress-list">
      {props.items.map((item) => (
        <div key={item.label} className="progress-row">
          <div className="progress-meta">
            <span>{item.label}</span>
            <strong>{item.value}%</strong>
          </div>
          <div className="progress-track">
            <div className={`progress-bar ${item.tone ?? 'brand'}`} style={{ width: `${item.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function DataTable(props: { columns: TableColumn[]; rows: TableRow[] }) {
  const { columns, rows } = props
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[columns[0].key]}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Field(props: { label: string; value: string }) {
  return (
    <div className="field-card">
      <label>{props.label}</label>
      <strong>{props.value}</strong>
    </div>
  )
}

function InfoItem(props: { title: string; value: string }) {
  return (
    <div className="info-item">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function TagGroup(props: { tags: string[] }) {
  return (
    <div className="tag-group">
      {props.tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
        </span>
      ))}
    </div>
  )
}

export default App
