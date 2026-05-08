const userService = require('../../services/user')
const orderService = require('../../services/order')
const safetyService = require('../../services/safety')
const runtime = require('../../utils/runtime')
const navigation = require('../../utils/navigation')
const { faqItems } = require('../../utils/route-presets')
const { formatDateTime, formatDistance } = require('../../utils/formatter')

const capabilityCards = [
  {
    title: '紧急联系人',
    description: '可新增、删除默认联系人。',
    tone: 'safe',
  },
  {
    title: '行程分享',
    description: '可按订单生成 24 小时安全链接。',
    tone: 'safe',
  },
  {
    title: 'SOS / 轨迹留痕',
    description: '支持 SOS 上报、轨迹批量上传和轨迹摘要查询。',
    tone: 'safe',
  },
]

capabilityCards.forEach((item) => {
  item.toneLabel = '可用'
  item.noteClass = 'hero-note--safe'
})

function containsId(ids, id) {
  return ids.indexOf(id) >= 0
}

function mapContact(item, selectedIds) {
  const selected = containsId(selectedIds, item.id)
  return {
    ...item,
    defaultChipClass: item.isDefault ? 'chip chip--active' : 'chip chip--soft',
    defaultLabel: item.isDefault ? '默认联系人' : '备用联系人',
    shareChipClass: selected ? 'chip chip--active' : 'chip chip--soft',
    shareLabel: selected ? '已加入分享' : '点按加入分享',
  }
}

function mapSafetyConfig(config) {
  const normalized = config || {}
  const selectedIds = Array.isArray(normalized.defaultShareContactIds) ? normalized.defaultShareContactIds : []
  return {
    shareEnabled: !!normalized.shareEnabled,
    recordEnabled: !!normalized.recordEnabled,
    defaultShareContactIds: selectedIds,
    recordNotice: normalized.recordNotice || '行程轨迹仅在行程中采集，用于安全回溯与异常核查。',
    shareChipClass: normalized.shareEnabled ? 'chip chip--active' : 'chip chip--soft',
    shareLabel: normalized.shareEnabled ? '默认分享已开启' : '默认分享已关闭',
    recordChipClass: normalized.recordEnabled ? 'chip chip--active' : 'chip chip--soft',
    recordLabel: normalized.recordEnabled ? '轨迹留痕已开启' : '轨迹留痕已关闭',
  }
}

function mapOrder(item) {
  return {
    ...item,
    departText: formatDateTime(item.departAt),
    orderTitle: item.routeSummary || item.orderNo,
  }
}

function mapTraceSummary(summary) {
  const normalized = summary || {}
  return {
    distanceText: formatDistance(normalized.totalDistanceMeter),
    durationText: `${Math.round((normalized.totalDurationSecond || 0) / 60)} 分钟`,
    abnormalText: normalized.abnormalFlag ? '发现异常' : '轨迹正常',
    startText: formatDateTime(normalized.startAt, '待采集'),
    endText: formatDateTime(normalized.endAt, '待采集'),
  }
}

const defaultSafetyConfig = mapSafetyConfig({
  shareEnabled: true,
  recordEnabled: true,
  defaultShareContactIds: [],
})

Page({
  data: {
    authState: runtime.syncAuthState(),
    faqItems,
    capabilityCards,
    contacts: [],
    safetyConfig: defaultSafetyConfig,
    orders: [],
    selectedOrderId: 0,
    selectedOrderTitle: '暂无可用订单',
    shareResult: null,
    sosResult: null,
    traceSummary: null,
    contactDraft: {
      name: '家人',
      mobile: '13800138000',
      relation: '父母',
      isDefault: true,
    },
    loading: false,
    submitting: false,
    actioning: false,
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    this.setData({ authState })
    if (!authState.token) {
      this.setData({
        contacts: [],
        orders: [],
        selectedOrderId: 0,
        selectedOrderTitle: '暂无可用订单',
        shareResult: null,
        sosResult: null,
        traceSummary: null,
      })
      return
    }
    this.setData({ loading: true })
    try {
      const results = await Promise.allSettled([
        userService.listEmergencyContacts(),
        safetyService.getSafetyConfig(),
        orderService.listOrders('passenger'),
        orderService.listOrders('driver'),
      ])
      const config = results[1].status === 'fulfilled' ? mapSafetyConfig(results[1].value) : defaultSafetyConfig
      const contactsResult = results[0].status === 'fulfilled' ? results[0].value : { list: [] }
      const passengerOrders = results[2].status === 'fulfilled' ? (results[2].value.list || []) : []
      const driverOrders = results[3].status === 'fulfilled' ? (results[3].value.list || []) : []
      const orders = passengerOrders.concat(driverOrders).map(mapOrder)
      const selectedOrder = orders.find((item) => item.orderId === this.data.selectedOrderId) || orders[0] || null
      this.setData({
        safetyConfig: config,
        contacts: (contactsResult.list || []).map((item) => mapContact(item, config.defaultShareContactIds)),
        orders,
        selectedOrderId: selectedOrder ? selectedOrder.orderId : 0,
        selectedOrderTitle: selectedOrder ? selectedOrder.orderTitle : '暂无可用订单',
      })
    } catch (error) {
      runtime.handleError(error, '加载安全中心失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  handleDraftInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }
    this.setData({
      contactDraft: {
        ...this.data.contactDraft,
        [field]: event.detail.value,
      },
    })
  },

  handleDefaultChange(event) {
    this.setData({
      contactDraft: {
        ...this.data.contactDraft,
        isDefault: !!event.detail.value,
      },
    })
  },

  async handleCreateContact() {
    if (!runtime.ensureLoggedIn('请先登录后管理联系人')) {
      return
    }
    this.setData({ submitting: true })
    try {
      await userService.createEmergencyContact(this.data.contactDraft)
      runtime.showSuccess('紧急联系人已保存')
      this.setData({
        contactDraft: {
          name: '朋友',
          mobile: '13900139000',
          relation: '朋友',
          isDefault: false,
        },
      })
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '新增联系人失败')
    } finally {
      this.setData({ submitting: false })
    }
  },

  async handleDeleteContact(event) {
    const id = event.currentTarget.dataset.id
    if (!id) {
      return
    }
    try {
      await userService.deleteEmergencyContact(id)
      runtime.showSuccess('联系人已删除')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '删除联系人失败')
    }
  },

  handleShareToggle() {
    const current = this.data.safetyConfig
    this.setData({
      safetyConfig: mapSafetyConfig({
        ...current,
        shareEnabled: !current.shareEnabled,
      }),
    })
  },

  handleRecordToggle() {
    const current = this.data.safetyConfig
    this.setData({
      safetyConfig: mapSafetyConfig({
        ...current,
        recordEnabled: !current.recordEnabled,
      }),
    })
  },

  handleContactToggle(event) {
    const id = Number(event.currentTarget.dataset.id) || 0
    if (!id) {
      return
    }
    const current = this.data.safetyConfig
    const selectedIds = current.defaultShareContactIds.slice()
    const index = selectedIds.indexOf(id)
    if (index >= 0) {
      selectedIds.splice(index, 1)
    } else {
      selectedIds.push(id)
    }
    const nextConfig = mapSafetyConfig({
      ...current,
      defaultShareContactIds: selectedIds,
    })
    this.setData({
      safetyConfig: nextConfig,
      contacts: this.data.contacts.map((item) => mapContact(item, selectedIds)),
    })
  },

  async handleSaveConfig() {
    if (!runtime.ensureLoggedIn('请先登录后保存安全配置')) {
      return
    }
    const config = this.data.safetyConfig
    this.setData({ actioning: true })
    try {
      await safetyService.updateSafetyConfig({
        shareEnabled: config.shareEnabled,
        recordEnabled: config.recordEnabled,
        defaultShareContactIds: config.defaultShareContactIds,
      })
      runtime.showSuccess('安全配置已保存')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '保存安全配置失败')
    } finally {
      this.setData({ actioning: false })
    }
  },

  handleSelectOrder(event) {
    const id = Number(event.currentTarget.dataset.id) || 0
    const order = this.data.orders.find((item) => item.orderId === id)
    this.setData({
      selectedOrderId: id,
      selectedOrderTitle: order ? order.orderTitle : '暂无可用订单',
      shareResult: null,
      sosResult: null,
      traceSummary: null,
    })
  },

  async handleCreateShareLink() {
    if (!this.data.selectedOrderId) {
      runtime.showToast('请先在订单中心生成订单')
      return
    }
    this.setData({ actioning: true })
    try {
      const result = await safetyService.createShareLink({
        orderId: this.data.selectedOrderId,
        contactIds: this.data.safetyConfig.defaultShareContactIds,
      })
      this.setData({ shareResult: result })
      runtime.showSuccess('分享链接已生成')
    } catch (error) {
      runtime.handleError(error, '生成分享链接失败')
    } finally {
      this.setData({ actioning: false })
    }
  },

  async handleUploadTrace() {
    if (!this.data.selectedOrderId) {
      runtime.showToast('请先在订单中心生成订单')
      return
    }
    this.setData({ actioning: true })
    try {
      const now = new Date()
      const later = new Date(now.getTime() + 5 * 60 * 1000)
      await safetyService.uploadTracePoints({
        orderId: this.data.selectedOrderId,
        points: [
          { lat: 30.2062, lng: 120.212, recordedAt: now.toISOString() },
          { lat: 30.2206, lng: 120.2487, recordedAt: later.toISOString() },
        ],
      })
      runtime.showSuccess('轨迹样本已上传')
      await this.handleRefreshTrace()
    } catch (error) {
      runtime.handleError(error, '上传轨迹失败')
    } finally {
      this.setData({ actioning: false })
    }
  },

  async handleRefreshTrace() {
    if (!this.data.selectedOrderId) {
      runtime.showToast('请先选择订单')
      return
    }
    try {
      const summary = await safetyService.getTraceSummary(this.data.selectedOrderId)
      this.setData({
        traceSummary: mapTraceSummary(summary),
      })
    } catch (error) {
      runtime.handleError(error, '刷新轨迹摘要失败')
    }
  },

  async handleCreateSOS() {
    if (!this.data.selectedOrderId) {
      runtime.showToast('请先在订单中心生成订单')
      return
    }
    this.setData({ actioning: true })
    try {
      const result = await safetyService.createSOS({
        orderId: this.data.selectedOrderId,
        currentLat: 30.2062,
        currentLng: 120.212,
        remark: '小程序安全中心 SOS',
      })
      this.setData({ sosResult: result })
      runtime.showSuccess('SOS 已上报')
    } catch (error) {
      runtime.handleError(error, '上报 SOS 失败')
    } finally {
      this.setData({ actioning: false })
    }
  },

  handleGoProfile() {
    navigation.openPrimaryPage('profile')
  },
})
