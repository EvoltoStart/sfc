const orderService = require('../../services/order')
const tripService = require('../../services/trip')
const runtime = require('../../utils/runtime')
const navigation = require('../../utils/navigation')
const { formatDateTime, formatMoney, formatRating } = require('../../utils/formatter')
const { resolveJoinMeta, resolveOrderMeta, resolveTripMeta } = require('../../utils/status')

function hasDriverRole(session) {
  return !!(session && Array.isArray(session.roles) && session.roles.indexOf('DRIVER') >= 0)
}

function mapPassengerRequest(item) {
  const statusMeta = resolveJoinMeta(item.requestStatus)
  return {
    ...item,
    driverName: item.driverInfo && item.driverInfo.nickname ? item.driverInfo.nickname : '顺路车主',
    createdText: formatDateTime(item.createdAt),
    ratingText: formatRating(item.driverInfo && item.driverInfo.rating),
    statusMeta,
  }
}

function mapPassengerOrder(item, role) {
  const statusMeta = resolveOrderMeta(item.orderStatus)
  const relation = role === 'driver'
    ? item.passengerInfo && item.passengerInfo.nickname
    : item.driverInfo && item.driverInfo.nickname
  return {
    ...item,
    relationName: relation || (role === 'driver' ? '乘客' : '车主'),
    departText: formatDateTime(item.departAt),
    payableText: formatMoney(item.payableAmountFen),
    statusMeta,
  }
}

function mapTripItem(item) {
  const statusMeta = resolveTripMeta(item.tripStatus)
  return {
    ...item,
    departText: formatDateTime(item.departAt),
    statusMeta,
  }
}

function mapDriverRequest(item) {
  const statusMeta = resolveJoinMeta(item.requestStatus)
  return {
    ...item,
    passengerName: item.passengerInfo && item.passengerInfo.nickname ? item.passengerInfo.nickname : '乘客',
    ratingText: formatRating(item.passengerInfo && item.passengerInfo.rating),
    applyText: formatDateTime(item.applyAt),
    creditText: (item.creditTags || []).join(' · ') || '新乘客',
    statusMeta,
    showActions: item.requestStatus === 'PENDING_DRIVER_CONFIRM',
  }
}

function buildRoleState(hasToken, rolePreference, passengerOrders, driverOrders, driverEnabled) {
  const isPassengerView = rolePreference !== 'DRIVER'
  return {
    rolePreference,
    headerCountText: String(isPassengerView ? passengerOrders.length : driverOrders.length),
    passengerRoleClass: isPassengerView ? 'chip chip--active' : 'chip chip--soft',
    driverRoleClass: !isPassengerView ? 'chip chip--active' : 'chip chip--soft',
    isPassengerView,
    isDriverView: !isPassengerView,
    showPassengerView: !!hasToken && isPassengerView,
    showDriverView: !!hasToken && !isPassengerView,
    driverRoleHint: driverEnabled ? '' : '当前账号还没有车主角色。要体验发布、接单和钱包结算，请先切换到 driver-alpha 或已完成司机认证的账号。',
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    session: null,
    rolePreference: runtime.getRolePreference(),
    headerCountText: '0',
    passengerRoleClass: 'chip chip--active',
    driverRoleClass: 'chip chip--soft',
    isPassengerView: true,
    isDriverView: false,
    showPassengerView: true,
    showDriverView: false,
    driverRoleHint: '',
    driverEnabled: false,
    loading: false,
    actionKey: '',
    passengerRequests: [],
    passengerOrders: [],
    driverTrips: [],
    driverRequests: [],
    driverOrders: [],
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    const rolePreference = runtime.getRolePreference()
    this.setData({
      authState,
      rolePreference,
      ...buildRoleState(!!authState.token, rolePreference, this.data.passengerOrders, this.data.driverOrders, this.data.driverEnabled),
    })

    if (!authState.token) {
      this.setData({
        session: null,
        driverEnabled: false,
        passengerRequests: [],
        passengerOrders: [],
        driverTrips: [],
        driverRequests: [],
        driverOrders: [],
      })
      return
    }

    this.setData({ loading: true })
    try {
      const bundle = await runtime.loadProfileBundle()
      const tasks = await Promise.allSettled([
        orderService.listMyJoinRequests(),
        orderService.listOrders('passenger'),
        tripService.listMyTrips(),
        orderService.listDriverJoinRequests(),
        orderService.listOrders('driver'),
      ])
      const driverEnabled = hasDriverRole(bundle.session)
      const passengerRequests = tasks[0].status === 'fulfilled' ? (tasks[0].value.list || []).map(mapPassengerRequest) : []
      const passengerOrders = tasks[1].status === 'fulfilled' ? (tasks[1].value.list || []).map((item) => mapPassengerOrder(item, 'passenger')) : []
      const driverTrips = tasks[2].status === 'fulfilled' ? (tasks[2].value.list || []).map(mapTripItem) : []
      const driverRequests = tasks[3].status === 'fulfilled' ? (tasks[3].value.list || []).map(mapDriverRequest) : []
      const driverOrders = tasks[4].status === 'fulfilled' ? (tasks[4].value.list || []).map((item) => mapPassengerOrder(item, 'driver')) : []

      this.setData({
        session: bundle.session,
        driverEnabled,
        passengerRequests,
        passengerOrders,
        driverTrips,
        driverRequests,
        driverOrders,
        ...buildRoleState(!!authState.token, rolePreference, passengerOrders, driverOrders, driverEnabled),
      })
    } catch (error) {
      runtime.handleError(error, '加载订单中心失败')
    } finally {
      this.setData({
        loading: false,
        actionKey: '',
      })
    }
  },

  handleRoleChange(event) {
    const role = event.currentTarget.dataset.role
    if (!role) {
      return
    }
    runtime.setRolePreference(role)
    this.setData({
      rolePreference: role,
      ...buildRoleState(!!this.data.authState.token, role, this.data.passengerOrders, this.data.driverOrders, this.data.driverEnabled),
    })
    if (role === 'DRIVER' && !this.data.driverEnabled) {
      runtime.showToast('当前账号暂无车主权限，请切换 driver-* 账号')
    }
  },

  handleRefresh() {
    this.bootstrap()
  },

  handleOpenDetail(event) {
    const kind = event.currentTarget.dataset.kind
    const id = event.currentTarget.dataset.id
    if (!kind || !id) {
      return
    }
    navigation.openOrderDetail({
      kind,
      id,
    })
  },

  async handleAcceptRequest(event) {
    const requestId = event.currentTarget.dataset.id
    if (!requestId) {
      return
    }
    this.setData({
      actionKey: `accept-${requestId}`,
    })
    try {
      await orderService.acceptJoinRequest(requestId, '车主已在小程序确认接单')
      runtime.showSuccess('已接受同行申请')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '接受申请失败')
      this.setData({
        actionKey: '',
      })
    }
  },

  async handleRejectRequest(event) {
    const requestId = event.currentTarget.dataset.id
    if (!requestId) {
      return
    }
    this.setData({
      actionKey: `reject-${requestId}`,
    })
    try {
      await orderService.rejectJoinRequest(requestId, '当前路线已满座，请选择其他行程')
      runtime.showSuccess('已拒绝同行申请')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '拒绝申请失败')
      this.setData({
        actionKey: '',
      })
    }
  },

  handleGoProfile() {
    navigation.openPrimaryPage('profile')
  },
})
