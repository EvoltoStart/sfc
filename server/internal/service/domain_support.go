package service

import (
	"context"
	"net/http"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

func (s *Service) loadRouteMetrics(input PricePreviewInput) (*RouteMetrics, *errno.Error) {
	metrics, err := s.mapClient.Route(context.Background(), RouteRequest{
		StartLat:  input.StartLat,
		StartLng:  input.StartLng,
		Waypoints: input.Waypoints,
		EndLat:    input.EndLat,
		EndLng:    input.EndLng,
	})
	if err != nil {
		return nil, errno.Internal("鍦板浘璺緞瑙勫垝澶辫触")
	}
	if metrics == nil || metrics.DistanceMeter <= 0 {
		return nil, errno.New("PARAM_INVALID", "璺嚎璺濈蹇呴』澶т簬 0", http.StatusBadRequest)
	}
	return metrics, nil
}

func (s *Service) ensureSafetyConfigLocked(userID int64) *domain.SafetyConfig {
	config := s.store.Snapshot().SafetyConfigs[userID]
	if config != nil {
		return config
	}

	config = &domain.SafetyConfig{
		ID:                     s.store.NextID("safety_config"),
		UserID:                 userID,
		ShareTripByDefault:     true,
		DefaultShareContactIDs: s.defaultShareContactIDsLocked(userID),
		SOSAutoNotifyContacts:  true,
		TraceVisibleToContacts: true,
		UpdatedAt:              now(),
	}
	s.store.Snapshot().SafetyConfigs[userID] = config
	return config
}

func (s *Service) defaultShareContactIDsLocked(userID int64) []int64 {
	var ids []int64
	for _, contact := range s.contactsByUserLocked(userID) {
		if contact.IsDefault {
			ids = append(ids, contact.ID)
		}
	}
	return ids
}

func (s *Service) tripSafetyInfoLocked(userID int64) map[string]any {
	config := s.ensureSafetyConfigLocked(userID)
	return map[string]any{
		"shareEnabled":           config.ShareTripByDefault,
		"defaultShareContactIds": cloneInt64Slice(config.DefaultShareContactIDs),
		"recordEnabled":          config.TraceVisibleToContacts,
	}
}

func (s *Service) traceSummaryLocked(order *domain.RideOrder) map[string]any {
	points := s.store.Snapshot().SafetyTracePoints[order.ID]
	if len(points) >= 2 {
		totalDistance := int64(0)
		for index := 1; index < len(points); index++ {
			totalDistance += int64(haversineMeter(points[index-1].Lat, points[index-1].Lng, points[index].Lat, points[index].Lng))
		}
		startAt := points[0].RecordedAt
		endAt := points[len(points)-1].RecordedAt
		abnormal := order.ExceptionFlag
		if order.DistanceMeter > 0 && totalDistance > order.DistanceMeter*2 {
			abnormal = true
		}
		return map[string]any{
			"totalDistanceMeter":  totalDistance,
			"totalDurationSecond": int64(endAt.Sub(startAt) / time.Second),
			"abnormalFlag":        abnormal,
			"startAt":             startAt,
			"endAt":               endAt,
		}
	}

	var totalDuration int64
	if order.BoardConfirmedAt != nil && order.ArrivalConfirmedAt != nil {
		totalDuration = int64(order.ArrivalConfirmedAt.Sub(*order.BoardConfirmedAt) / time.Second)
	}

	startAt := any(nil)
	if order.BoardConfirmedAt != nil {
		startAt = *order.BoardConfirmedAt
	}
	endAt := any(nil)
	if order.ArrivalConfirmedAt != nil {
		endAt = *order.ArrivalConfirmedAt
	}

	totalDistance := int64(0)
	if order.BoardConfirmedAt != nil || order.ArrivalConfirmedAt != nil || order.OrderStatus == domain.OrderStatusCompleted {
		totalDistance = order.DistanceMeter
	}

	return map[string]any{
		"totalDistanceMeter":  totalDistance,
		"totalDurationSecond": totalDuration,
		"abnormalFlag":        order.ExceptionFlag,
		"startAt":             startAt,
		"endAt":               endAt,
	}
}
