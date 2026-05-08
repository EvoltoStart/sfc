const tripService = require('../../services/trip')
const userService = require('../../services/user')
const vehicleService = require('../../services/vehicle')
const runtime = require('../../utils/runtime')
const navigation = require('../../utils/navigation')
const { routePresets, getRoutePreset, buildPublishDraft, toIsoString } = require('../../utils/route-presets')
const { loadPublishDraft, savePublishDraft } = require('../../utils/drafts')
const { formatDistance, formatMoney, formatPercent } = require('../../utils/formatter')
const { resolveAuthMeta } = require('../../utils/status')

function buildVehicleOptions(vehicles) {
  return (vehicles || []).map((item) => `${item.brand} ${item.model} · ${item.plateNoMasked}`)
}

function mapPresetItem(item, activePresetId) {
  return {
    ...item,
    chipClass: item.id === activePresetId ? 'chip chip--active' : 'chip chip--soft',
  }
}

function mapRouteTemplate(item) {
  return {
    ...item,
    statusText: item.isDefault ? '默认路线' : '普通路线',
    statusTone: item.isDefault ? 'safe' : 'info',
  }
}

function buildPublishView(data) {
  const publishDraft = data.publishDraft || loadPublishDraft()
  const routeScore = data.routeScore || null
  const pricePreview = data.pricePreview || null
  const driverStatusMeta = data.driverStatusMeta || null
  const licenseStatusMeta = data.licenseStatusMeta || null
  const vehicleOptions = data.vehicleOptions || []
  const vehicleIndex = typeof data.vehicleIndex === 'number' ? data.vehicleIndex : 0
  return {
    routePresetItems: routePresets.map((item) => mapPresetItem(item, publishDraft.presetId)),
    routeScoreTopText: routeScore ? routeScore.scoreText : '待算',
    previewTotalText: pricePreview ? pricePreview.totalText : '待算',
    previewServiceText: pricePreview ? pricePreview.serviceText : '--',
    previewDistanceText: pricePreview ? pricePreview.distanceText : '--',
    routeScoreText: routeScore ? routeScore.scoreText : '--',
    driverLicenseSummary: `司机状态 ${driverStatusMeta ? driverStatusMeta.label : '未查询'}，驾驶证 ${licenseStatusMeta ? licenseStatusMeta.label : '未查询'}。`,
    selectedVehicleText: vehicleOptions.length ? vehicleOptions[vehicleIndex] : '请先去车辆管理新增车辆',
    routeScoreNoteClass: routeScore && routeScore.passed ? 'hero-note hero-note--safe' : 'hero-note hero-note--warn',
    routeScoreNoteText: routeScore ? (routeScore.message || (routeScore.passed ? '规则校验通过' : '规则校验未通过')) : '',
    showDriverSummary: !!(data.driverProfile && driverStatusMeta),
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    routePresets,
    routePresetItems: routePresets.map((item) => mapPresetItem(item, loadPublishDraft().presetId)),
    publishDraft: loadPublishDraft(),
    vehicles: [],
    vehicleOptions: [],
    vehicleIndex: 0,
    driverProfile: null,
    driverStatusMeta: null,
    licenseStatus: null,
    licenseStatusMeta: null,
    pricePreview: null,
    routeScore: null,
    routeTemplates: [],
    routeScoreTopText: '待算',
    previewTotalText: '待算',
    previewServiceText: '--',
    previewDistanceText: '--',
    routeScoreText: '--',
    driverLicenseSummary: '司机状态未查询，驾驶证未查询。',
    selectedVehicleText: '请先去车辆管理新增车辆',
    routeScoreNoteClass: 'hero-note hero-note--warn',
    routeScoreNoteText: '',
    showDriverSummary: false,
    loading: false,
    previewing: false,
    submitting: false,
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    const publishDraft = loadPublishDraft()
    this.setData({
      authState,
      publishDraft,
      ...buildPublishView({
        publishDraft,
        routeScore: this.data.routeScore,
        pricePreview: this.data.pricePreview,
        driverProfile: this.data.driverProfile,
        driverStatusMeta: this.data.driverStatusMeta,
        licenseStatusMeta: this.data.licenseStatusMeta,
        vehicleOptions: this.data.vehicleOptions,
        vehicleIndex: this.data.vehicleIndex,
      }),
    })

    if (!authState.token) {
      this.setData({
        vehicles: [],
        vehicleOptions: [],
        routeTemplates: [],
        driverProfile: null,
        driverStatusMeta: null,
        licenseStatus: null,
        licenseStatusMeta: null,
        pricePreview: null,
        routeScore: null,
        ...buildPublishView({
          publishDraft,
          vehicleOptions: [],
          vehicleIndex: 0,
        }),
      })
      return
    }

    this.setData({ loading: true })
    try {
      const results = await Promise.allSettled([
        vehicleService.listVehicles(),
        vehicleService.getDriverProfile(),
        vehicleService.getLicenseStatus(),
        tripService.listRouteTemplates(),
        userService.getProfile(),
      ])

      const vehicles = results[0].status === 'fulfilled' ? results[0].value.list || [] : []
      const defaultVehicle = vehicles.find((item) => item.isDefault) || vehicles[0] || null
      const nextDraft = {
        ...publishDraft,
        vehicleId: publishDraft.vehicleId || (defaultVehicle ? defaultVehicle.id : 0),
      }
      savePublishDraft(nextDraft)

      const vehicleIndex = vehicles.findIndex((item) => item.id === nextDraft.vehicleId)
      const driverProfile = results[1].status === 'fulfilled' ? results[1].value : null
      const driverStatusMeta = results[1].status === 'fulfilled' ? resolveAuthMeta(results[1].value.driverStatus) : null
      const licenseStatus = results[2].status === 'fulfilled' ? results[2].value : null
      const licenseStatusMeta = results[2].status === 'fulfilled' ? resolveAuthMeta(results[2].value.authStatus) : null
      const routeTemplates = results[3].status === 'fulfilled' ? (results[3].value.list || []).map(mapRouteTemplate) : []
      const vehicleOptions = buildVehicleOptions(vehicles)

      this.setData({
        publishDraft: nextDraft,
        vehicles,
        vehicleOptions,
        vehicleIndex: vehicleIndex >= 0 ? vehicleIndex : 0,
        driverProfile,
        driverStatusMeta,
        licenseStatus,
        licenseStatusMeta,
        routeTemplates,
        ...buildPublishView({
          publishDraft: nextDraft,
          routeScore: this.data.routeScore,
          pricePreview: this.data.pricePreview,
          driverProfile,
          driverStatusMeta,
          licenseStatusMeta,
          vehicleOptions,
          vehicleIndex: vehicleIndex >= 0 ? vehicleIndex : 0,
        }),
      })
    } catch (error) {
      runtime.handleError(error, '加载发布页失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  handlePresetTap(event) {
    const presetId = event.currentTarget.dataset.preset
    const preset = getRoutePreset(presetId)
    const currentDraft = this.data.publishDraft
    const nextDraft = {
      ...buildPublishDraft(preset),
      vehicleId: currentDraft.vehicleId,
    }
    savePublishDraft(nextDraft)
    this.setData({
      publishDraft: nextDraft,
      pricePreview: null,
      routeScore: null,
      ...buildPublishView({
        publishDraft: nextDraft,
        vehicleOptions: this.data.vehicleOptions,
        vehicleIndex: this.data.vehicleIndex,
      }),
    })
  },

  handleFieldInput(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    if (!field) {
      return
    }
    const nextDraft = {
      ...this.data.publishDraft,
      [field]: field === 'seatTotal' ? Number(value) || 0 : value,
    }
    savePublishDraft(nextDraft)
    this.setData({
      publishDraft: nextDraft,
      ...buildPublishView({
        publishDraft: nextDraft,
        routeScore: this.data.routeScore,
        pricePreview: this.data.pricePreview,
        driverProfile: this.data.driverProfile,
        driverStatusMeta: this.data.driverStatusMeta,
        licenseStatusMeta: this.data.licenseStatusMeta,
        vehicleOptions: this.data.vehicleOptions,
        vehicleIndex: this.data.vehicleIndex,
      }),
    })
  },

  handleDateChange(event) {
    const nextDraft = {
      ...this.data.publishDraft,
      departDate: event.detail.value,
    }
    savePublishDraft(nextDraft)
    this.setData({
      publishDraft: nextDraft,
      ...buildPublishView({
        publishDraft: nextDraft,
        routeScore: this.data.routeScore,
        pricePreview: this.data.pricePreview,
        driverProfile: this.data.driverProfile,
        driverStatusMeta: this.data.driverStatusMeta,
        licenseStatusMeta: this.data.licenseStatusMeta,
        vehicleOptions: this.data.vehicleOptions,
        vehicleIndex: this.data.vehicleIndex,
      }),
    })
  },

  handleTimeChange(event) {
    const nextDraft = {
      ...this.data.publishDraft,
      departTime: event.detail.value,
    }
    savePublishDraft(nextDraft)
    this.setData({
      publishDraft: nextDraft,
      ...buildPublishView({
        publishDraft: nextDraft,
        routeScore: this.data.routeScore,
        pricePreview: this.data.pricePreview,
        driverProfile: this.data.driverProfile,
        driverStatusMeta: this.data.driverStatusMeta,
        licenseStatusMeta: this.data.licenseStatusMeta,
        vehicleOptions: this.data.vehicleOptions,
        vehicleIndex: this.data.vehicleIndex,
      }),
    })
  },

  handleVehicleChange(event) {
    const index = Number(event.detail.value) || 0
    const vehicle = this.data.vehicles[index]
    const nextDraft = {
      ...this.data.publishDraft,
      vehicleId: vehicle ? vehicle.id : 0,
    }
    savePublishDraft(nextDraft)
    this.setData({
      publishDraft: nextDraft,
      vehicleIndex: index,
      ...buildPublishView({
        publishDraft: nextDraft,
        routeScore: this.data.routeScore,
        pricePreview: this.data.pricePreview,
        driverProfile: this.data.driverProfile,
        driverStatusMeta: this.data.driverStatusMeta,
        licenseStatusMeta: this.data.licenseStatusMeta,
        vehicleOptions: this.data.vehicleOptions,
        vehicleIndex: index,
      }),
    })
  },

  async handlePreview() {
    if (!runtime.ensureLoggedIn('请先登录后刷新发布预览')) {
      return
    }
    this.setData({ previewing: true })
    try {
      const draft = this.data.publishDraft
      const results = await Promise.all([
        tripService.pricePreview({
          startName: draft.startName,
          startLat: draft.startLat,
          startLng: draft.startLng,
          endName: draft.endName,
          endLat: draft.endLat,
          endLng: draft.endLng,
          seatCount: draft.seatTotal,
        }),
        tripService.routeScorePreview({
          startName: draft.startName,
          startLat: draft.startLat,
          startLng: draft.startLng,
          endName: draft.endName,
          endLat: draft.endLat,
          endLng: draft.endLng,
          waypoints: [],
        }),
      ])

      this.setData({
        pricePreview: {
          ...results[0],
          totalText: formatMoney(results[0].totalFeeFen),
          serviceText: formatMoney(results[0].serviceFeeFen),
          distanceText: formatDistance(results[0].distanceMeter),
        },
        routeScore: {
          ...results[1],
          scoreText: formatPercent(results[1].routeScore),
        },
        ...buildPublishView({
          publishDraft: this.data.publishDraft,
          routeScore: {
            ...results[1],
            scoreText: formatPercent(results[1].routeScore),
          },
          pricePreview: {
            ...results[0],
            totalText: formatMoney(results[0].totalFeeFen),
            serviceText: formatMoney(results[0].serviceFeeFen),
            distanceText: formatDistance(results[0].distanceMeter),
          },
          driverProfile: this.data.driverProfile,
          driverStatusMeta: this.data.driverStatusMeta,
          licenseStatusMeta: this.data.licenseStatusMeta,
          vehicleOptions: this.data.vehicleOptions,
          vehicleIndex: this.data.vehicleIndex,
        }),
      })
      runtime.showSuccess('已刷新价格和顺路度')
    } catch (error) {
      runtime.handleError(error, '刷新预览失败')
    } finally {
      this.setData({ previewing: false })
    }
  },

  async handleCreateTrip() {
    if (!runtime.ensureLoggedIn('请先登录后发布行程')) {
      return
    }
    if (!this.data.publishDraft.vehicleId) {
      runtime.showToast('请先选择车辆')
      return
    }
    this.setData({ submitting: true })
    try {
      const draft = savePublishDraft(this.data.publishDraft)
      const result = await tripService.createTrip({
        vehicleId: draft.vehicleId,
        startName: draft.startName,
        startLat: draft.startLat,
        startLng: draft.startLng,
        endName: draft.endName,
        endLat: draft.endLat,
        endLng: draft.endLng,
        waypoints: [],
        departAt: toIsoString(draft.departDate, draft.departTime),
        seatTotal: draft.seatTotal,
      })
      this.setData({
        pricePreview: {
          ...result.pricePreview,
          totalText: formatMoney(result.pricePreview.totalFeeFen),
          serviceText: formatMoney(result.pricePreview.serviceFeeFen),
          distanceText: formatDistance(result.pricePreview.distanceMeter),
        },
        routeScore: {
          routeScore: result.routeScore,
          scoreText: formatPercent(result.routeScore),
          passed: result.frequencyCheck ? result.frequencyCheck.passed : true,
          message: result.frequencyCheck && !result.frequencyCheck.passed ? '触发频控规则' : '规则校验通过',
        },
        ...buildPublishView({
          publishDraft: draft,
          routeScore: {
            routeScore: result.routeScore,
            scoreText: formatPercent(result.routeScore),
            passed: result.frequencyCheck ? result.frequencyCheck.passed : true,
            message: result.frequencyCheck && !result.frequencyCheck.passed ? '触发频控规则' : '规则校验通过',
          },
          pricePreview: {
            ...result.pricePreview,
            totalText: formatMoney(result.pricePreview.totalFeeFen),
            serviceText: formatMoney(result.pricePreview.serviceFeeFen),
            distanceText: formatDistance(result.pricePreview.distanceMeter),
          },
          driverProfile: this.data.driverProfile,
          driverStatusMeta: this.data.driverStatusMeta,
          licenseStatusMeta: this.data.licenseStatusMeta,
          vehicleOptions: this.data.vehicleOptions,
          vehicleIndex: this.data.vehicleIndex,
        }),
      })
      runtime.setRolePreference('DRIVER')
      runtime.showSuccess(`行程 ${result.tripId} 已发布`)
      await navigation.openPrimaryPage('order')
    } catch (error) {
      runtime.handleError(error, '发布行程失败')
    } finally {
      this.setData({ submitting: false })
    }
  },

  async handleSaveTemplate() {
    if (!runtime.ensureLoggedIn('请先登录后保存常用路线')) {
      return
    }
    try {
      const draft = this.data.publishDraft
      const preset = getRoutePreset(draft.presetId)
      await tripService.createRouteTemplate({
        routeName: preset.routeName,
        startName: draft.startName,
        startLat: draft.startLat,
        startLng: draft.startLng,
        endName: draft.endName,
        endLat: draft.endLat,
        endLng: draft.endLng,
        waypoints: [],
        timePeriod: preset.timePeriod,
      })
      runtime.showSuccess('常用路线已保存')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '保存常用路线失败')
    }
  },

  async handleSetDefaultTemplate(event) {
    const templateId = event.currentTarget.dataset.id
    if (!templateId) {
      return
    }
    try {
      await tripService.setDefaultRouteTemplate(templateId)
      runtime.showSuccess('默认路线已更新')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '设置默认路线失败')
    }
  },

  handleGoVehicles() {
    navigation.openVehicles()
  },

  handleGoLicense() {
    navigation.openLicense()
  },

  handleGoProfile() {
    navigation.openPrimaryPage('profile')
  },
})
