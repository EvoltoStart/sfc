import { getStoredToken } from './auth'

type Primitive = string | number | boolean | null | undefined

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

export interface BasicUserInfo {
  userId: number
  nickname: string
  rating?: number
}

export interface SessionView {
  userId: number
  nickname: string
  avatarUrl: string
  realnameStatus: string
  driverVerified: boolean
  roles: string[]
}

export interface ProfileView {
  userId: number
  nickname: string
  avatarUrl: string
  mobileMasked: string
  realnameStatus: string
  driverVerified: boolean
  vehicleVerifiedCount: number
}

export interface LoginResult {
  token: string
  userId: number
  isNewUser: boolean
  roleFlags: {
    passenger: boolean
    driver: boolean
  }
  profile: ProfileView
}

export interface ReviewStatusView {
  authStatus: string
  rejectReason: string
  submittedAt: string | null
  reviewedAt: string | null
}

export interface EmergencyContact {
  id: number
  name: string
  mobileMasked: string
  relation: string
  isDefault: boolean
}

export interface DriverProfileView {
  driverStatus: string
  rating: number
  completedOrderCount: number
  specialLineStatus: string
  licenseStatus: string
}

export interface VehicleView {
  id: number
  brand: string
  model: string
  color: string
  plateNoMasked: string
  seatCount: number
  authStatus: string
  isDefault: boolean
  vehicleImageUrl?: string
}

export interface RouteTemplateView {
  id: number
  routeName: string
  startName: string
  endName: string
  timePeriod: string
  isDefault: boolean
}

export interface WaypointInput {
  name?: string
  lat: number
  lng: number
}

export interface PricePreviewResult {
  mileageFeeFen: number
  tollFeeFen: number
  serviceFeeFen: number
  totalFeeFen: number
  distanceMeter: number
}

export interface RouteScorePreviewResult {
  routeScore: number
  passed: boolean
  ruleSnapshotId: number
  message: string
}

export interface FrequencyCheckResult {
  passed: boolean
  currentDayCount: number
  currentMonthCount: number
  ruleSnapshotId: number
}

export interface TripCreateResult {
  tripId: number
  tripStatus: string
  routeScore: number
  pricePreview: PricePreviewResult
  frequencyCheck: FrequencyCheckResult
}

export interface TripListItem {
  tripId: number
  departAt: string
  routeSummary: string
  seatTotal: number
  seatAvailable: number
  applyCount: number
  tripStatus: string
}

export interface TripDetail {
  tripId: number
  driverInfo: BasicUserInfo
  routeInfo: {
    startName: string
    startLat: number
    startLng: number
    endName: string
    endLat: number
    endLng: number
    waypoints: WaypointInput[]
  }
  routeScore: number
  priceInfo: {
    totalFeeFen: number
    serviceFeeFen: number
    distanceMeter: number
  }
  tripStatus: string
  seatAvailable: number
  safetyInfo: {
    shareEnabled: boolean
  }
}

export interface MatchItem {
  tripId: number
  driverInfo: BasicUserInfo
  departAt: string
  seatAvailable: number
  routeScore: number
  estimatedFeeFen: number
  sortScore: number
}

export interface JoinRequestListItem {
  recordType: 'JOIN_REQUEST'
  joinRequestId: number
  tripId: number
  requestStatus: string
  routeSummary: string
  driverInfo: BasicUserInfo
  createdAt: string
}

export interface JoinRequestDetail {
  recordType: 'JOIN_REQUEST'
  joinRequestId: number
  tripId: number
  requestStatus: string
  driverInfo: BasicUserInfo
  routeInfo: {
    tripRouteSummary: string
  }
  startPoint: {
    name: string
    lat: number
    lng: number
  }
  endPoint: {
    name: string
    lat: number
    lng: number
  }
  acceptedAt: string | null
  rejectedAt: string | null
  cancelledAt: string | null
  expiredAt: string | null
}

export interface DriverJoinRequestListItem {
  joinRequestId: number
  tripId: number
  passengerInfo: BasicUserInfo
  applyAt: string
  historyOrderCount: number
  creditTags: string[]
  requestStatus: string
}

export interface OrderListItem {
  recordType: 'ORDER'
  orderId: number
  orderNo: string
  joinRequestId: number
  routeSummary: string
  departAt: string
  driverInfo?: BasicUserInfo
  passengerInfo?: BasicUserInfo
  orderStatus: string
  payableAmountFen: number
}

export interface OrderDetail {
  recordType: 'ORDER'
  orderId: number
  orderNo: string
  joinRequestId: number
  orderStatus: string
  driverInfo: BasicUserInfo
  passengerInfo: BasicUserInfo
  routeInfo: {
    startName: string
    endName: string
    departAt: string
  }
  priceInfo: {
    payableAmountFen: number
    serviceFeeFen: number
    distanceMeter: number
  }
  boardConfirmedAt: string | null
  arrivalConfirmedAt: string | null
  trackSummary: {
    totalDistanceMeter: number
  }
  safetyActions: string[]
  settlementInfo: {
    settlementStatus?: string
    settledAt?: string | null
    amountFen?: number
  } | null
}

export interface PaymentOrderResponse {
  paymentOrderId: number
  outTradeNo: string
  payParams: {
    nonceStr: string
    package: string
    timestamp: number
    signType: string
  }
  payExpireAt: string
}

export interface PaymentStatusResponse {
  payStatus: string
  paidAt: string | null
  amountFen: number
}

export interface WalletAccount {
  availableAmountFen: number
  frozenAmountFen: number
  totalIncomeFen: number
  totalWithdrawFen: number
}

export interface WalletLedgerItem {
  ledgerId: number
  bizType: string
  changeAmountFen: number
  balanceAfterFen: number
  bizNo: string
  createdAt: string
}

interface ListResult<T> {
  list: T[]
}

interface PagedResult<T> {
  list: T[]
  page: number
  pageSize: number
  total: number
}

interface RawListResult<T> {
  list: T[] | null
}

interface RawPagedResult<T> {
  list: T[] | null
  page?: number
  pageSize?: number
  total?: number
}

export interface SearchMatchesInput {
  startName: string
  startLat: number
  startLng: number
  endName: string
  endLat: number
  endLng: number
  departAt: string
  minRouteScore?: number
  page?: number
  pageSize?: number
}

export interface TripDraftInput {
  startName: string
  startLat: number
  startLng: number
  endName: string
  endLat: number
  endLng: number
  waypoints?: WaypointInput[]
  seatCount: number
}

export interface TripCreateInput {
  vehicleId: number
  startName: string
  startLat: number
  startLng: number
  endName: string
  endLat: number
  endLng: number
  waypoints?: WaypointInput[]
  departAt: string
  seatTotal: number
}

export interface JoinRequestCreateInput {
  tripId: number
  startName: string
  startLat: number
  startLng: number
  endName: string
  endLat: number
  endLng: number
}

export interface VehicleInput {
  brand: string
  model: string
  color: string
  plateNo: string
  seatCount: number
  vehicleImageUrl?: string
}

export interface LicenseSubmitInput {
  licenseNo: string
  issueDate: string
  expireDate: string
  imageUrl: string
}

export interface EmergencyContactInput {
  name: string
  mobile: string
  relation: string
  isDefault: boolean
}

export interface RouteTemplateInput {
  routeName: string
  startName: string
  startLat: number
  startLng: number
  endName: string
  endLat: number
  endLng: number
  waypoints?: WaypointInput[]
  timePeriod?: string
}

function buildQuery(params: Record<string, Primitive>) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === '' || value === null || value === undefined) {
      continue
    }
    searchParams.set(key, String(value))
  }
  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

function ensureList<T>(value: T[] | null | undefined) {
  return Array.isArray(value) ? value : []
}

function normalizeListResult<T>(result: RawListResult<T>): ListResult<T> {
  return {
    list: ensureList(result.list),
  }
}

function normalizePagedResult<T>(result: RawPagedResult<T>): PagedResult<T> {
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
  headers.set('X-Client-Type', 'miniapp')

  const token = getStoredToken()
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
    if (!response.ok) {
      throw new ApiError('服务返回了非 JSON 响应', {
        code: response.status,
        status: response.status,
      })
    }
    return undefined as T
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
  return request<T>(path, {
    method: 'GET',
  })
}

async function getList<T>(path: string) {
  const result = await get<RawListResult<T>>(path)
  return normalizeListResult(result)
}

async function getPaged<T>(path: string) {
  const result = await get<RawPagedResult<T>>(path)
  return normalizePagedResult(result)
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function put<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function remove<T>(path: string) {
  return request<T>(path, {
    method: 'DELETE',
  })
}

export const api = {
  wxLogin(code: string) {
    return post<LoginResult>('/api/v1/auth/wx-login', { code })
  },
  getSession() {
    return get<SessionView>('/api/v1/auth/session')
  },
  getProfile() {
    return get<ProfileView>('/api/v1/me/profile')
  },
  updateProfile(payload: { nickname: string; avatarUrl: string }) {
    return put<{ success: boolean; profile: ProfileView }>('/api/v1/me/profile', payload)
  },
  submitRealname(payload: { realName: string; idCardNo: string }) {
    return post<{ authId: number; authStatus: string }>('/api/v1/me/realname/submit', payload)
  },
  getRealnameStatus() {
    return get<ReviewStatusView>('/api/v1/me/realname/status')
  },
  listEmergencyContacts() {
    return getList<EmergencyContact>('/api/v1/me/emergency-contacts')
  },
  createEmergencyContact(payload: EmergencyContactInput) {
    return post<{ contactId: number; success: boolean }>('/api/v1/me/emergency-contacts', payload)
  },
  updateEmergencyContact(id: number, payload: EmergencyContactInput) {
    return put<{ success: boolean }>(`/api/v1/me/emergency-contacts/${id}`, payload)
  },
  deleteEmergencyContact(id: number) {
    return remove<{ success: boolean }>(`/api/v1/me/emergency-contacts/${id}`)
  },
  getDriverProfile() {
    return get<DriverProfileView>('/api/v1/driver/profile')
  },
  listVehicles() {
    return getList<VehicleView>('/api/v1/driver/vehicles')
  },
  createVehicle(payload: VehicleInput) {
    return post<{ vehicleId: number; authStatus: string }>('/api/v1/driver/vehicles', payload)
  },
  updateVehicle(id: number, payload: VehicleInput) {
    return put<{ success: boolean }>(`/api/v1/driver/vehicles/${id}`, payload)
  },
  setDefaultVehicle(id: number) {
    return post<{ success: boolean }>(`/api/v1/driver/vehicles/${id}/set-default`)
  },
  submitLicense(payload: LicenseSubmitInput) {
    return post<{ licenseId: number; authStatus: string }>('/api/v1/driver/license/submit', payload)
  },
  getLicenseStatus() {
    return get<ReviewStatusView>('/api/v1/driver/license/status')
  },
  listRouteTemplates() {
    return getList<RouteTemplateView>('/api/v1/route-templates')
  },
  createRouteTemplate(payload: RouteTemplateInput) {
    return post<{ routeTemplateId: number; success: boolean }>('/api/v1/route-templates', payload)
  },
  deleteRouteTemplate(id: number) {
    return remove<{ success: boolean }>(`/api/v1/route-templates/${id}`)
  },
  setDefaultRouteTemplate(id: number) {
    return post<{ success: boolean }>(`/api/v1/route-templates/${id}/set-default`)
  },
  pricePreview(payload: TripDraftInput) {
    return post<PricePreviewResult>('/api/v1/trips/price-preview', payload)
  },
  routeScorePreview(payload: Omit<TripDraftInput, 'seatCount'>) {
    return post<RouteScorePreviewResult>('/api/v1/trips/route-score-preview', payload)
  },
  createTrip(payload: TripCreateInput) {
    return post<TripCreateResult>('/api/v1/trips', payload)
  },
  listMyTrips(status = '') {
    return getPaged<TripListItem>(`/api/v1/trips/my${buildQuery({ status, page: 1, pageSize: 20 })}`)
  },
  getTrip(id: number) {
    return get<TripDetail>(`/api/v1/trips/${id}`)
  },
  cancelTrip(id: number, reason: string) {
    return post<{ success: boolean; tripStatus: string }>(`/api/v1/trips/${id}/cancel`, { reason })
  },
  searchMatches(payload: SearchMatchesInput) {
    return post<RawPagedResult<MatchItem>>('/api/v1/search/matches', payload).then(normalizePagedResult)
  },
  createJoinRequest(payload: JoinRequestCreateInput) {
    return post<{ joinRequestId: number; requestStatus: string }>('/api/v1/join-requests', payload)
  },
  listMyJoinRequests(status = '') {
    return getPaged<JoinRequestListItem>(
      `/api/v1/join-requests/my${buildQuery({ status, page: 1, pageSize: 20 })}`,
    )
  },
  getJoinRequest(id: number) {
    return get<JoinRequestDetail>(`/api/v1/join-requests/${id}`)
  },
  cancelJoinRequest(id: number, reason: string) {
    return post<{ success: boolean; requestStatus: string }>(`/api/v1/join-requests/${id}/cancel`, {
      reason,
    })
  },
  listDriverJoinRequests(tripId?: number, status = '') {
    return getPaged<DriverJoinRequestListItem>(
      `/api/v1/driver/join-requests${buildQuery({ tripId, status, page: 1, pageSize: 20 })}`,
    )
  },
  acceptJoinRequest(id: number, remark: string) {
    return post<{ orderId: number; orderStatus: string; payExpireAt: string }>(
      `/api/v1/driver/join-requests/${id}/accept`,
      { remark },
    )
  },
  rejectJoinRequest(id: number, reason: string) {
    return post<{ success: boolean; requestStatus: string }>(
      `/api/v1/driver/join-requests/${id}/reject`,
      { reason },
    )
  },
  listOrders(role: 'passenger' | 'driver', status = '') {
    return getPaged<OrderListItem>(
      `/api/v1/orders${buildQuery({ role, status, page: 1, pageSize: 20 })}`,
    )
  },
  getOrder(id: number) {
    return get<OrderDetail>(`/api/v1/orders/${id}`)
  },
  confirmBoard(id: number) {
    return post<{ success: boolean; orderStatus: string; boardConfirmedAt: string }>(
      `/api/v1/orders/${id}/confirm-board`,
    )
  },
  confirmArrival(id: number) {
    return post<{
      success: boolean
      orderStatus: string
      arrivalConfirmedAt: string
      settlementTriggered: boolean
    }>(`/api/v1/orders/${id}/confirm-arrival`)
  },
  cancelOrder(id: number, reason: string) {
    return post<{ success: boolean; orderStatus: string; refundInfo?: unknown }>(
      `/api/v1/orders/${id}/cancel`,
      { reason },
    )
  },
  createPaymentOrder(orderId: number) {
    return post<PaymentOrderResponse>('/api/v1/payments/orders', { orderId })
  },
  getPaymentStatus(orderId: number) {
    return get<PaymentStatusResponse>(`/api/v1/payments/${orderId}/status`)
  },
  mockPaymentCallback(outTradeNo: string, payStatus: 'PAID' | 'FAIL' = 'PAID') {
    return post<{ success: boolean; idempotent: boolean; payStatus: string }>(
      '/__dev/mock-payment-callback',
      {
        outTradeNo,
        payStatus,
      },
    )
  },
  getWalletAccount() {
    return get<WalletAccount>('/api/v1/wallet/account')
  },
  listWalletLedger(bizType = '') {
    return getPaged<WalletLedgerItem>(
      `/api/v1/wallet/ledger${buildQuery({ bizType, page: 1, pageSize: 20 })}`,
    )
  },
}
