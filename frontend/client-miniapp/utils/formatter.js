function formatMoney(fen) {
  const value = typeof fen === 'number' ? fen / 100 : 0
  return `¥${value.toFixed(2)}`
}

function formatNumber(value, fallback) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback || '--'
  }
  return `${value}`
}

function formatDateTime(value, fallback) {
  if (!value) {
    return fallback || '待更新'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return fallback || '待更新'
  }
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${month}/${day} ${hour}:${minute}`
}

function formatFullDateTime(value, fallback) {
  if (!value) {
    return fallback || '待更新'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return fallback || '待更新'
  }
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function formatDistance(meter) {
  if (typeof meter !== 'number' || meter <= 0) {
    return '待计算'
  }
  if (meter >= 1000) {
    return `${(meter / 1000).toFixed(1)} km`
  }
  return `${meter} m`
}

function formatPercent(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '--'
  }
  return `${value}%`
}

function formatRating(value, fallback) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return fallback || '新加入'
  }
  return `${value.toFixed(1)} 分`
}

function formatDate(value, fallback) {
  if (!value) {
    return fallback || '待设置'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return fallback || '待设置'
  }
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function roleLabel(role) {
  return role === 'DRIVER' ? '车主视角' : '乘客视角'
}

module.exports = {
  formatMoney,
  formatNumber,
  formatDateTime,
  formatFullDateTime,
  formatDistance,
  formatPercent,
  formatRating,
  formatDate,
  roleLabel,
}
