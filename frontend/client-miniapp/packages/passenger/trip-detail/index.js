const tripService = require('../../../services/trip')
const orderService = require('../../../services/order')
const runtime = require('../../../utils/runtime')
const navigation = require('../../../utils/navigation')
const { loadSearchDraft } = require('../../../utils/drafts')
const { formatDateTime, formatMoney, formatDistance, formatPercent, formatRating } = require('../../../utils/formatter')
const { resolveTripMeta } = require('../../../utils/status')

function buildTripView(detail, departAt) {
  const driverInfo = detail.driverInfo || {}
  return {
    ...detail,
    driverName: driverInfo.nickname || '顺路车主',
    avatarText: runtime.buildAvatarText(driverInfo.nickname),
    ratingText: formatRating(driverInfo.rating),
    routeScoreText: formatPercent(detail.routeScore),
    totalFeeText: detail.priceInfo ? formatMoney(detail.priceInfo.totalFeeFen) : '--',
    serviceFeeText: detail.priceInfo ? formatMoney(detail.priceInfo.serviceFeeFen) : '--',
    distanceText: detail.priceInfo ? formatDistance(detail.priceInfo.distanceMeter) : '--',
    departText: departAt ? formatDateTime(departAt) : '以订单确认为准',
    tripStatusMeta: resolveTripMeta(detail.tripStatus),
    shareLabel: detail.safetyInfo && detail.safetyInfo.shareEnabled ? '已开启' : '待开放',
    shareTone: detail.safetyInfo && detail.safetyInfo.shareEnabled ? 'hero-note--safe' : 'hero-note--warn',
    shareNote: detail.safetyInfo && detail.safetyInfo.shareEnabled
      ? '后端返回本行程支持分享状态。'
      : '后端暂未开放分享能力，这里保持诚实展示。',
  }
}

function buildTripPageState(authState, tripView) {
  return {
    topTitleText: tripView ? `${tripView.driverName}，这趟路顺得稳也坐得安心` : '正在加载行程详情',
    topRouteScoreText: tripView ? tripView.routeScoreText : '--',
    showTripPanel: !!(authState && authState.token && tripView),
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    searchDraft: loadSearchDraft(),
    tripId: 0,
    departAt: '',
    tripDetail: null,
    tripView: null,
    topTitleText: '正在加载行程详情',
    topRouteScoreText: '--',
    showTripPanel: false,
    loading: false,
    applying: false,
  },

  onLoad(options) {
    this.setData({
      tripId: Number(options.tripId) || 0,
      departAt: options.departAt || '',
    })
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    const searchDraft = loadSearchDraft()
    this.setData({
      authState,
      searchDraft,
      ...buildTripPageState(authState, this.data.tripView),
    })
    if (!this.data.tripId || !authState.token) {
      return
    }
    this.setData({ loading: true })
    try {
      const detail = await tripService.getTrip(this.data.tripId)
      this.setData({
        tripDetail: detail,
        tripView: buildTripView(detail, this.data.departAt),
        ...buildTripPageState(authState, buildTripView(detail, this.data.departAt)),
      })
    } catch (error) {
      runtime.handleError(error, '加载行程详情失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  handleRefresh() {
    this.bootstrap()
  },

  async handleApplyJoin() {
    if (!runtime.ensureLoggedIn('请先登录后申请同行')) {
      return
    }
    const tripDetail = this.data.tripDetail
    if (!tripDetail) {
      runtime.showToast('请先等待详情加载完成')
      return
    }
    this.setData({ applying: true })
    try {
      const draft = this.data.searchDraft
      const result = await orderService.createJoinRequest({
        tripId: tripDetail.tripId,
        startName: draft.startName,
        startLat: draft.startLat,
        startLng: draft.startLng,
        endName: draft.endName,
        endLat: draft.endLat,
        endLng: draft.endLng,
      })
      runtime.showSuccess('同行申请已提交')
      await navigation.openOrderDetail({
        kind: 'join',
        id: result.joinRequestId,
      })
    } catch (error) {
      runtime.handleError(error, '提交同行申请失败')
    } finally {
      this.setData({ applying: false })
    }
  },

  handleBack() {
    navigation.goBackOrHome('home')
  },
})
