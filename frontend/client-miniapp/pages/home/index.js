const tripService = require('../../services/trip')
const runtime = require('../../utils/runtime')
const navigation = require('../../utils/navigation')
const { routePresets, quickLoginCodes, faqItems, getRoutePreset, buildSearchDraft, toIsoString } = require('../../utils/route-presets')
const { loadSearchDraft, saveSearchDraft, saveLastSearchPayload } = require('../../utils/drafts')
const { formatDateTime, formatMoney, formatPercent, formatRating } = require('../../utils/formatter')

const capabilityNotes = [
  '可完成登录、搜索匹配、行程详情、同行申请、支付和钱包结算主流程。',
  '安全配置、行程分享、SOS 和轨迹摘要需要关联订单后使用。',
  '车主完成车辆和驾驶证认证后，可发布行程并处理乘客申请。',
]

function mapMatchItem(item) {
  const driverInfo = item.driverInfo || {}
  return {
    ...item,
    driverName: driverInfo.nickname || '顺路车主',
    avatarText: runtime.buildAvatarText(driverInfo.nickname),
    departText: formatDateTime(item.departAt),
    feeText: formatMoney(item.estimatedFeeFen),
    routeScoreText: formatPercent(item.routeScore),
    ratingText: formatRating(driverInfo.rating),
    seatText: `${item.seatAvailable || 0} 座可选`,
  }
}

function mapPresetItem(item, activePresetId) {
  return {
    ...item,
    chipClass: item.id === activePresetId ? 'chip chip--active' : 'chip chip--soft',
  }
}

function buildPageState(input) {
  const authState = input.authState || runtime.syncAuthState()
  const searchDraft = input.searchDraft || loadSearchDraft()
  const profile = input.profile || null
  const featuredTotal = typeof input.featuredTotal === 'number' ? input.featuredTotal : 0
  return {
    authState,
    searchDraft,
    profile,
    profileDisplayName: profile && profile.nickname ? profile.nickname : '先登录',
    featuredTotal,
    featuredTotalText: String(featuredTotal),
    loginStateText: authState.token ? '已登录' : '待登录',
    routePresetItems: routePresets.map((item) => mapPresetItem(item, searchDraft.presetId)),
  }
}

Page({
  data: {
    routePresets,
    routePresetItems: routePresets.map((item) => mapPresetItem(item, loadSearchDraft().presetId)),
    quickLoginCodes,
    faqItems,
    capabilityNotes,
    authState: runtime.syncAuthState(),
    session: null,
    profile: null,
    profileDisplayName: '先登录',
    searchDraft: loadSearchDraft(),
    featuredMatches: [],
    featuredTotal: 0,
    featuredTotalText: '0',
    loginStateText: '待登录',
    loginCode: '',
    loading: false,
    loggingIn: false,
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    const searchDraft = loadSearchDraft()
    this.setData({
      ...buildPageState({
        authState,
        searchDraft,
        profile: this.data.profile,
        featuredTotal: this.data.featuredTotal,
      }),
    })

    if (!authState.token) {
      this.setData({
        session: null,
        profile: null,
        featuredMatches: [],
        featuredTotal: 0,
        featuredTotalText: '0',
        profileDisplayName: '先登录',
        loginStateText: '待登录',
      })
      return
    }

    const bundle = await runtime.loadProfileBundle()
    this.setData({
      session: bundle.session,
      profile: bundle.profile,
      ...buildPageState({
        authState,
        searchDraft,
        profile: bundle.profile,
        featuredTotal: this.data.featuredTotal,
      }),
    })
    await this.loadFeaturedMatches(true)
  },

  handleLoginCodeInput(event) {
    this.setData({
      loginCode: event.detail.value,
    })
  },

  async handleQuickLogin(event) {
    const code = event.currentTarget.dataset.code
    if (!code) {
      return
    }
    this.setData({ loggingIn: true })
    try {
      await runtime.loginByCode(code)
      runtime.showSuccess(`已登录 ${code}`)
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '快捷登录失败')
    } finally {
      this.setData({ loggingIn: false })
    }
  },

  async handleLoginSubmit() {
    this.setData({ loggingIn: true })
    try {
      await runtime.loginByCode(this.data.loginCode)
      runtime.showSuccess('账号已登录')
      this.setData({ loginCode: '' })
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '登录失败')
    } finally {
      this.setData({ loggingIn: false })
    }
  },

  async handleWechatLogin() {
    this.setData({ loggingIn: true })
    try {
      await runtime.loginByWechat()
      runtime.showSuccess('微信登录成功')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '微信登录失败')
    } finally {
      this.setData({ loggingIn: false })
    }
  },

  handlePresetTap(event) {
    const presetId = event.currentTarget.dataset.preset
    const preset = getRoutePreset(presetId)
    const nextDraft = buildSearchDraft(preset)
    saveSearchDraft(nextDraft)
    this.setData({
      searchDraft: nextDraft,
      routePresetItems: routePresets.map((item) => mapPresetItem(item, nextDraft.presetId)),
    })
  },

  handleSearchFieldInput(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    if (!field) {
      return
    }
    const nextDraft = {
      ...this.data.searchDraft,
      [field]: field === 'minRouteScore' ? Number(value) || 0 : value,
    }
    saveSearchDraft(nextDraft)
    this.setData({
      searchDraft: nextDraft,
      routePresetItems: routePresets.map((item) => mapPresetItem(item, nextDraft.presetId)),
    })
  },

  handleDateChange(event) {
    const nextDraft = {
      ...this.data.searchDraft,
      departDate: event.detail.value,
    }
    saveSearchDraft(nextDraft)
    this.setData({
      searchDraft: nextDraft,
      routePresetItems: routePresets.map((item) => mapPresetItem(item, nextDraft.presetId)),
    })
  },

  handleTimeChange(event) {
    const nextDraft = {
      ...this.data.searchDraft,
      departTime: event.detail.value,
    }
    saveSearchDraft(nextDraft)
    this.setData({
      searchDraft: nextDraft,
      routePresetItems: routePresets.map((item) => mapPresetItem(item, nextDraft.presetId)),
    })
  },

  async loadFeaturedMatches(silent) {
    if (!runtime.ensureLoggedIn(silent ? '' : '请先登录后查看推荐')) {
      return
    }
    if (!silent) {
      this.setData({ loading: true })
    }
    try {
      const searchDraft = this.data.searchDraft
      const result = await tripService.searchMatches({
        startName: searchDraft.startName,
        startLat: searchDraft.startLat,
        startLng: searchDraft.startLng,
        endName: searchDraft.endName,
        endLat: searchDraft.endLat,
        endLng: searchDraft.endLng,
        departAt: toIsoString(searchDraft.departDate, searchDraft.departTime),
        minRouteScore: searchDraft.minRouteScore,
        page: 1,
        pageSize: 20,
      })
      saveLastSearchPayload({
        draft: searchDraft,
        result,
      })
      this.setData({
        featuredMatches: (result.list || []).slice(0, 3).map(mapMatchItem),
        featuredTotal: (result.list || []).length,
        featuredTotalText: String((result.list || []).length),
      })
    } catch (error) {
      this.setData({
        featuredMatches: [],
        featuredTotal: 0,
        featuredTotalText: '0',
      })
      if (!silent) {
        runtime.handleError(error, '刷新推荐失败')
      }
    } finally {
      if (!silent) {
        this.setData({ loading: false })
      }
    }
  },

  handleRefreshFeatured() {
    this.loadFeaturedMatches(false)
  },

  async handleSearch() {
    if (!runtime.ensureLoggedIn('请先登录后再搜索行程')) {
      return
    }
    this.setData({ loading: true })
    try {
      const searchDraft = saveSearchDraft(this.data.searchDraft)
      const result = await tripService.searchMatches({
        startName: searchDraft.startName,
        startLat: searchDraft.startLat,
        startLng: searchDraft.startLng,
        endName: searchDraft.endName,
        endLat: searchDraft.endLat,
        endLng: searchDraft.endLng,
        departAt: toIsoString(searchDraft.departDate, searchDraft.departTime),
        minRouteScore: searchDraft.minRouteScore,
        page: 1,
        pageSize: 20,
      })
      saveLastSearchPayload({
        draft: searchDraft,
        result,
      })
      this.setData({
        featuredMatches: (result.list || []).slice(0, 3).map(mapMatchItem),
        featuredTotal: (result.list || []).length,
        featuredTotalText: String((result.list || []).length),
      })
      runtime.showSuccess(`已匹配 ${result.list.length} 条行程`)
      await navigation.openMatchList({
        count: result.list.length,
      })
    } catch (error) {
      runtime.handleError(error, '搜索匹配失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  handleOpenTrip(event) {
    const tripId = event.currentTarget.dataset.tripId
    if (!tripId) {
      return
    }
    navigation.openTripDetail({
      tripId,
    })
  },

  handleGoProfile() {
    navigation.openPrimaryPage('profile')
  },
})
