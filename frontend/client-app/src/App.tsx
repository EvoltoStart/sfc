/* eslint-disable react-hooks/rules-of-hooks, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from 'react'
import './App.css'
import {
  api,
  ApiError,
  type DriverJoinRequestListItem,
  type DriverProfileView,
  type EmergencyContact,
  type JoinRequestDetail,
  type JoinRequestListItem,
  type MatchItem,
  type OrderDetail,
  type OrderListItem,
  type PaymentOrderResponse,
  type PaymentStatusResponse,
  type ProfileView,
  type ReviewStatusView,
  type RouteTemplateView,
  type SafetyConfigView,
  type SafetyShareLinkResponse,
  type SafetyTraceSummary,
  type SessionView,
  type TripDetail,
  type TripListItem,
  type VehicleInput,
  type VehicleView,
  type WalletAccount,
  type WalletLedgerItem,
} from './lib/api'
import {
  clearStoredAuthState,
  loadStoredAuthState,
  saveStoredAuthState,
  type RolePreference,
} from './lib/auth'
import {
  actionToneClass,
  formatDateTime,
  formatDistance,
  formatFullDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  resolveAuthMeta,
  resolveJoinMeta,
  resolveOrderMeta,
  resolvePaymentMeta,
  resolveTripMeta,
  roleLabel,
  yesNoLabel,
} from './lib/format'
import {
  buildHashRoute,
  defaultRoute,
  parseHashRoute,
  type AppRoute,
  type AppView,
} from './lib/routes'
import { faqItems, routePresets, staticCoupons, type RoutePreset } from './data/routePresets'

type ToastTone = 'info' | 'success' | 'error'
type PrimaryTab = 'home' | 'orders' | 'publish' | 'safety' | 'profile'
type PassengerOrderTab = 'requests' | 'orders'
type DriverOrderTab = 'trips' | 'requests' | 'orders'

interface ToastState {
  id: number
  tone: ToastTone
  message: string
}

interface SearchDraft {
  presetId: string
  startName: string
  startLat: number
  startLng: number
  endName: string
  endLat: number
  endLng: number
  departAtLocal: string
  minRouteScore: number
}

interface PublishDraft {
  presetId: string
  startName: string
  startLat: number
  startLng: number
  endName: string
  endLat: number
  endLng: number
  departAtLocal: string
  seatTotal: number
  vehicleId: number
}

interface ProfileDraft {
  nickname: string
  avatarUrl: string
}

interface RealnameDraft {
  realName: string
  idCardNo: string
}

interface ContactDraft {
  name: string
  mobile: string
  relation: string
  isDefault: boolean
}

type VehicleDraft = VehicleInput

interface LicenseDraft {
  licenseNo: string
  issueDate: string
  expireDate: string
  imageUrl: string
}

interface SafetyConfigDraft {
  shareEnabled: boolean
  recordEnabled: boolean
  defaultShareContactIds: number[]
}

interface SOSDraft {
  currentLat: number
  currentLng: number
  remark: string
}

interface PageCatalogItem {
  view: AppView
  label: string
  summary: string
  mode: '真实接口' | '静态占位'
}

const defaultPreset = routePresets[0]

const pageCatalog: PageCatalogItem[] = [
  { view: 'home', label: '首页搜索', summary: '乘客搜索与车主快捷入口', mode: '真实接口' },
  { view: 'matches', label: '匹配列表', summary: '真实匹配结果列表', mode: '真实接口' },
  { view: 'trip-detail', label: '行程详情', summary: '查看司机、价格与顺路度', mode: '真实接口' },
  { view: 'orders', label: '订单中心', summary: '乘客与车主多视角订单页', mode: '真实接口' },
  { view: 'order-detail', label: '订单详情', summary: '申请态与订单态详情动作', mode: '真实接口' },
  { view: 'payment', label: '支付确认', summary: '真实支付单 + 本地回调联调', mode: '真实接口' },
  { view: 'publish', label: '发布行程', summary: '价格预览、顺路校验、发单', mode: '真实接口' },
  { view: 'safety', label: '安全中心', summary: '安全配置、分享、SOS、轨迹摘要均接真实接口', mode: '真实接口' },
  { view: 'profile', label: '我的', summary: '资料、实名认证、司机能力入口', mode: '真实接口' },
  { view: 'vehicles', label: '车辆管理', summary: '新增车辆与默认车辆设置', mode: '真实接口' },
  { view: 'license', label: '驾驶证认证', summary: '提交驾驶证并刷新认证状态', mode: '真实接口' },
  { view: 'wallet', label: '钱包', summary: '司机收入账户与流水', mode: '真实接口' },
  { view: 'coupons', label: '优惠券', summary: '页面完整展示，等待后端接口补齐', mode: '静态占位' },
  { view: 'help', label: '帮助中心', summary: '联调 FAQ 与产品说明', mode: '静态占位' },
]

const backendCapabilityNotes = [
  '已接入真实接口：登录、资料、实名认证、紧急联系人、车辆、驾驶证、价格预览、顺路校验、发布行程、搜索匹配、同行申请、司机接单、订单、支付、钱包。',
  '安全能力已接入真实接口：默认分享设置、行程分享链接、SOS 上报、轨迹点上传和轨迹摘要都能走后端闭环。',
  '常用路线列表接口当前只返回名称摘要，不返回经纬度，所以前端保留“保存常用路线”，但搜索和发布仍使用本地路线预设来驱动真实联调。',
]

const quickLoginCodes = [
  { label: '乘客 A', code: 'passenger-alpha' },
  { label: '乘客 B', code: 'passenger-beta' },
  { label: '车主 A', code: 'driver-alpha' },
  { label: '车主 B', code: 'driver-beta' },
]

const apiOriginLabel = import.meta.env.DEV
  ? (import.meta.env.VITE_API_ORIGIN || 'http://127.0.0.1:8080').replace(/^https?:\/\//, '')
  : '同源部署'

function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

function buildSearchDraft(preset: RoutePreset): SearchDraft {
  const date = new Date()
  date.setHours(date.getHours() + preset.departOffsetHours, 20, 0, 0)
  return {
    presetId: preset.id,
    startName: preset.startName,
    startLat: preset.startLat,
    startLng: preset.startLng,
    endName: preset.endName,
    endLat: preset.endLat,
    endLng: preset.endLng,
    departAtLocal: toDateTimeLocalValue(date),
    minRouteScore: 80,
  }
}

function buildPublishDraft(preset: RoutePreset): PublishDraft {
  const date = new Date()
  date.setHours(date.getHours() + preset.departOffsetHours + 1, 10, 0, 0)
  return {
    presetId: preset.id,
    startName: preset.startName,
    startLat: preset.startLat,
    startLng: preset.startLng,
    endName: preset.endName,
    endLat: preset.endLat,
    endLng: preset.endLng,
    departAtLocal: toDateTimeLocalValue(date),
    seatTotal: 3,
    vehicleId: 0,
  }
}

function getRoutePreset(presetId: string) {
  return routePresets.find((item) => item.id === presetId) ?? defaultPreset
}

function toIsoString(localValue: string) {
  return new Date(localValue).toISOString()
}

function getPrimaryTab(view: AppView): PrimaryTab {
  switch (view) {
    case 'matches':
    case 'trip-detail':
      return 'home'
    case 'order-detail':
    case 'payment':
      return 'orders'
    case 'publish':
      return 'publish'
    case 'safety':
      return 'safety'
    case 'vehicles':
    case 'license':
    case 'wallet':
    case 'coupons':
    case 'help':
    case 'profile':
      return 'profile'
    case 'orders':
      return 'orders'
    default:
      return 'home'
  }
}

function readNumberParam(value?: string) {
  if (!value) {
    return 0
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function orderProgress(status: string) {
  switch (status) {
    case 'PENDING_PASSENGER_PAY':
      return 25
    case 'PENDING_DEPART':
      return 50
    case 'IN_PROGRESS':
      return 75
    case 'COMPLETED':
    case 'REFUNDED':
    case 'CANCELLED':
      return 100
    default:
      return 15
  }
}

function joinProgress(status: string) {
  switch (status) {
    case 'PENDING_DRIVER_CONFIRM':
      return 30
    case 'ACCEPTED':
      return 75
    case 'REJECTED':
    case 'CANCELLED':
    case 'EXPIRED':
      return 100
    default:
      return 20
  }
}

function emptyWallet(): WalletAccount {
  return {
    availableAmountFen: 0,
    frozenAmountFen: 0,
    totalIncomeFen: 0,
    totalWithdrawFen: 0,
  }
}

function toneToBadgeClass(tone: 'safe' | 'warn' | 'info' | 'danger') {
  if (tone === 'danger') {
    return 'danger'
  }
  return tone
}

function StatusBadge(props: { label: string; tone: 'safe' | 'warn' | 'info' | 'danger' }) {
  return <span className={`badge ${toneToBadgeClass(props.tone)}`}>{props.label}</span>
}

function SectionHeading(props: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="section-title app-section-title">
      <div>
        <strong>{props.title}</strong>
        {props.description ? <span>{props.description}</span> : null}
      </div>
      {props.action}
    </div>
  )
}

function EmptyState(props: { title: string; body: string; action?: ReactNode }) {
  return (
    <section className="panel empty-state-card">
      <strong>{props.title}</strong>
      <p>{props.body}</p>
      {props.action ? <div className="action-row">{props.action}</div> : null}
    </section>
  )
}

function PhoneHeader(props: {
  eyebrow: string
  title: string
  subtitle: string
  highlightValue: string
  highlightLabel: string
}) {
  return (
    <div className="topbar">
      <div>
        <div className="eyebrow">{props.eyebrow}</div>
        <div className="title">{props.title}</div>
        <div className="subtitle">{props.subtitle}</div>
      </div>
      <div className="weather">
        <strong>{props.highlightValue}</strong>
        <span>{props.highlightLabel}</span>
      </div>
    </div>
  )
}

function BottomTabs(props: {
  activeTab: PrimaryTab
  onNavigate: (view: AppView) => void
}) {
  const tabs: Array<{ key: PrimaryTab; label: string; view: AppView }> = [
    { key: 'home', label: '首页', view: 'home' },
    { key: 'orders', label: '订单', view: 'orders' },
    { key: 'publish', label: '发布', view: 'publish' },
    { key: 'safety', label: '安全', view: 'safety' },
    { key: 'profile', label: '我的', view: 'profile' },
  ]

  return (
    <div className="tabbar app-tabbar">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={props.activeTab === tab.key ? 'active' : ''}
          onClick={() => props.onNavigate(tab.view)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function App() {
  const storedAuth = loadStoredAuthState()

  const [route, setRoute] = useState<AppRoute>(() => {
    if (typeof window === 'undefined') {
      return defaultRoute
    }
    return parseHashRoute(window.location.hash)
  })
  const [catalogQuery, setCatalogQuery] = useState('')
  const deferredCatalogQuery = useDeferredValue(catalogQuery.trim().toLowerCase())

  const [authToken, setAuthToken] = useState(storedAuth.token)
  const [loginCode, setLoginCode] = useState(storedAuth.loginCode)
  const [rolePreference, setRolePreference] = useState<RolePreference>(storedAuth.rolePreference)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [bootstrapping, setBootstrapping] = useState(false)
  const [pageLoading, setPageLoading] = useState('')
  const [busyAction, setBusyAction] = useState('')

  const [session, setSession] = useState<SessionView | null>(null)
  const [profile, setProfile] = useState<ProfileView | null>(null)
  const [realnameStatus, setRealnameStatus] = useState<ReviewStatusView | null>(null)
  const [licenseStatus, setLicenseStatus] = useState<ReviewStatusView | null>(null)
  const [driverProfile, setDriverProfile] = useState<DriverProfileView | null>(null)

  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [vehicles, setVehicles] = useState<VehicleView[]>([])
  const [routeTemplates, setRouteTemplates] = useState<RouteTemplateView[]>([])
  const [walletAccount, setWalletAccount] = useState<WalletAccount>(emptyWallet())
  const [walletLedger, setWalletLedger] = useState<WalletLedgerItem[]>([])
  const [safetyConfig, setSafetyConfig] = useState<SafetyConfigView | null>(null)
  const [safetyConfigDraft, setSafetyConfigDraft] = useState<SafetyConfigDraft>({
    shareEnabled: true,
    recordEnabled: true,
    defaultShareContactIds: [],
  })
  const [selectedSafetyOrderId, setSelectedSafetyOrderId] = useState(0)
  const [safetyShareLink, setSafetyShareLink] = useState<SafetyShareLinkResponse | null>(null)
  const [safetyTraceSummary, setSafetyTraceSummary] = useState<SafetyTraceSummary | null>(null)
  const [sosDraft, setSosDraft] = useState<SOSDraft>({
    currentLat: defaultPreset.startLat,
    currentLng: defaultPreset.startLng,
    remark: '需要安全协助',
  })

  const [searchDraft, setSearchDraft] = useState<SearchDraft>(() => buildSearchDraft(defaultPreset))
  const [publishDraft, setPublishDraft] = useState<PublishDraft>(() => buildPublishDraft(defaultPreset))
  const [publishPricePreview, setPublishPricePreview] = useState<{ total: number; distance: number } | null>(
    null,
  )
  const [publishRouteScore, setPublishRouteScore] = useState<{ score: number; passed: boolean; message: string } | null>(
    null,
  )

  const [profileDraft, setProfileDraft] = useState<ProfileDraft>({
    nickname: '',
    avatarUrl: '',
  })
  const [realnameDraft, setRealnameDraft] = useState<RealnameDraft>({
    realName: '张三',
    idCardNo: '330106199001011234',
  })
  const [contactDraft, setContactDraft] = useState<ContactDraft>({
    name: '家人',
    mobile: '13800138000',
    relation: '父母',
    isDefault: true,
  })
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft>({
    brand: '比亚迪',
    model: '汉 DM-i',
    color: '曜石黑',
    plateNo: '浙A12345',
    seatCount: 4,
    vehicleImageUrl: '',
  })
  const [licenseDraft, setLicenseDraft] = useState<LicenseDraft>({
    licenseNo: 'A123456789',
    issueDate: '2024-01-01',
    expireDate: '2034-01-01',
    imageUrl: 'https://example.com/license.png',
  })

  const [passengerOrderTab, setPassengerOrderTab] = useState<PassengerOrderTab>('requests')
  const [driverOrderTab, setDriverOrderTab] = useState<DriverOrderTab>('trips')
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [tripDetail, setTripDetail] = useState<TripDetail | null>(null)
  const [passengerRequests, setPassengerRequests] = useState<JoinRequestListItem[]>([])
  const [passengerOrders, setPassengerOrders] = useState<OrderListItem[]>([])
  const [driverTrips, setDriverTrips] = useState<TripListItem[]>([])
  const [driverRequests, setDriverRequests] = useState<DriverJoinRequestListItem[]>([])
  const [driverOrders, setDriverOrders] = useState<OrderListItem[]>([])
  const [joinRequestDetail, setJoinRequestDetail] = useState<JoinRequestDetail | null>(null)
  const [orderDetail, setOrderDetail] = useState<OrderDetail | null>(null)
  const [paymentOrder, setPaymentOrder] = useState<PaymentOrderResponse | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusResponse | null>(null)

  const currentRole: RolePreference =
    profile?.driverVerified && rolePreference === 'DRIVER' ? 'DRIVER' : 'PASSENGER'
  const currentPreset = getRoutePreset(searchDraft.presetId)
  const safetyOrderOptions = currentRole === 'DRIVER' ? driverOrders : passengerOrders
  const activeSafetyOrderId =
    selectedSafetyOrderId || orderDetail?.orderId || safetyOrderOptions[0]?.orderId || 0

  const visibleCatalog = pageCatalog.filter((item) => {
    if (!deferredCatalogQuery) {
      return true
    }
    return `${item.label} ${item.summary} ${item.mode}`.toLowerCase().includes(deferredCatalogQuery)
  })

  useEffect(() => {
    saveStoredAuthState({
      token: authToken,
      loginCode,
      rolePreference,
    })
  }, [authToken, loginCode, rolePreference])

  useEffect(() => {
    if (!toast) {
      return
    }
    const timer = window.setTimeout(() => {
      setToast(null)
    }, 3200)
    return () => {
      window.clearTimeout(timer)
    }
  }, [toast])

  useEffect(() => {
    const syncRoute = () => {
      setRoute(parseHashRoute(window.location.hash))
    }
    window.addEventListener('hashchange', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
    }
  }, [])

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({
      id: Date.now(),
      tone,
      message,
    })
  }, [])

  const navigate = useCallback((view: AppView, params: Record<string, string> = {}) => {
    const nextRoute: AppRoute = { view, params }
    startTransition(() => {
      const nextHash = buildHashRoute(nextRoute)
      if (typeof window !== 'undefined') {
        if (window.location.hash === nextHash) {
          setRoute(nextRoute)
          return
        }
        window.location.hash = nextHash
      }
      setRoute(nextRoute)
    })
  }, [])

  const resetTransientState = useCallback(() => {
    setMatches([])
    setTripDetail(null)
    setPassengerRequests([])
    setPassengerOrders([])
    setDriverTrips([])
    setDriverRequests([])
    setDriverOrders([])
    setJoinRequestDetail(null)
    setOrderDetail(null)
    setPaymentOrder(null)
    setPaymentStatus(null)
  }, [])

  const performLogout = useCallback((message?: string) => {
    clearStoredAuthState()
    setAuthToken('')
    setLoginCode('')
    setSession(null)
    setProfile(null)
    setRealnameStatus(null)
    setLicenseStatus(null)
    setDriverProfile(null)
    setContacts([])
    setVehicles([])
    setRouteTemplates([])
    setWalletAccount(emptyWallet())
    setWalletLedger([])
    setSafetyConfig(null)
    setSafetyConfigDraft({
      shareEnabled: true,
      recordEnabled: true,
      defaultShareContactIds: [],
    })
    setSelectedSafetyOrderId(0)
    setSafetyShareLink(null)
    setSafetyTraceSummary(null)
    resetTransientState()
    navigate('home')
    if (message) {
      pushToast(message, 'info')
    }
  }, [navigate, pushToast, resetTransientState])

  const handleError = useCallback((error: unknown, fallback = '操作失败，请稍后再试') => {
    if (error instanceof ApiError) {
      if (error.code === 'USER_NOT_LOGIN' || error.status === 401) {
        performLogout('登录状态已失效，请重新登录')
        return
      }
      pushToast(error.message || fallback, 'error')
      return
    }
    pushToast(fallback, 'error')
  }, [performLogout, pushToast])

  const loadWalletBundle = useCallback(async () => {
    const [account, ledgerResult] = await Promise.all([api.getWalletAccount(), api.listWalletLedger()])
    setWalletAccount(account)
    setWalletLedger(ledgerResult.list)
  }, [])

  const applySafetyConfig = useCallback((config: SafetyConfigView) => {
    setSafetyConfig(config)
    setSafetyConfigDraft({
      shareEnabled: config.shareEnabled,
      recordEnabled: config.recordEnabled,
      defaultShareContactIds: config.defaultShareContactIds,
    })
  }, [])

  const loadSafetyConfig = useCallback(async () => {
    const config = await api.getSafetyConfig()
    applySafetyConfig(config)
  }, [applySafetyConfig])

  const loadBootstrapData = useEffectEvent(async () => {
    if (!authToken) {
      return
    }

    setBootstrapping(true)
    try {
      const [nextSession, nextProfile] = await Promise.all([api.getSession(), api.getProfile()])
      setSession(nextSession)
      setProfile(nextProfile)

      const optionalResults = await Promise.allSettled([
        api.getRealnameStatus(),
        api.getLicenseStatus(),
        api.getDriverProfile(),
        api.listEmergencyContacts(),
        api.listVehicles(),
        api.listRouteTemplates(),
        api.getWalletAccount(),
        api.listWalletLedger(),
        api.getSafetyConfig(),
      ])

      const [
        nextRealname,
        nextLicense,
        nextDriverProfile,
        nextContacts,
        nextVehicles,
        nextRouteTemplates,
        nextWalletAccount,
        nextWalletLedger,
        nextSafetyConfig,
      ] = optionalResults

      setRealnameStatus(nextRealname.status === 'fulfilled' ? nextRealname.value : null)
      setLicenseStatus(nextLicense.status === 'fulfilled' ? nextLicense.value : null)
      setDriverProfile(nextDriverProfile.status === 'fulfilled' ? nextDriverProfile.value : null)
      setContacts(nextContacts.status === 'fulfilled' ? nextContacts.value.list : [])
      setVehicles(nextVehicles.status === 'fulfilled' ? nextVehicles.value.list : [])
      setRouteTemplates(nextRouteTemplates.status === 'fulfilled' ? nextRouteTemplates.value.list : [])
      setWalletAccount(
        nextWalletAccount.status === 'fulfilled' ? nextWalletAccount.value : emptyWallet(),
      )
      setWalletLedger(nextWalletLedger.status === 'fulfilled' ? nextWalletLedger.value.list : [])
      if (nextSafetyConfig.status === 'fulfilled') {
        setSafetyConfig(nextSafetyConfig.value)
        setSafetyConfigDraft({
          shareEnabled: nextSafetyConfig.value.shareEnabled,
          recordEnabled: nextSafetyConfig.value.recordEnabled,
          defaultShareContactIds: nextSafetyConfig.value.defaultShareContactIds,
        })
      } else {
        setSafetyConfig(null)
      }
    } catch (error) {
      handleError(error, '会话恢复失败')
      performLogout('会话恢复失败，请重新登录')
    } finally {
      setBootstrapping(false)
    }
  })

  useEffect(() => {
    void loadBootstrapData()
  }, [authToken])

  const refreshPassengerOrderCenter = useEffectEvent(async () => {
    setPageLoading('orders')
    try {
      const [requestsResult, ordersResult] = await Promise.all([
        api.listMyJoinRequests(),
        api.listOrders('passenger'),
      ])
      setPassengerRequests(requestsResult.list)
      setPassengerOrders(ordersResult.list)
    } catch (error) {
      handleError(error, '加载乘客订单失败')
    } finally {
      setPageLoading('')
    }
  })

  const refreshDriverOrderCenter = useEffectEvent(async () => {
    setPageLoading('orders')
    try {
      const [tripsResult, requestsResult, ordersResult] = await Promise.all([
        api.listMyTrips(),
        api.listDriverJoinRequests(),
        api.listOrders('driver'),
      ])
      setDriverTrips(tripsResult.list)
      setDriverRequests(requestsResult.list)
      setDriverOrders(ordersResult.list)
    } catch (error) {
      handleError(error, '加载车主订单失败')
    } finally {
      setPageLoading('')
    }
  })

  const loadTripDetail = useEffectEvent(async (tripId: number) => {
    if (!tripId) {
      return
    }
    setPageLoading('trip-detail')
    try {
      const detail = await api.getTrip(tripId)
      setTripDetail(detail)
    } catch (error) {
      handleError(error, '加载行程详情失败')
    } finally {
      setPageLoading('')
    }
  })

  const loadJoinRequestDetail = useEffectEvent(async (joinRequestId: number) => {
    if (!joinRequestId) {
      return
    }
    setPageLoading('order-detail')
    try {
      const detail = await api.getJoinRequest(joinRequestId)
      setJoinRequestDetail(detail)
      setOrderDetail(null)
      setPaymentOrder(null)
      setPaymentStatus(null)
    } catch (error) {
      handleError(error, '加载申请详情失败')
    } finally {
      setPageLoading('')
    }
  })

  const loadOrderDetail = useEffectEvent(async (orderId: number, withPayment = false) => {
    if (!orderId) {
      return
    }
    setPageLoading(withPayment ? 'payment' : 'order-detail')
    try {
      const [detail, status] = await Promise.all([
        api.getOrder(orderId),
        withPayment ? api.getPaymentStatus(orderId) : Promise.resolve(null),
      ])
      setOrderDetail(detail)
      setJoinRequestDetail(null)
      if (status) {
        setPaymentStatus(status)
      }
    } catch (error) {
      handleError(error, withPayment ? '加载支付信息失败' : '加载订单详情失败')
    } finally {
      setPageLoading('')
    }
  })

  const refreshCurrentView = useEffectEvent(async () => {
    switch (route.view) {
      case 'orders':
        if (currentRole === 'DRIVER') {
          await refreshDriverOrderCenter()
        } else {
          await refreshPassengerOrderCenter()
        }
        return
      case 'trip-detail':
        await loadTripDetail(readNumberParam(route.params.tripId))
        return
      case 'order-detail':
        if (route.params.kind === 'join') {
          await loadJoinRequestDetail(readNumberParam(route.params.id))
        } else {
          await loadOrderDetail(readNumberParam(route.params.id))
        }
        return
      case 'payment':
        await loadOrderDetail(readNumberParam(route.params.id), true)
        return
      case 'wallet':
        await loadWalletBundle()
        return
      case 'safety':
        try {
          await loadSafetyConfig()
          if (currentRole === 'DRIVER') {
            await refreshDriverOrderCenter()
          } else {
            await refreshPassengerOrderCenter()
          }
        } catch (error) {
          handleError(error, '加载安全中心失败')
        }
        return
      default:
        return
    }
  })

  useEffect(() => {
    if (!authToken || !session || !profile) {
      return
    }

    if (route.view === 'orders') {
      if (currentRole === 'DRIVER') {
        void refreshDriverOrderCenter()
      } else {
        void refreshPassengerOrderCenter()
      }
    }

    if (route.view === 'trip-detail') {
      void loadTripDetail(readNumberParam(route.params.tripId))
    }

    if (route.view === 'order-detail') {
      if (route.params.kind === 'join') {
        void loadJoinRequestDetail(readNumberParam(route.params.id))
      } else {
        void loadOrderDetail(readNumberParam(route.params.id))
      }
    }

    if (route.view === 'payment') {
      void loadOrderDetail(readNumberParam(route.params.id), true)
    }

    if (route.view === 'wallet') {
      void loadWalletBundle()
    }

  }, [
    authToken,
    currentRole,
    refreshDriverOrderCenter,
    loadJoinRequestDetail,
    loadOrderDetail,
    loadSafetyConfig,
    loadTripDetail,
    loadWalletBundle,
    refreshDriverOrderCenter,
    refreshPassengerOrderCenter,
    route.params.id,
    route.params.kind,
    route.params.tripId,
    route.view,
    session,
    profile,
  ])

  useEffect(() => {
    if (!selectedSafetyOrderId && safetyOrderOptions.length > 0) {
      setSelectedSafetyOrderId(safetyOrderOptions[0].orderId)
    }
  }, [safetyOrderOptions, selectedSafetyOrderId])

  const handleLogin = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) {
      pushToast('请先输入登录 code', 'info')
      return
    }

    setBusyAction('login')
    try {
      const result = await api.wxLogin(trimmed)
      const nextRolePreference: RolePreference =
        result.roleFlags.driver && storedAuth.rolePreference === 'DRIVER' ? 'DRIVER' : 'PASSENGER'
      saveStoredAuthState({
        token: result.token,
        loginCode: trimmed,
        rolePreference: nextRolePreference,
      })
      setAuthToken(result.token)
      setLoginCode(trimmed)
      setProfile(result.profile)
      setRolePreference(nextRolePreference)
      pushToast(`已接入真实后端，当前账号：${trimmed}`, 'success')
    } catch (error) {
      handleError(error, '登录失败')
    } finally {
      setBusyAction('')
    }
  }

  const applySearchPreset = (presetId: string) => {
    const preset = getRoutePreset(presetId)
    setSearchDraft(buildSearchDraft(preset))
  }

  const applyPublishPreset = (presetId: string) => {
    const preset = getRoutePreset(presetId)
    setPublishDraft((current) => ({
      ...buildPublishDraft(preset),
      vehicleId: current.vehicleId,
    }))
    setPublishPricePreview(null)
    setPublishRouteScore(null)
  }

  const handleSearchMatches = async () => {
    setBusyAction('search')
    try {
      const result = await api.searchMatches({
        startName: searchDraft.startName,
        startLat: searchDraft.startLat,
        startLng: searchDraft.startLng,
        endName: searchDraft.endName,
        endLat: searchDraft.endLat,
        endLng: searchDraft.endLng,
        departAt: toIsoString(searchDraft.departAtLocal),
        minRouteScore: searchDraft.minRouteScore,
        page: 1,
        pageSize: 20,
      })
      setMatches(result.list)
      navigate('matches')
      pushToast(`搜索完成，共匹配 ${result.list.length} 条真实行程`, 'success')
    } catch (error) {
      handleError(error, '搜索匹配失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCreateJoinRequest = async () => {
    if (!tripDetail) {
      pushToast('请先选择一条行程', 'info')
      return
    }
    setBusyAction('join-request')
    try {
      const result = await api.createJoinRequest({
        tripId: tripDetail.tripId,
        startName: searchDraft.startName,
        startLat: searchDraft.startLat,
        startLng: searchDraft.startLng,
        endName: searchDraft.endName,
        endLat: searchDraft.endLat,
        endLng: searchDraft.endLng,
      })
      await refreshPassengerOrderCenter()
      navigate('order-detail', {
        kind: 'join',
        id: String(result.joinRequestId),
      })
      pushToast('同行申请已提交，已接入真实后端记录', 'success')
    } catch (error) {
      handleError(error, '提交同行申请失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleRefreshPublishPreview = async () => {
    setBusyAction('publish-preview')
    try {
      const [price, score] = await Promise.all([
        api.pricePreview({
          startName: publishDraft.startName,
          startLat: publishDraft.startLat,
          startLng: publishDraft.startLng,
          endName: publishDraft.endName,
          endLat: publishDraft.endLat,
          endLng: publishDraft.endLng,
          seatCount: publishDraft.seatTotal,
        }),
        api.routeScorePreview({
          startName: publishDraft.startName,
          startLat: publishDraft.startLat,
          startLng: publishDraft.startLng,
          endName: publishDraft.endName,
          endLat: publishDraft.endLat,
          endLng: publishDraft.endLng,
          waypoints: [],
        }),
      ])
      setPublishPricePreview({
        total: price.totalFeeFen,
        distance: price.distanceMeter,
      })
      setPublishRouteScore({
        score: score.routeScore,
        passed: score.passed,
        message: score.message,
      })
      pushToast('已刷新真实价格和顺路度建议', 'success')
    } catch (error) {
      handleError(error, '预览价格失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCreateTrip = async () => {
    if (!publishDraft.vehicleId) {
      pushToast('请先选择车辆', 'info')
      return
    }
    setBusyAction('create-trip')
    try {
      const result = await api.createTrip({
        vehicleId: publishDraft.vehicleId,
        startName: publishDraft.startName,
        startLat: publishDraft.startLat,
        startLng: publishDraft.startLng,
        endName: publishDraft.endName,
        endLat: publishDraft.endLat,
        endLng: publishDraft.endLng,
        waypoints: [],
        departAt: toIsoString(publishDraft.departAtLocal),
        seatTotal: publishDraft.seatTotal,
      })
      setRolePreference('DRIVER')
      await refreshDriverOrderCenter()
      navigate('orders')
      pushToast(`行程发布成功，真实 tripId=${result.tripId}`, 'success')
    } catch (error) {
      handleError(error, '发布行程失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleSaveRouteTemplate = async () => {
    const preset = getRoutePreset(publishDraft.presetId)
    setBusyAction('route-template')
    try {
      await api.createRouteTemplate({
        routeName: preset.routeName,
        startName: publishDraft.startName,
        startLat: publishDraft.startLat,
        startLng: publishDraft.startLng,
        endName: publishDraft.endName,
        endLat: publishDraft.endLat,
        endLng: publishDraft.endLng,
        waypoints: [],
        timePeriod: preset.timePeriod,
      })
      const templates = await api.listRouteTemplates()
      setRouteTemplates(templates.list)
      pushToast('当前路线已保存到真实后端', 'success')
    } catch (error) {
      handleError(error, '保存常用路线失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleUpdateProfile = async () => {
    setBusyAction('profile')
    try {
      const result = await api.updateProfile(profileDraft)
      setProfile(result.profile)
      pushToast('个人资料已更新', 'success')
    } catch (error) {
      handleError(error, '更新资料失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleSubmitRealname = async () => {
    setBusyAction('realname')
    try {
      await api.submitRealname(realnameDraft)
      const status = await api.getRealnameStatus()
      setRealnameStatus(status)
      pushToast('实名认证已提交到真实后端', 'success')
    } catch (error) {
      handleError(error, '提交实名认证失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCreateContact = async () => {
    setBusyAction('contact')
    try {
      await api.createEmergencyContact(contactDraft)
      const result = await api.listEmergencyContacts()
      setContacts(result.list)
      setContactDraft({
        name: '朋友',
        mobile: '13900139000',
        relation: '朋友',
        isDefault: false,
      })
      pushToast('紧急联系人已保存', 'success')
    } catch (error) {
      handleError(error, '新增联系人失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleDeleteContact = async (contactId: number) => {
    setBusyAction(`delete-contact-${contactId}`)
    try {
      await api.deleteEmergencyContact(contactId)
      const result = await api.listEmergencyContacts()
      setContacts(result.list)
      setSafetyConfigDraft((current) => ({
        ...current,
        defaultShareContactIds: current.defaultShareContactIds.filter((id) => id !== contactId),
      }))
      pushToast('联系人已删除', 'success')
    } catch (error) {
      handleError(error, '删除联系人失败')
    } finally {
      setBusyAction('')
    }
  }

  const toggleSafetyContact = (contactId: number) => {
    setSafetyConfigDraft((current) => {
      const selected = current.defaultShareContactIds.includes(contactId)
      return {
        ...current,
        defaultShareContactIds: selected
          ? current.defaultShareContactIds.filter((id) => id !== contactId)
          : [...current.defaultShareContactIds, contactId],
      }
    })
  }

  const handleUpdateSafetyConfig = async () => {
    setBusyAction('safety-config')
    try {
      await api.updateSafetyConfig(safetyConfigDraft)
      await loadSafetyConfig()
      pushToast('安全配置已保存到真实后端', 'success')
    } catch (error) {
      handleError(error, '保存安全配置失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCreateSafetyShareLink = async (orderId = activeSafetyOrderId) => {
    if (!orderId) {
      pushToast('请先选择一笔可分享的订单', 'info')
      return
    }
    setBusyAction('share-link')
    try {
      const result = await api.createSafetyShareLink(orderId, safetyConfigDraft.defaultShareContactIds)
      setSafetyShareLink(result)
      pushToast('行程分享链接已生成', 'success')
    } catch (error) {
      handleError(error, '生成分享链接失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleUploadTraceSample = async (orderId = activeSafetyOrderId) => {
    if (!orderId) {
      pushToast('请先选择一笔订单再上传轨迹', 'info')
      return
    }
    const now = Date.now()
    const preset = currentPreset
    setBusyAction('trace-upload')
    try {
      await api.uploadTracePoints(orderId, [
        {
          lat: preset.startLat,
          lng: preset.startLng,
          recordedAt: new Date(now - 8 * 60 * 1000).toISOString(),
        },
        {
          lat: (preset.startLat + preset.endLat) / 2,
          lng: (preset.startLng + preset.endLng) / 2,
          recordedAt: new Date(now - 4 * 60 * 1000).toISOString(),
        },
        {
          lat: preset.endLat,
          lng: preset.endLng,
          recordedAt: new Date(now).toISOString(),
        },
      ])
      const summary = await api.getTraceSummary(orderId)
      setSafetyTraceSummary(summary)
      pushToast('轨迹点已上传，摘要已刷新', 'success')
    } catch (error) {
      handleError(error, '上传轨迹失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleLoadTraceSummary = async (orderId = activeSafetyOrderId) => {
    if (!orderId) {
      pushToast('请先选择一笔订单查看轨迹摘要', 'info')
      return
    }
    setBusyAction('trace-summary')
    try {
      const summary = await api.getTraceSummary(orderId)
      setSafetyTraceSummary(summary)
      pushToast('轨迹摘要已刷新', 'success')
    } catch (error) {
      handleError(error, '读取轨迹摘要失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCreateSafetySOS = async (orderId = activeSafetyOrderId) => {
    if (!orderId) {
      pushToast('请先选择一笔订单再上报 SOS', 'info')
      return
    }
    setBusyAction('sos')
    try {
      const result = await api.createSafetySOS({
        orderId,
        currentLat: sosDraft.currentLat,
        currentLng: sosDraft.currentLng,
        remark: sosDraft.remark,
      })
      pushToast(
        result.notified
          ? `SOS 已上报并通知联系人，事件 ${result.sosEventId}`
          : `SOS 已上报，事件 ${result.sosEventId}`,
        'success',
      )
    } catch (error) {
      handleError(error, '上报 SOS 失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCreateVehicle = async () => {
    setBusyAction('vehicle')
    try {
      await api.createVehicle(vehicleDraft)
      const result = await api.listVehicles()
      setVehicles(result.list)
      const nextDefault = result.list.find((item) => item.isDefault) ?? result.list[0]
      if (nextDefault) {
        setPublishDraft((current) => ({
          ...current,
          vehicleId: nextDefault.id,
        }))
      }
      const refreshedProfile = await api.getProfile()
      setProfile(refreshedProfile)
      pushToast('车辆已提交，真实接口返回成功', 'success')
    } catch (error) {
      handleError(error, '新增车辆失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleSetDefaultVehicle = async (vehicleId: number) => {
    setBusyAction(`vehicle-default-${vehicleId}`)
    try {
      await api.setDefaultVehicle(vehicleId)
      const result = await api.listVehicles()
      setVehicles(result.list)
      setPublishDraft((current) => ({
        ...current,
        vehicleId,
      }))
      pushToast('默认车辆已更新', 'success')
    } catch (error) {
      handleError(error, '设置默认车辆失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleSubmitLicense = async () => {
    setBusyAction('license')
    try {
      await api.submitLicense(licenseDraft)
      const [status, refreshedProfile, refreshedDriverProfile] = await Promise.all([
        api.getLicenseStatus(),
        api.getProfile(),
        api.getDriverProfile(),
      ])
      setLicenseStatus(status)
      setProfile(refreshedProfile)
      setDriverProfile(refreshedDriverProfile)
      pushToast('驾驶证已提交到真实后端', 'success')
    } catch (error) {
      handleError(error, '提交驾驶证失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleSetDefaultTemplate = async (templateId: number) => {
    setBusyAction(`route-default-${templateId}`)
    try {
      await api.setDefaultRouteTemplate(templateId)
      const result = await api.listRouteTemplates()
      setRouteTemplates(result.list)
      pushToast('已更新常用路线默认项', 'success')
    } catch (error) {
      handleError(error, '设置默认路线失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleDeleteRouteTemplate = async (templateId: number) => {
    setBusyAction(`route-delete-${templateId}`)
    try {
      await api.deleteRouteTemplate(templateId)
      const result = await api.listRouteTemplates()
      setRouteTemplates(result.list)
      pushToast('常用路线已删除', 'success')
    } catch (error) {
      handleError(error, '删除常用路线失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleAcceptDriverRequest = async (joinRequestId: number) => {
    setBusyAction(`accept-${joinRequestId}`)
    try {
      const result = await api.acceptJoinRequest(joinRequestId, '欢迎同行')
      await refreshDriverOrderCenter()
      navigate('order-detail', {
        kind: 'order',
        id: String(result.orderId),
      })
      pushToast('已接受乘客申请，并生成真实订单', 'success')
    } catch (error) {
      handleError(error, '接受乘客申请失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleRejectDriverRequest = async (joinRequestId: number) => {
    setBusyAction(`reject-${joinRequestId}`)
    try {
      await api.rejectJoinRequest(joinRequestId, '本次行程不便接单')
      await refreshDriverOrderCenter()
      if (joinRequestDetail?.joinRequestId === joinRequestId) {
        await loadJoinRequestDetail(joinRequestId)
      }
      pushToast('已拒绝该申请', 'success')
    } catch (error) {
      handleError(error, '拒绝乘客申请失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCancelJoinRequest = async (joinRequestId: number) => {
    setBusyAction(`cancel-join-${joinRequestId}`)
    try {
      await api.cancelJoinRequest(joinRequestId, '乘客主动取消')
      await refreshPassengerOrderCenter()
      await loadJoinRequestDetail(joinRequestId)
      pushToast('申请已取消', 'success')
    } catch (error) {
      handleError(error, '取消申请失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCreatePaymentOrder = async (orderId: number) => {
    setBusyAction('create-payment')
    try {
      const result = await api.createPaymentOrder(orderId)
      setPaymentOrder(result)
      const status = await api.getPaymentStatus(orderId)
      setPaymentStatus(status)
      pushToast('支付单已创建，可继续模拟支付回调', 'success')
    } catch (error) {
      handleError(error, '创建支付单失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleMockPayment = async () => {
    if (!paymentOrder || !orderDetail) {
      pushToast('请先创建支付单', 'info')
      return
    }
    setBusyAction('mock-payment')
    try {
      await api.mockPaymentCallback(paymentOrder.outTradeNo, 'PAID')
      const [detail, status] = await Promise.all([
        api.getOrder(orderDetail.orderId),
        api.getPaymentStatus(orderDetail.orderId),
      ])
      setOrderDetail(detail)
      setPaymentStatus(status)
      await refreshPassengerOrderCenter()
      await refreshDriverOrderCenter()
      pushToast('已通过本地代理触发真实支付回调', 'success')
    } catch (error) {
      handleError(error, '模拟支付回调失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleConfirmBoard = async (orderId: number) => {
    setBusyAction('confirm-board')
    try {
      await api.confirmBoard(orderId)
      await loadOrderDetail(orderId)
      await refreshPassengerOrderCenter()
      await refreshDriverOrderCenter()
      pushToast('已确认上车', 'success')
    } catch (error) {
      handleError(error, '确认上车失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleConfirmArrival = async (orderId: number) => {
    setBusyAction('confirm-arrival')
    try {
      await api.confirmArrival(orderId)
      await Promise.all([loadOrderDetail(orderId), refreshPassengerOrderCenter(), refreshDriverOrderCenter(), loadWalletBundle()])
      pushToast('已确认到达，司机钱包已进入结算链路', 'success')
    } catch (error) {
      handleError(error, '确认到达失败')
    } finally {
      setBusyAction('')
    }
  }

  const handleCancelOrder = async (orderId: number) => {
    setBusyAction('cancel-order')
    try {
      await api.cancelOrder(orderId, '乘客主动取消')
      await Promise.all([loadOrderDetail(orderId), refreshPassengerOrderCenter(), refreshDriverOrderCenter(), loadWalletBundle()])
      pushToast('订单已取消，如已支付会自动进入退款态', 'success')
    } catch (error) {
      handleError(error, '取消订单失败')
    } finally {
      setBusyAction('')
    }
  }

  const renderLogin = () => {
    return (
      <div className="content">
        <PhoneHeader
          eyebrow="真实后端联调"
          title="顺风车客户端"
          subtitle="前端代码已经独立放在 frontend/client-app。现在这个界面不再是设计稿工作台，而是直接连真实 Go 后端的可运行客户端。"
          highlightValue="API"
          highlightLabel={`已接 ${apiOriginLabel}`}
        />

        <section className="hero-card">
          <div className="mini-note">本地联调优先走乘客与车主双闭环</div>
          <h1>先登录一个乘客或车主账号，立刻开始真实接口测试</h1>
          <p>
            后端 `wx-login` 会按 code 自动创建或复用用户，所以这里支持任意字符串登录。为了便于联调，右侧也保留了快捷账号和流程提示。
          </p>
          <div className="hero-metrics">
            <div className="metric-pill">
              <strong>19</strong>
              <span>已对齐设计页</span>
            </div>
            <div className="metric-pill">
              <strong>13+</strong>
              <span>真实业务接口</span>
            </div>
            <div className="metric-pill">
              <strong>本地</strong>
              <span>支付回调代理</span>
            </div>
          </div>
        </section>

        <section className="search-card hero-card">
          <div className="field">
            <span>登录 code</span>
            <input
              className="field-input"
              value={loginCode}
              onChange={(event) => setLoginCode(event.target.value)}
              placeholder="例如 passenger-alpha / driver-alpha"
            />
          </div>
          <div className="action-row">
            <button
              type="button"
              className="btn"
              onClick={() => void handleLogin(loginCode)}
              disabled={busyAction === 'login'}
            >
              {busyAction === 'login' ? '登录中...' : '真实接口登录'}
            </button>
          </div>
        </section>

        <SectionHeading title="快捷账号" description="这些账号名只是建议，你也可以直接输入任意 code。" />
        <section className="support-grid">
          {quickLoginCodes.map((item) => (
            <button
              key={item.code}
              type="button"
              className="support-card shortcut-card"
              onClick={() => void handleLogin(item.code)}
            >
              <strong>{item.label}</strong>
              <span>{item.code}</span>
            </button>
          ))}
        </section>
      </div>
    )
  }

  const renderHome = () => {
    const roleSummary =
      currentRole === 'DRIVER'
        ? '切到车主视角后，首页会更强调发布行程、车辆状态和待处理乘客申请。'
        : '首页优先承接乘客搜索，从顺路度、费用和安全三个维度给出匹配结果。'

    return (
      <div className="content">
        <PhoneHeader
          eyebrow={`${roleLabel(currentRole)} · 已接真实接口`}
          title="今天想顺着哪一阵风出发？"
          subtitle={roleSummary}
          highlightValue={currentRole === 'DRIVER' ? formatNumber(driverTrips.length) : formatNumber(matches.length)}
          highlightLabel={currentRole === 'DRIVER' ? '我的行程' : '最近匹配'}
        />

        <section className="hero-card">
          <div className="mini-note">{currentPreset.timePeriod}</div>
          <h2>{currentPreset.routeName}</h2>
          <p>{currentPreset.suggestion}</p>
          <div className="chips">
            <span className="chip">路线预设驱动真实经纬度</span>
            <span className="chip">顺路度门槛 {searchDraft.minRouteScore}%</span>
            <span className="chip">安全中心已接分享、SOS、轨迹摘要</span>
          </div>
        </section>

        <section className="search-card hero-card">
          <div className="field">
            <span>路线预设</span>
            <select
              className="field-select"
              value={searchDraft.presetId}
              onChange={(event) => applySearchPreset(event.target.value)}
            >
              {routePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.routeName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>起点</span>
            <strong>{searchDraft.startName}</strong>
          </div>
          <div className="field">
            <span>终点</span>
            <strong>{searchDraft.endName}</strong>
          </div>
          <div className="row">
            <div className="field grow-field">
              <span>出发时间</span>
              <input
                className="field-input"
                type="datetime-local"
                value={searchDraft.departAtLocal}
                onChange={(event) =>
                  setSearchDraft((current) => ({
                    ...current,
                    departAtLocal: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field compact-field">
              <span>顺路门槛</span>
              <select
                className="field-select"
                value={searchDraft.minRouteScore}
                onChange={(event) =>
                  setSearchDraft((current) => ({
                    ...current,
                    minRouteScore: Number(event.target.value),
                  }))
                }
              >
                {[70, 75, 80, 85, 90].map((score) => (
                  <option key={score} value={score}>
                    {score}%
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="action-row">
            <button type="button" className="btn" onClick={() => void handleSearchMatches()}>
              {busyAction === 'search' ? '搜索中...' : '查看真实匹配'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => navigate('orders')}>
              去订单中心
            </button>
          </div>
        </section>

        <SectionHeading title="快捷能力" description="把高频路径折成更短的动作入口。" />
        <section className="support-grid">
          <button type="button" className="support-card shortcut-card" onClick={() => navigate('publish')}>
            <strong>发布行程</strong>
            <span>先看价格预览，再真正发单</span>
          </button>
          <button type="button" className="support-card shortcut-card" onClick={() => navigate('safety')}>
            <strong>安全中心</strong>
            <span>配置、分享、SOS、轨迹都可联调</span>
          </button>
          <button type="button" className="support-card shortcut-card" onClick={() => navigate('vehicles')}>
            <strong>车辆管理</strong>
            <span>新增车辆并设置默认发布车辆</span>
          </button>
          <button type="button" className="support-card shortcut-card" onClick={() => navigate('wallet')}>
            <strong>司机钱包</strong>
            <span>履约完成后能看到真实入账</span>
          </button>
        </section>

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderMatches = () => {
    return (
      <div className="content">
        <PhoneHeader
          eyebrow="乘客匹配列表"
          title="真实匹配结果"
          subtitle="排序来自后端搜索接口，费用来自真实估价逻辑。这里展示的是可以直接申请同行的候选行程。"
          highlightValue={formatNumber(matches.length)}
          highlightLabel="匹配数"
        />

        {matches.length === 0 ? (
          <EmptyState
            title="还没有可展示的匹配结果"
            body="先回到首页发起一次搜索。当前页面只承接真实接口搜索结果，不再展示静态设计稿。"
            action={
              <button type="button" className="btn" onClick={() => navigate('home')}>
                回首页搜索
              </button>
            }
          />
        ) : (
          <>
            <SectionHeading
              title="候选车主"
              description={`当前按顺路度和时间偏差排序，最低门槛 ${searchDraft.minRouteScore}%`}
            />
            {matches.map((item) => (
              <section className="route-card" key={item.tripId}>
                <div className="driver-head">
                  <div className="driver-info">
                    <div className="avatar">{item.driverInfo.nickname.slice(0, 1)}</div>
                    <div>
                      <div className="driver-name">{item.driverInfo.nickname}</div>
                      <div className="meta">真实司机 ID：{item.driverInfo.userId}</div>
                    </div>
                  </div>
                  <StatusBadge label={`顺路 ${formatPercent(item.routeScore)}`} tone="safe" />
                </div>
                <div className="route-meta">
                  <span>{formatDateTime(item.departAt)}</span>
                  <span>剩余 {item.seatAvailable} 座</span>
                  <span>排序分 {item.sortScore}</span>
                </div>
                <div className="price-row app-price-row">
                  <span className="small-label">预估乘客费用</span>
                  <strong>{formatMoney(item.estimatedFeeFen)}</strong>
                </div>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={() =>
                      navigate('trip-detail', {
                        tripId: String(item.tripId),
                      })
                    }
                  >
                    查看详情
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      void loadTripDetail(item.tripId)
                      navigate('trip-detail', { tripId: String(item.tripId) })
                    }}
                  >
                    立即申请
                  </button>
                </div>
              </section>
            ))}
          </>
        )}

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderTripDetail = () => {
    const tripStatusMeta = resolveTripMeta(tripDetail?.tripStatus)

    return (
      <div className="content">
        <PhoneHeader
          eyebrow="行程详情"
          title={tripDetail ? `${tripDetail.routeInfo.startName} → ${tripDetail.routeInfo.endName}` : '加载中'}
          subtitle="这里承接真实 trip 详情接口，费用、顺路度、剩余座位都会跟后端一致。"
          highlightValue={tripDetail ? formatPercent(tripDetail.routeScore) : '--'}
          highlightLabel="顺路度"
        />

        {!tripDetail ? (
          <EmptyState title="行程详情加载中" body="如果长时间没有响应，请回到匹配列表重新选择一条行程。" />
        ) : (
          <>
            <section className="hero-card">
              <div className="mini-note">真实行程 ID：{tripDetail.tripId}</div>
              <h2>{tripDetail.driverInfo.nickname}</h2>
              <p>当前页面已经接入司机、路线、价格和安全摘要，不再依赖静态 HTML 预览。</p>
              <div className="hero-metrics">
                <div className="metric-pill">
                  <strong>{formatMoney(tripDetail.priceInfo.totalFeeFen)}</strong>
                  <span>总费用</span>
                </div>
                <div className="metric-pill">
                  <strong>{formatDistance(tripDetail.priceInfo.distanceMeter)}</strong>
                  <span>预估距离</span>
                </div>
                <div className="metric-pill">
                  <strong>{tripDetail.seatAvailable}</strong>
                  <span>剩余座位</span>
                </div>
              </div>
            </section>

            <section className="panel" style={{ padding: 16, marginTop: 12 }}>
              <div className="detail-row">
                <span>行程状态</span>
                <StatusBadge label={tripStatusMeta.label} tone={tripStatusMeta.tone} />
              </div>
              <div className="detail-row">
                <span>起点</span>
                <strong>{tripDetail.routeInfo.startName}</strong>
              </div>
              <div className="detail-row">
                <span>终点</span>
                <strong>{tripDetail.routeInfo.endName}</strong>
              </div>
              <div className="detail-row">
                <span>平台服务费</span>
                <strong>{formatMoney(tripDetail.priceInfo.serviceFeeFen)}</strong>
              </div>
            </section>

            <section className="strip" style={{ marginTop: 12, padding: 14 }}>
              <div className="row">
                <div>
                  <strong style={{ fontSize: 15 }}>安全提醒</strong>
                  <div className="meta">
                    紧急联系人、安全配置、SOS、行程分享和轨迹摘要都已接入真实安全接口。
                  </div>
                </div>
                <StatusBadge label={yesNoLabel(tripDetail.safetyInfo.shareEnabled)} tone="info" />
              </div>
            </section>

            <div className="action-row">
              <button type="button" className="btn-ghost" onClick={() => navigate('matches')}>
                返回列表
              </button>
              <button type="button" className="btn" onClick={() => void handleCreateJoinRequest()}>
                {busyAction === 'join-request' ? '提交中...' : '发起真实申请'}
              </button>
            </div>
          </>
        )}

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderOrders = () => {
    const showDriverMode = currentRole === 'DRIVER'
    const driverPendingRequests = driverRequests.filter((item) => item.requestStatus === 'PENDING_DRIVER_CONFIRM')
    const passengerPendingPayments = passengerOrders.filter(
      (item) => item.orderStatus === 'PENDING_PASSENGER_PAY',
    )

    const passengerPanels: Record<PassengerOrderTab, ReactNode> = {
      requests:
        passengerRequests.length === 0 ? (
          <EmptyState title="暂无同行申请" body="从首页搜索一条真实行程，提交申请后会在这里看到记录。" />
        ) : (
          <>
            {passengerRequests.map((item) => {
              const meta = resolveJoinMeta(item.requestStatus)
              return (
                <section className="order-card" key={item.joinRequestId}>
                  <div className="driver-head">
                    <div className="driver-info">
                      <div className="avatar">{item.driverInfo.nickname.slice(0, 1)}</div>
                      <div>
                        <div className="driver-name">{item.driverInfo.nickname}</div>
                        <div className="meta">{item.routeSummary}</div>
                      </div>
                    </div>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </div>
                  <div className="order-subline">
                    <span>申请时间 {formatDateTime(item.createdAt)}</span>
                    <span>申请 ID {item.joinRequestId}</span>
                  </div>
                  <div className="order-progress">
                    <span style={{ ['--progress' as string]: `${joinProgress(item.requestStatus)}%` }}></span>
                    <em>{meta.label}</em>
                  </div>
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() =>
                        navigate('order-detail', {
                          kind: 'join',
                          id: String(item.joinRequestId),
                        })
                      }
                    >
                      查看详情
                    </button>
                    {item.requestStatus === 'PENDING_DRIVER_CONFIRM' ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void handleCancelJoinRequest(item.joinRequestId)}
                      >
                        取消申请
                      </button>
                    ) : null}
                  </div>
                </section>
              )
            })}
          </>
        ),
      orders:
        passengerOrders.length === 0 ? (
          <EmptyState title="暂无正式订单" body="当司机接受你的申请后，这里会生成真实 ride_order 记录。" />
        ) : (
          <>
            {passengerOrders.map((item) => {
              const meta = resolveOrderMeta(item.orderStatus)
              return (
                <section className="order-card featured" key={item.orderId}>
                  <div className="driver-head">
                    <div className="driver-info">
                      <div className="avatar">{(item.driverInfo?.nickname ?? '车').slice(0, 1)}</div>
                      <div>
                        <div className="driver-name">{item.driverInfo?.nickname ?? '车主'}</div>
                        <div className="meta">{item.routeSummary}</div>
                      </div>
                    </div>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </div>
                  <div className="order-subline">
                    <span>{formatDateTime(item.departAt)}</span>
                    <span>订单号 {item.orderNo}</span>
                  </div>
                  <div className="order-progress">
                    <span style={{ ['--progress' as string]: `${orderProgress(item.orderStatus)}%` }}></span>
                    <em>{meta.label}</em>
                  </div>
                  <div className="order-meta-grid">
                    <div className="summary-card">
                      <strong>{formatMoney(item.payableAmountFen)}</strong>
                      <span>应付金额</span>
                    </div>
                    <div className="summary-card">
                      <strong>{item.joinRequestId}</strong>
                      <span>申请记录</span>
                    </div>
                    <div className="summary-card">
                      <strong>{item.orderId}</strong>
                      <span>订单 ID</span>
                    </div>
                  </div>
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() =>
                        navigate('order-detail', {
                          kind: 'order',
                          id: String(item.orderId),
                        })
                      }
                    >
                      查看详情
                    </button>
                    {item.orderStatus === 'PENDING_PASSENGER_PAY' ? (
                      <button
                        type="button"
                        className="btn"
                        onClick={() =>
                          navigate('payment', {
                            id: String(item.orderId),
                          })
                        }
                      >
                        去支付
                      </button>
                    ) : null}
                  </div>
                </section>
              )
            })}
          </>
        ),
    }

    const driverPanels: Record<DriverOrderTab, ReactNode> = {
      trips:
        driverTrips.length === 0 ? (
          <EmptyState
            title="还没有发布过行程"
            body="完成驾驶证和车辆准备后，就可以在发布页创建真实 trip 记录。"
            action={
              <button type="button" className="btn" onClick={() => navigate('publish')}>
                去发布行程
              </button>
            }
          />
        ) : (
          <>
            {driverTrips.map((item) => {
              const meta = resolveTripMeta(item.tripStatus)
              return (
                <section className="driver-trip-card" key={item.tripId}>
                  <div className="driver-head">
                    <div>
                      <div className="driver-name">{item.routeSummary}</div>
                      <div className="meta">{formatDateTime(item.departAt)}</div>
                    </div>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </div>
                  <div className="route-meta">
                    <span>总座位 {item.seatTotal}</span>
                    <span>剩余 {item.seatAvailable}</span>
                    <span>申请 {item.applyCount}</span>
                  </div>
                  <div
                    className="trip-seat-bar"
                    style={{
                      ['--fill' as string]: `${Math.max(8, (item.seatAvailable / Math.max(item.seatTotal, 1)) * 100)}%`,
                    }}
                  ></div>
                  <div className="action-row">
                    <button type="button" className="btn-soft" onClick={() => setDriverOrderTab('requests')}>
                      查看申请
                    </button>
                    {item.tripStatus !== 'CANCELLED' ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={async () => {
                          setBusyAction(`trip-cancel-${item.tripId}`)
                          try {
                            await api.cancelTrip(item.tripId, '车主取消本次行程')
                            await refreshDriverOrderCenter()
                            pushToast('行程已取消', 'success')
                          } catch (error) {
                            handleError(error, '取消行程失败')
                          } finally {
                            setBusyAction('')
                          }
                        }}
                      >
                        取消行程
                      </button>
                    ) : null}
                  </div>
                </section>
              )
            })}
          </>
        ),
      requests:
        driverRequests.length === 0 ? (
          <EmptyState title="暂无乘客申请" body="乘客提交同行申请后，这里会显示真实待处理列表。" />
        ) : (
          <>
            {driverRequests.map((item) => {
              const meta = resolveJoinMeta(item.requestStatus)
              return (
                <section className="request-card" key={item.joinRequestId}>
                  <div className="driver-head">
                    <div className="driver-info">
                      <div className="avatar warm">{item.passengerInfo.nickname.slice(0, 1)}</div>
                      <div>
                        <div className="driver-name">{item.passengerInfo.nickname}</div>
                        <div className="meta">申请到 trip #{item.tripId}</div>
                      </div>
                    </div>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </div>
                  <div className="request-grid">
                    <div className="request-fact">
                      <strong>{item.historyOrderCount}</strong>
                      <span>历史完成订单</span>
                    </div>
                    <div className="request-fact">
                      <strong>{formatDateTime(item.applyAt)}</strong>
                      <span>申请时间</span>
                    </div>
                  </div>
                  <div className="inline-meta">
                    {item.creditTags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() =>
                        navigate('order-detail', {
                          kind: 'join',
                          id: String(item.joinRequestId),
                        })
                      }
                    >
                      查看详情
                    </button>
                    {item.requestStatus === 'PENDING_DRIVER_CONFIRM' ? (
                      <>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => void handleRejectDriverRequest(item.joinRequestId)}
                        >
                          拒绝
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void handleAcceptDriverRequest(item.joinRequestId)}
                        >
                          接受
                        </button>
                      </>
                    ) : null}
                  </div>
                </section>
              )
            })}
          </>
        ),
      orders:
        driverOrders.length === 0 ? (
          <EmptyState title="暂无司机侧订单" body="接受乘客申请后，这里会展示真实订单和履约状态。" />
        ) : (
          <>
            {driverOrders.map((item) => {
              const meta = resolveOrderMeta(item.orderStatus)
              return (
                <section className="order-card" key={item.orderId}>
                  <div className="driver-head">
                    <div className="driver-info">
                      <div className="avatar warm">{(item.passengerInfo?.nickname ?? '乘').slice(0, 1)}</div>
                      <div>
                        <div className="driver-name">{item.passengerInfo?.nickname ?? '乘客'}</div>
                        <div className="meta">{item.routeSummary}</div>
                      </div>
                    </div>
                    <StatusBadge label={meta.label} tone={meta.tone} />
                  </div>
                  <div className="order-subline">
                    <span>{formatDateTime(item.departAt)}</span>
                    <span>{formatMoney(item.payableAmountFen)}</span>
                  </div>
                  <div className="action-row">
                    <button
                      type="button"
                      className="btn"
                      onClick={() =>
                        navigate('order-detail', {
                          kind: 'order',
                          id: String(item.orderId),
                        })
                      }
                    >
                      查看司机侧详情
                    </button>
                  </div>
                </section>
              )
            })}
          </>
        ),
    }

    return (
      <div className="content">
        <PhoneHeader
          eyebrow={`${roleLabel(currentRole)} · 订单中心`}
          title={showDriverMode ? '把接单、履约和结算放在一页看清楚' : '把申请、支付和履约拆成清晰的四个时刻'}
          subtitle={
            showDriverMode
              ? '这里聚合我的行程、乘客申请和司机订单，方便直接完成真实联调闭环。'
              : '当前页面同时展示同行申请和正式订单，列表都来自真实接口。'
          }
          highlightValue={
            showDriverMode
              ? formatNumber(driverPendingRequests.length)
              : formatNumber(passengerPendingPayments.length)
          }
          highlightLabel={showDriverMode ? '待处理申请' : '待支付订单'}
        />

        <section className="hero-card orders-overview">
          <div className="mini-note">一个订单中心，适配两种身份视角</div>
          <h2>{showDriverMode ? '行程、申请、订单，司机侧全部收口' : '申请态与订单态并列展示，不让信息断层'}</h2>
          <p>
            {showDriverMode
              ? '接受乘客申请后会自动生成正式订单；支付成功、确认上车和确认到达后，司机钱包会真实入账。'
              : '待车主确认的记录仍然是 join_request，只有被接受后才会进入 ride_order，这里会诚实地区分两类数据。'}
          </p>
        </section>

        <div className="filter-row">
          <button
            type="button"
            className={`filter-chip ${currentRole === 'PASSENGER' ? 'active' : ''}`}
            onClick={() => setRolePreference('PASSENGER')}
          >
            乘客视角
          </button>
          {profile?.driverVerified ? (
            <button
              type="button"
              className={`filter-chip ${currentRole === 'DRIVER' ? 'active' : ''}`}
              onClick={() => setRolePreference('DRIVER')}
            >
              车主视角
            </button>
          ) : null}
          {showDriverMode ? (
            <>
              <button
                type="button"
                className={`filter-chip ${driverOrderTab === 'trips' ? 'active' : ''}`}
                onClick={() => setDriverOrderTab('trips')}
              >
                我的行程
              </button>
              <button
                type="button"
                className={`filter-chip ${driverOrderTab === 'requests' ? 'active' : ''}`}
                onClick={() => setDriverOrderTab('requests')}
              >
                乘客申请
              </button>
              <button
                type="button"
                className={`filter-chip ${driverOrderTab === 'orders' ? 'active' : ''}`}
                onClick={() => setDriverOrderTab('orders')}
              >
                司机订单
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`filter-chip ${passengerOrderTab === 'requests' ? 'active' : ''}`}
                onClick={() => setPassengerOrderTab('requests')}
              >
                同行申请
              </button>
              <button
                type="button"
                className={`filter-chip ${passengerOrderTab === 'orders' ? 'active' : ''}`}
                onClick={() => setPassengerOrderTab('orders')}
              >
                正式订单
              </button>
            </>
          )}
        </div>

        {pageLoading === 'orders' ? <EmptyState title="正在拉取订单中心" body="正在读取真实后端数据..." /> : null}
        {showDriverMode ? driverPanels[driverOrderTab] : passengerPanels[passengerOrderTab]}

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderOrderDetail = () => {
    const isJoinRecord = route.params.kind === 'join'

    if (isJoinRecord) {
      const detail = joinRequestDetail
      const meta = resolveJoinMeta(detail?.requestStatus)

      return (
        <div className="content">
          <PhoneHeader
            eyebrow="申请详情"
            title={detail ? `申请 #${detail.joinRequestId}` : '加载中'}
            subtitle="当前详情页会根据记录类型切换为 join_request 或 ride_order，不再把两种对象混为一谈。"
            highlightValue={detail ? meta.label : '--'}
            highlightLabel="当前状态"
          />

          {!detail ? (
            <EmptyState title="申请详情加载中" body="稍等片刻，或回到订单中心重新进入。" />
          ) : (
            <>
              <section className="state-card">
                <div className="state-header">
                  <div>
                    <span className="state-kicker">JOIN_REQUEST</span>
                    <div className="state-title">{detail.routeInfo.tripRouteSummary}</div>
                    <div className="state-desc">
                      当前申请状态：{meta.label}。如果你是乘客且还在待确认阶段，可以撤销；如果你切到车主视角且仍待处理，也可以直接接受或拒绝。
                    </div>
                  </div>
                  <StatusBadge label={meta.label} tone={meta.tone} />
                </div>
                <section className="progress-card">
                  <div className="driver-head">
                    <div className="driver-info">
                      <div className="avatar">{detail.driverInfo.nickname.slice(0, 1)}</div>
                      <div>
                        <div className="driver-name">{detail.driverInfo.nickname}</div>
                        <div className="meta">司机 ID：{detail.driverInfo.userId}</div>
                      </div>
                    </div>
                    <span className="badge info">申请记录</span>
                  </div>
                  <div className="status-band">
                    <div className="metric-pill">
                      <strong>{detail.joinRequestId}</strong>
                      <span>申请编号</span>
                    </div>
                    <div className="metric-pill">
                      <strong>{detail.tripId}</strong>
                      <span>对应 trip</span>
                    </div>
                    <div className="metric-pill">
                      <strong>{meta.label}</strong>
                      <span>后端状态</span>
                    </div>
                  </div>
                </section>
                <section className="panel" style={{ padding: 16, marginTop: 14 }}>
                  <div className="detail-row">
                    <span>上车点</span>
                    <strong>{detail.startPoint.name}</strong>
                  </div>
                  <div className="detail-row">
                    <span>下车点</span>
                    <strong>{detail.endPoint.name}</strong>
                  </div>
                  <div className="detail-row">
                    <span>接受时间</span>
                    <strong>{formatFullDateTime(detail.acceptedAt)}</strong>
                  </div>
                  <div className="detail-row">
                    <span>拒绝时间</span>
                    <strong>{formatFullDateTime(detail.rejectedAt)}</strong>
                  </div>
                </section>
              </section>

              <div className="action-row">
                <button type="button" className="btn-soft" onClick={() => navigate('orders')}>
                  返回订单中心
                </button>
                {currentRole === 'PASSENGER' && detail.requestStatus === 'PENDING_DRIVER_CONFIRM' ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleCancelJoinRequest(detail.joinRequestId)}
                  >
                    取消申请
                  </button>
                ) : null}
                {currentRole === 'DRIVER' && detail.requestStatus === 'PENDING_DRIVER_CONFIRM' ? (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => void handleRejectDriverRequest(detail.joinRequestId)}
                    >
                      拒绝
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void handleAcceptDriverRequest(detail.joinRequestId)}
                    >
                      接受
                    </button>
                  </>
                ) : null}
              </div>
            </>
          )}

          <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
        </div>
      )
    }

    const detail = orderDetail
    const orderMeta = resolveOrderMeta(detail?.orderStatus)
    const payMeta = resolvePaymentMeta(paymentStatus?.payStatus)

    return (
      <div className="content">
        <PhoneHeader
          eyebrow={currentRole === 'DRIVER' ? '司机订单详情' : '乘客订单详情'}
          title={detail ? `订单 ${detail.orderNo}` : '加载中'}
          subtitle="这页承接正式 ride_order 的履约和支付链路。下方按钮都是真实请求，不是静态演示。"
          highlightValue={detail ? orderMeta.label : '--'}
          highlightLabel="订单状态"
        />

        {!detail ? (
          <EmptyState title="订单详情加载中" body="请稍等片刻，或回到订单中心重新进入。" />
        ) : (
          <>
            <section className="state-card">
              <div className="state-header">
                <div>
                  <span className="state-kicker">ORDER</span>
                  <div className="state-title">
                    {detail.routeInfo.startName} → {detail.routeInfo.endName}
                  </div>
                  <div className="state-desc">
                    订单会随着支付回调、确认上车和确认到达推进。司机视角能看到乘客信息和结算结果，乘客视角能看到支付和履约动作。
                  </div>
                </div>
                <StatusBadge label={orderMeta.label} tone={orderMeta.tone} />
              </div>

              <section className="progress-card">
                <div className="driver-head">
                  <div className="driver-info">
                    <div className="avatar">{detail.driverInfo.nickname.slice(0, 1)}</div>
                    <div>
                      <div className="driver-name">{detail.driverInfo.nickname}</div>
                      <div className="meta">
                        乘客 {detail.passengerInfo.nickname} · 出发 {formatDateTime(detail.routeInfo.departAt)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge label={payMeta.label} tone={payMeta.tone} />
                </div>
                <div className="status-band">
                  <div className="metric-pill">
                    <strong>{formatMoney(detail.priceInfo.payableAmountFen)}</strong>
                    <span>应付金额</span>
                  </div>
                  <div className="metric-pill">
                    <strong>{formatDistance(detail.priceInfo.distanceMeter)}</strong>
                    <span>行程距离</span>
                  </div>
                  <div className="metric-pill">
                    <strong>{detail.orderId}</strong>
                    <span>订单 ID</span>
                  </div>
                </div>
              </section>

              <section className="panel" style={{ padding: 16, marginTop: 14 }}>
                <div className="detail-row">
                  <span>支付状态</span>
                  <StatusBadge label={payMeta.label} tone={payMeta.tone} />
                </div>
                <div className="detail-row">
                  <span>已确认上车</span>
                  <strong>{formatFullDateTime(detail.boardConfirmedAt)}</strong>
                </div>
                <div className="detail-row">
                  <span>已确认到达</span>
                  <strong>{formatFullDateTime(detail.arrivalConfirmedAt)}</strong>
                </div>
                <div className="detail-row">
                  <span>司机结算</span>
                  <strong>
                    {detail.settlementInfo?.settlementStatus
                      ? detail.settlementInfo.settlementStatus
                      : '未结算'}
                  </strong>
                </div>
              </section>

              <section className="strip" style={{ marginTop: 12, padding: 14 }}>
                <div className="row">
                  <div>
                    <strong style={{ fontSize: 15 }}>安全动作</strong>
                    <div className="meta">
                      分享链接、SOS、轨迹上传和轨迹摘要都走真实安全接口，便于联调完整履约链路。
                    </div>
                  </div>
                  <StatusBadge label="已接入" tone="safe" />
                </div>
                <div className="status-band" style={{ marginTop: 12 }}>
                  <div className="metric-pill">
                    <strong>{formatDistance(safetyTraceSummary?.totalDistanceMeter ?? detail.trackSummary.totalDistanceMeter)}</strong>
                    <span>轨迹距离</span>
                  </div>
                  <div className="metric-pill">
                    <strong>{(safetyTraceSummary?.abnormalFlag ?? detail.trackSummary.abnormalFlag) ? '异常' : '正常'}</strong>
                    <span>轨迹判断</span>
                  </div>
                  <div className="metric-pill">
                    <strong>{detail.safetyActions.length}</strong>
                    <span>可用动作</span>
                  </div>
                </div>
                {safetyShareLink ? (
                  <div className="detail-row" style={{ marginTop: 10 }}>
                    <span>分享链接</span>
                    <strong>{safetyShareLink.shareUrl}</strong>
                  </div>
                ) : null}
                <div className="action-row wrap-row" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn-soft"
                    onClick={() => void handleCreateSafetyShareLink(detail.orderId)}
                  >
                    {busyAction === 'share-link' ? '生成中...' : '生成分享链接'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void handleUploadTraceSample(detail.orderId)}
                  >
                    {busyAction === 'trace-upload' ? '上传中...' : '上传轨迹样本'}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void handleLoadTraceSummary(detail.orderId)}
                  >
                    {busyAction === 'trace-summary' ? '读取中...' : '刷新轨迹摘要'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleCreateSafetySOS(detail.orderId)}
                  >
                    {busyAction === 'sos' ? '上报中...' : '上报 SOS'}
                  </button>
                </div>
              </section>
            </section>

            <div className="action-row wrap-row">
              <button type="button" className="btn-soft" onClick={() => navigate('orders')}>
                返回订单中心
              </button>
              {currentRole === 'PASSENGER' && detail.orderStatus === 'PENDING_PASSENGER_PAY' ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => navigate('payment', { id: String(detail.orderId) })}
                >
                  去支付
                </button>
              ) : null}
              {currentRole === 'PASSENGER' && detail.orderStatus === 'PENDING_DEPART' ? (
                <>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void handleCancelOrder(detail.orderId)}
                  >
                    取消订单
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleConfirmBoard(detail.orderId)}
                  >
                    确认上车
                  </button>
                </>
              ) : null}
              {currentRole === 'PASSENGER' && detail.orderStatus === 'IN_PROGRESS' ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => void handleConfirmArrival(detail.orderId)}
                >
                  确认到达
                </button>
              ) : null}
              {currentRole === 'PASSENGER' && detail.orderStatus === 'PENDING_PASSENGER_PAY' ? (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void handleCancelOrder(detail.orderId)}
                >
                  取消订单
                </button>
              ) : null}
            </div>
          </>
        )}

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderPayment = () => {
    const detail = orderDetail
    const paymentMeta = resolvePaymentMeta(paymentStatus?.payStatus)

    return (
      <div className="content">
        <PhoneHeader
          eyebrow="支付确认"
          title={detail ? `支付订单 ${detail.orderNo}` : '加载中'}
          subtitle="真实支付单创建成功后，这里可以通过本地开发代理模拟微信回调，让订单真正进入待上车状态。"
          highlightValue={paymentMeta.label}
          highlightLabel="支付状态"
        />

        {!detail ? (
          <EmptyState title="支付页加载中" body="请从订单详情进入，或回订单中心选择一笔待支付订单。" />
        ) : (
          <>
            <section className="hero-card">
              <div className="mini-note">真实 orderId：{detail.orderId}</div>
              <h2>{detail.routeInfo.startName} → {detail.routeInfo.endName}</h2>
              <p>如果先创建支付单，再点击“模拟支付成功”，后端会执行真实回调处理并更新订单状态。</p>
              <div className="hero-metrics">
                <div className="metric-pill">
                  <strong>{formatMoney(detail.priceInfo.payableAmountFen)}</strong>
                  <span>应付金额</span>
                </div>
                <div className="metric-pill">
                  <strong>{paymentMeta.label}</strong>
                  <span>支付状态</span>
                </div>
                <div className="metric-pill">
                  <strong>{paymentOrder ? paymentOrder.paymentOrderId : '--'}</strong>
                  <span>支付单 ID</span>
                </div>
              </div>
            </section>

            <section className="panel" style={{ padding: 16, marginTop: 12 }}>
              <div className="detail-row">
                <span>支付状态</span>
                <StatusBadge label={paymentMeta.label} tone={paymentMeta.tone} />
              </div>
              <div className="detail-row">
                <span>已支付时间</span>
                <strong>{formatFullDateTime(paymentStatus?.paidAt)}</strong>
              </div>
              <div className="detail-row">
                <span>回调 tradeNo</span>
                <strong>{paymentOrder?.outTradeNo ?? '尚未创建'}</strong>
              </div>
            </section>

            <section className="notice-card" style={{ marginTop: 12 }}>
              <strong>联调说明</strong>
              <div className="notice-list">
                <div className="notice-item">
                  <div className="notice-dot">1</div>
                  <div>
                    <strong>先创建支付单</strong>
                    <span>真实接口会返回支付单号和过期时间。</span>
                  </div>
                </div>
                <div className="notice-item">
                  <div className="notice-dot">2</div>
                  <div>
                    <strong>再模拟支付成功</strong>
                    <span>本地开发代理会为你生成签名，再调用真实支付回调接口。</span>
                  </div>
                </div>
                <div className="notice-item">
                  <div className="notice-dot">3</div>
                  <div>
                    <strong>刷新订单状态</strong>
                    <span>成功后订单会从待支付进入待上车，后续就能确认上车与到达。</span>
                  </div>
                </div>
              </div>
            </section>

            <div className="action-row wrap-row">
              <button
                type="button"
                className="btn-soft"
                onClick={() => void handleCreatePaymentOrder(detail.orderId)}
              >
                {busyAction === 'create-payment' ? '创建中...' : '创建真实支付单'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void handleMockPayment()}
                disabled={!paymentOrder}
              >
                {busyAction === 'mock-payment' ? '回调中...' : '模拟支付成功'}
              </button>
            </div>

            <div className="action-row">
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  navigate('order-detail', {
                    kind: 'order',
                    id: String(detail.orderId),
                  })
                }
              >
                返回订单详情
              </button>
            </div>
          </>
        )}

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderPublish = () => {
    const driverReady = Boolean(profile?.driverVerified)
    const licenseMeta = resolveAuthMeta(licenseStatus?.authStatus ?? driverProfile?.licenseStatus ?? '')

    return (
      <div className="content">
        <PhoneHeader
          eyebrow="车主发布页"
          title="把路线、座位和规则一次说清楚"
          subtitle="价格预览、顺路度校验和发布动作都走真实接口。如果当前还不是合格车主，页面会先把缺少的条件讲清楚。"
          highlightValue={publishRouteScore ? formatPercent(publishRouteScore.score) : '--'}
          highlightLabel="顺路度"
        />

        {!driverReady ? (
          <section className="hero-card">
            <div className="mini-note">发布前校验</div>
            <h2>当前账号还不能直接发布真实行程</h2>
            <p>后端要求“驾驶证审核通过 + 至少一辆审核通过的车辆”。你可以先去完善认证，然后再回来发布。</p>
            <div className="hero-metrics">
              <div className="metric-pill">
                <strong>{licenseMeta.label}</strong>
                <span>驾驶证状态</span>
              </div>
              <div className="metric-pill">
                <strong>{vehicles.length}</strong>
                <span>车辆数量</span>
              </div>
              <div className="metric-pill">
                <strong>{profile?.vehicleVerifiedCount ?? 0}</strong>
                <span>通过审核车辆</span>
              </div>
            </div>
            <div className="action-row">
              <button type="button" className="btn-soft" onClick={() => navigate('license')}>
                去驾驶证认证
              </button>
              <button type="button" className="btn" onClick={() => navigate('vehicles')}>
                去车辆管理
              </button>
            </div>
          </section>
        ) : null}

        <section className="search-card hero-card">
          <div className="field">
            <span>路线预设</span>
            <select
              className="field-select"
              value={publishDraft.presetId}
              onChange={(event) => applyPublishPreset(event.target.value)}
            >
              {routePresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.routeName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span>起点</span>
            <strong>{publishDraft.startName}</strong>
          </div>
          <div className="field">
            <span>终点</span>
            <strong>{publishDraft.endName}</strong>
          </div>
          <div className="row">
            <div className="field grow-field">
              <span>出发时间</span>
              <input
                className="field-input"
                type="datetime-local"
                value={publishDraft.departAtLocal}
                onChange={(event) =>
                  setPublishDraft((current) => ({
                    ...current,
                    departAtLocal: event.target.value,
                  }))
                }
              />
            </div>
            <div className="field compact-field">
              <span>座位数</span>
              <select
                className="field-select"
                value={publishDraft.seatTotal}
                onChange={(event) =>
                  setPublishDraft((current) => ({
                    ...current,
                    seatTotal: Number(event.target.value),
                  }))
                }
              >
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count} 座
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <span>选择车辆</span>
            <select
              className="field-select"
              value={publishDraft.vehicleId}
              onChange={(event) =>
                setPublishDraft((current) => ({
                  ...current,
                  vehicleId: Number(event.target.value),
                }))
              }
            >
              <option value={0}>请选择车辆</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.brand} {vehicle.model} · {vehicle.plateNoMasked}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="trip-card" style={{ marginTop: 12 }}>
          <strong style={{ fontSize: 16 }}>平台建议</strong>
          <div className="kpi-grid">
            <div className="kpi">
              <strong>{publishPricePreview ? formatMoney(publishPricePreview.total) : '--'}</strong>
              <span>建议车费</span>
            </div>
            <div className="kpi">
              <strong>{publishPricePreview ? formatDistance(publishPricePreview.distance) : '--'}</strong>
              <span>预估距离</span>
            </div>
            <div className="kpi">
              <strong>{publishRouteScore ? formatPercent(publishRouteScore.score) : '--'}</strong>
              <span>顺路度</span>
            </div>
            <div className="kpi">
              <strong>{publishRouteScore?.passed ? '通过' : '待校验'}</strong>
              <span>规则校验</span>
            </div>
          </div>
          <div className="recommend-band">
            <strong>当前判断</strong>
            <span>{publishRouteScore?.message ?? '点击“刷新建议”后，实时读取价格和顺路度接口。'}</span>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 12, padding: 16 }}>
          <div className="detail-row">
            <span>常用路线记录</span>
            <strong>{routeTemplates.length} 条</strong>
          </div>
          <div className="meta" style={{ marginTop: 8 }}>
            当前后端列表只返回名称摘要，不返回经纬度，所以这里把常用路线当作历史记录展示，不直接作为发布表单数据源。
          </div>
          <div className="template-list">
            {routeTemplates.length === 0 ? (
              <div className="meta">暂未保存过常用路线</div>
            ) : (
              routeTemplates.map((item) => (
                <div className="template-row" key={item.id}>
                  <div>
                    <strong>{item.routeName}</strong>
                    <span>
                      {item.startName} → {item.endName}
                    </span>
                  </div>
                  <div className="template-actions">
                    {item.isDefault ? <StatusBadge label="默认" tone="safe" /> : null}
                    <button type="button" className="mini-link" onClick={() => void handleSetDefaultTemplate(item.id)}>
                      设默认
                    </button>
                    <button type="button" className="mini-link danger-link" onClick={() => void handleDeleteRouteTemplate(item.id)}>
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <div className="action-row wrap-row">
          <button type="button" className="btn-soft" onClick={() => void handleRefreshPublishPreview()}>
            {busyAction === 'publish-preview' ? '刷新中...' : '刷新建议'}
          </button>
          <button type="button" className="btn-ghost" onClick={() => void handleSaveRouteTemplate()}>
            保存常用路线
          </button>
          <button type="button" className="btn" onClick={() => void handleCreateTrip()}>
            {busyAction === 'create-trip' ? '发布中...' : '确认发布'}
          </button>
        </div>

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderSafety = () => {
    return (
      <div className="content">
        <PhoneHeader
          eyebrow="安全中心"
          title="把分享、SOS 和轨迹真正串起来"
          subtitle="紧急联系人、安全配置、行程分享、SOS 上报和轨迹摘要都已经接入真实后端接口。"
          highlightValue={safetyConfig?.shareEnabled ? '开启' : '关闭'}
          highlightLabel="默认分享"
        />

        <section className="hero-card">
          <div className="mini-note">真实接口能力</div>
          <h2>安全中心现在可以完成一次可验证闭环</h2>
          <p>先维护默认联系人和记录开关，再选择一笔订单生成分享链接、上报 SOS、上传轨迹点并读取轨迹摘要。</p>
        </section>

        <SectionHeading title="默认安全配置" description="已接入 GET / PUT /api/v1/safety/config" />
        <section className="panel" style={{ padding: 16, marginTop: 12 }}>
          <div className="form-stack">
            <label className="switch-line">
              <input
                type="checkbox"
                checked={safetyConfigDraft.shareEnabled}
                onChange={(event) =>
                  setSafetyConfigDraft((current) => ({
                    ...current,
                    shareEnabled: event.target.checked,
                  }))
                }
              />
              默认开启行程分享
            </label>
            <label className="switch-line">
              <input
                type="checkbox"
                checked={safetyConfigDraft.recordEnabled}
                onChange={(event) =>
                  setSafetyConfigDraft((current) => ({
                    ...current,
                    recordEnabled: event.target.checked,
                  }))
                }
              />
              允许紧急联系人查看轨迹摘要
            </label>
            <div className="meta">{safetyConfig?.recordNotice ?? '保存后会从真实配置接口读取最新安全说明。'}</div>
            <button type="button" className="btn" onClick={() => void handleUpdateSafetyConfig()}>
              {busyAction === 'safety-config' ? '保存中...' : '保存安全配置'}
            </button>
          </div>
        </section>

        <SectionHeading title="紧急联系人" description="已接入 GET / POST / DELETE，并可纳入默认分享名单" />
        {contacts.length === 0 ? (
          <EmptyState title="还没有紧急联系人" body="先新增一个默认联系人，后续订单页才能更自然地串上安全链路。" />
        ) : (
          contacts.map((item) => (
            <section className="menu-card" key={item.id}>
              <div className="menu-row">
                <div>
                  <strong>{item.name}</strong>
                  <div className="meta">
                    {item.mobileMasked} · {item.relation}
                  </div>
                </div>
                {item.isDefault ? <StatusBadge label="默认" tone="safe" /> : null}
              </div>
              <div className="action-row">
                <label className="switch-line">
                  <input
                    type="checkbox"
                    checked={safetyConfigDraft.defaultShareContactIds.includes(item.id)}
                    onChange={() => toggleSafetyContact(item.id)}
                  />
                  默认通知
                </label>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void handleDeleteContact(item.id)}
                >
                  {busyAction === `delete-contact-${item.id}` ? '删除中...' : '删除'}
                </button>
              </div>
            </section>
          ))
        )}

        <section className="panel" style={{ marginTop: 12, padding: 16 }}>
          <strong style={{ fontSize: 16 }}>新增联系人</strong>
          <div className="form-stack">
            <input
              className="field-input"
              value={contactDraft.name}
              onChange={(event) =>
                setContactDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="姓名"
            />
            <input
              className="field-input"
              value={contactDraft.mobile}
              onChange={(event) =>
                setContactDraft((current) => ({
                  ...current,
                  mobile: event.target.value,
                }))
              }
              placeholder="手机号"
            />
            <input
              className="field-input"
              value={contactDraft.relation}
              onChange={(event) =>
                setContactDraft((current) => ({
                  ...current,
                  relation: event.target.value,
                }))
              }
              placeholder="关系"
            />
            <label className="switch-line">
              <input
                type="checkbox"
                checked={contactDraft.isDefault}
                onChange={(event) =>
                  setContactDraft((current) => ({
                    ...current,
                    isDefault: event.target.checked,
                  }))
                }
              />
              设为默认联系人
            </label>
            <button type="button" className="btn" onClick={() => void handleCreateContact()}>
              {busyAction === 'contact' ? '保存中...' : '保存联系人'}
            </button>
          </div>
        </section>

        <SectionHeading title="订单安全动作" description="已接入分享链接、SOS、轨迹上传和轨迹摘要" />
        <section className="panel" style={{ marginTop: 12, padding: 16 }}>
          {safetyOrderOptions.length === 0 ? (
            <div className="form-stack">
              <strong>还没有可操作订单</strong>
              <div className="meta">先走一次申请、接单和支付流程；有订单后这里会直接生成分享链接、SOS 和轨迹摘要。</div>
              <button type="button" className="btn" onClick={() => navigate('orders')}>
                去订单中心
              </button>
            </div>
          ) : (
            <div className="form-stack">
              <label className="field">
                <span>选择订单</span>
                <select
                  className="field-select"
                  value={activeSafetyOrderId}
                  onChange={(event) => {
                    setSelectedSafetyOrderId(Number(event.target.value))
                    setSafetyShareLink(null)
                    setSafetyTraceSummary(null)
                  }}
                >
                  {safetyOrderOptions.map((item) => (
                    <option key={item.orderId} value={item.orderId}>
                      {item.orderNo} · {item.routeSummary}
                    </option>
                  ))}
                </select>
              </label>

              <div className="status-band">
                <div className="metric-pill">
                  <strong>{safetyShareLink ? '已生成' : '待生成'}</strong>
                  <span>分享链接</span>
                </div>
                <div className="metric-pill">
                  <strong>{safetyTraceSummary ? formatDistance(safetyTraceSummary.totalDistanceMeter) : '--'}</strong>
                  <span>轨迹距离</span>
                </div>
                <div className="metric-pill">
                  <strong>{safetyTraceSummary ? (safetyTraceSummary.abnormalFlag ? '异常' : '正常') : '待读取'}</strong>
                  <span>轨迹判断</span>
                </div>
              </div>

              {safetyShareLink ? (
                <div className="detail-row">
                  <span>分享链接</span>
                  <strong>{safetyShareLink.shareUrl}</strong>
                </div>
              ) : null}

              <div className="row">
                <input
                  className="field-input"
                  type="number"
                  value={sosDraft.currentLat}
                  onChange={(event) =>
                    setSosDraft((current) => ({
                      ...current,
                      currentLat: Number(event.target.value),
                    }))
                  }
                  placeholder="当前位置纬度"
                />
                <input
                  className="field-input"
                  type="number"
                  value={sosDraft.currentLng}
                  onChange={(event) =>
                    setSosDraft((current) => ({
                      ...current,
                      currentLng: Number(event.target.value),
                    }))
                  }
                  placeholder="当前位置经度"
                />
              </div>
              <input
                className="field-input"
                value={sosDraft.remark}
                onChange={(event) =>
                  setSosDraft((current) => ({
                    ...current,
                    remark: event.target.value,
                  }))
                }
                placeholder="SOS 备注"
              />

              <div className="action-row wrap-row">
                <button type="button" className="btn-soft" onClick={() => void handleCreateSafetyShareLink()}>
                  {busyAction === 'share-link' ? '生成中...' : '生成分享链接'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => void handleUploadTraceSample()}>
                  {busyAction === 'trace-upload' ? '上传中...' : '上传轨迹样本'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => void handleLoadTraceSummary()}>
                  {busyAction === 'trace-summary' ? '读取中...' : '刷新轨迹摘要'}
                </button>
                <button type="button" className="btn" onClick={() => void handleCreateSafetySOS()}>
                  {busyAction === 'sos' ? '上报中...' : '上报 SOS'}
                </button>
              </div>
            </div>
          )}
        </section>

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderProfile = () => {
    const realnameMeta = resolveAuthMeta(realnameStatus?.authStatus ?? profile?.realnameStatus ?? '')
    const driverMeta = profile?.driverVerified ? resolveAuthMeta('APPROVED') : resolveAuthMeta('PENDING')

    return (
      <div className="content">
        <PhoneHeader
          eyebrow="我的"
          title={profile?.nickname ?? '未登录'}
          subtitle="资料、实名认证、司机能力和联调入口都收拢在这里。"
          highlightValue={roleLabel(currentRole)}
          highlightLabel="当前视角"
        />

        <section className="hero-card">
          <div className="mini-note">真实 userId：{profile?.userId ?? '--'}</div>
          <h2>{profile?.nickname ?? '未命名用户'}</h2>
          <p>当前登录 code：{loginCode || '未记录'}。如果完成司机认证，这里会自动开放车主视角切换。</p>
          <div className="hero-metrics">
            <div className="metric-pill">
              <strong>{realnameMeta.label}</strong>
              <span>实名认证</span>
            </div>
            <div className="metric-pill">
              <strong>{driverMeta.label}</strong>
              <span>司机能力</span>
            </div>
            <div className="metric-pill">
              <strong>{profile?.vehicleVerifiedCount ?? 0}</strong>
              <span>通过车辆</span>
            </div>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 12, padding: 16 }}>
          <strong style={{ fontSize: 16 }}>编辑资料</strong>
          <div className="form-stack">
            <input
              className="field-input"
              value={profileDraft.nickname}
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  nickname: event.target.value,
                }))
              }
              placeholder="昵称"
            />
            <input
              className="field-input"
              value={profileDraft.avatarUrl}
              onChange={(event) =>
                setProfileDraft((current) => ({
                  ...current,
                  avatarUrl: event.target.value,
                }))
              }
              placeholder="头像 URL，可为空"
            />
            <button type="button" className="btn" onClick={() => void handleUpdateProfile()}>
              {busyAction === 'profile' ? '保存中...' : '更新资料'}
            </button>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 12, padding: 16 }}>
          <div className="detail-row">
            <span>实名认证状态</span>
            <StatusBadge label={realnameMeta.label} tone={realnameMeta.tone} />
          </div>
          <div className="detail-row">
            <span>提交时间</span>
            <strong>{formatFullDateTime(realnameStatus?.submittedAt)}</strong>
          </div>
          <div className="detail-row">
            <span>驳回原因</span>
            <strong>{realnameStatus?.rejectReason || '暂无'}</strong>
          </div>
          <div className="form-stack" style={{ marginTop: 12 }}>
            <input
              className="field-input"
              value={realnameDraft.realName}
              onChange={(event) =>
                setRealnameDraft((current) => ({
                  ...current,
                  realName: event.target.value,
                }))
              }
              placeholder="真实姓名"
            />
            <input
              className="field-input"
              value={realnameDraft.idCardNo}
              onChange={(event) =>
                setRealnameDraft((current) => ({
                  ...current,
                  idCardNo: event.target.value,
                }))
              }
              placeholder="身份证号"
            />
            <button type="button" className="btn-soft" onClick={() => void handleSubmitRealname()}>
              {busyAction === 'realname' ? '提交中...' : '提交实名认证'}
            </button>
          </div>
        </section>

        <SectionHeading title="司机能力入口" description="这些页面都已经完成客户端化，不再停留在设计稿预览。" />
        <section className="support-grid">
          <button type="button" className="support-card shortcut-card" onClick={() => navigate('vehicles')}>
            <strong>车辆管理</strong>
            <span>新增车辆、设默认车辆</span>
          </button>
          <button type="button" className="support-card shortcut-card" onClick={() => navigate('license')}>
            <strong>驾驶证认证</strong>
            <span>查看状态并重新提交</span>
          </button>
          <button type="button" className="support-card shortcut-card" onClick={() => navigate('wallet')}>
            <strong>钱包</strong>
            <span>履约后查看真实入账</span>
          </button>
          <button type="button" className="support-card shortcut-card" onClick={() => navigate('help')}>
            <strong>帮助中心</strong>
            <span>联调 FAQ 与当前能力说明</span>
          </button>
        </section>

        <div className="action-row wrap-row">
          <button
            type="button"
            className={`btn-soft ${currentRole === 'PASSENGER' ? 'is-current' : ''}`}
            onClick={() => setRolePreference('PASSENGER')}
          >
            使用乘客视角
          </button>
          <button
            type="button"
            className={`btn ${currentRole === 'DRIVER' ? 'is-current' : ''}`}
            onClick={() => {
              if (!profile?.driverVerified) {
                pushToast('当前还未满足车主认证条件', 'info')
                return
              }
              setRolePreference('DRIVER')
            }}
          >
            使用车主视角
          </button>
          <button type="button" className="btn-ghost" onClick={() => performLogout('已退出登录')}>
            退出登录
          </button>
        </div>

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderVehicles = () => {
    return (
      <div className="content">
        <PhoneHeader
          eyebrow="车辆管理"
          title="把可发布车辆维护在一个干净列表里"
          subtitle="当前页面已经接入新增车辆和设置默认车辆，编辑能力等待后端返回完整车牌信息后再开放。"
          highlightValue={formatNumber(vehicles.length)}
          highlightLabel="车辆数"
        />

        <section className="panel" style={{ padding: 16 }}>
          <strong style={{ fontSize: 16 }}>新增车辆</strong>
          <div className="form-stack">
            <input
              className="field-input"
              value={vehicleDraft.brand}
              onChange={(event) =>
                setVehicleDraft((current) => ({
                  ...current,
                  brand: event.target.value,
                }))
              }
              placeholder="品牌"
            />
            <input
              className="field-input"
              value={vehicleDraft.model}
              onChange={(event) =>
                setVehicleDraft((current) => ({
                  ...current,
                  model: event.target.value,
                }))
              }
              placeholder="车型"
            />
            <input
              className="field-input"
              value={vehicleDraft.color}
              onChange={(event) =>
                setVehicleDraft((current) => ({
                  ...current,
                  color: event.target.value,
                }))
              }
              placeholder="颜色"
            />
            <input
              className="field-input"
              value={vehicleDraft.plateNo}
              onChange={(event) =>
                setVehicleDraft((current) => ({
                  ...current,
                  plateNo: event.target.value,
                }))
              }
              placeholder="车牌号"
            />
            <select
              className="field-select"
              value={vehicleDraft.seatCount}
              onChange={(event) =>
                setVehicleDraft((current) => ({
                  ...current,
                  seatCount: Number(event.target.value),
                }))
              }
            >
              {[2, 3, 4, 5, 6].map((seat) => (
                <option key={seat} value={seat}>
                  {seat} 座
                </option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => void handleCreateVehicle()}>
              {busyAction === 'vehicle' ? '保存中...' : '保存车辆'}
            </button>
          </div>
        </section>

        <SectionHeading title="已登记车辆" description="真实列表接口返回的是脱敏车牌，因此当前列表主打查看和设默认。" />
        {vehicles.length === 0 ? (
          <EmptyState title="暂无车辆" body="先创建一辆车，才能在发布页真正发出 trip。" />
        ) : (
          vehicles.map((vehicle) => {
            const authMeta = resolveAuthMeta(vehicle.authStatus)
            return (
              <section className="vehicle-card" key={vehicle.id}>
                <div className="driver-head">
                  <div>
                    <div className="driver-name">
                      {vehicle.brand} {vehicle.model}
                    </div>
                    <div className="meta">
                      {vehicle.color} · {vehicle.plateNoMasked}
                    </div>
                  </div>
                  <StatusBadge label={authMeta.label} tone={authMeta.tone} />
                </div>
                <div className="vehicle-meta">
                  <div className="detail-block">
                    <strong>{vehicle.seatCount} 座</strong>
                    <span>核定座位</span>
                  </div>
                  <div className="detail-block">
                    <strong>{vehicle.isDefault ? '默认中' : '可切换'}</strong>
                    <span>发布默认车</span>
                  </div>
                </div>
                <div className="action-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => void handleSetDefaultVehicle(vehicle.id)}
                  >
                    {busyAction === `vehicle-default-${vehicle.id}` ? '设置中...' : '设为默认'}
                  </button>
                </div>
              </section>
            )
          })
        )}

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderLicense = () => {
    const meta = resolveAuthMeta(licenseStatus?.authStatus ?? driverProfile?.licenseStatus ?? '')

    return (
      <div className="content">
        <PhoneHeader
          eyebrow="驾驶证认证"
          title="把车主资格先补齐"
          subtitle="后端会用驾驶证状态和车辆审核状态共同判断是否允许发布行程。"
          highlightValue={meta.label}
          highlightLabel="审核状态"
        />

        <section className="upload-panel">
          <div className="upload-badge">真实接口提交</div>
          <div className="form-stack" style={{ marginTop: 14 }}>
            <input
              className="field-input"
              value={licenseDraft.licenseNo}
              onChange={(event) =>
                setLicenseDraft((current) => ({
                  ...current,
                  licenseNo: event.target.value,
                }))
              }
              placeholder="驾驶证号"
            />
            <input
              className="field-input"
              type="date"
              value={licenseDraft.issueDate}
              onChange={(event) =>
                setLicenseDraft((current) => ({
                  ...current,
                  issueDate: event.target.value,
                }))
              }
            />
            <input
              className="field-input"
              type="date"
              value={licenseDraft.expireDate}
              onChange={(event) =>
                setLicenseDraft((current) => ({
                  ...current,
                  expireDate: event.target.value,
                }))
              }
            />
            <input
              className="field-input"
              value={licenseDraft.imageUrl}
              onChange={(event) =>
                setLicenseDraft((current) => ({
                  ...current,
                  imageUrl: event.target.value,
                }))
              }
              placeholder="证件图片 URL"
            />
            <button type="button" className="btn" onClick={() => void handleSubmitLicense()}>
              {busyAction === 'license' ? '提交中...' : '提交驾驶证'}
            </button>
          </div>
        </section>

        <section className="panel" style={{ marginTop: 12, padding: 16 }}>
          <div className="detail-row">
            <span>当前状态</span>
            <StatusBadge label={meta.label} tone={meta.tone} />
          </div>
          <div className="detail-row">
            <span>提交时间</span>
            <strong>{formatFullDateTime(licenseStatus?.submittedAt)}</strong>
          </div>
          <div className="detail-row">
            <span>驳回原因</span>
            <strong>{licenseStatus?.rejectReason || '暂无'}</strong>
          </div>
        </section>

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderWallet = () => {
    return (
      <div className="content">
        <PhoneHeader
          eyebrow="司机钱包"
          title="履约之后，真实入账会落到这里"
          subtitle="钱包余额和流水都直接读取后端。如果你完成了支付、上车和到达确认，这里就能看到真实收益。"
          highlightValue={formatMoney(walletAccount.availableAmountFen)}
          highlightLabel="可用余额"
        />

        <section className="finance-hero hero-card">
          <div className="mini-note">真实钱包账户</div>
          <div className="finance-balance">
            <strong>{formatMoney(walletAccount.availableAmountFen)}</strong>
            <span>可用余额</span>
          </div>
          <div className="mini-actions">
            <div className="mini-action">
              <strong>{formatMoney(walletAccount.frozenAmountFen)}</strong>
              <span>冻结金额</span>
            </div>
            <div className="mini-action">
              <strong>{formatMoney(walletAccount.totalIncomeFen)}</strong>
              <span>累计收入</span>
            </div>
            <div className="mini-action">
              <strong>{formatMoney(walletAccount.totalWithdrawFen)}</strong>
              <span>累计提现</span>
            </div>
          </div>
        </section>

        <SectionHeading title="钱包流水" description="当前支持读取真实流水列表。" />
        {walletLedger.length === 0 ? (
          <EmptyState title="暂无钱包流水" body="完成一笔真实订单后，再回来刷新这里看看司机入账。" />
        ) : (
          <section className="panel" style={{ padding: 16 }}>
            {walletLedger.map((item) => (
              <div className="ledger-item" key={item.ledgerId}>
                <div className={`ledger-icon ${item.changeAmountFen >= 0 ? '' : 'out'}`}>
                  {item.changeAmountFen >= 0 ? '入' : '出'}
                </div>
                <div className="ledger-copy">
                  <strong>{item.bizType}</strong>
                  <span>{item.bizNo || '暂无业务单号'}</span>
                </div>
                <div className="ledger-amount">
                  <strong>{formatMoney(item.changeAmountFen)}</strong>
                  <span>{formatDateTime(item.createdAt)}</span>
                </div>
              </div>
            ))}
          </section>
        )}

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderCoupons = () => {
    return (
      <div className="content">
        <PhoneHeader
          eyebrow="优惠券"
          title="页面已经补齐，接口仍待后端开放"
          subtitle="这里保留完整的优惠券视觉结构，但当前不会连接虚假的 API。"
          highlightValue="待接"
          highlightLabel="后端接口"
        />

        <section className="coupon-tabs">
          <span className="active">可用</span>
          <span>即将到期</span>
          <span>已失效</span>
        </section>

        {staticCoupons.map((item) => (
          <section className="coupon-card" key={item.id}>
            <div className="coupon-value">
              <strong>{item.amountText}</strong>
              <span>{item.status}</span>
            </div>
            <div className="coupon-copy">
              <strong>{item.title}</strong>
              <span>{item.rule}</span>
            </div>
          </section>
        ))}

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderHelp = () => {
    return (
      <div className="content">
        <PhoneHeader
          eyebrow="帮助中心"
          title="把当前产品能力和联调边界说清楚"
          subtitle="这页除了产品帮助，也承载前后端联调时最容易踩坑的关键说明。"
          highlightValue="FAQ"
          highlightLabel={`${faqItems.length} 条`}
        />

        <section className="faq-card">
          {faqItems.map((item) => (
            <div className="faq-item" key={item.id}>
              <strong>{item.question}</strong>
              <span>{item.answer}</span>
            </div>
          ))}
        </section>

        <BottomTabs activeTab={getPrimaryTab(route.view)} onNavigate={navigate} />
      </div>
    )
  }

  const renderActiveView = () => {
    if (!authToken || !session || !profile) {
      return renderLogin()
    }

    switch (route.view) {
      case 'home':
        return renderHome()
      case 'matches':
        return renderMatches()
      case 'trip-detail':
        return renderTripDetail()
      case 'orders':
        return renderOrders()
      case 'order-detail':
        return renderOrderDetail()
      case 'payment':
        return renderPayment()
      case 'publish':
        return renderPublish()
      case 'safety':
        return renderSafety()
      case 'profile':
        return renderProfile()
      case 'vehicles':
        return renderVehicles()
      case 'license':
        return renderLicense()
      case 'wallet':
        return renderWallet()
      case 'coupons':
        return renderCoupons()
      case 'help':
        return renderHelp()
      default:
        return renderHome()
    }
  }

  return (
    <div className="studio-shell">
      <section className="ambient-panel">
        <div className="ambient-copy">
          <span className="ambient-kicker">SFC Client</span>
          <h1>客户端已从设计工作台升级为真实联调界面</h1>
          <p>
            我们把设计稿的视觉语言保留下来，但页面本身已经改造成可运行的 React 客户端。右侧面板保留联调视角，用来快速登录、跳页和刷新真实数据。
          </p>
        </div>

        <div className="ambient-points">
          <div className="ambient-card">
            <strong>独立目录</strong>
            <span>`frontend/client-app` 已与后端彻底分离。</span>
          </div>
          <div className="ambient-card">
            <strong>真实主链路</strong>
            <span>登录、搜索、发布、接单、支付、履约、钱包都可接真接口。</span>
          </div>
          <div className="ambient-card">
            <strong>安全闭环</strong>
            <span>安全配置、SOS、分享链接和轨迹摘要已接真实接口。</span>
          </div>
        </div>
      </section>

      <main className="device-stage">
        {toast ? <div className={`status-banner ${toast.tone}`}>{toast.message}</div> : null}
        {bootstrapping ? <div className="status-banner info">正在恢复会话并拉取真实基础数据...</div> : null}
        {pageLoading ? <div className="status-banner info">正在读取当前页面的真实接口数据...</div> : null}

        <div className="phone-shell app-phone">
          <div className="mist one"></div>
          <div className="mist two"></div>
          {renderActiveView()}
        </div>
      </main>

      <aside className="inspector-panel">
        <section className="inspector-card">
          <div className="inspector-head">
            <span className="panel-kicker">联调面板</span>
            <h2>当前会话</h2>
          </div>
          {profile ? (
            <div className="inspector-stack">
              <div className="inspector-item">
                <strong>{profile.nickname}</strong>
                <span>userId {profile.userId}</span>
              </div>
              <div className="inspector-item">
                <strong>{loginCode || '未记录'}</strong>
                <span>登录 code</span>
              </div>
              <div className="inspector-item">
                <strong>{roleLabel(currentRole)}</strong>
                <span>当前视角</span>
              </div>
              <div className="inspector-item">
                <strong>{profile.driverVerified ? '已开启' : '未开启'}</strong>
                <span>司机能力</span>
              </div>
            </div>
          ) : (
            <div className="inspector-empty">尚未登录，先用任意 code 走一次真实登录。</div>
          )}
          <div className="quick-code-grid">
            {quickLoginCodes.map((item) => (
              <button key={item.code} type="button" className="quick-code" onClick={() => void handleLogin(item.code)}>
                <strong>{item.label}</strong>
                <span>{item.code}</span>
              </button>
            ))}
          </div>
          <div className="action-row column-row">
            <button type="button" className="btn-soft" onClick={() => void refreshCurrentView()}>
              刷新当前页数据
            </button>
            <button type="button" className="btn-ghost" onClick={() => performLogout('已从联调面板退出登录')}>
              清空当前登录
            </button>
          </div>
        </section>

        <section className="inspector-card">
          <div className="inspector-head">
            <span className="panel-kicker">页面导航</span>
            <h2>快速跳页</h2>
          </div>
          <input
            className="field-input inspector-search"
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="搜索页面名称或状态"
          />
          <div className="nav-list">
            {visibleCatalog.map((item) => (
              <button key={item.view} type="button" className="nav-item" onClick={() => navigate(item.view)}>
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.summary}</span>
                </div>
                <em className={actionToneClass(item.mode === '真实接口' ? 'safe' : 'info')}>
                  {item.mode}
                </em>
              </button>
            ))}
          </div>
        </section>

        <section className="inspector-card">
          <div className="inspector-head">
            <span className="panel-kicker">真实能力边界</span>
            <h2>当前说明</h2>
          </div>
          <div className="inspector-list">
            {backendCapabilityNotes.map((note) => (
              <div key={note} className="inspector-note">
                {note}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

export default App
