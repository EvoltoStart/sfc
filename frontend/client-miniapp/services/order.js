const { get, post, ensurePagedResult, buildQuery } = require('../utils/request')

function createJoinRequest(payload) {
  return post('/api/v1/join-requests', payload)
}

function listMyJoinRequests(status) {
  return get(`/api/v1/join-requests/my${buildQuery({ status, page: 1, pageSize: 20 })}`).then(ensurePagedResult)
}

function getJoinRequest(id) {
  return get(`/api/v1/join-requests/${id}`)
}

function cancelJoinRequest(id, reason) {
  return post(`/api/v1/join-requests/${id}/cancel`, { reason })
}

function listDriverJoinRequests(tripId, status) {
  return get(`/api/v1/driver/join-requests${buildQuery({ tripId, status, page: 1, pageSize: 20 })}`).then(ensurePagedResult)
}

function acceptJoinRequest(id, remark) {
  return post(`/api/v1/driver/join-requests/${id}/accept`, { remark })
}

function rejectJoinRequest(id, reason) {
  return post(`/api/v1/driver/join-requests/${id}/reject`, { reason })
}

function listOrders(role, status) {
  return get(`/api/v1/orders${buildQuery({ role, status, page: 1, pageSize: 20 })}`).then(ensurePagedResult)
}

function getOrder(id) {
  return get(`/api/v1/orders/${id}`)
}

function confirmBoard(id) {
  return post(`/api/v1/orders/${id}/confirm-board`)
}

function confirmArrival(id) {
  return post(`/api/v1/orders/${id}/confirm-arrival`)
}

function cancelOrder(id, reason) {
  return post(`/api/v1/orders/${id}/cancel`, { reason })
}

module.exports = {
  createJoinRequest,
  listMyJoinRequests,
  getJoinRequest,
  cancelJoinRequest,
  listDriverJoinRequests,
  acceptJoinRequest,
  rejectJoinRequest,
  listOrders,
  getOrder,
  confirmBoard,
  confirmArrival,
  cancelOrder,
}
