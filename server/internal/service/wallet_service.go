package service

import (
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type WithdrawCreateInput struct {
	AmountFen       int64  `json:"amountFen"`
	BankCardID      int64  `json:"bankCardId"`
	WithdrawChannel string `json:"withdrawChannel"`
	Remark          string `json:"remark"`
}

func (s *Service) GetWalletAccount(userID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}
	account := s.ensureWalletAccountLocked(userID)
	return map[string]any{
		"availableAmountFen": account.AvailableAmountFen,
		"frozenAmountFen":    account.FrozenAmountFen,
		"totalIncomeFen":     account.TotalIncomeFen,
		"totalWithdrawFen":   account.TotalWithdrawFen,
	}, nil
}

func (s *Service) ListWalletLedger(userID int64, bizType string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	type item struct {
		LedgerID        int64     `json:"ledgerId"`
		BizType         string    `json:"bizType"`
		ChangeAmountFen int64     `json:"changeAmountFen"`
		BalanceAfterFen int64     `json:"balanceAfterFen"`
		BizNo           string    `json:"bizNo"`
		CreatedAt       time.Time `json:"createdAt"`
	}

	var items []item
	for _, ledger := range s.store.Snapshot().WalletLedgers[userID] {
		if bizType != "" && ledger.BizType != bizType {
			continue
		}
		items = append(items, item{
			LedgerID:        ledger.ID,
			BizType:         ledger.BizType,
			ChangeAmountFen: ledger.ChangeAmountFen,
			BalanceAfterFen: ledger.BalanceAfterFen,
			BizNo:           ledger.BizNo,
			CreatedAt:       ledger.CreatedAt,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{
		"list":     paged,
		"page":     currentPage,
		"pageSize": currentPageSize,
		"total":    total,
	}, nil
}

func (s *Service) CreateWithdraw(userID int64, input WithdrawCreateInput) (map[string]any, *errno.Error) {
	if input.AmountFen <= 0 {
		return nil, errno.New("PARAM_INVALID", "鎻愮幇閲戦蹇呴』澶т簬 0", http.StatusBadRequest)
	}
	channel := strings.ToUpper(strings.TrimSpace(input.WithdrawChannel))
	if input.BankCardID <= 0 && channel == "" {
		return nil, errno.New("PARAM_INVALID", "鎻愮幇娓犻亾鎴栭摱琛屽崱涓嶈兘涓虹┖", http.StatusBadRequest)
	}
	if channel == "" {
		channel = "BANK_CARD"
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	account := s.ensureWalletAccountLocked(userID)
	if account.AvailableAmountFen < input.AmountFen {
		return nil, errno.New("WALLET_BALANCE_INSUFFICIENT", "閽卞寘鍙敤浣欓涓嶈冻", http.StatusConflict)
	}

	currentTime := now()
	withdraw := &domain.WithdrawRecord{
		ID:             s.store.NextID("withdraw_record"),
		UserID:         userID,
		WithdrawNo:     generateOrderNo("WD", s.store.NextID("withdraw_no")),
		AmountFen:      input.AmountFen,
		WithdrawStatus: domain.WithdrawStatusPending,
		Channel:        channel,
		BankCardID:     input.BankCardID,
		Remark:         strings.TrimSpace(input.Remark),
		CreatedAt:      currentTime,
		UpdatedAt:      currentTime,
	}
	s.store.Snapshot().Withdraws[withdraw.ID] = withdraw

	account.AvailableAmountFen -= input.AmountFen
	account.FrozenAmountFen += input.AmountFen
	s.appendWalletLedgerWithBalanceLocked(
		userID,
		"WITHDRAW_FREEZE",
		-input.AmountFen,
		account.AvailableAmountFen,
		withdraw.WithdrawNo,
		"鎻愮幇鐢宠鍐荤粨閲戦锛屾笭閬?"+channel+"锛宐ankCardId="+strconv.FormatInt(input.BankCardID, 10),
	)

	return map[string]any{
		"withdrawId":     withdraw.ID,
		"withdrawNo":     withdraw.WithdrawNo,
		"withdrawStatus": withdraw.WithdrawStatus,
	}, nil
}
