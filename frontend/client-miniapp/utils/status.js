function fallbackMeta(label) {
  return {
    label: label || '未知状态',
    tone: 'info',
  }
}

const authMeta = {
  UNSUBMITTED: { label: '未提交', tone: 'info' },
  PENDING: { label: '审核中', tone: 'warn' },
  APPROVED: { label: '已通过', tone: 'safe' },
  REJECTED: { label: '已驳回', tone: 'danger' },
}

const tripMeta = {
  DRAFT: { label: '草稿', tone: 'info' },
  PUBLISHED: { label: '已发布', tone: 'safe' },
  MATCHING: { label: '匹配中', tone: 'warn' },
  CONFIRMED: { label: '已成行', tone: 'safe' },
  IN_PROGRESS: { label: '进行中', tone: 'safe' },
  COMPLETED: { label: '已完成', tone: 'safe' },
  CANCELLED: { label: '已取消', tone: 'danger' },
}

const joinMeta = {
  PENDING_DRIVER_CONFIRM: { label: '待车主确认', tone: 'warn' },
  ACCEPTED: { label: '已接受', tone: 'safe' },
  REJECTED: { label: '已拒绝', tone: 'danger' },
  CANCELLED: { label: '已取消', tone: 'danger' },
  EXPIRED: { label: '已过期', tone: 'info' },
}

const orderMeta = {
  PENDING_PASSENGER_PAY: { label: '待支付', tone: 'warn' },
  PENDING_DEPART: { label: '待上车', tone: 'warn' },
  IN_PROGRESS: { label: '进行中', tone: 'safe' },
  PENDING_ARRIVAL_CONFIRM: { label: '待确认到达', tone: 'warn' },
  COMPLETED: { label: '已完成', tone: 'safe' },
  CANCELLED: { label: '已取消', tone: 'danger' },
  EXCEPTION_HANDLING: { label: '异常处理中', tone: 'danger' },
  REFUNDED: { label: '已退款', tone: 'info' },
}

const paymentMeta = {
  INIT: { label: '未创建', tone: 'info' },
  PAYING: { label: '支付中', tone: 'warn' },
  PAID: { label: '已支付', tone: 'safe' },
  FAIL: { label: '支付失败', tone: 'danger' },
  REFUNDING: { label: '退款中', tone: 'warn' },
  REFUNDED: { label: '已退款', tone: 'info' },
}

function resolveAuthMeta(status) {
  return authMeta[status] || fallbackMeta(status || '未知认证状态')
}

function resolveTripMeta(status) {
  return tripMeta[status] || fallbackMeta(status || '未知行程状态')
}

function resolveJoinMeta(status) {
  return joinMeta[status] || fallbackMeta(status || '未知申请状态')
}

function resolveOrderMeta(status) {
  return orderMeta[status] || fallbackMeta(status || '未知订单状态')
}

function resolvePaymentMeta(status) {
  return paymentMeta[status] || fallbackMeta(status || '未知支付状态')
}

module.exports = {
  resolveAuthMeta,
  resolveTripMeta,
  resolveJoinMeta,
  resolveOrderMeta,
  resolvePaymentMeta,
}
