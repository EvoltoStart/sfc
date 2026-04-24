package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
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
