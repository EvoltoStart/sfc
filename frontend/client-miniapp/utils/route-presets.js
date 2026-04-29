const routePresets = [
  {
    id: 'yiwu-hangzhou',
    routeName: '义乌国际商贸城 -> 杭州东站',
    startName: '义乌国际商贸城五区',
    startLat: 29.3124,
    startLng: 120.0828,
    endName: '杭州东站',
    endLat: 30.2907,
    endLng: 120.2124,
    timePeriod: '午后返程',
    suggestion: '适合乘客搜索和车主通勤场景演示。',
    departOffsetHours: 3,
  },
  {
    id: 'shenzhen-guangzhou',
    routeName: '深圳南山 -> 广州天河',
    startName: '深圳南山科技园',
    startLat: 22.5333,
    startLng: 113.9304,
    endName: '广州天河体育中心',
    endLat: 23.1291,
    endLng: 113.2644,
    timePeriod: '工作日晚高峰',
    suggestion: '适合验证搜索、匹配和支付主链路。',
    departOffsetHours: 4,
  },
  {
    id: 'beijing-tianjin',
    routeName: '北京朝阳 -> 天津和平',
    startName: '北京朝阳公园',
    startLat: 39.9219,
    startLng: 116.4436,
    endName: '天津和平区',
    endLat: 39.1172,
    endLng: 117.2,
    timePeriod: '城际顺风车',
    suggestion: '适合验证支付后履约与完成结算。',
    departOffsetHours: 5,
  },
  {
    id: 'suzhou-nanjing',
    routeName: '苏州工业园区 -> 南京鼓楼',
    startName: '苏州工业园区',
    startLat: 31.2989,
    startLng: 120.5853,
    endName: '南京鼓楼',
    endLat: 32.0603,
    endLng: 118.7969,
    timePeriod: '周末城际',
    suggestion: '适合验证车主接受申请并生成真实订单。',
    departOffsetHours: 6,
  },
  {
    id: 'hangzhou-shanghai',
    routeName: '杭州滨江 -> 上海浦东',
    startName: '杭州滨江',
    startLat: 30.2062,
    startLng: 120.212,
    endName: '上海浦东新区',
    endLat: 31.2304,
    endLng: 121.4737,
    timePeriod: '高频往返',
    suggestion: '适合验证频控与规则提示。',
    departOffsetHours: 7,
  },
]

const quickLoginCodes = [
  { label: '乘客 A', code: 'passenger-alpha' },
  { label: '乘客 B', code: 'passenger-beta' },
  { label: '车主 A', code: 'driver-alpha' },
  { label: '车主 B', code: 'driver-beta' },
]

const faqItems = [
  {
    id: 'faq-1',
    question: '为什么发布行程时提示车主未认证？',
    answer: '当前后端要求驾驶证审核通过，且至少存在一辆审核通过的车辆，两个条件同时满足后才能发布行程。',
  },
  {
    id: 'faq-2',
    question: '安全中心现在可以验证哪些真实能力？',
    answer: '紧急联系人、安全配置、行程分享链接、SOS 上报、轨迹批量上传和轨迹摘要查询都已接入真实后端；需要先登录并生成订单后再验证订单级动作。',
  },
  {
    id: 'faq-3',
    question: '本地怎么验证支付成功后的履约流程？',
    answer: '支付单创建后，可使用支付页里的“模拟支付成功”，它会走本地开发代理转发到真实后端回调。',
  },
]

function pad(value) {
  return String(value).padStart(2, '0')
}

function toDateTimeParts(date) {
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  }
}

function getRoutePreset(presetId) {
  return routePresets.find((item) => item.id === presetId) || routePresets[0]
}

function buildSearchDraft(preset) {
  const nextDate = new Date()
  nextDate.setHours(nextDate.getHours() + preset.departOffsetHours, 20, 0, 0)
  const dateTime = toDateTimeParts(nextDate)
  return {
    presetId: preset.id,
    startName: preset.startName,
    startLat: preset.startLat,
    startLng: preset.startLng,
    endName: preset.endName,
    endLat: preset.endLat,
    endLng: preset.endLng,
    departDate: dateTime.date,
    departTime: dateTime.time,
    minRouteScore: 80,
  }
}

function buildPublishDraft(preset) {
  const nextDate = new Date()
  nextDate.setHours(nextDate.getHours() + preset.departOffsetHours + 1, 10, 0, 0)
  const dateTime = toDateTimeParts(nextDate)
  return {
    presetId: preset.id,
    startName: preset.startName,
    startLat: preset.startLat,
    startLng: preset.startLng,
    endName: preset.endName,
    endLat: preset.endLat,
    endLng: preset.endLng,
    departDate: dateTime.date,
    departTime: dateTime.time,
    seatTotal: 3,
    vehicleId: 0,
  }
}

function toIsoString(datePart, timePart) {
  return new Date(`${datePart}T${timePart}:00`).toISOString()
}

module.exports = {
  routePresets,
  quickLoginCodes,
  faqItems,
  getRoutePreset,
  buildSearchDraft,
  buildPublishDraft,
  toIsoString,
}
