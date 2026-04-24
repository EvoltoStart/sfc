const env = require('./env')
const { routePresets, buildSearchDraft, buildPublishDraft } = require('./route-presets')

const defaultSearchDraft = buildSearchDraft(routePresets[0])
const defaultPublishDraft = buildPublishDraft(routePresets[0])
const LAST_SEARCH_KEY = 'sfc-miniapp-last-search-payload'

function normalizeSearchDraft(input) {
  const draft = {
    ...defaultSearchDraft,
    ...(input || {}),
  }
  draft.minRouteScore = Number(draft.minRouteScore) || defaultSearchDraft.minRouteScore
  return draft
}

function normalizePublishDraft(input) {
  const draft = {
    ...defaultPublishDraft,
    ...(input || {}),
  }
  draft.seatTotal = Number(draft.seatTotal) || defaultPublishDraft.seatTotal
  draft.vehicleId = Number(draft.vehicleId) || 0
  return draft
}

function loadStorageObject(key, fallbackValue) {
  const saved = wx.getStorageSync(key)
  if (!saved || typeof saved !== 'object') {
    return fallbackValue
  }
  return saved
}

function loadSearchDraft() {
  return normalizeSearchDraft(loadStorageObject(env.SEARCH_DRAFT_KEY, defaultSearchDraft))
}

function saveSearchDraft(draft) {
  const nextDraft = normalizeSearchDraft(draft)
  wx.setStorageSync(env.SEARCH_DRAFT_KEY, nextDraft)
  return nextDraft
}

function loadPublishDraft() {
  return normalizePublishDraft(loadStorageObject(env.PUBLISH_DRAFT_KEY, defaultPublishDraft))
}

function savePublishDraft(draft) {
  const nextDraft = normalizePublishDraft(draft)
  wx.setStorageSync(env.PUBLISH_DRAFT_KEY, nextDraft)
  return nextDraft
}

function saveLastSearchPayload(payload) {
  wx.setStorageSync(LAST_SEARCH_KEY, payload || {})
}

function loadLastSearchPayload() {
  return loadStorageObject(LAST_SEARCH_KEY, {})
}

module.exports = {
  defaultSearchDraft,
  defaultPublishDraft,
  loadSearchDraft,
  saveSearchDraft,
  loadPublishDraft,
  savePublishDraft,
  saveLastSearchPayload,
  loadLastSearchPayload,
}
