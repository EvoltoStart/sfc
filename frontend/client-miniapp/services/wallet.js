const { get, ensurePagedResult } = require('../utils/request')

function getWalletAccount() {
  return get('/api/v1/wallet/account')
}

function listWalletLedger() {
  return get('/api/v1/wallet/ledger?page=1&pageSize=20').then(ensurePagedResult)
}

module.exports = {
  getWalletAccount,
  listWalletLedger,
}
