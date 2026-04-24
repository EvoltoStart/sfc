package httpapi

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"sfc/server/internal/service"
)

func createAcceptedOrder(t *testing.T, client *http.Client, baseURL string) (driverToken, passengerToken string, orderID int64) {
	t.Helper()

	driverToken = login(t, client, baseURL, "driver-pay")
	vehicleID := prepareDriver(t, client, baseURL, driverToken)

	envelope := doJSONRequest(t, client, http.MethodPost, baseURL+"/api/v1/trips", driverToken, map[string]any{
		"vehicleId": vehicleID,
		"startName": "北京朝阳",
		"startLat":  39.9219,
		"startLng":  116.4436,
		"endName":   "天津和平",
		"endLat":    39.1172,
		"endLng":    117.2000,
		"departAt":  time.Now().Add(4 * time.Hour).UTC().Format(time.RFC3339),
		"seatTotal": 2,
	})
	assertSuccess(t, envelope)
	var tripData struct {
		TripID int64 `json:"tripId"`
	}
	if err := json.Unmarshal(envelope.Data, &tripData); err != nil {
		t.Fatalf("decode trip data failed: %v", err)
	}

	passengerToken = login(t, client, baseURL, "passenger-pay")
	envelope = doJSONRequest(t, client, http.MethodPost, baseURL+"/api/v1/join-requests", passengerToken, map[string]any{
		"tripId":    tripData.TripID,
		"startName": "北京朝阳",
		"startLat":  39.9220,
		"startLng":  116.4437,
		"endName":   "天津和平",
		"endLat":    39.1171,
		"endLng":    117.2001,
	})
	assertSuccess(t, envelope)
	var joinData struct {
		JoinRequestID int64 `json:"joinRequestId"`
	}
	if err := json.Unmarshal(envelope.Data, &joinData); err != nil {
		t.Fatalf("decode join request failed: %v", err)
	}

	envelope = doJSONRequest(t, client, http.MethodPost, baseURL+"/api/v1/driver/join-requests/"+toPath(joinData.JoinRequestID)+"/accept", driverToken, map[string]any{
		"remark": "确认同行",
	})
	assertSuccess(t, envelope)
	var orderData struct {
		OrderID int64 `json:"orderId"`
	}
	if err := json.Unmarshal(envelope.Data, &orderData); err != nil {
		t.Fatalf("decode order data failed: %v", err)
	}

	return driverToken, passengerToken, orderData.OrderID
}

func TestGroup3PaymentSettlementAndWallet(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	driverToken, passengerToken, orderID := createAcceptedOrder(t, client, server.URL)

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
		"X-Wechat-Timestamp": "1713420000",
		"X-Wechat-Signature": service.ComputePaymentCallbackSignature(paymentData.OutTradeNo, "PAID", "1713420000"),
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/callback/wechat", "", map[string]any{
		"outTradeNo": paymentData.OutTradeNo,
		"payStatus":  "PAID",
	}, map[string]string{
		"X-Wechat-Timestamp": "1713420000",
		"X-Wechat-Signature": service.ComputePaymentCallbackSignature(paymentData.OutTradeNo, "PAID", "1713420000"),
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/orders/"+toPath(orderID)+"/confirm-board", passengerToken, nil)
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/orders/"+toPath(orderID)+"/confirm-arrival", passengerToken, nil)
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/wallet/account", driverToken, nil)
	assertSuccess(t, envelope)
	var walletData struct {
		AvailableAmountFen int64 `json:"availableAmountFen"`
	}
	if err := json.Unmarshal(envelope.Data, &walletData); err != nil {
		t.Fatalf("decode wallet account failed: %v", err)
	}
	if walletData.AvailableAmountFen <= 0 {
		t.Fatalf("expect settlement income, got %d", walletData.AvailableAmountFen)
	}
}

func TestGroup3RefundOnPaidOrderCancel(t *testing.T) {
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
		t.Fatalf("decode payment create failed: %v", err)
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/payments/callback/wechat", "", map[string]any{
		"outTradeNo": paymentData.OutTradeNo,
		"payStatus":  "PAID",
	}, map[string]string{
		"X-Wechat-Timestamp": "1713420001",
		"X-Wechat-Signature": service.ComputePaymentCallbackSignature(paymentData.OutTradeNo, "PAID", "1713420001"),
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/orders/"+toPath(orderID)+"/cancel", passengerToken, map[string]any{
		"reason": "临时有事",
	})
	assertSuccess(t, envelope)
	var cancelData struct {
		OrderStatus string `json:"orderStatus"`
	}
	if err := json.Unmarshal(envelope.Data, &cancelData); err != nil {
		t.Fatalf("decode cancel response failed: %v", err)
	}
	if cancelData.OrderStatus != "REFUNDED" {
		t.Fatalf("expect refunded status, got %s", cancelData.OrderStatus)
	}
}

func TestGroup3CreateWithdrawFreezesWalletBalance(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	driverToken, passengerToken, orderID := createAcceptedOrder(t, client, server.URL)

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
		"X-Wechat-Timestamp": "1713420004",
		"X-Wechat-Signature": service.ComputePaymentCallbackSignature(paymentData.OutTradeNo, "PAID", "1713420004"),
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/orders/"+toPath(orderID)+"/confirm-board", passengerToken, nil)
	assertSuccess(t, envelope)
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/orders/"+toPath(orderID)+"/confirm-arrival", passengerToken, nil)
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/wallet/account", driverToken, nil)
	assertSuccess(t, envelope)
	var beforeWallet struct {
		AvailableAmountFen int64 `json:"availableAmountFen"`
		FrozenAmountFen    int64 `json:"frozenAmountFen"`
	}
	if err := json.Unmarshal(envelope.Data, &beforeWallet); err != nil {
		t.Fatalf("decode wallet before withdraw failed: %v", err)
	}
	if beforeWallet.AvailableAmountFen <= 1000 {
		t.Fatalf("expect wallet income before withdraw, got %+v", beforeWallet)
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/wallet/withdraws", driverToken, map[string]any{
		"amountFen":       1000,
		"withdrawChannel": "WECHAT",
	})
	assertSuccess(t, envelope)
	var withdrawData struct {
		WithdrawStatus string `json:"withdrawStatus"`
	}
	if err := json.Unmarshal(envelope.Data, &withdrawData); err != nil {
		t.Fatalf("decode withdraw response failed: %v", err)
	}
	if withdrawData.WithdrawStatus != "PENDING" {
		t.Fatalf("expect pending withdraw, got %s", withdrawData.WithdrawStatus)
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/wallet/account", driverToken, nil)
	assertSuccess(t, envelope)
	var afterWallet struct {
		AvailableAmountFen int64 `json:"availableAmountFen"`
		FrozenAmountFen    int64 `json:"frozenAmountFen"`
	}
	if err := json.Unmarshal(envelope.Data, &afterWallet); err != nil {
		t.Fatalf("decode wallet after withdraw failed: %v", err)
	}
	if afterWallet.AvailableAmountFen != beforeWallet.AvailableAmountFen-1000 {
		t.Fatalf("unexpected available amount after withdraw: before=%d after=%d", beforeWallet.AvailableAmountFen, afterWallet.AvailableAmountFen)
	}
	if afterWallet.FrozenAmountFen != beforeWallet.FrozenAmountFen+1000 {
		t.Fatalf("unexpected frozen amount after withdraw: before=%d after=%d", beforeWallet.FrozenAmountFen, afterWallet.FrozenAmountFen)
	}
}
