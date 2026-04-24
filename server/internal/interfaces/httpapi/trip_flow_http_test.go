package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"sfc/server/internal/bootstrap"
	"sfc/server/internal/store"
)

type apiEnvelope struct {
	Code      any             `json:"code"`
	Message   string          `json:"message"`
	Data      json.RawMessage `json:"data"`
	RequestID string          `json:"requestId"`
}

func newTestServer() *httptest.Server {
	svc := bootstrap.NewService(store.NewMemoryStore())
	return httptest.NewServer(NewRouter(svc))
}

func doJSONRequest(t *testing.T, client *http.Client, method, url, token string, body any, extraHeaders ...map[string]string) apiEnvelope {
	t.Helper()

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("marshal body failed: %v", err)
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		t.Fatalf("create request failed: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if len(extraHeaders) > 0 {
		for key, value := range extraHeaders[0] {
			req.Header.Set(key, value)
		}
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("do request failed: %v", err)
	}
	defer resp.Body.Close()

	var envelope apiEnvelope
	if err = json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}
	return envelope
}

func assertSuccess(t *testing.T, envelope apiEnvelope) {
	t.Helper()
	code, ok := envelope.Code.(float64)
	if !ok || code != 0 {
		t.Fatalf("expect success, got code=%v message=%s", envelope.Code, envelope.Message)
	}
}

func login(t *testing.T, client *http.Client, baseURL, code string) string {
	t.Helper()
	envelope := doJSONRequest(t, client, http.MethodPost, baseURL+"/api/v1/auth/wx-login", "", map[string]any{
		"code": code,
	})
	assertSuccess(t, envelope)
	var data struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode login data failed: %v", err)
	}
	return data.Token
}

func prepareDriver(t *testing.T, client *http.Client, baseURL, token string) int64 {
	t.Helper()

	envelope := doJSONRequest(t, client, http.MethodPost, baseURL+"/api/v1/driver/license/submit", token, map[string]any{
		"licenseNo":  "A123456789",
		"issueDate":  "2024-01-01",
		"expireDate": "2034-01-01",
		"imageUrl":   "https://example.com/license.png",
	})
	assertSuccess(t, envelope)

	envelope = doJSONRequest(t, client, http.MethodPost, baseURL+"/api/v1/driver/vehicles", token, map[string]any{
		"brand":     "比亚迪",
		"model":     "汉",
		"color":     "黑色",
		"plateNo":   "粤B12345",
		"seatCount": 4,
	})
	assertSuccess(t, envelope)
	var data struct {
		VehicleID int64 `json:"vehicleId"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode vehicle data failed: %v", err)
	}
	return data.VehicleID
}

func TestGroup1TripPublishAndSearch(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	driverToken := login(t, client, server.URL, "driver-user")
	vehicleID := prepareDriver(t, client, server.URL, driverToken)

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/trips", driverToken, map[string]any{
		"vehicleId": vehicleID,
		"startName": "深圳南山",
		"startLat":  22.5333,
		"startLng":  113.9304,
		"endName":   "广州天河",
		"endLat":    23.1291,
		"endLng":    113.2644,
		"departAt":  time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339),
		"seatTotal": 3,
	})
	assertSuccess(t, envelope)

	passengerToken := login(t, client, server.URL, "passenger-user")
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/search/matches", passengerToken, map[string]any{
		"startName": "深圳南山",
		"startLat":  22.5334,
		"startLng":  113.9305,
		"endName":   "广州天河",
		"endLat":    23.1292,
		"endLng":    113.2645,
		"departAt":  time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339),
		"page":      1,
		"pageSize":  10,
	})
	assertSuccess(t, envelope)

	var data struct {
		List []map[string]any `json:"list"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode matches failed: %v", err)
	}
	if len(data.List) != 1 {
		t.Fatalf("expect 1 match, got %d", len(data.List))
	}
}

func TestGroup1FrequencyLimit(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	driverToken := login(t, client, server.URL, "driver-limit")
	vehicleID := prepareDriver(t, client, server.URL, driverToken)

	for i := 0; i < 4; i++ {
		envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/trips", driverToken, map[string]any{
			"vehicleId": vehicleID,
			"startName": "杭州滨江",
			"startLat":  30.2062,
			"startLng":  120.2120,
			"endName":   "上海浦东",
			"endLat":    31.2304,
			"endLng":    121.4737,
			"departAt":  time.Now().Add(time.Duration(i+1) * time.Hour).UTC().Format(time.RFC3339),
			"seatTotal": 2,
		})
		assertSuccess(t, envelope)
	}

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/trips", driverToken, map[string]any{
		"vehicleId": vehicleID,
		"startName": "杭州滨江",
		"startLat":  30.2062,
		"startLng":  120.2120,
		"endName":   "上海浦东",
		"endLat":    31.2304,
		"endLng":    121.4737,
		"departAt":  time.Now().Add(6 * time.Hour).UTC().Format(time.RFC3339),
		"seatTotal": 2,
	})
	if envelope.Code != "FREQUENCY_LIMIT_EXCEEDED" {
		t.Fatalf("expect FREQUENCY_LIMIT_EXCEEDED, got %v", envelope.Code)
	}
}

func TestGroup1UpdateTripRecalculatesRouteAndRejectsMismatchRequest(t *testing.T) {
	server := newTestServer()
	defer server.Close()

	client := server.Client()
	driverToken := login(t, client, server.URL, "driver-update-trip")
	vehicleID := prepareDriver(t, client, server.URL, driverToken)

	envelope := doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/trips", driverToken, map[string]any{
		"vehicleId": vehicleID,
		"startName": "Beijing",
		"startLat":  39.9219,
		"startLng":  116.4436,
		"endName":   "Tianjin",
		"endLat":    39.1172,
		"endLng":    117.2000,
		"departAt":  time.Now().Add(2 * time.Hour).UTC().Format(time.RFC3339),
		"seatTotal": 2,
	})
	assertSuccess(t, envelope)
	var tripData struct {
		TripID int64 `json:"tripId"`
	}
	if err := json.Unmarshal(envelope.Data, &tripData); err != nil {
		t.Fatalf("decode trip create failed: %v", err)
	}

	passengerToken := login(t, client, server.URL, "passenger-update-trip")
	envelope = doJSONRequest(t, client, http.MethodPost, server.URL+"/api/v1/join-requests", passengerToken, map[string]any{
		"tripId":    tripData.TripID,
		"startName": "Beijing",
		"startLat":  39.9220,
		"startLng":  116.4437,
		"endName":   "Tianjin",
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

	envelope = doJSONRequest(t, client, http.MethodPut, server.URL+"/api/v1/trips/"+toPath(tripData.TripID), driverToken, map[string]any{
		"vehicleId": vehicleID,
		"startName": "Shanghai",
		"startLat":  31.2304,
		"startLng":  121.4737,
		"endName":   "Hangzhou",
		"endLat":    30.2741,
		"endLng":    120.1551,
		"departAt":  time.Now().Add(3 * time.Hour).UTC().Format(time.RFC3339),
		"seatTotal": 4,
	})
	assertSuccess(t, envelope)
	var updateData struct {
		TripStatus string `json:"tripStatus"`
	}
	if err := json.Unmarshal(envelope.Data, &updateData); err != nil {
		t.Fatalf("decode trip update failed: %v", err)
	}
	if updateData.TripStatus != "PUBLISHED" {
		t.Fatalf("expect published after mismatch requests are rejected, got %s", updateData.TripStatus)
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/join-requests/"+toPath(joinData.JoinRequestID), passengerToken, nil)
	assertSuccess(t, envelope)
	var requestDetail struct {
		RequestStatus string `json:"requestStatus"`
	}
	if err := json.Unmarshal(envelope.Data, &requestDetail); err != nil {
		t.Fatalf("decode join request detail failed: %v", err)
	}
	if requestDetail.RequestStatus != "REJECTED" {
		t.Fatalf("expect join request rejected after trip update, got %s", requestDetail.RequestStatus)
	}

	envelope = doJSONRequest(t, client, http.MethodGet, server.URL+"/api/v1/trips/"+toPath(tripData.TripID), driverToken, nil)
	assertSuccess(t, envelope)
	var tripDetail struct {
		RouteInfo struct {
			StartName string `json:"startName"`
			EndName   string `json:"endName"`
		} `json:"routeInfo"`
		SeatAvailable int `json:"seatAvailable"`
	}
	if err := json.Unmarshal(envelope.Data, &tripDetail); err != nil {
		t.Fatalf("decode trip detail failed: %v", err)
	}
	if tripDetail.RouteInfo.StartName != "Shanghai" || tripDetail.RouteInfo.EndName != "Hangzhou" {
		t.Fatalf("unexpected trip route after update: %+v", tripDetail.RouteInfo)
	}
	if tripDetail.SeatAvailable != 4 {
		t.Fatalf("expect seat available reset to 4, got %d", tripDetail.SeatAvailable)
	}
}
