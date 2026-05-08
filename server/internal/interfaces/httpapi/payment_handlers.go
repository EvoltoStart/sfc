package httpapi

import (
	"net/http"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) createPaymentOrder(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OrderID int64 `json:"orderId"`
	}
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CreatePaymentOrder(middleware.UserID(r), req.OrderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getPaymentStatus(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "orderId")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetPaymentStatus(middleware.UserID(r), orderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) paymentCallback(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OutTradeNo string `json:"outTradeNo"`
		PayStatus  string `json:"payStatus"`
	}
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	timestamp := r.Header.Get("X-Wechat-Timestamp")
	signature := r.Header.Get("X-Wechat-Signature")
	if !service.ValidatePaymentCallbackSignature(signature, req.OutTradeNo, req.PayStatus, timestamp) {
		response.Error(w, r, errno.New("PAYMENT_SIGN_INVALID", "鏀粯鍥炶皟绛惧悕鏍￠獙澶辫触", http.StatusUnauthorized))
		return
	}
	result, appErr := h.svc.PaymentCallback(req.OutTradeNo, req.PayStatus)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) devPaymentCallback(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OutTradeNo string `json:"outTradeNo"`
		PayStatus  string `json:"payStatus"`
	}
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.PaymentCallback(req.OutTradeNo, req.PayStatus)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) alipayPaymentCallback(w http.ResponseWriter, r *http.Request) {
	if _, appErr := h.svc.HandlePaymentNotification(r.Context(), r); appErr != nil {
		http.Error(w, "failure", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("success"))
}

func (h *Handler) createRefund(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OrderID         int64  `json:"orderId"`
		RefundReason    string `json:"refundReason"`
		RefundAmountFen int64  `json:"refundAmountFen"`
	}
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CreateRefund(middleware.UserID(r), req.OrderID, req.RefundReason, req.RefundAmountFen)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}
