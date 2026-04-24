package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) createTrip(w http.ResponseWriter, r *http.Request) {
	var req service.TripCreateInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CreateTrip(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listMyTrips(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListMyTrips(middleware.UserID(r), r.URL.Query().Get("status"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getTrip(w http.ResponseWriter, r *http.Request) {
	tripID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetTrip(middleware.UserID(r), tripID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) updateTrip(w http.ResponseWriter, r *http.Request) {
	tripID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req service.TripUpdateInput
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.UpdateTrip(middleware.UserID(r), tripID, req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) cancelTrip(w http.ResponseWriter, r *http.Request) {
	tripID, appErr := parsePathID(r, "id")
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
	result, appErr := h.svc.CancelTrip(middleware.UserID(r), tripID, req.Reason)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}
