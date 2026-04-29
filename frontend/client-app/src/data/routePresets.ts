export interface RoutePreset {
  id: string
  routeName: string
  startName: string
  startLat: number
  startLng: number
  endName: string
  endLat: number
  endLng: number
  timePeriod: string
  suggestion: string
  departOffsetHours: number
}

export const routePresets: RoutePreset[] = [
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
    suggestion: '适合乘客搜索和车主日常通勤演示，页面风格也与设计稿最接近。',
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
    suggestion: '这是后端测试里验证过的主链路城市组合，适合稳定联调。',
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
    suggestion: '适合验证支付、上车确认和到达确认整条履约链路。',
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
    suggestion: '适合验证车主接受申请并生成正式订单的闭环。',
    departOffsetHours: 6,
  },
  {
    id: 'hangzhou-shanghai',
    routeName: '杭州滨江 -> 上海浦东',
    startName: '杭州滨江区',
    startLat: 30.2062,
    startLng: 120.212,
    endName: '上海浦东新区',
    endLat: 31.2304,
    endLng: 121.4737,
    timePeriod: '高频往返',
    suggestion: '适合验证发布频控限制和异常提示。',
    departOffsetHours: 7,
  },
]

export interface StaticCoupon {
  id: string
  title: string
  amountText: string
  rule: string
  status: '可用' | '即将到期' | '待后端接入'
}

export const staticCoupons: StaticCoupon[] = [
  {
    id: 'coupon-1',
    title: '新客顺路立减券',
    amountText: '¥12',
    rule: '真实后端暂未开放优惠券接口，当前用于占位展示页面结构。',
    status: '待后端接入',
  },
  {
    id: 'coupon-2',
    title: '周末返程券',
    amountText: '95 折',
    rule: '后续可在支付确认页和订单页联动使用。',
    status: '待后端接入',
  },
]

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export const faqItems: FaqItem[] = [
  {
    id: 'help-1',
    question: '为什么发布行程会提示车主未认证？',
    answer: '当前后端要求驾驶证审核通过且至少存在一辆审核通过的车辆，两个条件同时满足后才能发布行程。',
  },
  {
    id: 'help-2',
    question: '安全中心现在可以验证哪些能力？',
    answer: '默认分享配置、紧急联系人、行程分享链接、SOS 上报、轨迹点上传和轨迹摘要都已经接入真实后端接口。',
  },
  {
    id: 'help-3',
    question: '本地怎么验证支付成功后的履约流程？',
    answer: '支付单创建后，可以使用页面里的“模拟支付成功”按钮触发本地开发代理，它会代你生成签名并调用真实后端回调。',
  },
]
