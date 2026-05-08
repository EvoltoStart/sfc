const orderService = require('../../../services/order')
const paymentService = require('../../../services/payment')
const runtime = require('../../../utils/runtime')
const navigation = require('../../../utils/navigation')
const { formatDateTime, formatMoney, formatDistance } = require('../../../utils/formatter')
const { resolveOrderMeta, resolvePaymentMeta } = require('../../../utils/status')

function mapOrder(detail) {
  const priceInfo = detail.priceInfo || {}
  const statusMeta = resolveOrderMeta(detail.orderStatus)
  return {
    ...detail,
    statusMeta,
    payableText: formatMoney(priceInfo.payableAmountFen),
    serviceFeeText: formatMoney(priceInfo.serviceFeeFen),
    distanceText: formatDistance(priceInfo.distanceMeter),
    departText: formatDateTime(detail.routeInfo && detail.routeInfo.departAt),
  }
}

function mapPaymentStatus(status) {
  if (!status) {
    return null
  }
  const statusMeta = resolvePaymentMeta(status.payStatus)
  return {
    ...status,
    statusMeta,
    amountText: formatMoney(status.amountFen),
    paidAtText: status.paidAt ? formatDateTime(status.paidAt) : '待支付',
  }
}

function mapPaymentOrder(order) {
  if (!order) {
    return null
  }
  return {
    ...order,
    expireText: formatDateTime(order.payExpireAt),
  }
}

function buildPaymentViewState(authState, orderView, paymentView) {
  const hasOrder = !!(authState && authState.token && orderView)
  return {
    showOrderPanel: hasOrder,
    headerPaymentStatusText: paymentView ? paymentView.statusMeta.label : '待创建',
    paymentCardTitle: paymentView ? paymentView.statusMeta.label : '尚未创建支付单',
    paymentCardSubText: paymentView ? paymentView.paidAtText : '点击下方按钮创建支付单',
    paymentBadgeText: paymentView ? paymentView.statusMeta.label : 'INIT',
    paymentBadgeTone: paymentView ? paymentView.statusMeta.tone : 'info',
    paymentAmountDisplayText: paymentView ? paymentView.amountText : (orderView ? orderView.payableText : '--'),
    paymentStatusDisplayText: paymentView ? paymentView.payStatus : 'INIT',
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    orderId: 0,
    orderDetail: null,
    orderView: null,
    paymentStatus: null,
    paymentView: null,
    paymentOrder: null,
    paymentOrderView: null,
    showOrderPanel: false,
    headerPaymentStatusText: '待创建',
    paymentCardTitle: '尚未创建支付单',
    paymentCardSubText: '点击下方按钮创建支付单',
    paymentBadgeText: 'INIT',
    paymentBadgeTone: 'info',
    paymentAmountDisplayText: '--',
    paymentStatusDisplayText: 'INIT',
    loading: false,
    creating: false,
    mocking: false,
  },

  onLoad(options) {
    this.setData({
      orderId: Number(options.orderId) || 0,
    })
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    this.setData({
      authState,
      ...buildPaymentViewState(authState, this.data.orderView, this.data.paymentView),
    })
    if (!authState.token || !this.data.orderId) {
      return
    }
    this.setData({ loading: true })
    try {
      const results = await Promise.allSettled([
        orderService.getOrder(this.data.orderId),
        paymentService.getPaymentStatus(this.data.orderId),
      ])
      if (results[0].status !== 'fulfilled') {
        throw results[0].reason
      }
      const detail = results[0].value
      const paymentStatus = results[1].status === 'fulfilled' ? results[1].value : null
      const orderView = mapOrder(detail)
      const paymentView = mapPaymentStatus(paymentStatus)
      this.setData({
        orderDetail: detail,
        orderView,
        paymentStatus,
        paymentView,
        ...buildPaymentViewState(authState, orderView, paymentView),
      })
    } catch (error) {
      runtime.handleError(error, '加载支付页失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  async handleCreatePaymentOrder() {
    if (!this.data.orderDetail) {
      return
    }
    this.setData({ creating: true })
    try {
      const paymentOrder = await paymentService.createPaymentOrder(this.data.orderDetail.orderId)
      const paymentStatus = await paymentService.getPaymentStatus(this.data.orderDetail.orderId)
      const paymentView = mapPaymentStatus(paymentStatus)
      this.setData({
        paymentOrder,
        paymentOrderView: mapPaymentOrder(paymentOrder),
        paymentStatus,
        paymentView,
        ...buildPaymentViewState(this.data.authState, this.data.orderView, paymentView),
      })
      runtime.showSuccess('支付单已创建')
    } catch (error) {
      runtime.handleError(error, '创建支付单失败')
    } finally {
      this.setData({ creating: false })
    }
  },

  async handleMockPayment() {
    if (!this.data.paymentOrder) {
      runtime.showToast('请先创建支付单')
      return
    }
    this.setData({ mocking: true })
    try {
      await paymentService.mockPaymentCallback(this.data.paymentOrder.outTradeNo, 'PAID')
      runtime.showSuccess('已触发本地支付回调')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '支付确认失败')
    } finally {
      this.setData({ mocking: false })
    }
  },

  handleOpenOrderDetail() {
    navigation.replaceOrderDetail({
      kind: 'order',
      id: this.data.orderId,
    })
  },

  handleBack() {
    navigation.goBackOrHome('order')
  },
})
