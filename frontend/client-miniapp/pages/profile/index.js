const authService = require('../../services/auth')
const userService = require('../../services/user')
const runtime = require('../../utils/runtime')
const navigation = require('../../utils/navigation')
const { quickLoginCodes } = require('../../utils/route-presets')
const { resolveAuthMeta } = require('../../utils/status')

function buildRoleView(rolePreference) {
  const isDriver = rolePreference === 'DRIVER'
  return {
    rolePreference,
    rolePreferenceText: isDriver ? '车主' : '乘客',
    passengerRoleClass: isDriver ? 'chip chip--soft' : 'chip chip--active',
    driverRoleClass: isDriver ? 'chip chip--active' : 'chip chip--soft',
  }
}

function buildProfileView(data) {
  const profile = data.profile || null
  const realnameMeta = data.realnameMeta || null
  const driverStatusMeta = data.driverStatusMeta || null
  const licenseStatusMeta = data.licenseStatusMeta || null
  return {
    profileDisplayName: profile && profile.nickname ? profile.nickname : '先登录一个账号',
    profileUserIdText: profile && typeof profile.userId !== 'undefined' ? String(profile.userId) : '--',
    realnameLabelText: realnameMeta ? realnameMeta.label : '待提交',
    driverStatusLabelText: driverStatusMeta ? driverStatusMeta.label : '待开通',
    licenseStatusLabelText: licenseStatusMeta ? licenseStatusMeta.label : '待提交',
    realnameNoteClass: realnameMeta && realnameMeta.tone === 'safe' ? 'hero-note hero-note--safe' : 'hero-note hero-note--warn',
    realnameStatusLabel: realnameMeta ? realnameMeta.label : '未提交',
  }
}

Page({
  data: {
    quickLoginCodes,
    authState: runtime.syncAuthState(),
    session: null,
    profile: null,
    realnameStatus: null,
    realnameMeta: null,
    driverProfile: null,
    driverStatusMeta: null,
    licenseStatus: null,
    licenseStatusMeta: null,
    profileDisplayName: '先登录一个账号',
    profileUserIdText: '--',
    realnameLabelText: '待提交',
    driverStatusLabelText: '待开通',
    licenseStatusLabelText: '待提交',
    roleSummaryText: '未返回',
    realnameNoteText: '提交后会以真实审核状态回显。',
    realnameNoteClass: 'hero-note hero-note--warn',
    realnameStatusLabel: '未提交',
    loginCode: '',
    loggingIn: false,
    savingProfile: false,
    submittingRealname: false,
    ...buildRoleView(runtime.getRolePreference()),
    profileDraft: {
      nickname: '',
      avatarUrl: '',
    },
    realnameDraft: {
      realName: '张三',
      idCardNo: '330106199001011234',
    },
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    const rolePreference = runtime.getRolePreference()
    this.setData({
      authState,
      ...buildRoleView(rolePreference),
    })
    if (!authState.token) {
      this.setData({
        session: null,
        profile: null,
        realnameStatus: null,
        realnameMeta: null,
        driverProfile: null,
        driverStatusMeta: null,
        licenseStatus: null,
        licenseStatusMeta: null,
        roleSummaryText: '未返回',
        realnameNoteText: '提交后会以真实审核状态回显。',
        ...buildProfileView({}),
      })
      return
    }
    const bundle = await runtime.loadProfileBundle()
    this.setData({
      session: bundle.session,
      profile: bundle.profile,
      realnameStatus: bundle.realnameStatus,
      realnameMeta: bundle.realnameStatus ? resolveAuthMeta(bundle.realnameStatus.authStatus) : null,
      driverProfile: bundle.driverProfile,
      driverStatusMeta: bundle.driverProfile ? resolveAuthMeta(bundle.driverProfile.driverStatus) : null,
      licenseStatus: bundle.licenseStatus,
      licenseStatusMeta: bundle.licenseStatus ? resolveAuthMeta(bundle.licenseStatus.authStatus) : null,
      roleSummaryText: bundle.session && Array.isArray(bundle.session.roles) ? bundle.session.roles.join(' / ') : '未返回',
      realnameNoteText: bundle.realnameStatus && bundle.realnameStatus.rejectReason
        ? `驳回原因：${bundle.realnameStatus.rejectReason}`
        : '提交后会以真实审核状态回显。',
      ...buildProfileView({
        profile: bundle.profile,
        realnameMeta: bundle.realnameStatus ? resolveAuthMeta(bundle.realnameStatus.authStatus) : null,
        driverStatusMeta: bundle.driverProfile ? resolveAuthMeta(bundle.driverProfile.driverStatus) : null,
        licenseStatusMeta: bundle.licenseStatus ? resolveAuthMeta(bundle.licenseStatus.authStatus) : null,
      }),
      profileDraft: {
        nickname: bundle.profile && bundle.profile.nickname ? bundle.profile.nickname : '',
        avatarUrl: bundle.profile && bundle.profile.avatarUrl ? bundle.profile.avatarUrl : '',
      },
    })
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
      this.setData({ loginCode: '' })
      runtime.showSuccess('登录成功')
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

  handleProfileInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }
    this.setData({
      profileDraft: {
        ...this.data.profileDraft,
        [field]: event.detail.value,
      },
    })
  },

  async handleSaveProfile() {
    if (!runtime.ensureLoggedIn('请先登录后更新资料')) {
      return
    }
    this.setData({ savingProfile: true })
    try {
      const result = await userService.updateProfile(this.data.profileDraft)
      const profile = result.profile || result
      this.setData({
        profile,
        profileDraft: {
          nickname: profile.nickname || '',
          avatarUrl: profile.avatarUrl || '',
        },
        ...buildProfileView({
          profile,
          realnameMeta: this.data.realnameMeta,
          driverStatusMeta: this.data.driverStatusMeta,
          licenseStatusMeta: this.data.licenseStatusMeta,
        }),
      })
      runtime.showSuccess('资料已更新')
    } catch (error) {
      runtime.handleError(error, '更新资料失败')
    } finally {
      this.setData({ savingProfile: false })
    }
  },

  handleRealnameInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }
    this.setData({
      realnameDraft: {
        ...this.data.realnameDraft,
        [field]: event.detail.value,
      },
    })
  },

  async handleSubmitRealname() {
    if (!runtime.ensureLoggedIn('请先登录后提交实名认证')) {
      return
    }
    this.setData({ submittingRealname: true })
    try {
      await userService.submitRealname(this.data.realnameDraft)
      const status = await userService.getRealnameStatus()
      this.setData({
        realnameStatus: status,
        realnameMeta: resolveAuthMeta(status.authStatus),
        realnameNoteText: status.rejectReason ? `驳回原因：${status.rejectReason}` : '提交后会以真实审核状态回显。',
        ...buildProfileView({
          profile: this.data.profile,
          realnameMeta: resolveAuthMeta(status.authStatus),
          driverStatusMeta: this.data.driverStatusMeta,
          licenseStatusMeta: this.data.licenseStatusMeta,
        }),
      })
      runtime.showSuccess('实名认证已提交')
    } catch (error) {
      runtime.handleError(error, '提交实名认证失败')
    } finally {
      this.setData({ submittingRealname: false })
    }
  },

  handleRoleChange(event) {
    const role = event.currentTarget.dataset.role
    if (!role) {
      return
    }
    runtime.setRolePreference(role)
    this.setData({
      ...buildRoleView(role),
    })
  },

  async handleLogout() {
    try {
      await authService.logout()
    } catch (error) {
      console.error('登出请求失败，继续清理本地状态', error)
    }
    runtime.clearAuthState()
    runtime.showSuccess('已退出登录')
    await this.bootstrap()
  },

  handleGoVehicles() {
    navigation.openVehicles()
  },

  handleGoLicense() {
    navigation.openLicense()
  },

  handleGoWallet() {
    navigation.openWallet()
  },
})
