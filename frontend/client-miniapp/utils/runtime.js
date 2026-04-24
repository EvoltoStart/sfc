const authService = require('../services/auth')
const userService = require('../services/user')
const vehicleService = require('../services/vehicle')
const { getAuthState } = require('./session')

function getAppSafe() {
  try {
    return getApp()
  } catch (error) {
    return null
  }
}

function syncAuthState() {
  const app = getAppSafe()
  if (app && typeof app.syncAuthState === 'function') {
    return app.syncAuthState()
  }
  return getAuthState()
}

function updateAuthState(patch) {
  const app = getAppSafe()
  if (app && typeof app.updateAuthState === 'function') {
    return app.updateAuthState(patch)
  }
  return {
    ...getAuthState(),
    ...(patch || {}),
  }
}

function clearAuthState() {
  const app = getAppSafe()
  if (app && typeof app.clearAuthState === 'function') {
    return app.clearAuthState()
  }
  return getAuthState()
}

function showToast(title, icon) {
  wx.showToast({
    title,
    icon: icon || 'none',
    duration: 2200,
  })
}

function showSuccess(title) {
  showToast(title, 'success')
}

function handleError(error, fallbackTitle) {
  const message = error && error.message ? error.message : fallbackTitle || '操作失败'
  console.error(fallbackTitle || '请求异常', error)
  showToast(message.length > 16 ? `${message.slice(0, 15)}…` : message)
}

function ensureLoggedIn(message) {
  const authState = syncAuthState()
  if (!authState.token) {
    showToast(message || '请先登录后再操作')
    return false
  }
  return true
}

function setRolePreference(rolePreference) {
  return updateAuthState({
    rolePreference: rolePreference === 'DRIVER' ? 'DRIVER' : 'PASSENGER',
  })
}

function pickRolePreference(result, currentRolePreference) {
  const roleFlags = (result && result.roleFlags) || {}
  if (roleFlags.driver && currentRolePreference === 'DRIVER') {
    return 'DRIVER'
  }
  return 'PASSENGER'
}

async function loginByCode(code) {
  const trimmed = (code || '').trim()
  if (!trimmed) {
    throw new Error('请先输入登录 code')
  }
  const authState = syncAuthState()
  const result = await authService.wxLoginByCode(trimmed)
  const rolePreference = pickRolePreference(result, authState.rolePreference)
  updateAuthState({
    token: result.token,
    loginCode: trimmed,
    rolePreference,
  })
  return {
    ...result,
    rolePreference,
  }
}

async function loginByWechat() {
  const authState = syncAuthState()
  const result = await authService.wxLoginByWechat()
  const rolePreference = pickRolePreference(result, authState.rolePreference)
  updateAuthState({
    token: result.token,
    loginCode: result.loginCode,
    rolePreference,
  })
  return {
    ...result,
    rolePreference,
  }
}

async function loadProfileBundle() {
  const results = await Promise.allSettled([
    authService.getSession(),
    userService.getProfile(),
    userService.getRealnameStatus(),
    vehicleService.getDriverProfile(),
    vehicleService.getLicenseStatus(),
  ])

  return {
    session: results[0].status === 'fulfilled' ? results[0].value : null,
    profile: results[1].status === 'fulfilled' ? results[1].value : null,
    realnameStatus: results[2].status === 'fulfilled' ? results[2].value : null,
    driverProfile: results[3].status === 'fulfilled' ? results[3].value : null,
    licenseStatus: results[4].status === 'fulfilled' ? results[4].value : null,
  }
}

function getRolePreference() {
  const authState = syncAuthState()
  return authState.rolePreference === 'DRIVER' ? 'DRIVER' : 'PASSENGER'
}

function buildAvatarText(name) {
  const source = (name || '').trim()
  return source ? source.slice(0, 1).toUpperCase() : '顺'
}

module.exports = {
  syncAuthState,
  updateAuthState,
  clearAuthState,
  showToast,
  showSuccess,
  handleError,
  ensureLoggedIn,
  setRolePreference,
  loginByCode,
  loginByWechat,
  loadProfileBundle,
  getRolePreference,
  buildAvatarText,
}
