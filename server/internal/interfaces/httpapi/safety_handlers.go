package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) getSafetyConfig(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetSafetyConfig(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) updateSafetyConfig(w http.ResponseWriter, r *http.Request) {
	var req service.SafetyConfigInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.UpdateSafetyConfig(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) createSafetyShareLink(w http.ResponseWriter, r *http.Request) {
	var req service.SafetyShareLinkInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CreateSafetyShareLink(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) createSafetySOS(w http.ResponseWriter, r *http.Request) {
	var req service.SafetySOSInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CreateSafetySOS(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) uploadTracePoints(w http.ResponseWriter, r *http.Request) {
	var req service.SafetyTraceBatchInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.UploadTracePoints(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getTraceSummary(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "orderId")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetTraceSummary(middleware.UserID(r), orderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}
