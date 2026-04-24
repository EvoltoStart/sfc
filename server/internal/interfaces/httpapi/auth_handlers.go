package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
)

func (h *Handler) wxLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code string `json:"code"`
	}
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}

	result, appErr := h.svc.WxLogin(req.Code)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetSession(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	h.svc.Logout(middleware.Token(r))
	response.Success(w, r, map[string]any{
		"success": true,
	})
}
