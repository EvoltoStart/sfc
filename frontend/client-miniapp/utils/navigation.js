const primaryPageMap = {
  home: '/pages/home/index',
  order: '/pages/order/index',
  publish: '/pages/publish/index',
  safety: '/pages/safety/index',
  profile: '/pages/profile/index',
}

function buildQuery(params) {
  const pairs = []
  Object.keys(params || {}).forEach((key) => {
    const value = params[key]
    if (value === '' || value === null || value === undefined) {
      return
    }
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  })
  return pairs.length ? `?${pairs.join('&')}` : ''
}

function withQuery(url, params) {
  return `${url}${buildQuery(params)}`
}

function currentRoute() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  return current ? `/${current.route}` : ''
}

function reLaunch(url) {
  return new Promise((resolve, reject) => {
    wx.reLaunch({
      url,
      success: resolve,
      fail: reject,
    })
  })
}

function navigateTo(url) {
  return new Promise((resolve, reject) => {
    wx.navigateTo({
      url,
      success: resolve,
      fail: reject,
    })
  })
}

function redirectTo(url) {
  return new Promise((resolve, reject) => {
    wx.redirectTo({
      url,
      success: resolve,
      fail: reject,
    })
  })
}

function openPrimaryPage(key) {
  const url = primaryPageMap[key] || primaryPageMap.home
  if (currentRoute() === url) {
    return Promise.resolve()
  }
  return reLaunch(url)
}

function openMatchList(params) {
  return navigateTo(withQuery('/packages/passenger/match-list/index', params))
}

function openTripDetail(params) {
  return navigateTo(withQuery('/packages/passenger/trip-detail/index', params))
}

function openPaymentConfirm(params) {
  return navigateTo(withQuery('/packages/passenger/payment-confirm/index', params))
}

function openOrderDetail(params) {
  return navigateTo(withQuery('/packages/common/order-detail/index', params))
}

function openVehicles(params) {
  return navigateTo(withQuery('/packages/driver/vehicles/index', params))
}

function openLicense(params) {
  return navigateTo(withQuery('/packages/driver/license/index', params))
}

function openWallet(params) {
  return navigateTo(withQuery('/packages/driver/wallet/index', params))
}

function replaceOrderDetail(params) {
  return redirectTo(withQuery('/packages/common/order-detail/index', params))
}

function goBackOrHome(fallbackKey) {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    wx.navigateBack()
    return Promise.resolve()
  }
  return openPrimaryPage(fallbackKey || 'home')
}

module.exports = {
  buildQuery,
  primaryPageMap,
  openPrimaryPage,
  openMatchList,
  openTripDetail,
  openPaymentConfirm,
  openOrderDetail,
  openVehicles,
  openLicense,
  openWallet,
  replaceOrderDetail,
  goBackOrHome,
}
