const { get, post, remove, ensureListResult, ensurePagedResult, buildQuery } = require('../utils/request')

function listRouteTemplates() {
  return get('/api/v1/route-templates').then(ensureListResult)
}

function createRouteTemplate(payload) {
  return post('/api/v1/route-templates', payload)
}

function deleteRouteTemplate(id) {
  return remove(`/api/v1/route-templates/${id}`)
}

function setDefaultRouteTemplate(id) {
  return post(`/api/v1/route-templates/${id}/set-default`)
}

function pricePreview(payload) {
  return post('/api/v1/trips/price-preview', payload)
}

function routeScorePreview(payload) {
  return post('/api/v1/trips/route-score-preview', payload)
}

function createTrip(payload) {
  return post('/api/v1/trips', payload)
}

function listMyTrips(status) {
  return get(`/api/v1/trips/my${buildQuery({ status, page: 1, pageSize: 20 })}`).then(ensurePagedResult)
}

function getTrip(id) {
  return get(`/api/v1/trips/${id}`)
}

function cancelTrip(id, reason) {
  return post(`/api/v1/trips/${id}/cancel`, { reason })
}

function searchMatches(payload) {
  return post('/api/v1/search/matches', payload).then(ensurePagedResult)
}

module.exports = {
  listRouteTemplates,
  createRouteTemplate,
  deleteRouteTemplate,
  setDefaultRouteTemplate,
  pricePreview,
  routeScorePreview,
  createTrip,
  listMyTrips,
  getTrip,
  cancelTrip,
  searchMatches,
}
