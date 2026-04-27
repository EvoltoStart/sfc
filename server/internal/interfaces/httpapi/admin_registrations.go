package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/service"
)

func registerAdminRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("POST /api/v1/admin/auth/login", handler.adminLogin)
	mux.HandleFunc("GET /api/v1/admin/auth/session", middleware.RequireAdminAuth(svc, handler.getAdminSession))
	mux.HandleFunc("GET /api/v1/admin/auth/permissions", middleware.RequireAdminAuth(svc, handler.getAdminPermissions))
	mux.HandleFunc("GET /api/v1/admin/dashboard", middleware.RequireAdminAuth(svc, handler.getAdminDashboard))
	mux.HandleFunc("GET /api/v1/admin/audits", middleware.RequireAdminAuth(svc, handler.listAdminAudits))
	mux.HandleFunc("GET /api/v1/admin/audits/{id}", middleware.RequireAdminAuth(svc, handler.getAdminAuditDetail))
	mux.HandleFunc("POST /api/v1/admin/audits/{id}/approve", middleware.RequireAdminPermission(svc, "audit:approve", handler.approveAdminAudit))
	mux.HandleFunc("POST /api/v1/admin/audits/{id}/reject", middleware.RequireAdminPermission(svc, "audit:reject", handler.rejectAdminAudit))
	mux.HandleFunc("GET /api/v1/admin/orders", middleware.RequireAdminAuth(svc, handler.listAdminOrders))
	mux.HandleFunc("GET /api/v1/admin/orders/{id}", middleware.RequireAdminAuth(svc, handler.getAdminOrderDetail))
	mux.HandleFunc("GET /api/v1/admin/risk/trace/{orderId}", middleware.RequireAdminAuth(svc, handler.getAdminTrace))
	mux.HandleFunc("GET /api/v1/admin/risk/sos-events", middleware.RequireAdminAuth(svc, handler.listAdminSOSEvents))
	mux.HandleFunc("GET /api/v1/admin/risk/timeout-alerts", middleware.RequireAdminAuth(svc, handler.listAdminTimeoutAlerts))
	mux.HandleFunc("GET /api/v1/admin/risk/route-score-logs", middleware.RequireAdminAuth(svc, handler.listAdminRouteScoreLogs))
	mux.HandleFunc("GET /api/v1/admin/risk/frequency-logs", middleware.RequireAdminAuth(svc, handler.listAdminFrequencyLogs))
	mux.HandleFunc("GET /api/v1/admin/risk/pricing-logs", middleware.RequireAdminAuth(svc, handler.listAdminPricingLogs))
	mux.HandleFunc("GET /api/v1/admin/finance/ledger", middleware.RequireAdminAuth(svc, handler.listAdminFinanceLedger))
	mux.HandleFunc("GET /api/v1/admin/finance/order-ledger/{orderId}", middleware.RequireAdminAuth(svc, handler.getAdminOrderLedger))
	mux.HandleFunc("GET /api/v1/admin/finance/withdraws", middleware.RequireAdminAuth(svc, handler.listAdminWithdraws))
	mux.HandleFunc("GET /api/v1/admin/finance/reports", middleware.RequireAdminAuth(svc, handler.getAdminFinanceReports))
	mux.HandleFunc("GET /api/v1/admin/users", middleware.RequireAdminAuth(svc, handler.listAdminUsers))
	mux.HandleFunc("GET /api/v1/admin/users/{id}", middleware.RequireAdminAuth(svc, handler.getAdminUserDetail))
	mux.HandleFunc("GET /api/v1/admin/ops/overview", middleware.RequireAdminAuth(svc, handler.getAdminOpsOverview))
	mux.HandleFunc("GET /api/v1/admin/audit-logs", middleware.RequireAdminAuth(svc, handler.listAdminAuditLogs))
	mux.HandleFunc("GET /api/v1/admin/cms/banners", middleware.RequireAdminAuth(svc, handler.listCMSBanners))
	mux.HandleFunc("POST /api/v1/admin/cms/banners", middleware.RequireAdminPermission(svc, "cms:banner:create", handler.createCMSBanner))
	mux.HandleFunc("PUT /api/v1/admin/cms/banners/{id}", middleware.RequireAdminPermission(svc, "cms:banner:update", handler.updateCMSBanner))
	mux.HandleFunc("GET /api/v1/admin/cms/articles/{type}", middleware.RequireAdminAuth(svc, handler.getCMSArticle))
	mux.HandleFunc("PUT /api/v1/admin/cms/articles/{type}", middleware.RequireAdminPermission(svc, "cms:article:update", handler.updateCMSArticle))
}
