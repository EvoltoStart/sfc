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
    suggestion: '午后返程需求稳定，适合快速找到同向车主。',
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
    suggestion: '工作日晚高峰车流密集，建议提前筛选顺路度更高的行程。',
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
    suggestion: '城际距离较长，建议优先选择评价稳定且座位充足的车主。',
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
    suggestion: '周末跨城出行集中，建议先确认上车点和行李空间。',
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
    suggestion: '高频往返线路，建议关注发车时间和剩余座位。',
    departOffsetHours: 7,
  },
]

export interface StaticCoupon {
  id: string
  title: string
  amountText: string
  rule: string
  status: '可用' | '即将到期' | '已使用'
}

export const staticCoupons: StaticCoupon[] = [
  {
    id: 'coupon-1',
    title: '新客顺路立减券',
    amountText: '¥12',
    rule: '适用于 30 元以上同行订单，支付时自动抵扣。',
    status: '可用',
  },
  {
    id: 'coupon-2',
    title: '周末返程券',
    amountText: '95 折',
    rule: '周五 18:00 至周日 23:59 出发的城际订单可用。',
    status: '即将到期',
  },
  {
    id: 'coupon-3',
    title: '安全同行券',
    amountText: '¥8',
    rule: '完成实名认证后可用于下一笔夜间同行订单。',
    status: '可用',
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
    answer: '发布前需要驾驶证审核通过，并至少有一辆审核通过的车辆。',
  },
  {
    id: 'help-2',
    question: '行程中遇到异常怎么办？',
    answer: '订单详情页保留分享、SOS 和联系入口，紧急联系人与平台安全岗会收到必要的行程信息。',
  },
  {
    id: 'help-3',
    question: '支付后费用什么时候结算给车主？',
    answer: '乘客确认上车与到达后，系统按订单状态完成结算，取消或异常订单会进入退款处理。',
  },
]
