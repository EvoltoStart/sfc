const { get, post, put, remove, ensureListResult } = require('../utils/request')

function getProfile() {
  return get('/api/v1/me/profile')
}

function updateProfile(payload) {
  return put('/api/v1/me/profile', payload)
}

function submitRealname(payload) {
  return post('/api/v1/me/realname/submit', payload)
}

function getRealnameStatus() {
  return get('/api/v1/me/realname/status')
}

function listEmergencyContacts() {
  return get('/api/v1/me/emergency-contacts').then(ensureListResult)
}

function createEmergencyContact(payload) {
  return post('/api/v1/me/emergency-contacts', payload)
}

function updateEmergencyContact(id, payload) {
  return put(`/api/v1/me/emergency-contacts/${id}`, payload)
}

function deleteEmergencyContact(id) {
  return remove(`/api/v1/me/emergency-contacts/${id}`)
}

module.exports = {
  getProfile,
  updateProfile,
  submitRealname,
  getRealnameStatus,
  listEmergencyContacts,
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
}
