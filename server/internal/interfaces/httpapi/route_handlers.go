package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) listRouteTemplates(w http.ResponseWriter, r *http.Request) {
	items, appErr := h.svc.ListRouteTemplates(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"list": items})
}

func (h *Handler) createRouteTemplate(w http.ResponseWriter, r *http.Request) {
	var req service.RouteTemplateInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	route, appErr := h.svc.CreateRouteTemplate(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{
		"routeTemplateId": route.ID,
		"success":         true,
	})
}

func (h *Handler) updateRouteTemplate(w http.ResponseWriter, r *http.Request) {
	routeID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req service.RouteTemplateInput
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	_, appErr = h.svc.UpdateRouteTemplate(middleware.UserID(r), routeID, req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"success": true})
}

func (h *Handler) deleteRouteTemplate(w http.ResponseWriter, r *http.Request) {
	routeID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	if appErr = h.svc.DeleteRouteTemplate(middleware.UserID(r), routeID); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"success": true})
}

func (h *Handler) setDefaultRouteTemplate(w http.ResponseWriter, r *http.Request) {
	routeID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	if appErr = h.svc.SetDefaultRouteTemplate(middleware.UserID(r), routeID); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"success": true})
}

func (h *Handler) pricePreview(w http.ResponseWriter, r *http.Request) {
	var req service.PricePreviewInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.PricePreview(req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) routeScorePreview(w http.ResponseWriter, r *http.Request) {
	var req service.PricePreviewInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.RouteScorePreview(req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}
