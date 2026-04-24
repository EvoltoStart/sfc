const STORAGE_KEY = 'sfc-miniapp-auth-state'

const defaultState = {
  token: '',
  loginCode: '',
  rolePreference: 'PASSENGER',
}

function getAuthState() {
  const saved = wx.getStorageSync(STORAGE_KEY)
  if (!saved || typeof saved !== 'object') {
    return { ...defaultState }
  }
  return {
    token: typeof saved.token === 'string' ? saved.token : '',
    loginCode: typeof saved.loginCode === 'string' ? saved.loginCode : '',
    rolePreference: saved.rolePreference === 'DRIVER' ? 'DRIVER' : 'PASSENGER',
  }
}

function setAuthState(patch) {
  const nextState = {
    ...getAuthState(),
    ...patch,
  }
  wx.setStorageSync(STORAGE_KEY, nextState)
  return nextState
}

function clearAuthState() {
  wx.removeStorageSync(STORAGE_KEY)
}

module.exports = {
  defaultState,
  getAuthState,
  setAuthState,
  clearAuthState,
}
