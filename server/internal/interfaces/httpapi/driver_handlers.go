package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) getDriverProfile(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetDriverProfile(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listVehicles(w http.ResponseWriter, r *http.Request) {
	items, appErr := h.svc.ListVehicles(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"list": items})
}

func (h *Handler) createVehicle(w http.ResponseWriter, r *http.Request) {
	var req service.VehicleInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	vehicle, appErr := h.svc.CreateVehicle(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{
		"vehicleId":  vehicle.ID,
		"authStatus": vehicle.AuthStatus,
	})
}

func (h *Handler) updateVehicle(w http.ResponseWriter, r *http.Request) {
	vehicleID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req service.VehicleInput
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	_, appErr = h.svc.UpdateVehicle(middleware.UserID(r), vehicleID, req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"success": true})
}

func (h *Handler) setDefaultVehicle(w http.ResponseWriter, r *http.Request) {
	vehicleID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	if appErr = h.svc.SetDefaultVehicle(middleware.UserID(r), vehicleID); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{"success": true})
}

func (h *Handler) submitDriverLicense(w http.ResponseWriter, r *http.Request) {
	var req service.LicenseSubmitInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	license, appErr := h.svc.SubmitDriverLicense(middleware.UserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, map[string]any{
		"licenseId":  license.ID,
		"authStatus": license.AuthStatus,
	})
}

func (h *Handler) getLicenseStatus(w http.ResponseWriter, r *http.Request) {
	statusView, appErr := h.svc.GetLicenseStatus(middleware.UserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, statusView)
}
