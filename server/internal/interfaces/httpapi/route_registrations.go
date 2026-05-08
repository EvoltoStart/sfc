package httpapi

import (
	"net/http"

	"sfc/server/internal/common/middleware"
	"sfc/server/internal/service"
)

func registerAuthRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("POST /api/v1/auth/wx-login", handler.wxLogin)
	mux.HandleFunc("GET /api/v1/auth/session", middleware.RequireAuth(svc, handler.getSession))
	mux.HandleFunc("POST /api/v1/auth/logout", middleware.RequireAuth(svc, handler.logout))
}

func registerUserRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("GET /api/v1/me/profile", middleware.RequireAuth(svc, handler.getProfile))
	mux.HandleFunc("PUT /api/v1/me/profile", middleware.RequireAuth(svc, handler.updateProfile))
	mux.HandleFunc("POST /api/v1/me/realname/submit", middleware.RequireAuth(svc, handler.submitRealname))
	mux.HandleFunc("GET /api/v1/me/realname/status", middleware.RequireAuth(svc, handler.getRealnameStatus))
	mux.HandleFunc("GET /api/v1/me/emergency-contacts", middleware.RequireAuth(svc, handler.listEmergencyContacts))
	mux.HandleFunc("POST /api/v1/me/emergency-contacts", middleware.RequireAuth(svc, handler.createEmergencyContact))
	mux.HandleFunc("PUT /api/v1/me/emergency-contacts/{id}", middleware.RequireAuth(svc, handler.updateEmergencyContact))
	mux.HandleFunc("DELETE /api/v1/me/emergency-contacts/{id}", middleware.RequireAuth(svc, handler.deleteEmergencyContact))
}

func registerDriverRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("GET /api/v1/driver/profile", middleware.RequireAuth(svc, handler.getDriverProfile))
	mux.HandleFunc("GET /api/v1/driver/vehicles", middleware.RequireAuth(svc, handler.listVehicles))
	mux.HandleFunc("POST /api/v1/driver/vehicles", middleware.RequireAuth(svc, handler.createVehicle))
	mux.HandleFunc("PUT /api/v1/driver/vehicles/{id}", middleware.RequireAuth(svc, handler.updateVehicle))
	mux.HandleFunc("POST /api/v1/driver/vehicles/{id}/set-default", middleware.RequireAuth(svc, handler.setDefaultVehicle))
	mux.HandleFunc("POST /api/v1/driver/license/submit", middleware.RequireAuth(svc, handler.submitDriverLicense))
	mux.HandleFunc("GET /api/v1/driver/license/status", middleware.RequireAuth(svc, handler.getLicenseStatus))
}

func registerRouteRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("GET /api/v1/route-templates", middleware.RequireAuth(svc, handler.listRouteTemplates))
	mux.HandleFunc("POST /api/v1/route-templates", middleware.RequireAuth(svc, handler.createRouteTemplate))
	mux.HandleFunc("PUT /api/v1/route-templates/{id}", middleware.RequireAuth(svc, handler.updateRouteTemplate))
	mux.HandleFunc("DELETE /api/v1/route-templates/{id}", middleware.RequireAuth(svc, handler.deleteRouteTemplate))
	mux.HandleFunc("POST /api/v1/route-templates/{id}/set-default", middleware.RequireAuth(svc, handler.setDefaultRouteTemplate))
	mux.HandleFunc("POST /api/v1/trips/price-preview", middleware.RequireAuth(svc, handler.pricePreview))
	mux.HandleFunc("POST /api/v1/trips/route-score-preview", middleware.RequireAuth(svc, handler.routeScorePreview))
}

func registerTripRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("POST /api/v1/trips", middleware.RequireAuth(svc, handler.createTrip))
	mux.HandleFunc("GET /api/v1/trips/my", middleware.RequireAuth(svc, handler.listMyTrips))
	mux.HandleFunc("GET /api/v1/trips/{id}", middleware.RequireAuth(svc, handler.getTrip))
	mux.HandleFunc("PUT /api/v1/trips/{id}", middleware.RequireAuth(svc, handler.updateTrip))
	mux.HandleFunc("POST /api/v1/trips/{id}/cancel", middleware.RequireAuth(svc, handler.cancelTrip))
}

func registerMatchingRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("POST /api/v1/search/matches", middleware.RequireAuth(svc, handler.searchMatches))
}

func registerOrderRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("POST /api/v1/join-requests", middleware.RequireAuth(svc, handler.createJoinRequest))
	mux.HandleFunc("GET /api/v1/join-requests/my", middleware.RequireAuth(svc, handler.listMyJoinRequests))
	mux.HandleFunc("GET /api/v1/join-requests/{id}", middleware.RequireAuth(svc, handler.getJoinRequest))
	mux.HandleFunc("POST /api/v1/join-requests/{id}/cancel", middleware.RequireAuth(svc, handler.cancelJoinRequest))
	mux.HandleFunc("GET /api/v1/driver/join-requests", middleware.RequireAuth(svc, handler.listDriverJoinRequests))
	mux.HandleFunc("POST /api/v1/driver/join-requests/{id}/accept", middleware.RequireAuth(svc, handler.acceptJoinRequest))
	mux.HandleFunc("POST /api/v1/driver/join-requests/{id}/reject", middleware.RequireAuth(svc, handler.rejectJoinRequest))
	mux.HandleFunc("GET /api/v1/orders", middleware.RequireAuth(svc, handler.listOrders))
	mux.HandleFunc("GET /api/v1/orders/{id}", middleware.RequireAuth(svc, handler.getOrder))
	mux.HandleFunc("POST /api/v1/orders/{id}/confirm-board", middleware.RequireAuth(svc, handler.confirmBoard))
	mux.HandleFunc("POST /api/v1/orders/{id}/confirm-arrival", middleware.RequireAuth(svc, handler.confirmArrival))
	mux.HandleFunc("POST /api/v1/orders/{id}/cancel", middleware.RequireAuth(svc, handler.cancelOrder))
}

func registerPaymentRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("POST /api/v1/payments/orders", middleware.RequireAuth(svc, handler.createPaymentOrder))
	mux.HandleFunc("GET /api/v1/payments/{orderId}/status", middleware.RequireAuth(svc, handler.getPaymentStatus))
	mux.HandleFunc("POST /api/v1/payments/callback/wechat", handler.paymentCallback)
	mux.HandleFunc("POST /api/v1/payments/callback/alipay", handler.alipayPaymentCallback)
	mux.HandleFunc("POST /__dev/mock-payment-callback", handler.devPaymentCallback)
	mux.HandleFunc("POST /api/v1/refunds", middleware.RequireAuth(svc, handler.createRefund))
}

func registerWalletRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("GET /api/v1/wallet/account", middleware.RequireAuth(svc, handler.getWalletAccount))
	mux.HandleFunc("GET /api/v1/wallet/ledger", middleware.RequireAuth(svc, handler.listWalletLedger))
	mux.HandleFunc("POST /api/v1/wallet/withdraws", middleware.RequireAuth(svc, handler.createWalletWithdraw))
}

func registerSafetyRoutes(mux *http.ServeMux, svc *service.Service, handler *Handler) {
	mux.HandleFunc("GET /api/v1/safety/config", middleware.RequireAuth(svc, handler.getSafetyConfig))
	mux.HandleFunc("PUT /api/v1/safety/config", middleware.RequireAuth(svc, handler.updateSafetyConfig))
	mux.HandleFunc("POST /api/v1/safety/share-links", middleware.RequireAuth(svc, handler.createSafetyShareLink))
	mux.HandleFunc("POST /api/v1/safety/sos", middleware.RequireAuth(svc, handler.createSafetySOS))
	mux.HandleFunc("POST /api/v1/safety/trace-points/batch", middleware.RequireAuth(svc, handler.uploadTracePoints))
	mux.HandleFunc("GET /api/v1/safety/trace-summary/{orderId}", middleware.RequireAuth(svc, handler.getTraceSummary))
}
