Component({
  properties: {
    title: {
      type: String,
      value: '暂无数据',
    },
    description: {
      type: String,
      value: '完成下一步操作后会显示相关记录。',
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
