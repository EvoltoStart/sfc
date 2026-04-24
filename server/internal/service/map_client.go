package service

import (
	"context"

	"sfc/server/internal/domain"
)

type MapClient interface {
	Route(ctx context.Context, req RouteRequest) (*RouteMetrics, error)
}

type RouteRequest struct {
	StartLat  float64
	StartLng  float64
	Waypoints []domain.Waypoint
	EndLat    float64
	EndLng    float64
}

type RouteMetrics struct {
	DistanceMeter  int64
	DurationSecond int64
	Provider       string
}
