package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) getProfile(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetProfile(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Nickname  string `json:"nickname"`
		AvatarURL string `json:"avatarUrl"`
	}
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	profile, appErr := h.svc.UpdateProfile(middleware.UserID(r), req.Nickname, req.AvatarURL)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{
		"success": true,
		"profile": profile,
	})
}

func (h *Handler) submitRealname(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RealName string `json:"realName"`
		IDCardNo string `json:"idCardNo"`
	}
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	statusView, authID, appErr := h.svc.SubmitRealname(middleware.UserID(r), req.RealName, req.IDCardNo)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{
		"authId":     authID,
		"authStatus": statusView.AuthStatus,
	})
}

func (h *Handler) getRealnameStatus(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetRealnameStatus(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listEmergencyContacts(w http.ResponseWriter, r *http.Request) {
	contacts, appErr := h.svc.ListEmergencyContacts(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{
		"list": contacts,
	})
}

func (h *Handler) createEmergencyContact(w http.ResponseWriter, r *http.Request) {
	var req service.EmergencyContactInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	contact, appErr := h.svc.CreateEmergencyContact(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{
		"contactId": contact.ID,
		"success":   true,
	})
}

func (h *Handler) updateEmergencyContact(w http.ResponseWriter, r *http.Request) {
	contactID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req service.EmergencyContactInput
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	_, appErr = h.svc.UpdateEmergencyContact(middleware.UserID(r), contactID, req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"success": true})
}

func (h *Handler) deleteEmergencyContact(w http.ResponseWriter, r *http.Request) {
	contactID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	if appErr = h.svc.DeleteEmergencyContact(middleware.UserID(r), contactID); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"success": true})
}
