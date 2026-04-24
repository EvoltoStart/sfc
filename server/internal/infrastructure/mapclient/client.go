package mapclient

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"sfc/server/internal/domain"
	"sfc/server/internal/service"
)

type fallbackClient struct{}

func NewFallback() service.MapClient {
	return fallbackClient{}
}

func (fallbackClient) Route(_ context.Context, req service.RouteRequest) (*service.RouteMetrics, error) {
	return &service.RouteMetrics{
		DistanceMeter:  pathDistanceMeter(req.StartLat, req.StartLng, req.Waypoints, req.EndLat, req.EndLng),
		DurationSecond: 0,
		Provider:       "HAVERSINE",
	}, nil
}

type amapClient struct {
	key        string
	baseURL    string
	httpClient *http.Client
}

func NewAMap(key, baseURL string) service.MapClient {
	key = strings.TrimSpace(key)
	if key == "" {
		return NewFallback()
	}
	baseURL = strings.TrimSpace(baseURL)
	if baseURL == "" {
		baseURL = "https://restapi.amap.com"
	}
	return &amapClient{
		key:        key,
		baseURL:    strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

func (c *amapClient) Route(ctx context.Context, req service.RouteRequest) (*service.RouteMetrics, error) {
	values := url.Values{}
	values.Set("key", c.key)
	values.Set("origin", fmt.Sprintf("%.6f,%.6f", req.StartLng, req.StartLat))
	values.Set("destination", fmt.Sprintf("%.6f,%.6f", req.EndLng, req.EndLat))
	values.Set("strategy", "0")
	values.Set("extensions", "base")
	if waypointValue := formatAMapWaypoints(req.Waypoints); waypointValue != "" {
		values.Set("waypoints", waypointValue)
	}

	requestURL := c.baseURL + "/v3/direction/driving?" + values.Encode()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload struct {
		Status string `json:"status"`
		Info   string `json:"info"`
		Route  struct {
			Paths []struct {
				Distance string `json:"distance"`
				Duration string `json:"duration"`
			} `json:"paths"`
		} `json:"route"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("amap status=%d info=%s", resp.StatusCode, payload.Info)
	}
	if payload.Status != "1" || len(payload.Route.Paths) == 0 {
		return nil, fmt.Errorf("amap route not available: %s", payload.Info)
	}

	distance, err := strconv.ParseInt(payload.Route.Paths[0].Distance, 10, 64)
	if err != nil {
		return nil, err
	}
	duration, _ := strconv.ParseInt(payload.Route.Paths[0].Duration, 10, 64)
	return &service.RouteMetrics{
		DistanceMeter:  distance,
		DurationSecond: duration,
		Provider:       "AMAP",
	}, nil
}

func formatAMapWaypoints(waypoints []domain.Waypoint) string {
	if len(waypoints) == 0 {
		return ""
	}
	values := make([]string, 0, len(waypoints))
	for _, point := range waypoints {
		values = append(values, fmt.Sprintf("%.6f,%.6f", point.Lng, point.Lat))
	}
	return strings.Join(values, ";")
}

func haversineMeter(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371000.0

	lat1Rad := lat1 * mathPi / 180
	lat2Rad := lat2 * mathPi / 180
	deltaLat := (lat2 - lat1) * mathPi / 180
	deltaLng := (lng2 - lng1) * mathPi / 180

	sinLat := mathSin(deltaLat / 2)
	sinLng := mathSin(deltaLng / 2)
	a := sinLat*sinLat + mathCos(lat1Rad)*mathCos(lat2Rad)*sinLng*sinLng
	c := 2 * mathAtan2(mathSqrt(a), mathSqrt(1-a))
	return earthRadius * c
}

func pathDistanceMeter(startLat, startLng float64, waypoints []domain.Waypoint, endLat, endLng float64) int64 {
	if len(waypoints) == 0 {
		return int64(mathRound(haversineMeter(startLat, startLng, endLat, endLng)))
	}

	total := 0.0
	currentLat, currentLng := startLat, startLng
	for _, point := range waypoints {
		total += haversineMeter(currentLat, currentLng, point.Lat, point.Lng)
		currentLat, currentLng = point.Lat, point.Lng
	}
	total += haversineMeter(currentLat, currentLng, endLat, endLng)
	return int64(mathRound(total))
}

const mathPi = 3.141592653589793

func mathSin(v float64) float64      { return mathImplSin(v) }
func mathCos(v float64) float64      { return mathImplCos(v) }
func mathSqrt(v float64) float64     { return mathImplSqrt(v) }
func mathAtan2(y, x float64) float64 { return mathImplAtan2(y, x) }
func mathRound(v float64) float64    { return mathImplRound(v) }
