const { get, post, put } = require('../utils/request')

function getSafetyConfig() {
  return get('/api/v1/safety/config')
}

function updateSafetyConfig(payload) {
  return put('/api/v1/safety/config', payload)
}

function createShareLink(payload) {
  return post('/api/v1/safety/share-links', payload)
}

function createSOS(payload) {
  return post('/api/v1/safety/sos', payload)
}

function uploadTracePoints(payload) {
  return post('/api/v1/safety/trace-points/batch', payload)
}

function getTraceSummary(orderId) {
  return get(`/api/v1/safety/trace-summary/${orderId}`)
}

module.exports = {
  getSafetyConfig,
  updateSafetyConfig,
  createShareLink,
  createSOS,
  uploadTracePoints,
  getTraceSummary,
}
