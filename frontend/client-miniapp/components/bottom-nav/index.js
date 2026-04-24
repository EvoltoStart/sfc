const navigation = require('../../utils/navigation')

function buildItems(active) {
  const current = active || 'home'
  return [
    { key: 'home', label: '首页', hint: '找同行', activeClass: current === 'home' ? 'bottom-nav__item--active' : '' },
    { key: 'order', label: '订单', hint: '看进度', activeClass: current === 'order' ? 'bottom-nav__item--active' : '' },
    { key: 'publish', label: '发布', hint: '发车程', activeClass: current === 'publish' ? 'bottom-nav__item--active' : '' },
    { key: 'safety', label: '安全', hint: '守护中', activeClass: current === 'safety' ? 'bottom-nav__item--active' : '' },
    { key: 'profile', label: '我的', hint: '账号与认证', activeClass: current === 'profile' ? 'bottom-nav__item--active' : '' },
  ]
}

Component({
  properties: {
    active: {
      type: String,
      value: 'home',
    },
  },

  data: {
    items: buildItems('home'),
  },

  observers: {
    active(value) {
      this.setData({
        items: buildItems(value),
      })
    },
  },

  methods: {
    handleTap(event) {
      const key = event.currentTarget.dataset.key
      if (!key || key === this.properties.active) {
        return
      }
      navigation.openPrimaryPage(key).catch((error) => {
        console.error('导航失败', error)
      })
    },
  },
})
