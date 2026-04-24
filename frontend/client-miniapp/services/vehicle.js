const { get, post, put, ensureListResult } = require('../utils/request')

function getDriverProfile() {
  return get('/api/v1/driver/profile')
}

function listVehicles() {
  return get('/api/v1/driver/vehicles').then(ensureListResult)
}

function createVehicle(payload) {
  return post('/api/v1/driver/vehicles', payload)
}

function updateVehicle(id, payload) {
  return put(`/api/v1/driver/vehicles/${id}`, payload)
}

function setDefaultVehicle(id) {
  return post(`/api/v1/driver/vehicles/${id}/set-default`)
}

function submitLicense(payload) {
  return post('/api/v1/driver/license/submit', payload)
}

function getLicenseStatus() {
  return get('/api/v1/driver/license/status')
}

module.exports = {
  getDriverProfile,
  listVehicles,
  createVehicle,
  updateVehicle,
  setDefaultVehicle,
  submitLicense,
  getLicenseStatus,
}
