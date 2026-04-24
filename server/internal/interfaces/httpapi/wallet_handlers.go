package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) getWalletAccount(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetWalletAccount(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listWalletLedger(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListWalletLedger(middleware.UserID(r), r.URL.Query().Get("bizType"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) createWalletWithdraw(w http.ResponseWriter, r *http.Request) {
	var req service.WithdrawCreateInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CreateWithdraw(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}
