const { get, post } = require('../utils/request')

function createPaymentOrder(orderId) {
  return post('/api/v1/payments/orders', { orderId })
}

function getPaymentStatus(orderId) {
  return get(`/api/v1/payments/${orderId}/status`)
}

function mockPaymentCallback(outTradeNo, payStatus) {
  return post(
    '/__dev/mock-payment-callback',
    {
      outTradeNo,
      payStatus: payStatus || 'PAID',
    },
    { auth: false },
  )
}

module.exports = {
  createPaymentOrder,
  getPaymentStatus,
  mockPaymentCallback,
}
