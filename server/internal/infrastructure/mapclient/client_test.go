package mapclient

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"sfc/server/internal/domain"
	"sfc/server/internal/service"
)

func TestAMapMapClientRoute(t *testing.T) {
	var requested bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requested = true
		if r.URL.Path != "/v3/direction/driving" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.URL.Query().Get("origin"); got != "113.930400,22.533300" {
			t.Fatalf("unexpected origin: %s", got)
		}
		if got := r.URL.Query().Get("destination"); got != "113.264400,23.129100" {
			t.Fatalf("unexpected destination: %s", got)
		}
		if got := r.URL.Query().Get("waypoints"); got != "113.500000,22.800000" {
			t.Fatalf("unexpected waypoints: %s", got)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"status":"1","info":"OK","route":{"paths":[{"distance":"12345","duration":"678"}]}}`)
	}))
	defer server.Close()

	client := &amapClient{
		key:        "test-key",
		baseURL:    server.URL,
		httpClient: server.Client(),
	}
	metrics, err := client.Route(context.Background(), service.RouteRequest{
		StartLat: 22.5333,
		StartLng: 113.9304,
		Waypoints: []domain.Waypoint{
			{Lat: 22.8, Lng: 113.5},
		},
		EndLat: 23.1291,
		EndLng: 113.2644,
	})
	if err != nil {
		t.Fatalf("route failed: %v", err)
	}
	if !requested {
		t.Fatal("expected amap client to call remote api")
	}
	if metrics.DistanceMeter != 12345 {
		t.Fatalf("unexpected distance: %d", metrics.DistanceMeter)
	}
	if metrics.DurationSecond != 678 {
		t.Fatalf("unexpected duration: %d", metrics.DurationSecond)
	}
	if !strings.EqualFold(metrics.Provider, "AMAP") {
		t.Fatalf("unexpected provider: %s", metrics.Provider)
	}
}
