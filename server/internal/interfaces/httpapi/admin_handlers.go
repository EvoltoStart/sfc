package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

func (h *Handler) adminLogin(w http.ResponseWriter, r *http.Request) {
	var req service.AdminLoginInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.AdminLogin(req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminSession(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetAdminSession(middleware.AdminUserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminPermissions(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetAdminPermissions(middleware.AdminUserID(r))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminDashboard(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetAdminDashboard()
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminAudits(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminAudits(r.URL.Query().Get("taskType"), r.URL.Query().Get("taskStatus"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminAuditDetail(w http.ResponseWriter, r *http.Request) {
	taskID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetAdminAuditDetail(taskID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) approveAdminAudit(w http.ResponseWriter, r *http.Request) {
	taskID, appErr := parsePathID(r, "id")
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
	result, appErr := h.svc.ApproveAdminAudit(middleware.AdminUserID(r), taskID, req.Remark)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) rejectAdminAudit(w http.ResponseWriter, r *http.Request) {
	taskID, appErr := parsePathID(r, "id")
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
	result, appErr := h.svc.RejectAdminAudit(middleware.AdminUserID(r), taskID, req.Remark)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminOrders(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	abnormal := r.URL.Query().Get("abnormalFlag") == "true"
	result, appErr := h.svc.ListAdminOrders(
		r.URL.Query().Get("orderStatus"),
		r.URL.Query().Get("tripStatus"),
		r.URL.Query().Get("driverKeyword"),
		r.URL.Query().Get("passengerKeyword"),
		abnormal,
		page,
		pageSize,
	)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminOrderDetail(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetAdminOrderDetail(orderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminTrace(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "orderId")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetAdminTrace(orderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminSOSEvents(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminSOSEvents(r.URL.Query().Get("status"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminTimeoutAlerts(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminTimeoutAlerts(page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminRouteScoreLogs(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminRouteScoreLogs(page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminFrequencyLogs(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminFrequencyLogs(page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminPricingLogs(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminPricingLogs(page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminFinanceLedger(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminFinanceLedger(r.URL.Query().Get("bizType"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminOrderLedger(w http.ResponseWriter, r *http.Request) {
	orderID, appErr := parsePathID(r, "orderId")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetAdminOrderLedger(orderID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminWithdraws(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminWithdraws(page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminFinanceReports(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetAdminFinanceReports()
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminUsers(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminUsers(r.URL.Query().Get("keyword"), page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminUserDetail(w http.ResponseWriter, r *http.Request) {
	userID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.GetAdminUserDetail(userID)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getAdminOpsOverview(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetAdminOpsOverview()
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listAdminAuditLogs(w http.ResponseWriter, r *http.Request) {
	page, pageSize := parsePageParams(r)
	result, appErr := h.svc.ListAdminAuditLogs(page, pageSize)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) listCMSBanners(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.ListCMSBanners()
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) createCMSBanner(w http.ResponseWriter, r *http.Request) {
	var req service.CMSBannerInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.CreateCMSBannerByAdmin(middleware.AdminUserID(r), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) updateCMSBanner(w http.ResponseWriter, r *http.Request) {
	bannerID, appErr := parsePathID(r, "id")
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	var req service.CMSBannerInput
	if appErr = decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.UpdateCMSBannerByAdmin(middleware.AdminUserID(r), bannerID, req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) getCMSArticle(w http.ResponseWriter, r *http.Request) {
	result, appErr := h.svc.GetCMSArticle(r.PathValue("type"))
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}

func (h *Handler) updateCMSArticle(w http.ResponseWriter, r *http.Request) {
	var req service.CMSArticleInput
	if appErr := decodeJSON(r, &req); appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	result, appErr := h.svc.UpdateCMSArticleByAdmin(middleware.AdminUserID(r), r.PathValue("type"), req)
	if appErr != nil {
		response.Error(w, r, appErr)
		return
	}
	response.Success(w, r, result)
}
