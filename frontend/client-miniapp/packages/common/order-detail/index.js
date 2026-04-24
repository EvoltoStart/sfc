const orderService = require('../../../services/order')
const paymentService = require('../../../services/payment')
const runtime = require('../../../utils/runtime')
const navigation = require('../../../utils/navigation')
const { formatDateTime, formatDistance, formatMoney, formatPercent, formatRating } = require('../../../utils/formatter')
const { resolveJoinMeta, resolveOrderMeta } = require('../../../utils/status')

function mapJoinDetail(detail, linkedOrderId) {
  const driverInfo = detail.driverInfo || {}
  const statusMeta = resolveJoinMeta(detail.requestStatus)
  return {
    ...detail,
    driverName: driverInfo.nickname || '顺路车主',
    avatarText: runtime.buildAvatarText(driverInfo.nickname),
    ratingText: formatRating(driverInfo.rating),
    statusMeta,
    linkedOrderId: linkedOrderId || 0,
    acceptedText: detail.acceptedAt ? formatDateTime(detail.acceptedAt) : '--',
    cancelledText: detail.cancelledAt ? formatDateTime(detail.cancelledAt) : '--',
    canCancelJoin: detail.requestStatus === 'PENDING_DRIVER_CONFIRM',
  }
}

function mapOrderDetail(detail, paymentStatus) {
  const statusMeta = resolveOrderMeta(detail.orderStatus)
  const driverInfo = detail.driverInfo || {}
  const passengerInfo = detail.passengerInfo || {}
  const priceInfo = detail.priceInfo || {}
  return {
    ...detail,
    statusMeta,
    driverName: driverInfo.nickname || '顺路车主',
    passengerName: passengerInfo.nickname || '乘客',
    driverAvatar: runtime.buildAvatarText(driverInfo.nickname),
    passengerAvatar: runtime.buildAvatarText(passengerInfo.nickname),
    driverRatingText: formatRating(driverInfo.rating),
    passengerRatingText: formatRating(passengerInfo.rating),
    departText: formatDateTime(detail.routeInfo && detail.routeInfo.departAt),
    payableText: formatMoney(priceInfo.payableAmountFen),
    serviceFeeText: formatMoney(priceInfo.serviceFeeFen),
    distanceText: formatDistance(priceInfo.distanceMeter),
    trackDistanceText: detail.trackSummary ? formatDistance(detail.trackSummary.totalDistanceMeter) : '--',
    settlementText: detail.settlementInfo && typeof detail.settlementInfo.amountFen === 'number'
      ? formatMoney(detail.settlementInfo.amountFen)
      : '--',
    paymentStatusText: paymentStatus ? paymentStatus.payStatus : 'INIT',
    paymentAmountText: paymentStatus ? formatMoney(paymentStatus.amountFen) : '--',
    paymentPaidAtText: paymentStatus && paymentStatus.paidAt ? formatDateTime(paymentStatus.paidAt) : '待支付',
    paymentTone: paymentStatus && paymentStatus.payStatus === 'PAID' ? 'safe' : 'warn',
    safetyActionCount: Array.isArray(detail.safetyActions) ? detail.safetyActions.length : 0,
    canPay: detail.orderStatus === 'PENDING_PASSENGER_PAY',
    canConfirmBoard: detail.orderStatus === 'PENDING_DEPART',
    canConfirmArrival: detail.orderStatus === 'IN_PROGRESS' || detail.orderStatus === 'PENDING_ARRIVAL_CONFIRM',
    canCancel: ['COMPLETED', 'REFUNDED', 'CANCELLED'].indexOf(detail.orderStatus) < 0,
  }
}

function buildOrderDetailView(authState, kind, joinView, orderView) {
  return {
    headerTitleText: kind === 'join' ? '先看申请状态，再决定是否继续等待' : '把支付、履约和结算信息放在一页里',
    headerKindText: kind === 'join' ? '申请' : '订单',
    showJoinPanel: !!(authState && authState.token && kind === 'join' && joinView),
    showOrderPanel: !!(authState && authState.token && kind === 'order' && orderView),
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    kind: 'order',
    recordId: 0,
    joinDetail: null,
    joinView: null,
    orderDetail: null,
    orderView: null,
    paymentStatus: null,
    headerTitleText: '把支付、履约和结算信息放在一页里',
    headerKindText: '订单',
    showJoinPanel: false,
    showOrderPanel: false,
    loading: false,
    actioning: false,
  },

  onLoad(options) {
    const kind = options.kind === 'join' ? 'join' : 'order'
    this.setData({
      kind,
      recordId: Number(options.id) || 0,
      ...buildOrderDetailView(this.data.authState, kind, null, null),
    })
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    this.setData({
      authState,
      ...buildOrderDetailView(authState, this.data.kind, this.data.joinView, this.data.orderView),
    })
    if (!authState.token || !this.data.recordId) {
      return
    }
    this.setData({ loading: true })
    try {
      if (this.data.kind === 'join') {
        await this.loadJoinDetail()
      } else {
        await this.loadOrderDetail()
      }
    } finally {
      this.setData({ loading: false, actioning: false })
    }
  },

  async loadJoinDetail() {
    try {
      const detail = await orderService.getJoinRequest(this.data.recordId)
      let linkedOrderId = 0
      if (detail.requestStatus === 'ACCEPTED') {
        try {
          const ordersResult = await orderService.listOrders('passenger')
          const linkedOrder = (ordersResult.list || []).find((item) => item.joinRequestId === detail.joinRequestId)
          linkedOrderId = linkedOrder ? linkedOrder.orderId : 0
        } catch (error) {
          console.error('查询关联订单失败', error)
        }
      }
      this.setData({
        joinDetail: detail,
        joinView: mapJoinDetail(detail, linkedOrderId),
        orderDetail: null,
        orderView: null,
        paymentStatus: null,
        ...buildOrderDetailView(this.data.authState, 'join', mapJoinDetail(detail, linkedOrderId), null),
      })
    } catch (error) {
      runtime.handleError(error, '加载申请详情失败')
    }
  },

  async loadOrderDetail() {
    try {
      const results = await Promise.allSettled([
        orderService.getOrder(this.data.recordId),
        paymentService.getPaymentStatus(this.data.recordId),
      ])
      if (results[0].status !== 'fulfilled') {
        throw results[0].reason
      }
      const detail = results[0].value
      const paymentStatus = results[1].status === 'fulfilled' ? results[1].value : null
      const orderView = mapOrderDetail(detail, paymentStatus)
      this.setData({
        orderDetail: detail,
        orderView,
        paymentStatus,
        joinDetail: null,
        joinView: null,
        ...buildOrderDetailView(this.data.authState, 'order', null, orderView),
      })
    } catch (error) {
      runtime.handleError(error, '加载订单详情失败')
    }
  },

  async handleCancelJoin() {
    if (!this.data.joinDetail) {
      return
    }
    this.setData({ actioning: true })
    try {
      await orderService.cancelJoinRequest(this.data.joinDetail.joinRequestId, '乘客主动取消')
      runtime.showSuccess('申请已取消')
      await this.loadJoinDetail()
    } catch (error) {
      runtime.handleError(error, '取消申请失败')
      this.setData({ actioning: false })
    }
  },

  handleOpenLinkedOrder() {
    if (!this.data.joinView || !this.data.joinView.linkedOrderId) {
      return
    }
    navigation.replaceOrderDetail({
      kind: 'order',
      id: this.data.joinView.linkedOrderId,
    })
  },

  handleOpenPayment() {
    if (!this.data.orderDetail) {
      return
    }
    navigation.openPaymentConfirm({
      orderId: this.data.orderDetail.orderId,
    })
  },

  async handleCancelOrder() {
    if (!this.data.orderDetail) {
      return
    }
    this.setData({ actioning: true })
    try {
      await orderService.cancelOrder(this.data.orderDetail.orderId, '乘客主动取消')
      runtime.showSuccess('订单已取消')
      await this.loadOrderDetail()
    } catch (error) {
      runtime.handleError(error, '取消订单失败')
      this.setData({ actioning: false })
    }
  },

  async handleConfirmBoard() {
    if (!this.data.orderDetail) {
      return
    }
    this.setData({ actioning: true })
    try {
      await orderService.confirmBoard(this.data.orderDetail.orderId)
      runtime.showSuccess('已确认上车')
      await this.loadOrderDetail()
    } catch (error) {
      runtime.handleError(error, '确认上车失败')
      this.setData({ actioning: false })
    }
  },

  async handleConfirmArrival() {
    if (!this.data.orderDetail) {
      return
    }
    this.setData({ actioning: true })
    try {
      await orderService.confirmArrival(this.data.orderDetail.orderId)
      runtime.showSuccess('已确认到达')
      await this.loadOrderDetail()
    } catch (error) {
      runtime.handleError(error, '确认到达失败')
      this.setData({ actioning: false })
    }
  },

  handleBack() {
    navigation.goBackOrHome('order')
  },
})
