import { useEffect, useState, type ReactNode } from 'react'
import './App.css'
import {
  auditFilters,
  colorTokens,
  commandFilters,
  componentTokens,
  contentStats,
  dashboardRiskHeat,
  navItems,
  opsLineInfo,
  opsStats,
  orderFilters,
  publishFlow,
  reportExports,
  reportProgress,
  reportStats,
  riskPanels,
  riskTabs,
  tokenGroups,
  typeTokens,
  userStats,
  type PageKey,
  type PriorityRecord,
  type ProgressItem,
  type StatItem,
  type TableColumn,
  type TableRow,
  type Tone,
} from './adminData'
import {
  adminApi,
  ApiError,
  type AdminAuditDetail,
  type AdminAuditListItem,
  type AdminAuditLogItem,
  type AdminDashboard,
  type AdminFinanceReports,
  type AdminLedgerItem,
  type AdminOpsOverview,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type AdminPermissions,
  type AdminPricingLog,
  type AdminRouteScoreLog,
  type AdminSession,
  type AdminSosEvent,
  type AdminTimeoutAlert,
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminWithdrawItem,
  type CMSArticle,
  type CMSBannerItem,
} from './lib/adminApi'
import {
  clearStoredAdminAuthState,
  loadStoredAdminAuthState,
  saveStoredAdminAuthState,
} from './lib/adminAuth'

interface PagerState {
  page: number
  pageSize: number
  total: number
}

interface AuditFilterState {
  taskType: string
  taskStatus: string
}

interface OrderFilterState {
  orderStatus: string
  driverKeyword: string
  passengerKeyword: string
  abnormalOnly: boolean
}

interface RiskFilterState {
  sosStatus: string
  viewMode: 'sos' | 'timeout' | 'route' | 'pricing'
}

interface FinanceFilterState {
  bizType: string
}

interface AppData {
  dashboard: AdminDashboard | null
  audits: AdminAuditListItem[]
  auditDetail: AdminAuditDetail | null
  orders: AdminOrderListItem[]
  orderDetail: AdminOrderDetail | null
  sosEvents: AdminSosEvent[]
  timeoutAlerts: AdminTimeoutAlert[]
  routeLogs: AdminRouteScoreLog[]
  pricingLogs: AdminPricingLog[]
  ledger: AdminLedgerItem[]
  withdraws: AdminWithdrawItem[]
  reports: AdminFinanceReports | null
  users: AdminUserListItem[]
  userDetail: AdminUserDetail | null
  opsOverview: AdminOpsOverview | null
  auditLogs: AdminAuditLogItem[]
  banners: CMSBannerItem[]
  helpArticle: CMSArticle | null
}

type RiskSelection =
  | { kind: 'sos'; id: number }
  | { kind: 'timeout'; id: number }
  | { kind: 'route'; id: number }
  | { kind: 'pricing'; id: number }
  | null

const emptyData: AppData = {
  dashboard: null,
  audits: [],
  auditDetail: null,
  orders: [],
  orderDetail: null,
  sosEvents: [],
  timeoutAlerts: [],
  routeLogs: [],
  pricingLogs: [],
  ledger: [],
  withdraws: [],
  reports: null,
  users: [],
  userDetail: null,
  opsOverview: null,
  auditLogs: [],
  banners: [],
  helpArticle: null,
}

function App() {
  const storedAuth = loadStoredAdminAuthState()
  const [currentPage, setCurrentPage] = useState<PageKey>(storedAuth.token ? 'dashboard' : 'login')
  const [session, setSession] = useState<AdminSession | null>(null)
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null)
  const [data, setData] = useState<AppData>(emptyData)
  const [errorMessage, setErrorMessage] = useState('')
  const [isBooting, setIsBooting] = useState(Boolean(storedAuth.token))
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [authForm, setAuthForm] = useState({
    username: storedAuth.username || 'admin',
    password: 'admin123',
  })

  const [auditPager, setAuditPager] = useState<PagerState>({ page: 1, pageSize: 20, total: 0 })
  const [orderPager, setOrderPager] = useState<PagerState>({ page: 1, pageSize: 20, total: 0 })
  const [riskPager, setRiskPager] = useState<PagerState>({ page: 1, pageSize: 20, total: 0 })
  const [financePager, setFinancePager] = useState<PagerState>({ page: 1, pageSize: 20, total: 0 })
  const [userPager, setUserPager] = useState<PagerState>({ page: 1, pageSize: 20, total: 0 })
  const [auditLogPager, setAuditLogPager] = useState<PagerState>({ page: 1, pageSize: 20, total: 0 })

  const [auditFiltersState, setAuditFiltersState] = useState<AuditFilterState>({ taskType: '', taskStatus: '' })
  const [orderFiltersState, setOrderFiltersState] = useState<OrderFilterState>({
    orderStatus: '',
    driverKeyword: '',
    passengerKeyword: '',
    abnormalOnly: false,
  })
  const [riskFiltersState, setRiskFiltersState] = useState<RiskFilterState>({ sosStatus: '', viewMode: 'sos' })
  const [financeFiltersState, setFinanceFiltersState] = useState<FinanceFilterState>({ bizType: '' })

  const [selectedAuditId, setSelectedAuditId] = useState<number | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [selectedRisk, setSelectedRisk] = useState<RiskSelection>(null)
  const [selectedLedgerId, setSelectedLedgerId] = useState<number | null>(null)
  const [selectedWithdrawId, setSelectedWithdrawId] = useState<number | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedBannerId, setSelectedBannerId] = useState<number | null>(null)

  async function restoreSessionAndBootstrap() {
    setIsBooting(true)
    setErrorMessage('')
    try {
      const [nextSession, nextPermissions] = await Promise.all([
        adminApi.getSession(),
        adminApi.getPermissions(),
      ])
      setSession(nextSession)
      setPermissions(nextPermissions)
      await Promise.all([
        refreshDashboard(),
        refreshAuditSection(auditPager.page),
        refreshOrderSection(orderPager.page),
        refreshRiskSection(riskPager.page),
        refreshFinanceSection(financePager.page),
        refreshUserSection(userPager.page),
        refreshOpsSection(),
        refreshAuditLogSection(auditLogPager.page),
        refreshContentSection(),
      ])
    } catch (error) {
      clearStoredAdminAuthState()
      setCurrentPage('login')
      setSession(null)
      setPermissions(null)
      setErrorMessage(resolveErrorMessage(error, '后台会话恢复失败，请重新登录。'))
    } finally {
      setIsBooting(false)
    }
  }

  async function handleLogin() {
    setIsBooting(true)
    setErrorMessage('')
    try {
      const result = await adminApi.login(authForm)
      saveStoredAdminAuthState({ token: result.token, username: authForm.username })
      setCurrentPage('dashboard')
      await restoreSessionAndBootstrap()
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '登录失败，请检查账号或密码。'))
      setIsBooting(false)
    }
  }

  function handleLogout() {
    clearStoredAdminAuthState()
    setSession(null)
    setPermissions(null)
    setData(emptyData)
    setCurrentPage('login')
    setErrorMessage('')
    setIsBooting(false)
  }

  async function refreshDashboard() {
    try {
      const dashboard = await adminApi.getDashboard()
      setData((current) => ({ ...current, dashboard }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '加载工作台失败。'))
    }
  }

  async function refreshAuditSection(page = 1) {
    try {
      const result = await adminApi.listAudits(auditFiltersState.taskType, auditFiltersState.taskStatus, page, auditPager.pageSize)
      setAuditPager({ page: result.page, pageSize: result.pageSize, total: result.total })
      const firstId = result.list[0]?.auditTaskId ?? null
      setSelectedAuditId(firstId)
      const auditDetail = firstId ? await adminApi.getAuditDetail(firstId) : null
      setData((current) => ({ ...current, audits: result.list, auditDetail }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '刷新审核列表失败。'))
    }
  }

  async function refreshOrderSection(page = 1) {
    try {
      const result = await adminApi.listOrders({
        abnormalFlag: orderFiltersState.abnormalOnly,
        orderStatus: orderFiltersState.orderStatus,
        driverKeyword: orderFiltersState.driverKeyword,
        passengerKeyword: orderFiltersState.passengerKeyword,
        page,
        pageSize: orderPager.pageSize,
      })
      setOrderPager({ page: result.page, pageSize: result.pageSize, total: result.total })
      const firstId = result.list[0]?.orderId ?? null
      setSelectedOrderId(firstId)
      const orderDetail = firstId ? await adminApi.getOrderDetail(firstId) : null
      setData((current) => ({ ...current, orders: result.list, orderDetail }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '刷新订单列表失败。'))
    }
  }

  async function refreshRiskSection(page = 1) {
    try {
      const [sos, timeoutAlerts, routeLogs, pricingLogs] = await Promise.all([
        adminApi.listSosEvents(riskFiltersState.sosStatus, page, riskPager.pageSize),
        adminApi.listTimeoutAlerts(page, riskPager.pageSize),
        adminApi.listRouteScoreLogs(page, riskPager.pageSize),
        adminApi.listPricingLogs(page, riskPager.pageSize),
      ])
      setRiskPager({ page: sos.page, pageSize: sos.pageSize, total: sos.total })
      const nextSelection: RiskSelection = sos.list[0]
        ? { kind: 'sos', id: sos.list[0].sosEventId }
        : timeoutAlerts.list[0]
          ? { kind: 'timeout', id: timeoutAlerts.list[0].orderId }
          : routeLogs.list[0]
            ? { kind: 'route', id: routeLogs.list[0].snapshotId }
            : pricingLogs.list[0]
              ? { kind: 'pricing', id: pricingLogs.list[0].pricingLogId }
              : null
      setSelectedRisk(nextSelection)
      setData((current) => ({
        ...current,
        sosEvents: sos.list,
        timeoutAlerts: timeoutAlerts.list,
        routeLogs: routeLogs.list,
        pricingLogs: pricingLogs.list,
      }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '刷新风控列表失败。'))
    }
  }

  async function refreshFinanceSection(page = 1) {
    try {
      const [ledger, withdraws, reports] = await Promise.all([
        adminApi.listFinanceLedger(financeFiltersState.bizType, page, financePager.pageSize),
        adminApi.listWithdraws(page, financePager.pageSize),
        adminApi.getFinanceReports(),
      ])
      setFinancePager({ page: ledger.page, pageSize: ledger.pageSize, total: ledger.total })
      setSelectedLedgerId(ledger.list[0]?.ledgerId ?? null)
      setSelectedWithdrawId(withdraws.list[0]?.withdrawId ?? null)
      setData((current) => ({
        ...current,
        ledger: ledger.list,
        withdraws: withdraws.list,
        reports,
      }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '刷新财务数据失败。'))
    }
  }

  async function refreshUserSection(page = 1) {
    try {
      const result = await adminApi.listUsers('', page, userPager.pageSize)
      setUserPager({ page: result.page, pageSize: result.pageSize, total: result.total })
      const firstId = result.list[0]?.userId ?? null
      setSelectedUserId(firstId)
      const userDetail = firstId ? await adminApi.getUserDetail(firstId) : null
      setData((current) => ({ ...current, users: result.list, userDetail }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '刷新用户列表失败。'))
    }
  }

  async function refreshOpsSection() {
    try {
      const opsOverview = await adminApi.getOpsOverview()
      setData((current) => ({ ...current, opsOverview }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '刷新专线运营失败。'))
    }
  }

  async function refreshAuditLogSection(page = 1) {
    try {
      const result = await adminApi.listAuditLogs(page, auditLogPager.pageSize)
      setAuditLogPager({ page: result.page, pageSize: result.pageSize, total: result.total })
      setData((current) => ({ ...current, auditLogs: result.list }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '刷新操作审计失败。'))
    }
  }

  async function refreshContentSection() {
    try {
      const [banners, helpArticle] = await Promise.all([
        adminApi.listBanners(),
        adminApi.getHelpArticle(),
      ])
      setSelectedBannerId(banners.list[0]?.bannerId ?? null)
      setData((current) => ({ ...current, banners: banners.list, helpArticle }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '刷新内容配置失败。'))
    }
  }

  async function handleApproveAudit() {
    if (!data.auditDetail) return
    try {
      await adminApi.approveAudit(data.auditDetail.auditTaskId, '前端快捷审核通过')
      await refreshAuditSection(auditPager.page)
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '审核通过失败。'))
    }
  }

  async function handleRejectAudit() {
    if (!data.auditDetail) return
    try {
      await adminApi.rejectAudit(data.auditDetail.auditTaskId, '前端快捷驳回补件')
      await refreshAuditSection(auditPager.page)
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '驳回补件失败。'))
    }
  }

  async function handleSelectAudit(id: number) {
    setSelectedAuditId(id)
    try {
      const auditDetail = await adminApi.getAuditDetail(id)
      setData((current) => ({ ...current, auditDetail }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '加载审核详情失败。'))
    }
  }

  async function handleSelectOrder(id: number) {
    setSelectedOrderId(id)
    try {
      const orderDetail = await adminApi.getOrderDetail(id)
      setData((current) => ({ ...current, orderDetail }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '加载订单详情失败。'))
    }
  }

  async function handleSelectUser(id: number) {
    setSelectedUserId(id)
    try {
      const userDetail = await adminApi.getUserDetail(id)
      setData((current) => ({ ...current, userDetail }))
    } catch (error) {
      setErrorMessage(resolveErrorMessage(error, '加载用户详情失败。'))
    }
  }

  async function refreshAll() {
    setIsRefreshing(true)
    await Promise.all([
      refreshDashboard(),
      refreshAuditSection(auditPager.page),
      refreshOrderSection(orderPager.page),
      refreshRiskSection(riskPager.page),
      refreshFinanceSection(financePager.page),
      refreshUserSection(userPager.page),
      refreshOpsSection(),
      refreshAuditLogSection(auditLogPager.page),
      refreshContentSection(),
    ])
    setIsRefreshing(false)
  }

  useEffect(() => {
    if (!storedAuth.token) {
      return
    }
    const timer = window.setTimeout(() => {
      void restoreSessionAndBootstrap()
    }, 0)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pageTitle = navItems.find((item) => item.key === currentPage)?.label ?? '后台管理'
  const pageProps: PageProps = {
    authForm,
    session,
    permissions,
    data,
    auditPager,
    orderPager,
    riskPager,
    financePager,
    userPager,
    auditLogPager,
    selectedAuditId,
    selectedOrderId,
    selectedRisk,
    selectedLedgerId,
    selectedWithdrawId,
    selectedUserId,
    selectedBannerId,
    auditFiltersState,
    orderFiltersState,
    riskFiltersState,
    financeFiltersState,
    onAuthFieldChange: (field, value) => setAuthForm((current) => ({ ...current, [field]: value })),
    onLogin: handleLogin,
    onApproveAudit: handleApproveAudit,
    onRejectAudit: handleRejectAudit,
    onSelectAudit: handleSelectAudit,
    onSelectOrder: handleSelectOrder,
    onSelectUser: handleSelectUser,
    onSelectRisk: setSelectedRisk,
    onSelectLedger: setSelectedLedgerId,
    onSelectWithdraw: setSelectedWithdrawId,
    onSelectBanner: setSelectedBannerId,
    onAuditFiltersChange: (patch) => setAuditFiltersState((current) => ({ ...current, ...patch })),
    onOrderFiltersChange: (patch) => setOrderFiltersState((current) => ({ ...current, ...patch })),
    onRiskFiltersChange: (patch) => setRiskFiltersState((current) => ({ ...current, ...patch })),
    onFinanceFiltersChange: (patch) => setFinanceFiltersState((current) => ({ ...current, ...patch })),
    onApplyAuditFilters: () => void refreshAuditSection(1),
    onApplyOrderFilters: () => void refreshOrderSection(1),
    onApplyRiskFilters: () => void refreshRiskSection(1),
    onApplyFinanceFilters: () => void refreshFinanceSection(1),
    onAuditPageChange: (page) => void refreshAuditSection(page),
    onOrderPageChange: (page) => void refreshOrderSection(page),
    onRiskPageChange: (page) => void refreshRiskSection(page),
    onFinancePageChange: (page) => void refreshFinanceSection(page),
    onUserPageChange: (page) => void refreshUserSection(page),
    onAuditLogPageChange: (page) => void refreshAuditLogSection(page),
  }

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
          <p>后台页面、筛选、分页和真实数据接入已经合并到一套统一状态流里。</p>
        </div>
        <nav className="sidebar-nav" aria-label="后台主导航">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === currentPage ? 'nav-item active' : 'nav-item'}
              onClick={() => setCurrentPage(item.key)}
            >
              <span className="nav-code">{item.code}</span>
              <span>
                <strong>{item.label}</strong>
                <small>{item.summary}</small>
              </span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">当前账号</span>
          <strong>{session?.displayName ?? '未登录'}</strong>
          <p>{session ? `角色：${session.roles.join(' / ') || '未分配'}` : '请先登录后台。'}</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">运营驾驶舱</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-actions">
            <button type="button" className="ghost-btn" onClick={() => void refreshAll()}>
              {isRefreshing ? '刷新中' : '刷新数据'}
            </button>
            <button type="button" className="ghost-btn" onClick={handleLogout}>
              退出登录
            </button>
            <button type="button" className="primary-btn">
              {session ? session.displayName : '进入处置流'}
            </button>
          </div>
        </header>

        <div className="command-strip">
          {commandFilters.map((item, index) => (
            <span key={item} className={index === 3 ? 'command-chip alert' : 'command-chip'}>
              {item}
            </span>
          ))}
          <span className="live-pill">{isBooting ? '初始化中' : isRefreshing ? '同步中' : '已同步'}</span>
        </div>

        {errorMessage ? (
          <div className="alert-box warning">
            <strong>提示</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <section className="page-stage">{renderPage(currentPage, pageProps)}</section>
      </main>
    </div>
  )
}

interface PageProps {
  authForm: { username: string; password: string }
  session: AdminSession | null
  permissions: AdminPermissions | null
  data: AppData
  auditPager: PagerState
  orderPager: PagerState
  riskPager: PagerState
  financePager: PagerState
  userPager: PagerState
  auditLogPager: PagerState
  selectedAuditId: number | null
  selectedOrderId: number | null
  selectedRisk: RiskSelection
  selectedLedgerId: number | null
  selectedWithdrawId: number | null
  selectedUserId: number | null
  selectedBannerId: number | null
  auditFiltersState: AuditFilterState
  orderFiltersState: OrderFilterState
  riskFiltersState: RiskFilterState
  financeFiltersState: FinanceFilterState
  onAuthFieldChange: (field: 'username' | 'password', value: string) => void
  onLogin: () => void
  onApproveAudit: () => void
  onRejectAudit: () => void
  onSelectAudit: (id: number) => void
  onSelectOrder: (id: number) => void
  onSelectUser: (id: number) => void
  onSelectRisk: (selection: RiskSelection) => void
  onSelectLedger: (id: number | null) => void
  onSelectWithdraw: (id: number | null) => void
  onSelectBanner: (id: number | null) => void
  onAuditFiltersChange: (patch: Partial<AuditFilterState>) => void
  onOrderFiltersChange: (patch: Partial<OrderFilterState>) => void
  onRiskFiltersChange: (patch: Partial<RiskFilterState>) => void
  onFinanceFiltersChange: (patch: Partial<FinanceFilterState>) => void
  onApplyAuditFilters: () => void
  onApplyOrderFilters: () => void
  onApplyRiskFilters: () => void
  onApplyFinanceFilters: () => void
  onAuditPageChange: (page: number) => void
  onOrderPageChange: (page: number) => void
  onRiskPageChange: (page: number) => void
  onFinancePageChange: (page: number) => void
  onUserPageChange: (page: number) => void
  onAuditLogPageChange: (page: number) => void
}

function renderPage(page: PageKey, props: PageProps) {
  switch (page) {
    case 'login':
      return <LoginPage {...props} />
    case 'dashboard':
      return <DashboardPage {...props} />
    case 'audit':
      return <AuditPage {...props} />
    case 'orders':
      return <OrdersPage {...props} />
    case 'risk':
      return <RiskPage {...props} />
    case 'finance':
      return <FinancePage {...props} />
    case 'users':
      return <UsersPage {...props} />
    case 'ops':
      return <OpsPage {...props} />
    case 'content':
      return <ContentPage {...props} />
    case 'report':
      return <ReportPage {...props} />
    case 'auditlog':
      return <AuditLogPage {...props} />
    case 'tokens':
      return <TokensPage />
    default:
      return null
  }
}

function LoginPage(props: PageProps) {
  return (
    <div className="page-grid">
      <div className="two-col">
        <Surface title="登录与会话恢复" subtitle="默认开发账号为 `admin / admin123`。">
          <div className="input-grid">
            <label className="input-field">
              <span>账号</span>
              <input value={props.authForm.username} onChange={(e) => props.onAuthFieldChange('username', e.target.value)} />
            </label>
            <label className="input-field">
              <span>密码</span>
              <input type="password" value={props.authForm.password} onChange={(e) => props.onAuthFieldChange('password', e.target.value)} />
            </label>
          </div>
          <div className="action-row">
            <button type="button" className="ghost-btn" onClick={() => props.onAuthFieldChange('password', 'admin123')}>
              使用默认密码
            </button>
            <button type="button" className="primary-btn" onClick={props.onLogin}>
              登录后台
            </button>
          </div>
        </Surface>
        <Surface title="权限初始化" subtitle="登录成功后会真实加载菜单、按钮和数据域权限。">
          <InfoList items={[
            { title: '菜单权限', value: props.permissions?.menus.join(' / ') || '登录后加载' },
            { title: '按钮权限', value: props.permissions?.buttons.join(' / ') || '登录后加载' },
            { title: '数据范围', value: props.permissions?.dataScopes.join(' / ') || '登录后加载' },
          ]} />
        </Surface>
      </div>
    </div>
  )
}

function DashboardPage(props: PageProps) {
  const stats: StatItem[] = props.data.dashboard
    ? [
        { label: '今日订单', value: String(props.data.dashboard.todayOrderCount), tone: 'brand' },
        { label: '进行中订单', value: String(props.data.dashboard.inProgressOrderCount), tone: 'info' },
        { label: '异常订单', value: String(props.data.dashboard.exceptionOrderCount), tone: 'danger' },
        { label: '待审核资料', value: String(props.data.dashboard.pendingAuditCount), tone: 'warning' },
      ]
    : [
        { label: '今日订单', value: '0', tone: 'brand' },
        { label: '进行中订单', value: '0', tone: 'info' },
        { label: '异常订单', value: '0', tone: 'danger' },
        { label: '待审核资料', value: '0', tone: 'warning' },
      ]
  return (
    <div className="page-grid">
      <StatsSection title="今日平台态势" subtitle="工作台已优先接入真实后台接口。" stats={stats} />
      <div className="two-col">
        <Surface title="风控热区" subtitle="保留高密度可视化工作面。">
          <HeatGrid items={dashboardRiskHeat} />
        </Surface>
        <Surface title="运营指令条" subtitle="固定放置高频操作。">
          <ActionCapsules items={['进入高风险订单队列', '查看待审核资料', '导出日报', '进入专线运营']} />
        </Surface>
      </div>
    </div>
  )
}

function AuditPage(props: PageProps) {
  const rows: TableRow[] = props.data.audits.map((item) => ({
    id: String(item.auditTaskId),
    name: item.applicantName,
    type: item.taskType,
    city: '-',
    status: item.taskStatus,
    updatedAt: formatDateTime(item.submittedAt),
  }))
  const detailItems = props.data.auditDetail
    ? [
        { title: '任务编号', value: String(props.data.auditDetail.auditTaskId) },
        { title: '审核类型', value: props.data.auditDetail.taskType },
        { title: '申请人', value: props.data.auditDetail.applicantInfo?.name || '-' },
        { title: '状态', value: props.data.auditDetail.taskStatus },
      ]
    : [
        { title: '任务编号', value: '-' },
        { title: '审核类型', value: '-' },
      ]
  const stats: StatItem[] = [
    { label: '当前页任务', value: String(props.data.audits.length), tone: 'brand' },
    { label: '待审核', value: String(props.data.audits.filter((item) => item.taskStatus === 'PENDING').length), tone: 'warning' },
    { label: '已通过', value: String(props.data.audits.filter((item) => item.taskStatus === 'APPROVED').length), tone: 'success' },
    { label: '已驳回', value: String(props.data.audits.filter((item) => item.taskStatus === 'REJECTED').length), tone: 'danger' },
  ]
  return (
    <div className="page-grid">
      <StatsSection title="资质审核队列" subtitle="支持真实筛选、分页和详情联动。" stats={stats} />
      <Surface title="审核筛选条" subtitle="筛选后只刷新审核数据区。">
        <div className="filter-toolbar">
          <div className="input-grid">
            <label className="input-field">
              <span>任务类型</span>
              <select value={props.auditFiltersState.taskType} onChange={(e) => props.onAuditFiltersChange({ taskType: e.target.value })}>
                <option value="">全部</option>
                <option value="REALNAME">实名认证</option>
                <option value="DRIVER_LICENSE">驾驶证</option>
                <option value="VEHICLE">车辆</option>
              </select>
            </label>
            <label className="input-field">
              <span>任务状态</span>
              <select value={props.auditFiltersState.taskStatus} onChange={(e) => props.onAuditFiltersChange({ taskStatus: e.target.value })}>
                <option value="">全部</option>
                <option value="PENDING">待审核</option>
                <option value="APPROVED">已通过</option>
                <option value="REJECTED">已驳回</option>
              </select>
            </label>
          </div>
          <div className="action-row">
            <TagGroup tags={auditFilters} />
            <button type="button" className="primary-btn" onClick={props.onApplyAuditFilters}>应用筛选</button>
          </div>
        </div>
      </Surface>
      <div className="layout-2-1">
        <Surface title="审核列表" subtitle="数据来自 `/api/v1/admin/audits`。">
          <DataTable
            columns={[
              { key: 'name', label: '申请人' },
              { key: 'type', label: '类型' },
              { key: 'city', label: '城市' },
              { key: 'status', label: '状态' },
              { key: 'updatedAt', label: '时间' },
            ]}
            rows={rows}
            selectedRowKey={props.selectedAuditId}
            onRowClick={(row) => {
              const id = Number(row.id)
              if (Number.isFinite(id)) props.onSelectAudit(id)
            }}
          />
          <Pager state={props.auditPager} onPageChange={props.onAuditPageChange} />
        </Surface>
        <Surface title="审核详情" subtitle="右侧详情来自 `/api/v1/admin/audits/{id}`。">
          <InfoList items={detailItems} compact />
          <TimelineList items={props.data.auditDetail?.historyLogs?.map((item) => `${String(item.taskStatus ?? '')} · ${String(item.remark ?? '无备注')}`) ?? []} />
          <div className="action-row">
            <button type="button" className="ghost-btn" onClick={props.onRejectAudit}>驳回补件</button>
            <button type="button" className="primary-btn" onClick={props.onApproveAudit}>通过审核</button>
          </div>
        </Surface>
      </div>
    </div>
  )
}

function OrdersPage(props: PageProps) {
  const rows = props.data.orders.map((item) => ({
    id: String(item.orderId),
    orderNo: item.orderNo,
    route: item.routeSummary,
    status: item.orderStatus,
    risk: item.abnormalFlag ? '异常订单' : '正常',
    payment: formatMoneyFen(item.payableAmountFen),
    operator: `${item.driverName} / ${item.passengerName}`,
  }))
  const detailItems = props.data.orderDetail
    ? [
        { title: '订单号', value: props.data.orderDetail.orderInfo.orderNo },
        { title: '司机', value: props.data.orderDetail.driverInfo.nickname },
        { title: '乘客', value: props.data.orderDetail.passengerInfo.nickname },
        { title: '行程', value: `${props.data.orderDetail.routeInfo.startName} → ${props.data.orderDetail.routeInfo.endName}` },
      ]
    : []
  return (
    <div className="page-grid">
      <StatsSection title="订单中心" subtitle="支持真实筛选、分页和详情联动。" stats={[
        { label: '当前页订单', value: String(props.data.orders.length), tone: 'brand' },
        { label: '异常订单', value: String(props.data.orders.filter((item) => item.abnormalFlag).length), tone: 'danger' },
        { label: '已选订单', value: props.selectedOrderId ? String(props.selectedOrderId) : '0', tone: 'info' },
        { label: '筛选状态', value: props.orderFiltersState.abnormalOnly ? '仅异常' : '全部', tone: 'warning' },
      ]} />
      <Surface title="搜索与筛选" subtitle="筛选后只刷新订单数据区。">
        <div className="filter-toolbar">
          <div className="input-grid order-filter-grid">
            <label className="input-field">
              <span>订单状态</span>
              <input value={props.orderFiltersState.orderStatus} onChange={(e) => props.onOrderFiltersChange({ orderStatus: e.target.value })} />
            </label>
            <label className="input-field">
              <span>司机关键词</span>
              <input value={props.orderFiltersState.driverKeyword} onChange={(e) => props.onOrderFiltersChange({ driverKeyword: e.target.value })} />
            </label>
            <label className="input-field">
              <span>乘客关键词</span>
              <input value={props.orderFiltersState.passengerKeyword} onChange={(e) => props.onOrderFiltersChange({ passengerKeyword: e.target.value })} />
            </label>
            <label className="check-field">
              <input type="checkbox" checked={props.orderFiltersState.abnormalOnly} onChange={(e) => props.onOrderFiltersChange({ abnormalOnly: e.target.checked })} />
              <span>仅看异常订单</span>
            </label>
          </div>
          <div className="action-row">
            <TagGroup tags={orderFilters} />
            <button type="button" className="primary-btn" onClick={props.onApplyOrderFilters}>应用筛选</button>
          </div>
        </div>
      </Surface>
      <div className="layout-2-1">
        <Surface title="订单列表" subtitle="数据来自 `/api/v1/admin/orders`。">
          <DataTable columns={[
            { key: 'orderNo', label: '订单号' },
            { key: 'route', label: '线路' },
            { key: 'status', label: '状态' },
            { key: 'risk', label: '风险' },
            { key: 'payment', label: '金额' },
            { key: 'operator', label: '司乘' },
          ]} rows={rows} selectedRowKey={props.selectedOrderId} onRowClick={(row) => {
            const id = Number(row.id)
            if (Number.isFinite(id)) props.onSelectOrder(id)
          }} />
          <Pager state={props.orderPager} onPageChange={props.onOrderPageChange} />
        </Surface>
        <Surface title="订单详情" subtitle="详情来自 `/api/v1/admin/orders/{id}`。">
          <InfoList items={detailItems} compact />
          <TimelineList items={props.data.orderDetail?.statusLogs?.map((item) => {
            const toStatus = String(item['toStatus'] ?? item['ToStatus'] ?? item['status'] ?? '状态更新')
            const createdAt = String(item['createdAt'] ?? item['CreatedAt'] ?? '')
            return `${toStatus} · ${formatDateTime(createdAt)}`
          }) ?? []} />
        </Surface>
      </div>
    </div>
  )
}

function RiskPage(props: PageProps) {
  const riskRows: TableRow[] =
    props.riskFiltersState.viewMode === 'sos'
      ? props.data.sosEvents.map((item) => ({
          id: `sos-${item.sosEventId}`,
          type: 'SOS',
          target: item.orderNo,
          city: '-',
          status: item.eventStatus,
          owner: item.userName,
        }))
      : props.riskFiltersState.viewMode === 'timeout'
        ? props.data.timeoutAlerts.map((item) => ({
            id: `timeout-${item.orderId}`,
            type: '超时',
            target: item.orderNo,
            city: '-',
            status: item.alertStatus,
            owner: `${item.currentDelayMinute} 分钟`,
          }))
        : props.riskFiltersState.viewMode === 'route'
          ? props.data.routeLogs.map((item) => ({
              id: `route-${item.snapshotId}`,
              type: '顺路度',
              target: String(item.tripId),
              city: '-',
              status: item.passed ? '通过' : '未通过',
              owner: item.ruleVersion,
            }))
          : props.data.pricingLogs.map((item) => ({
              id: `pricing-${item.pricingLogId}`,
              type: '定价',
              target: String(item.tripId),
              city: '-',
              status: formatMoneyFen(item.serviceFeeFen),
              owner: formatMoneyFen(item.mileageFeeFen),
            }))
  const detailItems = resolveRiskDetailItems(props)
  return (
    <div className="page-grid">
      <StatsSection title="安全与风控" subtitle="已完成分页、筛选和多视图切换。" stats={[
        { label: 'SOS', value: String(props.data.sosEvents.length), tone: 'danger' },
        { label: '超时', value: String(props.data.timeoutAlerts.length), tone: 'warning' },
        { label: '顺路度', value: String(props.data.routeLogs.length), tone: 'info' },
        { label: '定价', value: String(props.data.pricingLogs.length), tone: 'brand' },
      ]} />
      <Surface title="风控筛选" subtitle="支持切换当前视图，并对 SOS 状态做真实筛选。">
        <div className="filter-toolbar">
          <div className="input-grid">
            <label className="input-field">
              <span>当前视图</span>
              <select value={props.riskFiltersState.viewMode} onChange={(e) => props.onRiskFiltersChange({ viewMode: e.target.value as RiskFilterState['viewMode'] })}>
                <option value="sos">SOS</option>
                <option value="timeout">超时预警</option>
                <option value="route">顺路度</option>
                <option value="pricing">定价日志</option>
              </select>
            </label>
            <label className="input-field">
              <span>SOS 状态</span>
              <select value={props.riskFiltersState.sosStatus} onChange={(e) => props.onRiskFiltersChange({ sosStatus: e.target.value })}>
                <option value="">全部</option>
                <option value="PENDING">待处理</option>
                <option value="PROCESSING">处理中</option>
                <option value="CLOSED">已关闭</option>
              </select>
            </label>
          </div>
          <div className="action-row">
            <TagGroup tags={riskTabs} />
            <button type="button" className="primary-btn" onClick={props.onApplyRiskFilters}>应用筛选</button>
          </div>
        </div>
      </Surface>
      <div className="three-col">
        {riskPanels.map((item) => (
          <Surface key={item.title} title={item.title} subtitle={item.detail} tone={item.tone}>
            <div className={`tone-block ${item.tone}`}>
              <span>优先级</span>
              <strong>{item.tone === 'danger' ? 'P0' : item.tone === 'warning' ? 'P1' : 'P2'}</strong>
            </div>
          </Surface>
        ))}
      </div>
      <div className="layout-2-1">
        <Surface title="事件列表" subtitle="当前列表会随视图切换而切换。">
          <DataTable columns={[
            { key: 'type', label: '类型' },
            { key: 'target', label: '目标' },
            { key: 'city', label: '城市' },
            { key: 'status', label: '状态' },
            { key: 'owner', label: '附加信息' },
          ]} rows={riskRows} selectedRowKey={props.selectedRisk ? `${props.selectedRisk.kind}-${props.selectedRisk.id}` : null} onRowClick={(row) => {
            const raw = String(row.id ?? '')
            const [kind, idText] = raw.split('-')
            const id = Number(idText)
            if (kind === 'sos' || kind === 'timeout' || kind === 'route' || kind === 'pricing') {
              props.onSelectRisk({ kind, id })
            }
          }} />
          <Pager state={props.riskPager} onPageChange={props.onRiskPageChange} />
        </Surface>
        <Surface title="风险详情" subtitle="右侧详情跟随当前选中事件切换。">
          <InfoList items={detailItems} compact />
        </Surface>
      </div>
    </div>
  )
}

function FinancePage(props: PageProps) {
  const ledgerRows = props.data.ledger.map((item) => ({
    id: String(item.ledgerId),
    ledgerNo: String(item.ledgerId),
    bizType: item.bizType,
    amount: formatMoneyFen(item.changeAmountFen),
    status: '已记录',
    operator: item.operatorName,
    time: formatDateTime(item.createdAt),
  }))
  const withdrawItems: PriorityRecord[] = props.data.withdraws.map((item) => ({
    title: item.userName,
    detail: `${formatMoneyFen(item.amountFen)} / ${item.withdrawStatus}`,
    tone: item.withdrawStatus === 'PENDING' ? 'warning' : 'info',
  }))
  const detailItems = resolveFinanceDetailItems(props)
  return (
    <div className="page-grid">
      <StatsSection title="财务中心" subtitle="支持真实筛选、分页和详情联动。" stats={[
        { label: '流水条数', value: String(props.data.ledger.length), tone: 'brand' },
        { label: '提现条数', value: String(props.data.withdraws.length), tone: 'warning' },
        { label: '累计收入', value: formatMoneyFen(props.data.reports?.incomeSummary?.totalIncomeFen ?? 0), tone: 'success' },
        { label: '累计服务费', value: formatMoneyFen(props.data.reports?.serviceFeeSummary?.totalServiceFeeFen ?? 0), tone: 'info' },
      ]} />
      <Surface title="财务筛选" subtitle="当前已把业务类型筛选接到真实流水接口。">
        <div className="filter-toolbar">
          <div className="input-grid">
            <label className="input-field">
              <span>业务类型</span>
              <input value={props.financeFiltersState.bizType} onChange={(e) => props.onFinanceFiltersChange({ bizType: e.target.value })} placeholder="如 SETTLEMENT" />
            </label>
          </div>
          <div className="action-row">
            <button type="button" className="primary-btn" onClick={props.onApplyFinanceFilters}>应用筛选</button>
          </div>
        </div>
      </Surface>
      <div className="layout-2-1">
        <Surface title="账务流水" subtitle="主列表来自 `/api/v1/admin/finance/ledger`。">
          <DataTable columns={[
            { key: 'ledgerNo', label: '流水号' },
            { key: 'bizType', label: '业务类型' },
            { key: 'amount', label: '金额' },
            { key: 'status', label: '状态' },
            { key: 'operator', label: '操作人' },
            { key: 'time', label: '时间' },
          ]} rows={ledgerRows} selectedRowKey={props.selectedLedgerId} onRowClick={(row) => {
            const id = Number(row.id)
            if (Number.isFinite(id)) props.onSelectLedger(id)
          }} />
          <Pager state={props.financePager} onPageChange={props.onFinancePageChange} />
        </Surface>
        <div className="stack-column">
          <Surface title="提现审核队列" subtitle="数据来自 `/api/v1/admin/finance/withdraws`。">
            <PriorityList items={withdrawItems} selectedTitle={props.data.withdraws.find((item) => item.withdrawId === props.selectedWithdrawId)?.userName ?? ''} onItemClick={(title) => {
              const target = props.data.withdraws.find((item) => item.userName === title)
              props.onSelectWithdraw(target?.withdrawId ?? null)
            }} />
          </Surface>
          <Surface title="财务详情" subtitle="右侧详情随当前选中的流水或提现项变化。">
            <InfoList items={detailItems} compact />
          </Surface>
        </div>
      </div>
    </div>
  )
}

function UsersPage(props: PageProps) {
  const rows = props.data.users.map((item) => ({
    id: String(item.userId),
    user: `${item.nickname} / ${item.mobileMasked}`,
    role: item.userStatus,
    realname: item.realnameStatus,
    contact: `${item.contactCount} 人`,
    complaint: `${item.orderCount} 单`,
  }))
  const detailItems = props.data.userDetail
    ? [
        { title: '用户昵称', value: props.data.userDetail.userInfo.nickname },
        { title: '手机号', value: props.data.userDetail.userInfo.mobileMasked },
        { title: '实名状态', value: props.data.userDetail.userInfo.realnameStatus },
        { title: '用户状态', value: props.data.userDetail.userInfo.userStatus },
        { title: '紧急联系人', value: String(props.data.userDetail.realnameInfo.contactCount) },
      ]
    : [
        { title: '用户昵称', value: '-' },
        { title: '手机号', value: '-' },
      ]
  return (
    <div className="page-grid">
      <StatsSection title="用户管理" subtitle="用户列表与用户详情已经接入真实后台接口。" stats={[
        { label: '当前页用户', value: String(props.data.users.length), tone: 'brand' },
        { label: '已选中用户', value: props.selectedUserId ? String(props.selectedUserId) : '0', tone: 'info' },
        ...userStats.slice(2),
      ]} />
      <div className="layout-2-1">
        <Surface title="用户列表" subtitle="主列表来自 `/api/v1/admin/users`。">
          <DataTable columns={[
            { key: 'user', label: '用户' },
            { key: 'role', label: '状态' },
            { key: 'realname', label: '实名状态' },
            { key: 'contact', label: '紧急联系人' },
            { key: 'complaint', label: '订单数量' },
          ]} rows={rows} selectedRowKey={props.selectedUserId} onRowClick={(row) => {
            const id = Number(row.id)
            if (Number.isFinite(id)) props.onSelectUser(id)
          }} />
          <Pager state={props.userPager} onPageChange={props.onUserPageChange} />
        </Surface>
        <Surface title="用户详情摘要" subtitle="右侧详情来自 `/api/v1/admin/users/{id}`。">
          <InfoList items={detailItems} compact />
          <PriorityList items={[
            { title: '车辆数量', detail: `${props.data.userDetail?.summary.vehicleCount ?? 0} 辆`, tone: 'info' },
            { title: '行程数量', detail: `${props.data.userDetail?.summary.tripCount ?? 0} 次`, tone: 'warning' },
          ]} />
        </Surface>
      </div>
    </div>
  )
}

function OpsPage(props: PageProps) {
  const lineItems = props.data.opsOverview?.lines ?? []
  const packageItems = props.data.opsOverview?.packages.map((item) => ({
    title: item.packageName,
    detail: `${item.status} / ${item.description}`,
    tone: (item.status === 'ACTIVE' ? 'success' : 'warning') as Tone,
  })) ?? []
  return (
    <div className="page-grid">
      <StatsSection title="专线运营" subtitle="专线页已经接入真实运营概览接口。" stats={[
        { label: '线路数量', value: String(lineItems.length), tone: 'brand' },
        { label: '服务包数量', value: String(packageItems.length), tone: 'success' },
        ...opsStats.slice(2),
      ]} />
      <div className="two-col">
        <Surface title="专线运行摘要" subtitle="线路摘要来自 `/api/v1/admin/ops/overview`。">
          <InfoList items={lineItems.length > 0 ? lineItems.slice(0, 4).map((item) => ({
            title: item.routeSummary,
            value: `行程 ${item.tripCount} / 订单 ${item.orderCount} / 司机 ${item.activeDrivers}`,
          })) : opsLineInfo} />
        </Surface>
        <Surface title="近 7 日专线效果" subtitle="这里用真实线路数据折算成相对热度。">
          <ProgressList items={lineItems.length > 0 ? lineItems.slice(0, 4).map((item, index) => ({
            label: item.routeSummary,
            value: Math.max(10, Math.min(100, item.orderCount * 20)),
            tone: (['brand', 'success', 'warning', 'info'][index] ?? 'brand') as Tone,
          })) : [
            { label: '杭州 → 上海', value: 88, tone: 'brand' },
            { label: '义乌 → 杭州', value: 72, tone: 'success' },
            { label: '宁波 → 上海', value: 53, tone: 'warning' },
            { label: '嘉兴 → 苏州', value: 38, tone: 'info' },
          ]} />
        </Surface>
      </div>
      <Surface title="服务包与补贴策略" subtitle="服务包信息来自运营概览接口。">
        <PriorityList items={packageItems.length > 0 ? packageItems : [{
          title: '通勤包',
          detail: 'ACTIVE / 工作日通勤线路组合',
          tone: 'success',
        }]} columns={3} />
      </Surface>
    </div>
  )
}

function ContentPage(props: PageProps) {
  const bannerRows = props.data.banners.map((item) => ({
    id: String(item.bannerId),
    name: item.title,
    channel: item.linkUrl || '-',
    status: item.status,
    operator: '-',
    updatedAt: String(item.sortNo),
  }))
  const selectedBanner = props.data.banners.find((item) => item.bannerId === props.selectedBannerId) ?? null
  return (
    <div className="page-grid">
      <StatsSection title="内容配置" subtitle="Banner 与帮助中心文章都来自真实后台接口。" stats={[
        { label: 'Banner 数量', value: String(props.data.banners.length), tone: 'brand' },
        { label: '帮助中心', value: props.data.helpArticle ? '已接入' : '未加载', tone: 'info' },
        ...contentStats.slice(2),
      ]} />
      <div className="two-col">
        <Surface title="Banner 列表" subtitle="内容来自 `/api/v1/admin/cms/banners`。">
          <DataTable columns={[
            { key: 'name', label: '内容名称' },
            { key: 'channel', label: '跳转位置' },
            { key: 'status', label: '状态' },
            { key: 'operator', label: '操作人' },
            { key: 'updatedAt', label: '排序' },
          ]} rows={bannerRows} selectedRowKey={props.selectedBannerId} onRowClick={(row) => {
            const id = Number(row.id)
            if (Number.isFinite(id)) props.onSelectBanner(id)
          }} />
        </Surface>
        <Surface title="发布流程" subtitle="右侧优先展示当前选中的 Banner。">
          <StepRail items={publishFlow} />
          <div className="preview-card">
            <span className="eyebrow">{selectedBanner ? '当前 Banner' : '帮助中心文章'}</span>
            <InfoList items={selectedBanner ? [
              { title: 'Banner 标题', value: selectedBanner.title },
              { title: '跳转链接', value: selectedBanner.linkUrl || '-' },
              { title: '状态', value: selectedBanner.status },
              { title: '排序', value: String(selectedBanner.sortNo) },
            ] : [
              { title: '文章标题', value: props.data.helpArticle?.title || '-' },
              { title: '文章状态', value: props.data.helpArticle?.status || '-' },
              { title: '内容摘要', value: props.data.helpArticle?.content.slice(0, 40) || '-' },
            ]} compact />
          </div>
        </Surface>
      </div>
    </div>
  )
}

function ReportPage(props: PageProps) {
  const stats: StatItem[] = props.data.reports
    ? [
        { label: '总收入', value: formatMoneyFen(props.data.reports.incomeSummary?.totalIncomeFen ?? 0), tone: 'success' },
        { label: '总服务费', value: formatMoneyFen(props.data.reports.serviceFeeSummary?.totalServiceFeeFen ?? 0), tone: 'brand' },
        { label: '总订单量', value: String(props.data.reports.orderSummary?.totalOrderCount ?? 0), tone: 'info' },
        { label: '总提现', value: formatMoneyFen(props.data.reports.withdrawSummary?.totalWithdrawFen ?? 0), tone: 'warning' },
      ]
    : reportStats
  return (
    <div className="page-grid">
      <StatsSection title="报表统计" subtitle="报表页当前优先使用真实财务汇总数据。" stats={stats} />
      <div className="two-col">
        <Surface title="核心指标走势" subtitle="保留高层摘要面板。">
          <ProgressList items={reportProgress} />
        </Surface>
        <Surface title="导出任务队列" subtitle="保留异步导出工作流占位。">
          <InfoList items={reportExports} />
        </Surface>
      </div>
    </div>
  )
}

function AuditLogPage(props: PageProps) {
  const rows = props.data.auditLogs.map((item) => ({
    time: formatDateTime(item.time),
    actor: item.actor,
    action: item.action,
    requestId: item.requestId,
    risk: item.risk,
  }))
  return (
    <div className="page-grid">
      <StatsSection title="操作审计" subtitle="操作审计页已经接入真实后台日志接口。" stats={[
        { label: '当前页日志', value: String(props.data.auditLogs.length), tone: 'brand' },
        ...reportStats.slice(1, 4),
      ]} />
      <div className="two-col">
        <Surface title="审计日志列表" subtitle="数据来自 `/api/v1/admin/audit-logs`。">
          <DataTable columns={[
            { key: 'time', label: '时间' },
            { key: 'actor', label: '操作人' },
            { key: 'action', label: '行为' },
            { key: 'requestId', label: 'Request ID' },
            { key: 'risk', label: '风险等级' },
          ]} rows={rows} />
          <Pager state={props.auditLogPager} onPageChange={props.onAuditLogPageChange} />
        </Surface>
        <Surface title="审计链路摘要" subtitle="右侧时间轴显示最近日志摘要。">
          <TimelineList items={props.data.auditLogs.slice(0, 4).map((item) => `${formatDateTime(item.time)} · ${item.action}`)} />
          <div className="alert-box danger">
            <strong>高风险提醒</strong>
            <p>当前日志已覆盖审核留痕和 CMS 变更，后续可以继续扩展更多后台行为源。</p>
          </div>
        </Surface>
      </div>
    </div>
  )
}

function TokensPage() {
  return (
    <div className="page-grid">
      <Surface title="设计 Token 与组件拆分" subtitle="这部分保留为工程规范页。">
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
      <div className="two-col">
        <Surface title="颜色 Token" subtitle="颜色语义用于状态、风险与层级表达。">
          <div className="swatch-grid">
            {colorTokens.map((token) => (
              <div key={token.name} className="swatch-card">
                <span className="swatch" style={{ backgroundColor: token.value }} />
                <strong>{token.name}</strong>
                <small>{token.value}</small>
              </div>
            ))}
          </div>
        </Surface>
        <Surface title="排版与组件" subtitle="统一字体、字号节奏和组件职责。">
          <InfoList items={typeTokens} />
          <PriorityList items={componentTokens} />
        </Surface>
      </div>
    </div>
  )
}

function StatsSection(props: { title: string; subtitle: string; stats: StatItem[] }) {
  return (
    <Surface title={props.title} subtitle={props.subtitle}>
      <div className="stats-grid">
        {props.stats.map((item) => (
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

function Surface(props: { title: string; subtitle: string; children: ReactNode; actions?: ReactNode; tone?: Tone }) {
  return (
    <section className={props.tone ? `surface tone-${props.tone}` : 'surface'}>
      <div className="surface-head">
        <div>
          <span className="eyebrow">模块</span>
          <h2>{props.title}</h2>
          <p>{props.subtitle}</p>
        </div>
        {props.actions ? <div>{props.actions}</div> : null}
      </div>
      {props.children}
    </section>
  )
}

function DataTable(props: {
  columns: TableColumn[]
  rows: TableRow[]
  selectedRowKey?: string | number | null
  onRowClick?: (row: TableRow) => void
}) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr
              key={`${props.columns[0]?.key ?? 'row'}-${index}`}
              className={String(row.id ?? '') !== '' && String(row.id) === String(props.selectedRowKey ?? '') ? 'is-selected' : undefined}
              onClick={props.onRowClick ? () => props.onRowClick?.(row) : undefined}
            >
              {props.columns.map((column) => (
                <td key={column.key}>{row[column.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pager(props: { state: PagerState; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(props.state.total / props.state.pageSize))
  return (
    <div className="action-row pager-row">
      <span className="mini-text">第 {props.state.page} / {totalPages} 页，共 {props.state.total} 条</span>
      <div className="topbar-actions">
        <button type="button" className="ghost-btn" disabled={props.state.page <= 1} onClick={() => props.onPageChange(props.state.page - 1)}>
          上一页
        </button>
        <button type="button" className="ghost-btn" disabled={props.state.page >= totalPages} onClick={() => props.onPageChange(props.state.page + 1)}>
          下一页
        </button>
      </div>
    </div>
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

function InfoList(props: { items: Array<{ title: string; value: string }>; compact?: boolean }) {
  return (
    <div className={props.compact ? 'info-list compact' : 'info-list'}>
      {props.items.map((item) => (
        <div key={item.title} className="info-item">
          <span>{item.title}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

function PriorityList(props: { items: PriorityRecord[]; columns?: number; selectedTitle?: string; onItemClick?: (title: string) => void }) {
  const className = props.columns === 3 ? 'priority-list columns-3' : 'priority-list'
  return (
    <div className={className}>
      {props.items.map((item) => (
        <div
          key={item.title}
          className={`priority-item ${item.tone}${props.selectedTitle === item.title ? ' is-selected' : ''}`}
          onClick={props.onItemClick ? () => props.onItemClick?.(item.title) : undefined}
        >
          <strong>{item.title}</strong>
          <p>{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

function TimelineList(props: { items: string[] }) {
  return (
    <div className="timeline">
      {props.items.map((item, index) => (
        <div key={`${item}-${index}`} className="timeline-item">
          <span />
          <p>{item}</p>
        </div>
      ))}
    </div>
  )
}

function HeatGrid(props: { items: Array<{ label: string; value: string; tone: Tone }> }) {
  return (
    <div className="heat-grid">
      {props.items.map((item) => (
        <div key={item.label} className={`heat-cell ${item.tone}`}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

function ActionCapsules(props: { items: string[] }) {
  return (
    <div className="capsule-grid">
      {props.items.map((item) => (
        <button key={item} type="button" className="capsule-btn">
          {item}
        </button>
      ))}
    </div>
  )
}

function StepRail(props: { items: string[] }) {
  return (
    <div className="step-rail">
      {props.items.map((item, index) => (
        <div key={item} className="step-item">
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{item}</strong>
        </div>
      ))}
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

function resolveRiskDetailItems(props: PageProps) {
  if (props.selectedRisk?.kind === 'sos') {
    const target = props.data.sosEvents.find((item) => item.sosEventId === props.selectedRisk?.id)
    if (target) {
      return [
        { title: '事件类型', value: 'SOS' },
        { title: '关联订单', value: target.orderNo },
        { title: '触发用户', value: target.userName },
        { title: '状态', value: target.eventStatus },
        { title: '触发时间', value: formatDateTime(target.triggeredAt) },
      ]
    }
  }
  if (props.selectedRisk?.kind === 'timeout') {
    const target = props.data.timeoutAlerts.find((item) => item.orderId === props.selectedRisk?.id)
    if (target) {
      return [
        { title: '事件类型', value: '超时预警' },
        { title: '关联订单', value: target.orderNo },
        { title: '预计到达', value: formatDateTime(target.estimatedArrivalAt) },
        { title: '延迟分钟', value: String(target.currentDelayMinute) },
        { title: '状态', value: target.alertStatus },
      ]
    }
  }
  if (props.selectedRisk?.kind === 'route') {
    const target = props.data.routeLogs.find((item) => item.snapshotId === props.selectedRisk?.id)
    if (target) {
      return [
        { title: '事件类型', value: '顺路度日志' },
        { title: '快照 ID', value: String(target.snapshotId) },
        { title: 'Trip ID', value: String(target.tripId) },
        { title: '顺路度', value: String(target.routeScore) },
        { title: '规则版本', value: target.ruleVersion },
      ]
    }
  }
  if (props.selectedRisk?.kind === 'pricing') {
    const target = props.data.pricingLogs.find((item) => item.pricingLogId === props.selectedRisk?.id)
    if (target) {
      return [
        { title: '事件类型', value: '定价日志' },
        { title: '日志 ID', value: String(target.pricingLogId) },
        { title: 'Trip ID', value: String(target.tripId) },
        { title: '里程费', value: formatMoneyFen(target.mileageFeeFen) },
        { title: '服务费', value: formatMoneyFen(target.serviceFeeFen) },
      ]
    }
  }
  return [{ title: '事件详情', value: '请选择左侧事件' }]
}

function resolveFinanceDetailItems(props: PageProps) {
  const ledger = props.data.ledger.find((item) => item.ledgerId === props.selectedLedgerId)
  if (ledger) {
    return [
      { title: '当前流水', value: String(ledger.ledgerId) },
      { title: '业务类型', value: ledger.bizType },
      { title: '金额', value: formatMoneyFen(ledger.changeAmountFen) },
      { title: '操作人', value: ledger.operatorName },
      { title: '时间', value: formatDateTime(ledger.createdAt) },
    ]
  }
  const withdraw = props.data.withdraws.find((item) => item.withdrawId === props.selectedWithdrawId)
  if (withdraw) {
    return [
      { title: '提现单号', value: String(withdraw.withdrawId) },
      { title: '用户', value: withdraw.userName },
      { title: '金额', value: formatMoneyFen(withdraw.amountFen) },
      { title: '状态', value: withdraw.withdrawStatus },
      { title: '时间', value: formatDateTime(withdraw.createdAt) },
    ]
  }
  return [
    { title: '累计收入', value: formatMoneyFen(props.data.reports?.incomeSummary?.totalIncomeFen ?? 0) },
    { title: '累计服务费', value: formatMoneyFen(props.data.reports?.serviceFeeSummary?.totalServiceFeeFen ?? 0) },
  ]
}

function formatMoneyFen(fen: number) {
  return `¥ ${(fen / 100).toFixed(2)}`
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '-'
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

function resolveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback
  if (error instanceof Error) return error.message || fallback
  return fallback
}

export default App
