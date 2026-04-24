type MetaTone = 'safe' | 'warn' | 'info' | 'danger'

interface StatusMeta {
  label: string
  tone: MetaTone
  hint?: string
}

const authMeta: Record<string, StatusMeta> = {
  UNSUBMITTED: { label: '未提交', tone: 'info' },
  PENDING: { label: '审核中', tone: 'warn' },
  APPROVED: { label: '已通过', tone: 'safe' },
  REJECTED: { label: '已驳回', tone: 'danger' },
}

const tripMeta: Record<string, StatusMeta> = {
  DRAFT: { label: '草稿', tone: 'info' },
  PUBLISHED: { label: '已发布', tone: 'safe' },
  MATCHING: { label: '匹配中', tone: 'warn' },
  CONFIRMED: { label: '已成行', tone: 'safe' },
  IN_PROGRESS: { label: '进行中', tone: 'safe' },
  COMPLETED: { label: '已完成', tone: 'safe' },
  CANCELLED: { label: '已取消', tone: 'danger' },
}

const joinMeta: Record<string, StatusMeta> = {
  PENDING_DRIVER_CONFIRM: { label: '待车主确认', tone: 'warn' },
  ACCEPTED: { label: '已接受', tone: 'safe' },
  REJECTED: { label: '已拒绝', tone: 'danger' },
  CANCELLED: { label: '已取消', tone: 'danger' },
  EXPIRED: { label: '已过期', tone: 'info' },
}

const orderMeta: Record<string, StatusMeta> = {
  PENDING_PASSENGER_PAY: { label: '待支付', tone: 'warn' },
  PENDING_DEPART: { label: '待上车', tone: 'warn' },
  IN_PROGRESS: { label: '进行中', tone: 'safe' },
  PENDING_ARRIVAL_CONFIRM: { label: '待确认到达', tone: 'warn' },
  COMPLETED: { label: '已完成', tone: 'safe' },
  CANCELLED: { label: '已取消', tone: 'danger' },
  EXCEPTION_HANDLING: { label: '异常处理中', tone: 'danger' },
  REFUNDED: { label: '已退款', tone: 'info' },
}

const paymentMeta: Record<string, StatusMeta> = {
  INIT: { label: '未创建', tone: 'info' },
  PAYING: { label: '支付中', tone: 'warn' },
  PAID: { label: '已支付', tone: 'safe' },
  FAIL: { label: '支付失败', tone: 'danger' },
  REFUNDING: { label: '退款中', tone: 'warn' },
  REFUNDED: { label: '已退款', tone: 'info' },
}

function fallbackMeta(status: string): StatusMeta {
  return {
    label: status || '未知状态',
    tone: 'info',
  }
}

export function resolveAuthMeta(status?: string) {
  if (!status) {
    return fallbackMeta('未知认证状态')
  }
  return authMeta[status] ?? fallbackMeta(status)
}

export function resolveTripMeta(status?: string) {
  if (!status) {
    return fallbackMeta('未知行程状态')
  }
  return tripMeta[status] ?? fallbackMeta(status)
}

export function resolveJoinMeta(status?: string) {
  if (!status) {
    return fallbackMeta('未知申请状态')
  }
  return joinMeta[status] ?? fallbackMeta(status)
}

export function resolveOrderMeta(status?: string) {
  if (!status) {
    return fallbackMeta('未知订单状态')
  }
  return orderMeta[status] ?? fallbackMeta(status)
}

export function resolvePaymentMeta(status?: string) {
  if (!status) {
    return fallbackMeta('未知支付状态')
  }
  return paymentMeta[status] ?? fallbackMeta(status)
}

export function formatMoney(fen?: number | null) {
  const value = typeof fen === 'number' ? fen / 100 : 0
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value?: number | null, fallback = '--') {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }
  return new Intl.NumberFormat('zh-CN').format(value)
}

export function formatDateTime(value?: string | null, fallback = '待更新') {
  if (!value) {
    return fallback
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatFullDateTime(value?: string | null, fallback = '待更新') {
  if (!value) {
    return fallback
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return fallback
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatDistance(meter?: number | null) {
  if (typeof meter !== 'number' || meter <= 0) {
    return '待计算'
  }
  if (meter >= 1000) {
    return `${(meter / 1000).toFixed(1)} km`
  }
  return `${meter} m`
}

export function formatPercent(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--'
  }
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`
}

export function roleLabel(role: 'PASSENGER' | 'DRIVER') {
  return role === 'DRIVER' ? '车主视角' : '乘客视角'
}

export function yesNoLabel(value: boolean) {
  return value ? '已开启' : '未开启'
}

export function actionToneClass(tone: MetaTone) {
  return `tone-${tone}`
}
