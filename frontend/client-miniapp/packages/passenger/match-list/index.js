const tripService = require('../../../services/trip')
const runtime = require('../../../utils/runtime')
const navigation = require('../../../utils/navigation')
const { loadSearchDraft, loadLastSearchPayload, saveLastSearchPayload } = require('../../../utils/drafts')
const { formatDateTime, formatMoney, formatPercent, formatRating } = require('../../../utils/formatter')

function mapMatchItem(item) {
  const driverInfo = item.driverInfo || {}
  return {
    ...item,
    avatarText: runtime.buildAvatarText(driverInfo.nickname),
    driverName: driverInfo.nickname || '顺路车主',
    ratingText: formatRating(driverInfo.rating),
    departText: formatDateTime(item.departAt),
    feeText: formatMoney(item.estimatedFeeFen),
    routeScoreText: formatPercent(item.routeScore),
    seatText: `${item.seatAvailable || 0} 座可选`,
  }
}

function sortMatches(list, sortKey) {
  const nextList = (list || []).slice()
  if (sortKey === 'fee') {
    nextList.sort((a, b) => (a.estimatedFeeFen || 0) - (b.estimatedFeeFen || 0))
  } else if (sortKey === 'depart') {
    nextList.sort((a, b) => new Date(a.departAt).getTime() - new Date(b.departAt).getTime())
  } else {
    nextList.sort((a, b) => (b.routeScore || 0) - (a.routeScore || 0))
  }
  return nextList.map(mapMatchItem)
}

function buildSortState(sortKey) {
  return {
    routeSortClass: sortKey === 'route' ? 'chip chip--active' : 'chip chip--soft',
    feeSortClass: sortKey === 'fee' ? 'chip chip--active' : 'chip chip--soft',
    departSortClass: sortKey === 'depart' ? 'chip chip--active' : 'chip chip--soft',
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    searchDraft: loadSearchDraft(),
    sortKey: 'route',
    routeSortClass: 'chip chip--active',
    feeSortClass: 'chip chip--soft',
    departSortClass: 'chip chip--soft',
    rawMatches: [],
    matches: [],
    loading: false,
    resultCount: 0,
    showEmptyState: false,
  },

  onShow() {
    this.bootstrap()
  },

  bootstrap() {
    const authState = runtime.syncAuthState()
    const searchDraft = loadSearchDraft()
    const lastPayload = loadLastSearchPayload()
    const hasCache = lastPayload && lastPayload.result && lastPayload.draft && JSON.stringify(lastPayload.draft) === JSON.stringify(searchDraft)
    this.setData({
      authState,
      searchDraft,
      rawMatches: hasCache ? lastPayload.result.list || [] : [],
      matches: hasCache ? sortMatches(lastPayload.result.list || [], this.data.sortKey) : [],
      resultCount: hasCache ? (lastPayload.result.list || []).length : 0,
      showEmptyState: !!authState.token && !(hasCache ? (lastPayload.result.list || []).length : 0),
      ...buildSortState(this.data.sortKey),
    })
    if (authState.token) {
      this.loadMatches()
    }
  },

  async loadMatches() {
    if (!runtime.ensureLoggedIn('请先登录后查看匹配结果')) {
      return
    }
    this.setData({ loading: true })
    try {
      const draft = this.data.searchDraft
      const result = await tripService.searchMatches({
        startName: draft.startName,
        startLat: draft.startLat,
        startLng: draft.startLng,
        endName: draft.endName,
        endLat: draft.endLat,
        endLng: draft.endLng,
        departAt: new Date(`${draft.departDate}T${draft.departTime}:00`).toISOString(),
        minRouteScore: draft.minRouteScore,
        page: 1,
        pageSize: 20,
      })
      saveLastSearchPayload({
        draft,
        result,
      })
      this.setData({
        rawMatches: result.list || [],
        matches: sortMatches(result.list || [], this.data.sortKey),
        resultCount: (result.list || []).length,
        showEmptyState: !(result.list || []).length,
      })
    } catch (error) {
      runtime.handleError(error, '加载匹配结果失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  handleSortChange(event) {
    const sortKey = event.currentTarget.dataset.sort
    if (!sortKey) {
      return
    }
    this.setData({
      sortKey,
      matches: sortMatches(this.data.rawMatches, sortKey),
      ...buildSortState(sortKey),
    })
  },

  handleOpenTrip(event) {
    const tripId = event.currentTarget.dataset.tripId
    const departAt = event.currentTarget.dataset.departAt
    if (!tripId) {
      return
    }
    navigation.openTripDetail({
      tripId,
      departAt,
    })
  },

  handleBack() {
    navigation.goBackOrHome('home')
  },
})
