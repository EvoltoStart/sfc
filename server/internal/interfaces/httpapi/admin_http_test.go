package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"sfc/server/internal/bootstrap"
	"sfc/server/internal/domain"
	"sfc/server/internal/service"
	"sfc/server/internal/store"
)

func adminLogin(t *testing.T, client *http.Client, baseURL string) string {
	t.Helper()
	envelope := doJSONRequest(t, client, http.MethodPost, baseURL+"/api/v1/admin/auth/login", "", map[string]any{
		"username": "admin",
		"password": "admin123",
	})
	assertSuccess(t, envelope)
	var data struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode admin login failed: %v", err)
	}
	return data.Token
}

func TestAdminAuthDashboardAndOrders(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	adminToken := adminLogin(t, client, server.URL)

	envelope := doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/auth/session", adminToken, nil)
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/auth/permissions", adminToken, nil)
	assertSuccess(t, envelope)

	driverToken, passengerToken, orderID := createAcceptedOrder(t, client, server.URL)
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/orders", passengerToken, map[string]any{
		"orderId": orderID,
	})
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/dashboard", adminToken, nil)
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/orders?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	var listData struct {
		List []map[string]any `json:"list"`
	}
	if err := json.Unmarshal(envelope.Data, &listData); err != nil {
		t.Fatalf("decode admin orders failed: %v", err)
	}
	if len(listData.List) == 0 {
		t.Fatal("expect admin orders list not empty")
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/orders/"+toPath(orderID), adminToken, nil)
	assertSuccess(t, envelope)

	_ = driverToken
}

func TestAdminAuditFinanceAndCMS(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	adminToken := adminLogin(t, client, server.URL)

	driverToken := login(t, client, server.URL, "driver-admin-audit")
	_ = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/driver/license/submit", driverToken, map[string]any{
		"licenseNo":  "A123456789",
		"issueDate":  "2024-01-01",
		"expireDate": "2034-01-01",
		"imageUrl":   "https://example.com/license.png",
	})

	envelope := doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/audits?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	var auditData struct {
		List []struct {
			AuditTaskID int64 `json:"auditTaskId"`
		} `json:"list"`
	}
	if err := json.Unmarshal(envelope.Data, &auditData); err != nil {
		t.Fatalf("decode audit list failed: %v", err)
	}
	if len(auditData.List) == 0 {
		t.Fatal("expect audit task list not empty")
	}

	taskID := auditData.List[0].AuditTaskID
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/audits/"+toPath(taskID), adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/admin/audits/"+toPath(taskID)+"/approve", adminToken, map[string]any{
		"remark": "ok",
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/finance/ledger?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/finance/withdraws?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/finance/reports", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/risk/sos-events?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/risk/timeout-alerts?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/risk/route-score-logs?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/risk/frequency-logs?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/risk/pricing-logs?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/cms/banners", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/admin/cms/banners", adminToken, map[string]any{
		"title":    "banner2",
		"imageUrl": "https://example.com/2.png",
		"linkUrl":  "https://example.com/2",
		"sortNo":   2,
		"status":   "ENABLED",
	})
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/cms/articles/HELP_CENTER", adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodPut, server.URL+"/api/v1/admin/cms/articles/HELP_CENTER", adminToken, map[string]any{
		"title":   "帮助中心2",
		"content": "updated",
		"status":  "PUBLISHED",
	})
	assertSuccess(t, envelope)
}

func TestAdminCMSWriteRequiresButtonPermission(t *testing.T) {
	appStore := store.NewMemoryStore()
	appStore.AdminUsers[2] = &domain.AdminUser{
		ID:          2,
		Username:    "cms-viewer",
		Password:    "admin123",
		DisplayName: "运营只读",
		Status:      domain.AdminUserStatusActive,
		CreatedAt:   time.Now().UTC(),
		RoleCodes:   []string{"CMS_VIEWER"},
		MenuCodes:   []string{"cms"},
		ButtonCodes: []string{},
		DataScopes:  []string{"ALL"},
	}
	svc := bootstrap.NewService(appStore)
	server := httptest.NewServer(NewRouter(svc))
	defer server.Close()

	client := server.Client()
	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/admin/auth/login", "", map[string]any{
		"username": "cms-viewer",
		"password": "admin123",
	})
	assertSuccess(t, envelope)
	var loginData struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(envelope.Data, &loginData); err != nil {
		t.Fatalf("decode admin login failed: %v", err)
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/cms/banners", loginData.Token, nil)
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/admin/cms/banners", loginData.Token, map[string]any{
		"title":    "no-permission",
		"imageUrl": "https://example.com/no-permission.png",
		"linkUrl":  "https://example.com/no-permission",
		"sortNo":   3,
		"status":   "ENABLED",
	})
	if envelope.Code != "PERMISSION_DENIED" {
		t.Fatalf("expect permission denied, got code=%v message=%s", envelope.Code, envelope.Message)
	}
}

func TestAdminTraceOrderLedgerAndRejectAudit(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	adminToken := adminLogin(t, client, server.URL)
	_, passengerToken, orderID := createAcceptedOrder(t, client, server.URL)

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/orders", passengerToken, map[string]any{
		"orderId": orderID,
	})
	assertSuccess(t, envelope)
	var paymentData struct {
		OutTradeNo string `json:"outTradeNo"`
	}
	if err := json.Unmarshal(envelope.Data, &paymentData); err != nil {
		t.Fatalf("decode payment create failed: %v", err)
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/callback/wechat", "", map[string]any{
		"outTradeNo": paymentData.OutTradeNo,
		"payStatus":  "PAID",
	}, map[string]string{
		"X-Wechat-Timestamp": "1713420099",
		"X-Wechat-Signature": service.ComputePaymentCallbackSignature(paymentData.OutTradeNo, "PAID", "1713420099"),
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/orders/"+toPath(orderID)+"/confirm-board", passengerToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/safety/trace-points/batch", passengerToken, map[string]any{
		"orderId": orderID,
		"points": []map[string]any{
			{"lat": 39.9220, "lng": 116.4437, "recordedAt": "2026-04-24T10:00:00Z"},
			{"lat": 39.7000, "lng": 116.8000, "recordedAt": "2026-04-24T10:10:00Z"},
		},
	})
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/safety/sos", passengerToken, map[string]any{
		"orderId":    orderID,
		"currentLat": 39.9220,
		"currentLng": 116.4437,
		"remark":     "need help",
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/risk/trace/"+toPath(orderID), adminToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/finance/order-ledger/"+toPath(orderID), adminToken, nil)
	assertSuccess(t, envelope)

	driverToken := login(t, client, server.URL, "driver-admin-reject")
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/driver/license/submit", driverToken, map[string]any{
		"licenseNo":  "B123456789",
		"issueDate":  "2024-01-01",
		"expireDate": "2034-01-01",
		"imageUrl":   "https://example.com/license2.png",
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/admin/audits?page=1&pageSize=20", adminToken, nil)
	assertSuccess(t, envelope)
	var auditData struct {
		List []struct {
			AuditTaskID int64 `json:"auditTaskId"`
		} `json:"list"`
	}
	if err := json.Unmarshal(envelope.Data, &auditData); err != nil {
		t.Fatalf("decode audit list failed: %v", err)
	}
	if len(auditData.List) == 0 {
		t.Fatal("expect audit task")
	}
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/admin/audits/"+toPath(auditData.List[0].AuditTaskID)+"/reject", adminToken, map[string]any{
		"remark": "资料不清晰",
	})
	assertSuccess(t, envelope)
}
