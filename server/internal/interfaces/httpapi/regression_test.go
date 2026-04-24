package httpapi

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"

	alipaySDK "github.com/smartwalle/alipay/v3"
	"github.com/smartwalle/nsign"

	"sfc/server/internal/service"
)

func TestGroup2JoinRequestRejectsRouteMismatch(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	driverToken := login(t, client, server.URL, "driver-mismatch")
	vehicleID := prepareDriver(t, client, server.URL, driverToken)

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/trips", driverToken, map[string]any{
		"vehicleId": vehicleID,
		"startName": "Beijing",
		"startLat":  39.9219,
		"startLng":  116.4436,
		"endName":   "Tianjin",
		"endLat":    39.1172,
		"endLng":    117.2000,
		"departAt":  time.Now().Add(3 * time.Hour).UTC().Format(time.RFC3339),
		"seatTotal": 2,
	})
	assertSuccess(t, envelope)
	var tripData struct {
		TripID int64 `json:"tripId"`
	}
	if err := json.Unmarshal(envelope.Data, &tripData); err != nil {
		t.Fatalf("decode trip data failed: %v", err)
	}

	passengerToken := login(t, client, server.URL, "passenger-mismatch")
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/join-requests", passengerToken, map[string]any{
		"tripId":    tripData.TripID,
		"startName": "Shanghai",
		"startLat":  31.2304,
		"startLng":  121.4737,
		"endName":   "Hangzhou",
		"endLat":    30.2741,
		"endLng":    120.1551,
	})
	if envelope.Code != "ROUTE_SCORE_NOT_PASS" {
		t.Fatalf("expect ROUTE_SCORE_NOT_PASS, got code=%v message=%s", envelope.Code, envelope.Message)
	}
}

func TestGroup3RefundedPaymentIgnoresPaidReplay(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	_, passengerToken, orderID := createAcceptedOrder(t, client, server.URL)

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/orders", passengerToken, map[string]any{
		"orderId": orderID,
	})
	assertSuccess(t, envelope)
	var paymentData struct {
		OutTradeNo string `json:"outTradeNo"`
	}
	if err := json.Unmarshal(envelope.Data, &paymentData); err != nil {
		t.Fatalf("decode payment data failed: %v", err)
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/callback/wechat", "", map[string]any{
		"outTradeNo": paymentData.OutTradeNo,
		"payStatus":  "PAID",
	}, map[string]string{
		"X-Wechat-Timestamp": "1713420002",
		"X-Wechat-Signature": service.ComputePaymentCallbackSignature(paymentData.OutTradeNo, "PAID", "1713420002"),
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/orders/"+toPath(orderID)+"/cancel", passengerToken, map[string]any{
		"reason": "change plan",
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/payments/"+toPath(orderID)+"/status", passengerToken, nil)
	assertSuccess(t, envelope)
	var statusData struct {
		PayStatus string `json:"payStatus"`
	}
	if err := json.Unmarshal(envelope.Data, &statusData); err != nil {
		t.Fatalf("decode payment status failed: %v", err)
	}
	if statusData.PayStatus != "REFUNDED" {
		t.Fatalf("expect refunded pay status, got %s", statusData.PayStatus)
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/callback/wechat", "", map[string]any{
		"outTradeNo": paymentData.OutTradeNo,
		"payStatus":  "PAID",
	}, map[string]string{
		"X-Wechat-Timestamp": "1713420003",
		"X-Wechat-Signature": service.ComputePaymentCallbackSignature(paymentData.OutTradeNo, "PAID", "1713420003"),
	})
	assertSuccess(t, envelope)

	if err := json.Unmarshal(envelope.Data, &statusData); err != nil {
		t.Fatalf("decode callback response failed: %v", err)
	}
	if statusData.PayStatus != "REFUNDED" {
		t.Fatalf("expect replay callback to keep refunded status, got %s", statusData.PayStatus)
	}
}

func TestGroup4SafetyEndpointsHappyPath(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	_, passengerToken, orderID := createAcceptedOrder(t, client, server.URL)

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/me/emergency-contacts", passengerToken, map[string]any{
		"name":      "Alice",
		"mobile":    "13800000000",
		"relation":  "family",
		"isDefault": true,
	})
	assertSuccess(t, envelope)
	var contactData struct {
		ContactID int64 `json:"contactId"`
	}
	if err := json.Unmarshal(envelope.Data, &contactData); err != nil {
		t.Fatalf("decode contact failed: %v", err)
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/safety/config", passengerToken, nil)
	assertSuccess(t, envelope)
	var configData struct {
		ShareEnabled bool `json:"shareEnabled"`
	}
	if err := json.Unmarshal(envelope.Data, &configData); err != nil {
		t.Fatalf("decode safety config failed: %v", err)
	}
	if !configData.ShareEnabled {
		t.Fatal("expect share enabled by default")
	}

	envelope = doJSONRequest(t, client, http.MethodPut, server.URL+"/api/v1/safety/config", passengerToken, map[string]any{
		"shareEnabled":           true,
		"defaultShareContactIds": []int64{contactData.ContactID},
		"recordEnabled":          true,
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/safety/share-links", passengerToken, map[string]any{
		"orderId":    orderID,
		"contactIds": []int64{contactData.ContactID},
	})
	assertSuccess(t, envelope)
	var shareData struct {
		ShareURL string `json:"shareUrl"`
	}
	if err := json.Unmarshal(envelope.Data, &shareData); err != nil {
		t.Fatalf("decode share link failed: %v", err)
	}
	if shareData.ShareURL == "" {
		t.Fatal("expect share url")
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/safety/sos", passengerToken, map[string]any{
		"orderId":    orderID,
		"currentLat": 31.2304,
		"currentLng": 121.4737,
		"remark":     "need help",
	})
	assertSuccess(t, envelope)
	var sosData struct {
		Notified bool `json:"notified"`
	}
	if err := json.Unmarshal(envelope.Data, &sosData); err != nil {
		t.Fatalf("decode sos response failed: %v", err)
	}
	if !sosData.Notified {
		t.Fatal("expect sos notification to reach default contacts")
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/safety/trace-points/batch", passengerToken, map[string]any{
		"orderId": orderID,
		"points": []map[string]any{
			{"lat": 31.2304, "lng": 121.4737, "recordedAt": "2026-04-18T10:00:00Z"},
			{"lat": 31.2200, "lng": 121.4200, "recordedAt": "2026-04-18T10:10:00Z"},
			{"lat": 31.1979, "lng": 121.3275, "recordedAt": "2026-04-18T10:20:00Z"},
		},
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/safety/trace-summary/"+toPath(orderID), passengerToken, nil)
	assertSuccess(t, envelope)
	var traceData struct {
		TotalDistanceMeter int64 `json:"totalDistanceMeter"`
	}
	if err := json.Unmarshal(envelope.Data, &traceData); err != nil {
		t.Fatalf("decode trace summary failed: %v", err)
	}
	if traceData.TotalDistanceMeter <= 0 {
		t.Fatalf("expect trace distance > 0, got %d", traceData.TotalDistanceMeter)
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/orders/"+toPath(orderID), passengerToken, nil)
	assertSuccess(t, envelope)
	var orderData struct {
		TrackSummary struct {
			TotalDistanceMeter int64 `json:"totalDistanceMeter"`
		} `json:"trackSummary"`
	}
	if err := json.Unmarshal(envelope.Data, &orderData); err != nil {
		t.Fatalf("decode order detail failed: %v", err)
	}
	if orderData.TrackSummary.TotalDistanceMeter <= 0 {
		t.Fatalf("expect order detail to carry trace summary, got %d", orderData.TrackSummary.TotalDistanceMeter)
	}
}

func TestGroup3AlipayCreateOrderAndCallback(t *testing.T) {
	privateKey, publicKey := generateTestPEMKeys(t)
	server := newEnvBackedTestServer(t, map[string]string{
		"SFC_ALIPAY_APP_ID":      "2021000000000000",
		"SFC_ALIPAY_PRIVATE_KEY": privateKey,
		"SFC_ALIPAY_PUBLIC_KEY":  publicKey,
	})
	defer server.Close()

	client := server.Client()
	_, passengerToken, orderID := createAcceptedOrder(t, client, server.URL)

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/orders", passengerToken, map[string]any{
		"orderId": orderID,
	})
	assertSuccess(t, envelope)
	var paymentData struct {
		OutTradeNo string `json:"outTradeNo"`
		PayChannel string `json:"payChannel"`
		PayURL     string `json:"payUrl"`
	}
	if err := json.Unmarshal(envelope.Data, &paymentData); err != nil {
		t.Fatalf("decode alipay payment create failed: %v", err)
	}
	if paymentData.PayChannel != "ALIPAY" {
		t.Fatalf("expect ALIPAY pay channel, got %s", paymentData.PayChannel)
	}
	if !strings.Contains(paymentData.PayURL, "openapi-sandbox.dl.alipaydev.com") {
		t.Fatalf("expect sandbox pay url, got %s", paymentData.PayURL)
	}

	alipayClient, err := alipaySDK.New("2021000000000000", privateKey, false, alipaySDK.WithNewSandboxGateway())
	if err != nil {
		t.Fatalf("create alipay client failed: %v", err)
	}
	if err = alipayClient.LoadAliPayPublicKey(publicKey); err != nil {
		t.Fatalf("load alipay public key failed: %v", err)
	}

	values := url.Values{}
	values.Set("out_trade_no", paymentData.OutTradeNo)
	values.Set("trade_no", "2026041800000001")
	values.Set("trade_status", "TRADE_SUCCESS")
	values.Set("sign_type", "RSA2")
	signature, err := alipayClient.SignValues(values, nsign.WithIgnore("sign_type"))
	if err != nil {
		t.Fatalf("sign alipay callback failed: %v", err)
	}
	values.Set("sign", base64.StdEncoding.EncodeToString(signature))

	statusCode, body := doFormRequestRaw(t, client, http.MethodPost, server.URL+"/api/v1/payments/callback/alipay", values.Encode(), nil)
	if statusCode != http.StatusOK {
		t.Fatalf("expect 200 callback status, got %d body=%s", statusCode, body)
	}
	if strings.TrimSpace(body) != "success" {
		t.Fatalf("expect success callback body, got %s", body)
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/payments/"+toPath(orderID)+"/status", passengerToken, nil)
	assertSuccess(t, envelope)
	var statusData struct {
		PayStatus       string `json:"payStatus"`
		ProviderTradeNo string `json:"providerTradeNo"`
	}
	if err := json.Unmarshal(envelope.Data, &statusData); err != nil {
		t.Fatalf("decode payment status failed: %v", err)
	}
	if statusData.PayStatus != "PAID" {
		t.Fatalf("expect payment paid, got %s", statusData.PayStatus)
	}
	if statusData.ProviderTradeNo != "2026041800000001" {
		t.Fatalf("unexpected provider trade no: %s", statusData.ProviderTradeNo)
	}
}
