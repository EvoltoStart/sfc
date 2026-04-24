const { get, post } = require('../utils/request')

function getWxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('微信登录未返回 code'))
          return
        }
        resolve(res.code)
      },
      fail(error) {
        reject(error)
      },
    })
  })
}

async function wxLoginByWechat() {
  const code = await getWxLoginCode()
  const result = await post('/api/v1/auth/wx-login', { code }, { auth: false })
  return {
    ...result,
    loginCode: code,
  }
}

async function wxLoginByCode(code) {
  const result = await post('/api/v1/auth/wx-login', { code }, { auth: false })
  return {
    ...result,
    loginCode: code,
  }
}

function getSession() {
  return get('/api/v1/auth/session')
}

function logout() {
  return post('/api/v1/auth/logout')
}

module.exports = {
  wxLoginByWechat,
  wxLoginByCode,
  getSession,
  logout,
}
