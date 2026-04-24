package httpapi

import (
	"net/http"
	"strconv"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) createJoinRequest(w http.ResponseWriter, r *http.Request) {
	var req service.JoinRequestCreateInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CreateJoinRequest(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listMyJoinRequests(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListMyJoinRequests(middleware.UserID(r), r.URL.Query().Get("status"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getJoinRequest(w http.ResponseWriter, r *http.Request) {
	joinRequestID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetJoinRequest(middleware.UserID(r), joinRequestID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) cancelJoinRequest(w http.ResponseWriter, r *http.Request) {
	joinRequestID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CancelJoinRequest(middleware.UserID(r), joinRequestID, req.Reason)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listDriverJoinRequests(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	var tripID int64
	if rawTripID := r.URL.Query().Get("tripId"); rawTripID != "" {
		parsed, err := strconv.ParseInt(rawTripID, 10, 64)
		if err != nil || parsed <= 0 {
			response.Error(w, r, errno.New("PARAM_INVALID", "tripId 参数非法", http.StatusBadRequest))
			return
		}
		tripID = parsed
	}
	result, appErr := h.svc.ListDriverJoinRequests(middleware.UserID(r), tripID, r.URL.Query().Get("status"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) acceptJoinRequest(w http.ResponseWriter, r *http.Request) {
	joinRequestID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req struct {
		Remark string `json:"remark"`
	}
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.AcceptJoinRequest(middleware.UserID(r), joinRequestID, req.Remark)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) rejectJoinRequest(w http.ResponseWriter, r *http.Request) {
	joinRequestID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.RejectJoinRequest(middleware.UserID(r), joinRequestID, req.Reason)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listOrders(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListOrders(middleware.UserID(r), r.URL.Query().Get("role"), r.URL.Query().Get("status"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getOrder(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetOrder(middleware.UserID(r), orderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) confirmBoard(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.ConfirmBoard(middleware.UserID(r), orderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) confirmArrival(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.ConfirmArrival(middleware.UserID(r), orderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) cancelOrder(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CancelOrder(middleware.UserID(r), orderID, req.Reason)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}
