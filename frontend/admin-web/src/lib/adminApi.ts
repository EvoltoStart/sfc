import { getStoredAdminToken } from './adminAuth'

export interface ApiEnvelope<T> {
  code: number | string
  message: string
  data: T
  requestId: string
}

export class ApiError extends Error {
  code: number | string
  requestId: string
  status: number

  constructor(message: string, options: { code: number | string; requestId?: string; status?: number }) {
    super(message)
    this.name = 'ApiError'
    this.code = options.code
    this.requestId = options.requestId ?? ''
    this.status = options.status ?? 500
  }
}

interface RawListResult<T> {
  list: T[] | null
  page?: number
  pageSize?: number
  total?: number
}

export interface PagedResult<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
}

export interface AdminLoginResult {
  token: string
  adminUserId: number
  displayName: string
  roles: string[]
}

export interface AdminSession {
  adminUserId: number
  username: string
  displayName: string
  status: string
  roles: string[]
}

export interface AdminPermissions {
  menus: string[]
  buttons: string[]
  dataScopes: string[]
}

export interface AdminDashboard {
  todayOrderCount: number
  inProgressOrderCount: number
  exceptionOrderCount: number
  pendingAuditCount: number
  todaySosCount: number
  todayIncomeFen: number
  pendingWithdrawCount: number
  complaintCount: number
}

export interface AdminAuditListItem {
  auditTaskId: number
  taskType: string
  bizId: number
  applicantName: string
  taskStatus: string
  submittedAt: string
}

export interface AdminAuditDetail {
  auditTaskId: number
  taskType: string
  taskStatus: string
  applicantInfo: {
    name?: string
  }
  materialList: Array<Record<string, unknown>>
  historyLogs: Array<Record<string, unknown>>
}

export interface AdminOrderListItem {
  orderId: number
  orderNo: string
  driverName: string
  passengerName: string
  orderStatus: string
  routeSummary: string
  payableAmountFen: number
  abnormalFlag: boolean
}

export interface AdminOrderDetail {
  orderInfo: {
    orderId: number
    orderNo: string
    orderStatus: string
  }
  driverInfo: {
    userId: number
    nickname: string
  }
  passengerInfo: {
    userId: number
    nickname: string
  }
  routeInfo: {
    startName: string
    endName: string
    departAt: string
  }
  statusLogs: Array<Record<string, unknown>>
  priceInfo: {
    payableAmountFen: number
    serviceFeeFen: number
    distanceMeter: number
  }
  paymentInfo?: Record<string, unknown> | null
  refundInfo?: Record<string, unknown> | null
  settlementInfo?: Record<string, unknown> | null
  riskInfo?: {
    abnormalFlag?: boolean
  }
  traceSummary?: Record<string, unknown>
}

export interface AdminSosEvent {
  sosEventId: number
  orderNo: string
  userName: string
  triggeredAt: string
  eventStatus: string
  handlerName: string
}

export interface AdminTimeoutAlert {
  orderId: number
  orderNo: string
  estimatedArrivalAt: string
  currentDelayMinute: number
  alertStatus: string
}

export interface AdminRouteScoreLog {
  snapshotId: number
  tripId: number
  routeScore: number
  passed: boolean
  ruleVersion: string
  createdAt: string
}

export interface AdminFrequencyLog {
  logId: number
  driverUserID: number
  cityCode: string
  tripType: string
  currentDayCount: number
  currentMonthCount: number
  passed: boolean
  createdAt: string
}

export interface AdminPricingLog {
  pricingLogId: number
  tripId: number
  distanceMeter: number
  mileageFeeFen: number
  tollFeeFen: number
  serviceFeeFen: number
  createdAt: string
}

export interface AdminLedgerItem {
  ledgerId: number
  bizType: string
  orderNo: string
  changeAmountFen: number
  operatorName: string
  createdAt: string
}

export interface AdminWithdrawItem {
  withdrawId: number
  userName: string
  amountFen: number
  withdrawStatus: string
  createdAt: string
}

export interface AdminFinanceReports {
  incomeSummary?: {
    totalIncomeFen?: number
  }
  serviceFeeSummary?: {
    totalServiceFeeFen?: number
  }
  orderSummary?: {
    totalOrderCount?: number
  }
  withdrawSummary?: {
    totalWithdrawFen?: number
  }
}

export interface AdminUserListItem {
  userId: number
  nickname: string
  mobileMasked: string
  realnameStatus: string
  contactCount: number
  orderCount: number
  userStatus: string
  lastLoginAt?: string | null
}

export interface AdminUserDetail {
  userInfo: {
    userId: number
    nickname: string
    mobileMasked: string
    realnameStatus: string
    userStatus: string
  }
  realnameInfo: {
    authStatus: string
    contactCount: number
  }
  emergencyContacts: Array<{
    name: string
    mobile: string
    relation: string
    isDefault: boolean
  }>
  summary: {
    vehicleCount: number
    tripCount: number
    orderCount: number
  }
  complaintSummary: {
    complaintCount: number
  }
}

export interface AdminOpsOverview {
  lines: Array<{
    routeSummary: string
    tripCount: number
    orderCount: number
    activeDrivers: number
  }>
  packages: Array<{
    packageName: string
    status: string
    description: string
  }>
}

export interface AdminAuditLogItem {
  time: string
  actor: string
  action: string
  requestId: string
  risk: string
}

export interface CMSBannerItem {
  bannerId: number
  title: string
  imageUrl: string
  linkUrl: string
  sortNo: number
  status: string
}

export interface CMSArticle {
  articleId: number
  title: string
  content: string
  status: string
  updatedAt: string
}

function ensureList<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : []
}

function normalizePaged<T>(result: RawListResult<T>): PagedResult<T> {
  const list = ensureList(result.list)
  return {
    list,
    page: result.page ?? 1,
    pageSize: result.pageSize ?? 20,
    total: result.total ?? list.length,
  }
}

async function request<T>(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Client-Type', 'admin')

  const token = getStoredAdminToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, {
    ...init,
    headers,
  })

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new ApiError('服务返回了非 JSON 响应', {
      code: response.status,
      status: response.status,
    })
  }

  const envelope = (await response.json()) as ApiEnvelope<T>
  if (envelope.code !== 0) {
    throw new ApiError(envelope.message || '请求失败', {
      code: envelope.code,
      requestId: envelope.requestId,
      status: response.status,
    })
  }
  return envelope.data
}

function get<T>(path: string) {
  return request<T>(path, { method: 'GET' })
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function buildPagedQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') {
      continue
    }
    query.set(key, String(value))
  }
  return query.toString()
}

export const adminApi = {
  login(payload: { username: string; password: string }) {
    return post<AdminLoginResult>('/api/v1/admin/auth/login', payload)
  },
  getSession() {
    return get<AdminSession>('/api/v1/admin/auth/session')
  },
  getPermissions() {
    return get<AdminPermissions>('/api/v1/admin/auth/permissions')
  },
  getDashboard() {
    return get<AdminDashboard>('/api/v1/admin/dashboard')
  },
  listAudits(taskType = '', taskStatus = '', page = 1, pageSize = 20) {
    const query = buildPagedQuery({
      page,
      pageSize,
      taskType,
      taskStatus,
    })
    return get<RawListResult<AdminAuditListItem>>(`/api/v1/admin/audits?${query}`).then(normalizePaged)
  },
  getAuditDetail(id: number) {
    return get<AdminAuditDetail>(`/api/v1/admin/audits/${id}`)
  },
  approveAudit(id: number, remark: string) {
    return post<{ success: boolean; taskStatus: string }>(`/api/v1/admin/audits/${id}/approve`, { remark })
  },
  rejectAudit(id: number, remark: string) {
    return post<{ success: boolean; taskStatus: string }>(`/api/v1/admin/audits/${id}/reject`, { remark })
  },
  listOrders(options?: {
    abnormalFlag?: boolean
    orderStatus?: string
    driverKeyword?: string
    passengerKeyword?: string
    page?: number
    pageSize?: number
  }) {
    const query = buildPagedQuery({
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 20,
      abnormalFlag: options?.abnormalFlag ? 'true' : undefined,
      orderStatus: options?.orderStatus,
      driverKeyword: options?.driverKeyword,
      passengerKeyword: options?.passengerKeyword,
    })
    return get<RawListResult<AdminOrderListItem>>(`/api/v1/admin/orders?${query}`).then(normalizePaged)
  },
  getOrderDetail(id: number) {
    return get<AdminOrderDetail>(`/api/v1/admin/orders/${id}`)
  },
  listSosEvents(status = '', page = 1, pageSize = 20) {
    const query = buildPagedQuery({
      page,
      pageSize,
      status,
    })
    return get<RawListResult<AdminSosEvent>>(`/api/v1/admin/risk/sos-events?${query}`).then(normalizePaged)
  },
  listTimeoutAlerts(page = 1, pageSize = 20) {
    return get<RawListResult<AdminTimeoutAlert>>(`/api/v1/admin/risk/timeout-alerts?${buildPagedQuery({ page, pageSize })}`).then(normalizePaged)
  },
  listRouteScoreLogs(page = 1, pageSize = 20) {
    return get<RawListResult<AdminRouteScoreLog>>(`/api/v1/admin/risk/route-score-logs?${buildPagedQuery({ page, pageSize })}`).then(normalizePaged)
  },
  listFrequencyLogs() {
    return get<RawListResult<AdminFrequencyLog>>('/api/v1/admin/risk/frequency-logs?page=1&pageSize=20').then(normalizePaged)
  },
  listPricingLogs(page = 1, pageSize = 20) {
    return get<RawListResult<AdminPricingLog>>(`/api/v1/admin/risk/pricing-logs?${buildPagedQuery({ page, pageSize })}`).then(normalizePaged)
  },
  listFinanceLedger(bizType = '', page = 1, pageSize = 20) {
    const query = buildPagedQuery({
      page,
      pageSize,
      bizType,
    })
    return get<RawListResult<AdminLedgerItem>>(`/api/v1/admin/finance/ledger?${query}`).then(normalizePaged)
  },
  listWithdraws(page = 1, pageSize = 20) {
    return get<RawListResult<AdminWithdrawItem>>(`/api/v1/admin/finance/withdraws?${buildPagedQuery({ page, pageSize })}`).then(normalizePaged)
  },
  getFinanceReports() {
    return get<AdminFinanceReports>('/api/v1/admin/finance/reports')
  },
  listUsers(keyword = '', page = 1, pageSize = 20) {
    return get<RawListResult<AdminUserListItem>>(`/api/v1/admin/users?${buildPagedQuery({ keyword, page, pageSize })}`).then(normalizePaged)
  },
  getUserDetail(id: number) {
    return get<AdminUserDetail>(`/api/v1/admin/users/${id}`)
  },
  getOpsOverview() {
    return get<AdminOpsOverview>('/api/v1/admin/ops/overview')
  },
  listAuditLogs(page = 1, pageSize = 20) {
    return get<RawListResult<AdminAuditLogItem>>(`/api/v1/admin/audit-logs?${buildPagedQuery({ page, pageSize })}`).then(normalizePaged)
  },
  listBanners() {
    return get<{ list: CMSBannerItem[] | null }>('/api/v1/admin/cms/banners').then((result) => ({
      list: ensureList(result.list),
    }))
  },
  getHelpArticle() {
    return get<CMSArticle>('/api/v1/admin/cms/articles/HELP_CENTER')
  },
}
