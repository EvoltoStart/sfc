const vehicleService = require('../../../services/vehicle')
const runtime = require('../../../utils/runtime')
const { resolveAuthMeta } = require('../../../utils/status')

function buildLicenseView(licenseStatus, licenseStatusMeta, driverStatusMeta) {
  return {
    licenseStatusText: licenseStatusMeta ? licenseStatusMeta.label : '待提交',
    driverStatusText: driverStatusMeta ? driverStatusMeta.label : '待开通',
    showRejectReason: !!(licenseStatus && licenseStatus.rejectReason),
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    licenseStatus: null,
    licenseStatusMeta: null,
    driverProfile: null,
    driverStatusMeta: null,
    licenseStatusText: '待提交',
    driverStatusText: '待开通',
    showRejectReason: false,
    loading: false,
    submitting: false,
    licenseDraft: {
      licenseNo: '330100199901011234',
      issueDate: '2020-01-01',
      expireDate: '2030-01-01',
      imageUrl: '',
    },
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    this.setData({ authState })
    if (!authState.token) {
      return
    }
    this.setData({ loading: true })
    try {
      const results = await Promise.allSettled([
        vehicleService.getLicenseStatus(),
        vehicleService.getDriverProfile(),
      ])
      const licenseStatus = results[0].status === 'fulfilled' ? results[0].value : null
      const licenseStatusMeta = results[0].status === 'fulfilled' ? resolveAuthMeta(results[0].value.authStatus) : null
      const driverProfile = results[1].status === 'fulfilled' ? results[1].value : null
      const driverStatusMeta = results[1].status === 'fulfilled' ? resolveAuthMeta(results[1].value.driverStatus) : null
      this.setData({
        licenseStatus,
        licenseStatusMeta,
        driverProfile,
        driverStatusMeta,
        ...buildLicenseView(licenseStatus, licenseStatusMeta, driverStatusMeta),
      })
    } catch (error) {
      runtime.handleError(error, '加载驾驶证状态失败')
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
      licenseDraft: {
        ...this.data.licenseDraft,
        [field]: event.detail.value,
      },
    })
  },

  handleDateChange(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }
    this.setData({
      licenseDraft: {
        ...this.data.licenseDraft,
        [field]: event.detail.value,
      },
    })
  },

  async handleSubmit() {
    if (!runtime.ensureLoggedIn('请先登录后提交驾驶证')) {
      return
    }
    this.setData({ submitting: true })
    try {
      await vehicleService.submitLicense(this.data.licenseDraft)
      runtime.showSuccess('驾驶证已提交')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '提交驾驶证失败')
      this.setData({ submitting: false })
    }
  },
})
