const env = require('./env')
const { getAuthState, clearAuthState } = require('./session')

function buildQuery(params) {
  const parts = []
  Object.keys(params || {}).forEach((key) => {
    const value = params[key]
    if (value === '' || value === null || value === undefined) {
      return
    }
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  })
  return parts.length ? `?${parts.join('&')}` : ''
}

function createApiError(message, extra) {
  const error = new Error(message || '请求失败')
  Object.assign(error, extra || {})
  return error
}

function parseResponsePayload(payload) {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload)
    } catch (error) {
      return payload
    }
  }
  return payload
}

function ensureList(value) {
  return Array.isArray(value) ? value : []
}

function ensureListResult(result) {
  return {
    ...(result || {}),
    list: ensureList(result && result.list),
  }
}

function ensurePagedResult(result) {
  const normalized = ensureListResult(result || {})
  return {
    list: normalized.list,
    page: typeof result?.page === 'number' ? result.page : 1,
    pageSize: typeof result?.pageSize === 'number' ? result.pageSize : 20,
    total: typeof result?.total === 'number' ? result.total : normalized.list.length,
  }
}

function buildRequestUrls(url, baseUrl) {
  if (/^https?:\/\//.test(url)) {
    return [url]
  }

  const baseUrls = []
  const addBaseUrl = (value) => {
    if (!value || baseUrls.indexOf(value) >= 0) {
      return
    }
    baseUrls.push(value)
  }

  addBaseUrl(baseUrl)

  if (baseUrl === env.API_BASE_URL) {
    ensureList(env.API_BASE_URL_FALLBACKS).forEach(addBaseUrl)
  }

  return baseUrls.map((value) => `${value}${url}`)
}

function request(options) {
  const {
    url,
    method = 'GET',
    data,
    auth = true,
    baseUrl = env.API_BASE_URL,
    headers = {},
  } = options

  const authState = getAuthState()
  const finalHeaders = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Client-Type': 'miniapp',
    ...headers,
  }

  if (auth && authState.token) {
    finalHeaders.Authorization = `Bearer ${authState.token}`
  }

  return new Promise((resolve, reject) => {
    const requestUrls = buildRequestUrls(url, baseUrl)

    const execute = (index) => {
      wx.request({
        url: requestUrls[index],
        method,
        data,
        header: finalHeaders,
        success(res) {
          const payload = parseResponsePayload(res.data)

          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            reject(
              createApiError('服务返回了无法识别的响应', {
                status: res.statusCode,
                payload,
                requestUrl: requestUrls[index],
              }),
            )
            return
          }

          if (payload.code !== 0) {
            if (payload.code === 'USER_NOT_LOGIN' || res.statusCode === 401) {
              clearAuthState()
            }
            reject(
              createApiError(payload.message || '请求失败', {
                code: payload.code,
                requestId: payload.requestId || '',
                status: res.statusCode,
                payload,
                requestUrl: requestUrls[index],
              }),
            )
            return
          }

          resolve(payload.data)
        },
        fail(error) {
          if (index < requestUrls.length - 1) {
            execute(index + 1)
            return
          }

          reject(
            createApiError('网络请求失败，请检查服务是否已启动', {
              status: 0,
              reason: error,
              requestUrls,
            }),
          )
        },
      })
    }

    execute(0)
  })
}

function get(url, data, options) {
  return request({
    url: `${url}${buildQuery(data || {})}`,
    method: 'GET',
    ...(options || {}),
  })
}

function post(url, data, options) {
  return request({
    url,
    method: 'POST',
    data,
    ...(options || {}),
  })
}

function put(url, data, options) {
  return request({
    url,
    method: 'PUT',
    data,
    ...(options || {}),
  })
}

function remove(url, data, options) {
  return request({
    url,
    method: 'DELETE',
    data,
    ...(options || {}),
  })
}

module.exports = {
  buildQuery,
  createApiError,
  ensureList,
  ensureListResult,
  ensurePagedResult,
  buildRequestUrls,
  request,
  get,
  post,
  put,
  remove,
}
