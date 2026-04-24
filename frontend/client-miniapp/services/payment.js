const env = require('../utils/env')
const { get, post, request } = require('../utils/request')

function createPaymentOrder(orderId) {
  return post('/api/v1/payments/orders', { orderId })
}

function getPaymentStatus(orderId) {
  return get(`/api/v1/payments/${orderId}/status`)
}

function mockPaymentCallback(outTradeNo, payStatus) {
  return request({
    url: `${env.DEV_PROXY_ORIGIN}/__dev/mock-payment-callback`,
    method: 'POST',
    data: {
      outTradeNo,
      payStatus: payStatus || 'PAID',
    },
    auth: false,
    baseUrl: '',
  })
}

module.exports = {
  createPaymentOrder,
  getPaymentStatus,
  mockPaymentCallback,
}
