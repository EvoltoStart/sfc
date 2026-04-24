export type PageKey =
  | 'login'
  | 'dashboard'
  | 'audit'
  | 'orders'
  | 'risk'
  | 'finance'
  | 'users'
  | 'ops'
  | 'content'
  | 'report'
  | 'auditlog'
  | 'tokens'

export type Tone = 'brand' | 'info' | 'success' | 'warning' | 'danger'

export interface NavItem {
  key: PageKey
  code: string
  label: string
  summary: string
}

export interface StatItem {
  label: string
  value: string
  change?: string
  tone?: Tone
}

export interface ProgressItem {
  label: string
  value: number
  tone?: Tone
}

export interface TableColumn {
  key: string
  label: string
}

export interface TableRow {
  [key: string]: string
}

export interface InfoRecord {
  title: string
  value: string
}

export interface PriorityRecord {
  title: string
  detail: string
  tone: Tone
}

export const navItems: NavItem[] = [
  { key: 'login', code: '00', label: '登录与权限', summary: '登录、会话恢复、权限矩阵' },
  { key: 'dashboard', code: '01', label: '工作台', summary: '全局态势、待办、风控热区' },
  { key: 'audit', code: '02', label: '资质审核', summary: '司机、车辆、证照审核闭环' },
  { key: 'orders', code: '03', label: '订单中心', summary: '异常检索、批量处理、详情跳转' },
  { key: 'risk', code: '04', label: '安全与风控', summary: 'SOS、超时、顺路度、录音导出' },
  { key: 'finance', code: '05', label: '财务中心', summary: '流水、提现、对账、收入结构' },
  { key: 'users', code: '06', label: '用户管理', summary: '实名、紧急联系人、投诉工单' },
  { key: 'ops', code: '07', label: '专线运营', summary: '专线司机、补贴、服务包配置' },
  { key: 'content', code: '08', label: '内容配置', summary: 'Banner、协议、客服内容发布' },
  { key: 'report', code: '09', label: '报表统计', summary: '订单、用户、财务、专线报表' },
  { key: 'auditlog', code: '10', label: '操作审计', summary: '行为追踪、请求链路、风险导出' },
  { key: 'tokens', code: '11', label: '设计 Token', summary: '颜色、排版、组件落地规范' },
]

export const commandFilters = ['全城', '今日', '专线优先', '高风险优先', '待审核优先']

export const dashboardStats: StatItem[] = [
  { label: '今日订单', value: '482', change: '+12.4%', tone: 'brand' },
  { label: '待处理工单', value: '19', change: '6 单超时', tone: 'warning' },
  { label: '风险事件', value: '7', change: '2 起升级', tone: 'danger' },
  { label: '待审核提现', value: '¥ 83,200', change: '18 笔', tone: 'info' },
]

export const orderTrend: ProgressItem[] = [
  { label: '杭州', value: 84, tone: 'brand' },
  { label: '上海', value: 68, tone: 'info' },
  { label: '义乌', value: 57, tone: 'success' },
  { label: '宁波', value: 41, tone: 'warning' },
]

export const todoQueue: PriorityRecord[] = [
  { title: '待审核司机资料', detail: '9 条资料超过 30 分钟未决策', tone: 'warning' },
  { title: '高风险订单复核', detail: '3 笔订单命中频控 + 定价双重规则', tone: 'danger' },
  { title: '提现批次复核', detail: '18 笔待审核提现需要财务确认', tone: 'info' },
]

export const dashboardRiskHeat = [
  { label: '高峰时段投诉', value: '18', tone: 'danger' as Tone },
  { label: '夜间女性乘客', value: '7', tone: 'warning' as Tone },
  { label: '超时未出发', value: '11', tone: 'warning' as Tone },
  { label: '定价偏离', value: '5', tone: 'info' as Tone },
]

export const dashboardFundInfo: InfoRecord[] = [
  { title: '平台服务费收入', value: '¥ 128,460 / 今日' },
  { title: '待对账金额', value: '¥ 7,840 / 4 笔异常' },
  { title: '提现处理中', value: '18 笔 / ¥ 83,200' },
  { title: '退款补差', value: '6 笔 / ¥ 1,920' },
]

export const auditStats: StatItem[] = [
  { label: '待审核资料', value: '36', tone: 'warning' },
  { label: '今日通过率', value: '87.2%', tone: 'success' },
  { label: '驳回重提', value: '11', tone: 'danger' },
  { label: '平均处理时长', value: '9 分钟', tone: 'info' },
]

export const auditColumns: TableColumn[] = [
  { key: 'name', label: '申请人' },
  { key: 'type', label: '审核类型' },
  { key: 'city', label: '城市' },
  { key: 'status', label: '状态' },
  { key: 'updatedAt', label: '更新时间' },
]

export const auditRows: TableRow[] = [
  { name: '王磊 / 车主', type: '驾驶证 + 行驶证', city: '杭州', status: '待审核', updatedAt: '10:28' },
  { name: '陈颖 / 司机', type: '司机实名认证', city: '上海', status: '补件中', updatedAt: '10:15' },
  { name: '刘杰 / 车主', type: '车辆年检资料', city: '宁波', status: '待复核', updatedAt: '09:42' },
  { name: '何倩 / 司机', type: '驾驶证认证', city: '义乌', status: '待审核', updatedAt: '09:30' },
]

export const auditFilters = ['待审核', '补件中', '高风险资料', '杭州', '驾驶证']

export const auditCandidateInfo: InfoRecord[] = [
  { title: '证件完整度', value: '92%' },
  { title: '历史驳回', value: '1 次' },
  { title: '账号状态', value: '正常，可发布' },
  { title: '关联车辆', value: '浙A·8X2P6 / 审核中' },
]

export const auditHistory = [
  '2026-04-24 10:28 提交补件，补传驾驶证副页与行驶证照片',
  '2026-04-18 16:42 因证件边缘缺失被驳回',
  '2026-04-18 15:13 初次提交资料',
]

export const orderStats: StatItem[] = [
  { label: '待出发订单', value: '126', tone: 'brand' },
  { label: '异常取消', value: '14', tone: 'danger' },
  { label: '待支付', value: '23', tone: 'warning' },
  { label: '投诉处理中', value: '9', tone: 'info' },
]

export const orderColumns: TableColumn[] = [
  { key: 'orderNo', label: '订单号' },
  { key: 'route', label: '线路' },
  { key: 'status', label: '履约状态' },
  { key: 'risk', label: '风险标签' },
  { key: 'payment', label: '支付状态' },
  { key: 'operator', label: '当前处理人' },
]

export const orderRows: TableRow[] = [
  { orderNo: 'SFC202604240012', route: '杭州西湖 → 上海虹桥', status: '待出发', risk: '频控预警', payment: '已支付', operator: '运营 02' },
  { orderNo: 'SFC202604240015', route: '义乌商贸城 → 杭州东站', status: '申诉中', risk: '投诉升级', payment: '退款中', operator: '客服 07' },
  { orderNo: 'SFC202604240018', route: '宁波南站 → 上海浦东', status: '已完成', risk: '低风险', payment: '已结算', operator: '系统' },
  { orderNo: 'SFC202604240021', route: '杭州滨江 → 苏州工业园', status: '待支付', risk: '定价偏离', payment: '待支付', operator: '运营 01' },
]

export const orderFilters = ['今日', '待出发', '退款中', '高风险', '专线订单']

export const orderSelectedInfo: InfoRecord[] = [
  { title: '订单号', value: 'SFC202604240015' },
  { title: '司乘信息', value: '乘客王某 / 司机李某' },
  { title: '发车时间', value: '2026-04-24 11:30' },
  { title: '当前处理人', value: '客服 07' },
]

export const orderTimeline = [
  '10:22 乘客发起退款申请，原因：司机临时更换车型',
  '10:30 客服接入，补充沟通录音摘要',
  '10:46 风控命中投诉升级规则，转人工复核',
  '11:02 财务冻结结算，等待裁决结果',
]

export const orderFinanceInfo: InfoRecord[] = [
  { title: '乘客支付', value: '¥ 126.00' },
  { title: '平台服务费', value: '¥ 12.60' },
  { title: '司机结算状态', value: '冻结中' },
  { title: '退款进度', value: '待客服裁决' },
]

export const riskStats: StatItem[] = [
  { label: 'SOS 事件', value: '2', tone: 'danger' },
  { label: '超时预警', value: '11', tone: 'warning' },
  { label: '顺路度异常', value: '5', tone: 'info' },
  { label: '录音导出申请', value: '8', tone: 'brand' },
]

export const riskPanels: PriorityRecord[] = [
  { title: 'SOS 事件墙', detail: '优先展示待处理中的 SOS，要求一键跳转订单详情与轨迹回放。', tone: 'danger' },
  { title: '超时预警', detail: '按城市、线路、司乘角色维度快速筛选，减少人工定位路径。', tone: 'warning' },
  { title: '规则命中记录', detail: '顺路度、频控、定价日志统一放在同一阅读链路，便于比对。', tone: 'info' },
]

export const riskTabs = ['SOS记录', '超时预警', '顺路度', '频控日志', '定价日志', '轨迹回放', '录音调取', '规则配置']

export const riskEventRows: TableRow[] = [
  { type: 'SOS', target: 'SFC202604240031', city: '杭州', status: '处理中', owner: '风控 02' },
  { type: '超时', target: 'SFC202604240015', city: '义乌', status: '待复核', owner: '风控 03' },
  { type: '定价', target: 'SFC202604240021', city: '杭州', status: '已拦截', owner: '系统' },
]

export const riskEventColumns: TableColumn[] = [
  { key: 'type', label: '事件类型' },
  { key: 'target', label: '关联单号' },
  { key: 'city', label: '城市' },
  { key: 'status', label: '状态' },
  { key: 'owner', label: '处理人' },
]

export const riskDetailInfo: InfoRecord[] = [
  { title: '轨迹回放', value: '已生成 12 个定位点，支持导出' },
  { title: '录音摘要', value: '已申请导出，需二次授权' },
  { title: '规则命中', value: '夜间女性乘客 + 行程超时' },
  { title: '处置建议', value: '优先联系乘客，必要时冻结司机接单' },
]

export const financeStats: StatItem[] = [
  { label: '今日平台收入', value: '¥ 128,460', change: '+8.6%', tone: 'success' },
  { label: '待审核提现', value: '¥ 83,200', change: '18 笔', tone: 'warning' },
  { label: '异常账务', value: '¥ 7,840', change: '4 笔待对账', tone: 'danger' },
  { label: '订阅收入', value: '¥ 24,300', change: '本月累计', tone: 'info' },
]

export const financeColumns: TableColumn[] = [
  { key: 'ledgerNo', label: '流水号' },
  { key: 'bizType', label: '业务类型' },
  { key: 'amount', label: '金额' },
  { key: 'status', label: '状态' },
  { key: 'operator', label: '操作人' },
  { key: 'time', label: '时间' },
]

export const financeRows: TableRow[] = [
  { ledgerNo: 'LG240424001', bizType: '平台服务费', amount: '+ ¥ 218.00', status: '已入账', operator: '系统清分', time: '10:20' },
  { ledgerNo: 'LG240424007', bizType: '司机提现', amount: '- ¥ 5,000.00', status: '待审核', operator: '财务 03', time: '10:08' },
  { ledgerNo: 'LG240424011', bizType: '退款补差', amount: '- ¥ 86.00', status: '待对账', operator: '客服 05', time: '09:46' },
  { ledgerNo: 'LG240424014', bizType: '信息服务订阅', amount: '+ ¥ 699.00', status: '已结算', operator: '系统', time: '09:15' },
]

export const withdrawQueue: PriorityRecord[] = [
  { title: '司机李某提现', detail: '¥ 5,000，近 7 日首次提现，资料完整', tone: 'info' },
  { title: '司机周某提现', detail: '¥ 8,800，命中高额提现复核规则', tone: 'warning' },
  { title: '司机韩某提现', detail: '¥ 12,000，历史投诉 2 次，建议复核', tone: 'danger' },
]

export const financeReconInfo: InfoRecord[] = [
  { title: '待对账订单', value: '4 笔异常单' },
  { title: '订阅收入', value: '本月 ¥ 24,300' },
  { title: '资源占用费', value: '本月 ¥ 12,680' },
  { title: '导出权限', value: '仅财务主管可全量导出' },
]

export const userStats: StatItem[] = [
  { label: '实名认证通过', value: '4,382', tone: 'success' },
  { label: '紧急联系人缺失', value: '123', tone: 'warning' },
  { label: '近 7 日投诉', value: '32', tone: 'danger' },
  { label: '冻结账号', value: '17', tone: 'info' },
]

export const userColumns: TableColumn[] = [
  { key: 'user', label: '用户' },
  { key: 'role', label: '角色' },
  { key: 'realname', label: '实名状态' },
  { key: 'contact', label: '紧急联系人' },
  { key: 'complaint', label: '投诉摘要' },
]

export const userRows: TableRow[] = [
  { user: '王某 / 138****2231', role: '乘客', realname: '已实名', contact: '已填写', complaint: '7 日内 2 次' },
  { user: '李某 / 139****6128', role: '司机', realname: '待复核', contact: '已填写', complaint: '无' },
  { user: '何某 / 137****9183', role: '车主', realname: '异常', contact: '缺失', complaint: '1 次升级' },
]

export const userDetailInfo: InfoRecord[] = [
  { title: '实名认证', value: '身份证与司机认证状态不一致' },
  { title: '紧急联系人', value: '张女士 / 妻子 / 136****1992' },
  { title: '近 30 日订单', value: '18 单' },
  { title: '客服工单', value: '投诉单 2 条，退款单 1 条' },
]

export const opsStats: StatItem[] = [
  { label: '运行专线', value: '16', tone: 'brand' },
  { label: '补贴中的线路', value: '5', tone: 'warning' },
  { label: '服务包在线', value: '12', tone: 'success' },
  { label: '客服值守组', value: '4', tone: 'info' },
]

export const opsLineInfo: InfoRecord[] = [
  { title: '重点线路', value: '杭州 → 上海 / 今日 132 单' },
  { title: '补贴策略', value: '早高峰每单补贴 ¥ 8' },
  { title: '司机覆盖', value: '活跃司机 68 / 缺口 12' },
  { title: '客服值守', value: '专线客服 A 组在线' },
]

export const opsPackageCards: PriorityRecord[] = [
  { title: '通勤包', detail: '周一至周五固定通勤，复购率 61%', tone: 'success' },
  { title: '商务包', detail: '高客单价，退款率偏高，需要优化说明', tone: 'warning' },
  { title: '夜间安心包', detail: '女性乘客占比高，需联动安全策略', tone: 'danger' },
]

export const contentStats: StatItem[] = [
  { label: '线上 Banner', value: '8', tone: 'brand' },
  { label: '待发布草稿', value: '5', tone: 'warning' },
  { label: '协议版本', value: '11', tone: 'info' },
  { label: '帮助中心条目', value: '42', tone: 'success' },
]

export const bannerColumns: TableColumn[] = [
  { key: 'name', label: '内容名称' },
  { key: 'channel', label: '投放位置' },
  { key: 'status', label: '状态' },
  { key: 'operator', label: '最后编辑' },
  { key: 'updatedAt', label: '更新时间' },
]

export const bannerRows: TableRow[] = [
  { name: '五一专线活动', channel: '首页 Banner', status: '待发布', operator: '运营 03', updatedAt: '10:12' },
  { name: '夜间安全提示', channel: '安全中心', status: '已上线', operator: '内容 01', updatedAt: '09:48' },
  { name: '客服联系方式更新', channel: '帮助中心', status: '草稿', operator: '内容 02', updatedAt: '09:30' },
]

export const publishFlow = ['草稿编辑', '预览校对', '审批确认', '发布上线']

export const reportStats: StatItem[] = [
  { label: '订单报表', value: '12', tone: 'brand' },
  { label: '财务看板', value: '8', tone: 'success' },
  { label: '用户趋势', value: '5', tone: 'info' },
  { label: '专线周报', value: '4', tone: 'warning' },
]

export const reportProgress: ProgressItem[] = [
  { label: '订单完成率', value: 83, tone: 'success' },
  { label: '退款率', value: 19, tone: 'danger' },
  { label: '新用户增长', value: 62, tone: 'brand' },
  { label: '专线复购率', value: 47, tone: 'info' },
]

export const reportExports: InfoRecord[] = [
  { title: '订单周报', value: '生成中，预计 2 分钟' },
  { title: '财务对账单', value: '已完成，可下载' },
  { title: '专线月报', value: '等待排队' },
  { title: '用户增长图表', value: '昨日 23:58 自动生成' },
]

export const auditLogStats: StatItem[] = [
  { label: '今日审计日志', value: '1,284', tone: 'brand' },
  { label: '高风险导出', value: '3', tone: 'danger' },
  { label: '异常请求', value: '9', tone: 'warning' },
  { label: 'Request ID 检索', value: '实时', tone: 'info' },
]

export const auditLogColumns: TableColumn[] = [
  { key: 'time', label: '时间' },
  { key: 'actor', label: '操作人' },
  { key: 'action', label: '行为' },
  { key: 'requestId', label: 'Request ID' },
  { key: 'risk', label: '风险等级' },
]

export const auditLogRows: TableRow[] = [
  { time: '10:28', actor: '财务 03', action: '审核提现批次', requestId: 'req_240424_001', risk: '中' },
  { time: '10:19', actor: '运营 02', action: '导出高风险订单', requestId: 'req_240424_002', risk: '高' },
  { time: '09:57', actor: '审核 04', action: '驳回司机资料', requestId: 'req_240424_003', risk: '低' },
]

export const auditTimeline = [
  '10:28 财务 03 发起提现审核',
  '10:19 运营 02 导出高风险订单列表',
  '09:57 审核专员 04 驳回司机资料',
  '09:41 系统任务执行日报汇总',
]

export const tokenGroups = [
  {
    title: '颜色系统',
    lines: ['品牌绿 `#0f766e`', '墨色文字 `#0f172a`', '背景雾白 `#edf3f8`', '风险红 `#dc2626`'],
  },
  {
    title: '布局系统',
    lines: ['侧边栏宽度 248px', '顶部条高度 72px', '桌面间距 16px', '表格行高 44px'],
  },
  {
    title: '组件落地方向',
    lines: ['BasicLayout', 'PageHeader', 'KpiCard', 'SearchForm', 'DataTable', 'AuditDrawer'],
  },
]

export const colorTokens = [
  { name: 'Brand', value: '#0f766e' },
  { name: 'Ink', value: '#0f172a' },
  { name: 'Info', value: '#2563eb' },
  { name: 'Warning', value: '#d97706' },
  { name: 'Danger', value: '#dc2626' },
  { name: 'Canvas', value: '#edf3f8' },
]

export const typeTokens: InfoRecord[] = [
  { title: '标题字体', value: 'Space Grotesk / IBM Plex Sans' },
  { title: '正文字体', value: 'IBM Plex Sans / PingFang SC / Microsoft YaHei' },
  { title: '数字字体', value: 'IBM Plex Mono / JetBrains Mono' },
  { title: '字号节奏', value: '11 / 12 / 14 / 16 / 24 / 30 / 52' },
]

export const componentTokens: PriorityRecord[] = [
  { title: 'BasicLayout', detail: '侧边导航 + 顶部命令条 + 内容工作区', tone: 'brand' },
  { title: 'MetricCard', detail: '指标卡统一数值、环比、语义色表达', tone: 'info' },
  { title: 'AuditDrawer', detail: '审核与风控都优先使用右侧详情抽屉', tone: 'warning' },
  { title: 'DataTable', detail: '列表页统一表头、密度、横向滚动策略', tone: 'success' },
]
