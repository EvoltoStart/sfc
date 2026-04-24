const userService = require('../../services/user')
const runtime = require('../../utils/runtime')
const navigation = require('../../utils/navigation')
const { faqItems } = require('../../utils/route-presets')

const capabilityCards = [
  {
    title: '紧急联系人',
    description: '已接入真实接口，可以新增、删除默认联系人。',
    tone: 'safe',
  },
  {
    title: '行程分享',
    description: '后端能力未开放，当前页面只做说明，不会假装已开启。',
    tone: 'warn',
  },
  {
    title: 'SOS / 轨迹留痕',
    description: '等待后端开放真实能力后再补入口，目前保留状态说明。',
    tone: 'warn',
  },
]

capabilityCards.forEach((item) => {
  item.toneLabel = item.tone === 'safe' ? '已接入' : '待开放'
  item.noteClass = item.tone === 'safe' ? 'hero-note--safe' : 'hero-note--warn'
})

function mapContact(item) {
  return {
    ...item,
    defaultChipClass: item.isDefault ? 'chip chip--active' : 'chip chip--soft',
    defaultLabel: item.isDefault ? '默认联系人' : '备用联系人',
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    faqItems,
    capabilityCards,
    contacts: [],
    contactDraft: {
      name: '家人',
      mobile: '13800138000',
      relation: '父母',
      isDefault: true,
    },
    loading: false,
    submitting: false,
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    this.setData({ authState })
    if (!authState.token) {
      this.setData({ contacts: [] })
      return
    }
    this.setData({ loading: true })
    try {
      const result = await userService.listEmergencyContacts()
      this.setData({
        contacts: (result.list || []).map(mapContact),
      })
    } catch (error) {
      runtime.handleError(error, '加载联系人失败')
    } finally {
      this.setData({ loading: false })
    }
  },

  handleDraftInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) {
      return
    }
    this.setData({
      contactDraft: {
        ...this.data.contactDraft,
        [field]: event.detail.value,
      },
    })
  },

  handleDefaultChange(event) {
    this.setData({
      contactDraft: {
        ...this.data.contactDraft,
        isDefault: !!event.detail.value,
      },
    })
  },

  async handleCreateContact() {
    if (!runtime.ensureLoggedIn('请先登录后管理联系人')) {
      return
    }
    this.setData({ submitting: true })
    try {
      await userService.createEmergencyContact(this.data.contactDraft)
      runtime.showSuccess('紧急联系人已保存')
      this.setData({
        contactDraft: {
          name: '朋友',
          mobile: '13900139000',
          relation: '朋友',
          isDefault: false,
        },
      })
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '新增联系人失败')
    } finally {
      this.setData({ submitting: false })
    }
  },

  async handleDeleteContact(event) {
    const id = event.currentTarget.dataset.id
    if (!id) {
      return
    }
    try {
      await userService.deleteEmergencyContact(id)
      runtime.showSuccess('联系人已删除')
      await this.bootstrap()
    } catch (error) {
      runtime.handleError(error, '删除联系人失败')
    }
  },

  handleGoProfile() {
    navigation.openPrimaryPage('profile')
  },
})
