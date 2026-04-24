Component({
  properties: {
    title: {
      type: String,
      value: '暂无数据',
    },
    description: {
      type: String,
      value: '等你完成下一步操作后，这里会出现真实结果。',
    },
    actionText: {
      type: String,
      value: '',
    },
  },

  methods: {
    handleAction() {
      this.triggerEvent('action')
    },
  },
})
