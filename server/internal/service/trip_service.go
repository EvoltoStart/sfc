package service

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type TripCreateInput struct {
	VehicleID int64             `json:"vehicleId"`
	StartName string            `json:"startName"`
	StartLat  float64           `json:"startLat"`
	StartLng  float64           `json:"startLng"`
	EndName   string            `json:"endName"`
	EndLat    float64           `json:"endLat"`
	EndLng    float64           `json:"endLng"`
	Waypoints []domain.Waypoint `json:"waypoints"`
	DepartAt  string            `json:"departAt"`
	SeatTotal int               `json:"seatTotal"`
}

type TripUpdateInput struct {
	VehicleID int64             `json:"vehicleId"`
	StartName string            `json:"startName"`
	StartLat  float64           `json:"startLat"`
	StartLng  float64           `json:"startLng"`
	EndName   string            `json:"endName"`
	EndLat    float64           `json:"endLat"`
	EndLng    float64           `json:"endLng"`
	Waypoints []domain.Waypoint `json:"waypoints"`
	DepartAt  string            `json:"departAt"`
	SeatTotal int               `json:"seatTotal"`
}

type FrequencyCheckResult struct {
	Passed            bool  `json:"passed"`
	CurrentDayCount   int   `json:"currentDayCount"`
	CurrentMonthCount int   `json:"currentMonthCount"`
	RuleSnapshotID    int64 `json:"ruleSnapshotId"`
}

type TripCreateResult struct {
	TripID         int64                `json:"tripId"`
	TripStatus     string               `json:"tripStatus"`
	RouteScore     float64              `json:"routeScore"`
	PricePreview   PricePreviewResult   `json:"pricePreview"`
	FrequencyCheck FrequencyCheckResult `json:"frequencyCheck"`
}

func (s *Service) CreateTrip(userID int64, input TripCreateInput) (*TripCreateResult, *errno.Error) {
	if strings.TrimSpace(input.StartName) == "" || strings.TrimSpace(input.EndName) == "" || input.SeatTotal <= 0 || input.VehicleID <= 0 {
		return nil, errno.New("PARAM_INVALID", "行程发布参数不完整", http.StatusBadRequest)
	}

	departAt, appErr := parseRFC3339(input.DepartAt)
	if appErr != nil {
		return nil, appErr
	}
	pricePreview, appErr := s.PricePreview(PricePreviewInput{
		StartLat:  input.StartLat,
		StartLng:  input.StartLng,
		EndLat:    input.EndLat,
		EndLng:    input.EndLng,
		Waypoints: input.Waypoints,
		SeatCount: input.SeatTotal,
	})
	if appErr != nil {
		return nil, appErr
	}

	routePreview, appErr := s.RouteScorePreview(PricePreviewInput{
		StartLat:  input.StartLat,
		StartLng:  input.StartLng,
		EndLat:    input.EndLat,
		EndLng:    input.EndLng,
		Waypoints: input.Waypoints,
	})
	if appErr != nil {
		return nil, appErr
	}
	if !routePreview.Passed {
		return nil, errno.ErrRouteScoreNotPass
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr = s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}
	if !s.isDriverVerifiedLocked(userID) {
		return nil, errno.ErrDriverNotVerified
	}

	vehicle := s.store.Snapshot().Vehicles[input.VehicleID]
	if vehicle == nil {
		return nil, errno.ErrResourceNotFound
	}
	if vehicle.UserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if vehicle.AuthStatus != domain.AuthStatusApproved {
		return nil, errno.ErrDriverNotVerified
	}

	dayCount := 0
	monthCount := 0
	for _, trip := range s.store.Snapshot().Trips {
		if trip.DriverUserID != userID || trip.TripStatus == domain.TripStatusCancelled {
			continue
		}
		if sameDay(trip.DepartAt, departAt) {
			dayCount++
		}
		if trip.DepartAt.Year() == departAt.Year() && trip.DepartAt.Month() == departAt.Month() {
			monthCount++
		}
	}

	frequencySnapshot := &domain.RuleSnapshot{
		ID:           s.store.NextID("rule_snapshot"),
		RuleType:     "FREQUENCY_LIMIT",
		RuleVersion:  "v1",
		SnapshotJSON: `{"dayLimit":4,"monthLimit":60}`,
		CreatedAt:    now(),
	}
	s.store.Snapshot().RuleSnapshots[frequencySnapshot.ID] = frequencySnapshot

	if dayCount >= 4 || monthCount >= 60 {
		log := &domain.FrequencyLimitLog{
			ID:                s.store.NextID("frequency_limit_log"),
			DriverUserID:      userID,
			CityCode:          input.StartName,
			TripType:          "DEFAULT",
			CurrentDayCount:   dayCount,
			CurrentMonthCount: monthCount,
			RuleSnapshotID:    frequencySnapshot.ID,
			Passed:            false,
			CreatedAt:         now(),
		}
		s.store.Snapshot().FrequencyLogs[log.ID] = log
		return nil, errno.ErrFrequencyLimitExceeded
	}

	trip := &domain.Trip{
		ID:                  s.store.NextID("trip"),
		DriverUserID:        userID,
		VehicleID:           input.VehicleID,
		StartName:           strings.TrimSpace(input.StartName),
		StartLat:            input.StartLat,
		StartLng:            input.StartLng,
		EndName:             strings.TrimSpace(input.EndName),
		EndLat:              input.EndLat,
		EndLng:              input.EndLng,
		Waypoints:           input.Waypoints,
		DepartAt:            departAt,
		SeatTotal:           input.SeatTotal,
		SeatAvailable:       input.SeatTotal,
		PriceTotalFen:       pricePreview.TotalFeeFen,
		ServiceFeeFen:       pricePreview.ServiceFeeFen,
		DistanceMeter:       pricePreview.DistanceMeter,
		RouteScore:          routePreview.RouteScore,
		TripStatus:          domain.TripStatusPublished,
		FrequencySnapshotID: frequencySnapshot.ID,
		FrequencyDayCount:   dayCount + 1,
		FrequencyMonthCount: monthCount + 1,
		CreatedAt:           now(),
	}
	s.store.Snapshot().Trips[trip.ID] = trip

	frequencyLog := &domain.FrequencyLimitLog{
		ID:                s.store.NextID("frequency_limit_log"),
		DriverUserID:      userID,
		CityCode:          input.StartName,
		TripType:          "DEFAULT",
		CurrentDayCount:   dayCount + 1,
		CurrentMonthCount: monthCount + 1,
		RuleSnapshotID:    frequencySnapshot.ID,
		Passed:            true,
		CreatedAt:         now(),
	}
	s.store.Snapshot().FrequencyLogs[frequencyLog.ID] = frequencyLog

	pricingLog := &domain.PricingAuditLog{
		ID:                s.store.NextID("pricing_audit_log"),
		TripID:            trip.ID,
		PricingInputJSON:  marshalJSON(input),
		PricingResultJSON: marshalJSON(pricePreview),
		CreatedAt:         now(),
	}
	s.store.Snapshot().PricingLogs[pricingLog.ID] = pricingLog

	return &TripCreateResult{
		TripID:       trip.ID,
		TripStatus:   trip.TripStatus,
		RouteScore:   trip.RouteScore,
		PricePreview: *pricePreview,
		FrequencyCheck: FrequencyCheckResult{
			Passed:            true,
			CurrentDayCount:   dayCount + 1,
			CurrentMonthCount: monthCount + 1,
			RuleSnapshotID:    frequencySnapshot.ID,
		},
	}, nil
}

func (s *Service) UpdateTrip(userID, tripID int64, input TripUpdateInput) (*TripCreateResult, *errno.Error) {
	if strings.TrimSpace(input.StartName) == "" || strings.TrimSpace(input.EndName) == "" || input.SeatTotal <= 0 || input.VehicleID <= 0 {
		return nil, errno.New("PARAM_INVALID", "行程更新参数不完整", http.StatusBadRequest)
	}

	departAt, appErr := parseRFC3339(input.DepartAt)
	if appErr != nil {
		return nil, appErr
	}
	pricePreview, appErr := s.PricePreview(PricePreviewInput{
		StartLat:  input.StartLat,
		StartLng:  input.StartLng,
		EndLat:    input.EndLat,
		EndLng:    input.EndLng,
		Waypoints: input.Waypoints,
		SeatCount: input.SeatTotal,
	})
	if appErr != nil {
		return nil, appErr
	}

	routePreview, appErr := s.RouteScorePreview(PricePreviewInput{
		StartLat:  input.StartLat,
		StartLng:  input.StartLng,
		EndLat:    input.EndLat,
		EndLng:    input.EndLng,
		Waypoints: input.Waypoints,
	})
	if appErr != nil {
		return nil, appErr
	}
	if !routePreview.Passed {
		return nil, errno.ErrRouteScoreNotPass
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr = s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}
	if !s.isDriverVerifiedLocked(userID) {
		return nil, errno.ErrDriverNotVerified
	}

	trip := s.store.Snapshot().Trips[tripID]
	if trip == nil {
		return nil, errno.ErrResourceNotFound
	}
	if trip.DriverUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if trip.TripStatus == domain.TripStatusCancelled || trip.TripStatus == domain.TripStatusConfirmed ||
		trip.TripStatus == domain.TripStatusInProgress || trip.TripStatus == domain.TripStatusCompleted {
		return nil, errno.ErrTripStatusInvalid
	}

	vehicle := s.store.Snapshot().Vehicles[input.VehicleID]
	if vehicle == nil {
		return nil, errno.ErrResourceNotFound
	}
	if vehicle.UserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if vehicle.AuthStatus != domain.AuthStatusApproved {
		return nil, errno.ErrDriverNotVerified
	}

	for _, order := range s.store.Snapshot().Orders {
		if order.TripID != tripID {
			continue
		}
		if order.OrderStatus != domain.OrderStatusCancelled && order.OrderStatus != domain.OrderStatusRefunded {
			return nil, errno.ErrTripStatusInvalid
		}
	}

	dayCount := 0
	monthCount := 0
	for _, item := range s.store.Snapshot().Trips {
		if item.ID == tripID || item.DriverUserID != userID || item.TripStatus == domain.TripStatusCancelled {
			continue
		}
		if sameDay(item.DepartAt, departAt) {
			dayCount++
		}
		if item.DepartAt.Year() == departAt.Year() && item.DepartAt.Month() == departAt.Month() {
			monthCount++
		}
	}

	frequencySnapshot := &domain.RuleSnapshot{
		ID:           s.store.NextID("rule_snapshot"),
		RuleType:     "FREQUENCY_LIMIT",
		RuleVersion:  "v1",
		SnapshotJSON: `{"dayLimit":4,"monthLimit":60}`,
		CreatedAt:    now(),
	}
	s.store.Snapshot().RuleSnapshots[frequencySnapshot.ID] = frequencySnapshot

	if dayCount >= 4 || monthCount >= 60 {
		log := &domain.FrequencyLimitLog{
			ID:                s.store.NextID("frequency_limit_log"),
			DriverUserID:      userID,
			CityCode:          input.StartName,
			TripType:          "DEFAULT",
			CurrentDayCount:   dayCount,
			CurrentMonthCount: monthCount,
			RuleSnapshotID:    frequencySnapshot.ID,
			Passed:            false,
			CreatedAt:         now(),
		}
		s.store.Snapshot().FrequencyLogs[log.ID] = log
		return nil, errno.ErrFrequencyLimitExceeded
	}

	trip.VehicleID = input.VehicleID
	trip.StartName = strings.TrimSpace(input.StartName)
	trip.StartLat = input.StartLat
	trip.StartLng = input.StartLng
	trip.EndName = strings.TrimSpace(input.EndName)
	trip.EndLat = input.EndLat
	trip.EndLng = input.EndLng
	trip.Waypoints = input.Waypoints
	trip.DepartAt = departAt
	trip.SeatTotal = input.SeatTotal
	trip.SeatAvailable = input.SeatTotal
	trip.PriceTotalFen = pricePreview.TotalFeeFen
	trip.ServiceFeeFen = pricePreview.ServiceFeeFen
	trip.DistanceMeter = pricePreview.DistanceMeter
	trip.RouteScore = routePreview.RouteScore
	trip.FrequencySnapshotID = frequencySnapshot.ID
	trip.FrequencyDayCount = dayCount + 1
	trip.FrequencyMonthCount = monthCount + 1
	trip.CancelledReason = ""

	currentTime := now()
	for _, request := range s.store.Snapshot().JoinRequests {
		if request.TripID != trip.ID || request.RequestStatus != domain.JoinRequestStatusPending {
			continue
		}
		if matchRouteScore(request.StartLat, request.StartLng, request.EndLat, request.EndLng, trip) >= s.routePassScore {
			continue
		}
		request.RequestStatus = domain.JoinRequestStatusRejected
		request.Remark = "行程更新后不再顺路"
		request.RejectedAt = &currentTime
	}

	frequencyLog := &domain.FrequencyLimitLog{
		ID:                s.store.NextID("frequency_limit_log"),
		DriverUserID:      userID,
		CityCode:          input.StartName,
		TripType:          "DEFAULT",
		CurrentDayCount:   dayCount + 1,
		CurrentMonthCount: monthCount + 1,
		RuleSnapshotID:    frequencySnapshot.ID,
		Passed:            true,
		CreatedAt:         currentTime,
	}
	s.store.Snapshot().FrequencyLogs[frequencyLog.ID] = frequencyLog

	pricingLog := &domain.PricingAuditLog{
		ID:                s.store.NextID("pricing_audit_log"),
		TripID:            trip.ID,
		PricingInputJSON:  marshalJSON(input),
		PricingResultJSON: marshalJSON(pricePreview),
		CreatedAt:         currentTime,
	}
	s.store.Snapshot().PricingLogs[pricingLog.ID] = pricingLog
	s.refreshTripStatusLocked(trip.ID)

	return &TripCreateResult{
		TripID:       trip.ID,
		TripStatus:   trip.TripStatus,
		RouteScore:   trip.RouteScore,
		PricePreview: *pricePreview,
		FrequencyCheck: FrequencyCheckResult{
			Passed:            true,
			CurrentDayCount:   dayCount + 1,
			CurrentMonthCount: monthCount + 1,
			RuleSnapshotID:    frequencySnapshot.ID,
		},
	}, nil
}

func sameDay(left, right time.Time) bool {
	ly, lm, ld := left.Date()
	ry, rm, rd := right.Date()
	return ly == ry && lm == rm && ld == rd
}

func (s *Service) ListMyTrips(userID int64, status string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	type tripItem struct {
		TripID        int64     `json:"tripId"`
		DepartAt      time.Time `json:"departAt"`
		RouteSummary  string    `json:"routeSummary"`
		SeatTotal     int       `json:"seatTotal"`
		SeatAvailable int       `json:"seatAvailable"`
		ApplyCount    int       `json:"applyCount"`
		TripStatus    string    `json:"tripStatus"`
	}

	var items []tripItem
	for _, trip := range s.store.Snapshot().Trips {
		if trip.DriverUserID != userID {
			continue
		}
		if status != "" && trip.TripStatus != status {
			continue
		}
		applyCount := 0
		for _, request := range s.store.Snapshot().JoinRequests {
			if request.TripID == trip.ID && request.RequestStatus != domain.JoinRequestStatusCancelled && request.RequestStatus != domain.JoinRequestStatusRejected {
				applyCount++
			}
		}
		items = append(items, tripItem{
			TripID:        trip.ID,
			DepartAt:      trip.DepartAt,
			RouteSummary:  fmt.Sprintf("%s -> %s", trip.StartName, trip.EndName),
			SeatTotal:     trip.SeatTotal,
			SeatAvailable: trip.SeatAvailable,
			ApplyCount:    applyCount,
			TripStatus:    trip.TripStatus,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].DepartAt.After(items[j].DepartAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{
		"list":     paged,
		"page":     currentPage,
		"pageSize": currentPageSize,
		"total":    total,
	}, nil
}

func (s *Service) GetTrip(userID, tripID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}
	trip := s.store.Snapshot().Trips[tripID]
	if trip == nil {
		return nil, errno.ErrResourceNotFound
	}
	driver := s.store.Snapshot().Users[trip.DriverUserID]
	return map[string]any{
		"tripId": trip.ID,
		"driverInfo": map[string]any{
			"userId":   driver.ID,
			"nickname": driver.Nickname,
		},
		"routeInfo": map[string]any{
			"startName": trip.StartName,
			"startLat":  trip.StartLat,
			"startLng":  trip.StartLng,
			"endName":   trip.EndName,
			"endLat":    trip.EndLat,
			"endLng":    trip.EndLng,
			"waypoints": trip.Waypoints,
		},
		"routeScore": trip.RouteScore,
		"priceInfo": map[string]any{
			"totalFeeFen":   trip.PriceTotalFen,
			"serviceFeeFen": trip.ServiceFeeFen,
			"distanceMeter": trip.DistanceMeter,
		},
		"tripStatus":    trip.TripStatus,
		"seatAvailable": trip.SeatAvailable,
		"safetyInfo":    s.tripSafetyInfoLocked(userID),
	}, nil
}

func (s *Service) CancelTrip(userID, tripID int64, reason string) (map[string]any, *errno.Error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errno.New("PARAM_INVALID", "取消原因不能为空", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	trip := s.store.Snapshot().Trips[tripID]
	if trip == nil {
		return nil, errno.ErrResourceNotFound
	}
	if trip.DriverUserID != userID {
		return nil, errno.ErrUserForbidden
	}

	for _, order := range s.store.Snapshot().Orders {
		if order.TripID == tripID && order.OrderStatus != domain.OrderStatusCancelled && order.OrderStatus != domain.OrderStatusRefunded {
			return nil, errno.ErrTripStatusInvalid
		}
	}

	trip.TripStatus = domain.TripStatusCancelled
	trip.CancelledReason = reason
	return map[string]any{
		"success":    true,
		"tripStatus": trip.TripStatus,
	}, nil
}
