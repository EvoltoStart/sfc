const vehicleService = require('../../../services/vehicle')
const runtime = require('../../../utils/runtime')
const { resolveAuthMeta } = require('../../../utils/status')

function mapVehicle(item) {
  return {
    ...item,
    authMeta: resolveAuthMeta(item.authStatus),
    defaultText: item.isDefault ? '当前默认车辆' : '可设为默认',
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    driverProfile: null,
    vehicles: [],
    loading: false,
    submitting: false,
    vehicleDraft: {
      brand: '比亚迪',
      model: '秦 PLUS',
      color: '白色',
      plateNo: '浙A12345',
      seatCount: 4,
      vehicleImageUrl: '',
    },
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    this.setData({ authState })
    if (!authState.token) {
      this.setData({ vehicles: [], driverProfile: null })
      return
    }
    this.setData({ loading: true })
    try {
      const results = await Promise.allSettled([
        vehicleService.listVehicles(),
        vehicleService.getDriverProfile(),
      ])
      this.setData({
        vehicles: results[0].status === 'fulfilled' ? (results[0].value.list || []).map(mapVehicle) : [],
        driverProfile: results[1].status === 'fulfilled' ? results[1].value : null,
      })
    } catch (error) {
      runtime.handleError(error, '加载车辆失败')
    } finally {
      this.setData({ loading: false, submitting: false })
    }
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }
    this.setData({
      vehicleDraft: {
        ...this.data.vehicleDraft,
        [field]: field === 'seatCount' ? Number(event.detail.value) || 0 : event.detail.value,
      },
    })
  },

  async handleCreateVehicle() {
    if (!runtime.ensureLoggedIn('请先登录后新增车辆')) {
      return
    }
    this.setData({ submitting: true })
    try {
      await vehicleService.createVehicle(this.data.vehicleDraft)
      runtime.showSuccess('车辆已提交')
      this.setData({
        vehicleDraft: {
          brand: '特斯拉',
          model: 'Model Y',
          color: '黑色',
          plateNo: '浙A67890',
          seatCount: 4,
          vehicleImageUrl: '',
        },
      })
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '新增车辆失败')
      this.setData({ submitting: false })
    }
  },

  async handleSetDefault(event) {
    const id = event.currentTarget.dataset.id
    if (!id) {
      return
    }
    try {
      await vehicleService.setDefaultVehicle(id)
      runtime.showSuccess('默认车辆已更新')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '设置默认车辆失败')
    }
  },
})
