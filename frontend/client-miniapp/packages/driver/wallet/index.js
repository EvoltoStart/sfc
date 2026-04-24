const walletService = require('../../../services/wallet')
const runtime = require('../../../utils/runtime')
const { formatDateTime, formatMoney } = require('../../../utils/formatter')

function bizTypeLabel(value) {
  const map = {
    ORDER_SETTLEMENT: '订单结算',
    REFUND: '退款',
    WITHDRAW: '提现',
  }
  return map[value] || value || '流水'
}

function mapLedgerItem(item) {
  return {
    ...item,
    bizTypeText: bizTypeLabel(item.bizType),
    changeText: formatMoney(item.changeAmountFen),
    balanceText: formatMoney(item.balanceAfterFen),
    createdText: formatDateTime(item.createdAt),
  }
}

function buildWalletView(hasToken, walletAccount) {
  if (!walletAccount) {
    return {
      hasWallet: false,
      showWalletPanel: false,
      availableBalanceText: '0.00',
      frozenBalanceText: '0.00',
      totalIncomeText: '0.00',
      totalWithdrawText: '0.00',
    }
  }
  return {
    hasWallet: true,
    showWalletPanel: !!hasToken,
    availableBalanceText: (walletAccount.availableAmountFen / 100).toFixed(2),
    frozenBalanceText: (walletAccount.frozenAmountFen / 100).toFixed(2),
    totalIncomeText: (walletAccount.totalIncomeFen / 100).toFixed(2),
    totalWithdrawText: (walletAccount.totalWithdrawFen / 100).toFixed(2),
  }
}

Page({
  data: {
    authState: runtime.syncAuthState(),
    walletAccount: null,
    ledger: [],
    hasWallet: false,
    showWalletPanel: false,
    availableBalanceText: '0.00',
    frozenBalanceText: '0.00',
    totalIncomeText: '0.00',
    totalWithdrawText: '0.00',
    loading: false,
  },

  onShow() {
    this.bootstrap()
  },

  async bootstrap() {
    const authState = runtime.syncAuthState()
    this.setData({ authState })
    if (!authState.token) {
      this.setData({
        walletAccount: null,
        ledger: [],
        ...buildWalletView(false, null),
      })
      return
    }
    this.setData({ loading: true })
    try {
      const results = await Promise.allSettled([
        walletService.getWalletAccount(),
        walletService.listWalletLedger(),
      ])
      const walletAccount = results[0].status === 'fulfilled' ? results[0].value : null
      this.setData({
        walletAccount,
        ledger: results[1].status === 'fulfilled' ? (results[1].value.list || []).map(mapLedgerItem) : [],
        ...buildWalletView(!!authState.token, walletAccount),
      })
    } catch (error) {
      runtime.handleError(error, '加载钱包失败')
    } finally {
      this.setData({ loading: false })
    }
  },
})
