package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestGroup2JoinRequestAndOrderLifecycle(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	driverToken := login(t, client, server.URL, "driver-order")
	vehicleID := prepareDriver(t, client, server.URL, driverToken)

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/trips", driverToken, map[string]any{
		"vehicleId": vehicleID,
		"startName": "苏州工业园区",
		"startLat":  31.2989,
		"startLng":  120.5853,
		"endName":   "南京鼓楼",
		"endLat":    32.0603,
		"endLng":    118.7969,
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

	passengerToken := login(t, client, server.URL, "passenger-order")
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/join-requests", passengerToken, map[string]any{
		"tripId":    tripData.TripID,
		"startName": "苏州工业园区",
		"startLat":  31.2990,
		"startLng":  120.5855,
		"endName":   "南京鼓楼",
		"endLat":    32.0601,
		"endLng":    118.7971,
	})
	assertSuccess(t, envelope)
	var joinData struct {
		JoinRequestID int64 `json:"joinRequestId"`
	}
	if err := json.Unmarshal(envelope.Data, &joinData); err != nil {
		t.Fatalf("decode join request data failed: %v", err)
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/driver/join-requests/"+toPath(joinData.JoinRequestID)+"/accept", driverToken, map[string]any{
		"remark": "可以同行",
	})
	assertSuccess(t, envelope)
	var orderData struct {
		OrderID int64 `json:"orderId"`
	}
	if err := json.Unmarshal(envelope.Data, &orderData); err != nil {
		t.Fatalf("decode order data failed: %v", err)
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/orders?role=passenger", passengerToken, nil)
	assertSuccess(t, envelope)
	var listData struct {
		List []map[string]any `json:"list"`
	}
	if err := json.Unmarshal(envelope.Data, &listData); err != nil {
		t.Fatalf("decode order list failed: %v", err)
	}
	if len(listData.List) != 1 {
		t.Fatalf("expect 1 order, got %d", len(listData.List))
	}

	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/orders/"+toPath(orderData.OrderID)+"/cancel", passengerToken, map[string]any{
		"reason": "行程变更",
	})
	assertSuccess(t, envelope)
}

func toPath(id int64) string {
	return fmt.Sprintf("%d", id)
}
