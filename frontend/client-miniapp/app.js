const env = require('./utils/env')
const { getAuthState, setAuthState, clearAuthState } = require('./utils/session')
const { routePresets, quickLoginCodes, faqItems } = require('./utils/route-presets')

App({
  globalData: {
    env,
    routePresets,
    quickLoginCodes,
    faqItems,
    authState: getAuthState(),
  },

  onLaunch() {
    this.syncAuthState()
  },

  syncAuthState() {
    this.globalData.authState = getAuthState()
    return this.globalData.authState
  },

  updateAuthState(patch) {
    const nextState = setAuthState(patch)
    this.globalData.authState = nextState
    return nextState
  },

  clearAuthState() {
    clearAuthState()
    this.globalData.authState = getAuthState()
    return this.globalData.authState
  },
})
