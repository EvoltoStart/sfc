package service

import (
	"net/http"
	"sort"
	"strings"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type RouteTemplateInput struct {
	RouteName  string            `json:"routeName"`
	StartName  string            `json:"startName"`
	StartLat   float64           `json:"startLat"`
	StartLng   float64           `json:"startLng"`
	EndName    string            `json:"endName"`
	EndLat     float64           `json:"endLat"`
	EndLng     float64           `json:"endLng"`
	Waypoints  []domain.Waypoint `json:"waypoints"`
	TimePeriod string            `json:"timePeriod"`
}

type RouteTemplateView struct {
	ID         int64             `json:"id"`
	RouteName  string            `json:"routeName"`
	StartName  string            `json:"startName"`
	StartLat   float64           `json:"startLat"`
	StartLng   float64           `json:"startLng"`
	EndName    string            `json:"endName"`
	EndLat     float64           `json:"endLat"`
	EndLng     float64           `json:"endLng"`
	Waypoints  []domain.Waypoint `json:"waypoints"`
	TimePeriod string            `json:"timePeriod"`
	IsDefault  bool              `json:"isDefault"`
}

type PricePreviewInput struct {
	StartLat  float64           `json:"startLat"`
	StartLng  float64           `json:"startLng"`
	EndLat    float64           `json:"endLat"`
	EndLng    float64           `json:"endLng"`
	Waypoints []domain.Waypoint `json:"waypoints"`
	SeatCount int               `json:"seatCount"`
}

type PricePreviewResult struct {
	MileageFeeFen int64 `json:"mileageFeeFen"`
	TollFeeFen    int64 `json:"tollFeeFen"`
	ServiceFeeFen int64 `json:"serviceFeeFen"`
	TotalFeeFen   int64 `json:"totalFeeFen"`
	DistanceMeter int64 `json:"distanceMeter"`
}

type RouteScorePreviewResult struct {
	RouteScore     float64 `json:"routeScore"`
	Passed         bool    `json:"passed"`
	RuleSnapshotID int64   `json:"ruleSnapshotId"`
	Message        string  `json:"message"`
}

func (s *Service) ListRouteTemplates(userID int64) ([]RouteTemplateView, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	var templates []RouteTemplateView
	for _, route := range s.store.Snapshot().RouteTemplates {
		if route.UserID == userID {
			templates = append(templates, RouteTemplateView{
				ID:         route.ID,
				RouteName:  route.RouteName,
				StartName:  route.StartName,
				StartLat:   route.StartLat,
				StartLng:   route.StartLng,
				EndName:    route.EndName,
				EndLat:     route.EndLat,
				EndLng:     route.EndLng,
				Waypoints:  route.Waypoints,
				TimePeriod: route.TimePeriod,
				IsDefault:  route.IsDefault,
			})
		}
	}
	sort.Slice(templates, func(i, j int) bool {
		if boolToInt(templates[i].IsDefault) == boolToInt(templates[j].IsDefault) {
			return templates[i].ID < templates[j].ID
		}
		return templates[i].IsDefault
	})
	return templates, nil
}

func (s *Service) CreateRouteTemplate(userID int64, input RouteTemplateInput) (*domain.RouteTemplate, *errno.Error) {
	if strings.TrimSpace(input.RouteName) == "" || strings.TrimSpace(input.StartName) == "" || strings.TrimSpace(input.EndName) == "" {
		return nil, errno.New("PARAM_INVALID", "路线模板信息不完整", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	currentTime := now()
	template := &domain.RouteTemplate{
		ID:         s.store.NextID("route_template"),
		UserID:     userID,
		RouteName:  strings.TrimSpace(input.RouteName),
		StartName:  strings.TrimSpace(input.StartName),
		StartLat:   input.StartLat,
		StartLng:   input.StartLng,
		EndName:    strings.TrimSpace(input.EndName),
		EndLat:     input.EndLat,
		EndLng:     input.EndLng,
		Waypoints:  input.Waypoints,
		TimePeriod: strings.TrimSpace(input.TimePeriod),
		IsDefault:  len(s.routeTemplatesByUserLocked(userID)) == 0,
		CreatedAt:  currentTime,
		UpdatedAt:  currentTime,
	}
	if template.IsDefault {
		for _, item := range s.store.Snapshot().RouteTemplates {
			if item.UserID == userID {
				item.IsDefault = false
			}
		}
		template.IsDefault = true
	}
	s.store.Snapshot().RouteTemplates[template.ID] = template
	return template, nil
}

func (s *Service) UpdateRouteTemplate(userID, routeID int64, input RouteTemplateInput) (*domain.RouteTemplate, *errno.Error) {
	if strings.TrimSpace(input.RouteName) == "" || strings.TrimSpace(input.StartName) == "" || strings.TrimSpace(input.EndName) == "" {
		return nil, errno.New("PARAM_INVALID", "路线模板信息不完整", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	template := s.store.Snapshot().RouteTemplates[routeID]
	if template == nil {
		return nil, errno.ErrResourceNotFound
	}
	if template.UserID != userID {
		return nil, errno.ErrUserForbidden
	}

	template.RouteName = strings.TrimSpace(input.RouteName)
	template.StartName = strings.TrimSpace(input.StartName)
	template.StartLat = input.StartLat
	template.StartLng = input.StartLng
	template.EndName = strings.TrimSpace(input.EndName)
	template.EndLat = input.EndLat
	template.EndLng = input.EndLng
	template.Waypoints = input.Waypoints
	template.TimePeriod = strings.TrimSpace(input.TimePeriod)
	template.UpdatedAt = now()
	return template, nil
}

func (s *Service) DeleteRouteTemplate(userID, routeID int64) *errno.Error {
	s.store.Lock()
	defer s.store.Unlock()

	template := s.store.Snapshot().RouteTemplates[routeID]
	if template == nil {
		return errno.ErrResourceNotFound
	}
	if template.UserID != userID {
		return errno.ErrUserForbidden
	}

	wasDefault := template.IsDefault
	delete(s.store.Snapshot().RouteTemplates, routeID)
	if wasDefault {
		items := s.routeTemplatesByUserLocked(userID)
		if len(items) > 0 {
			items[0].IsDefault = true
		}
	}
	return nil
}

func (s *Service) SetDefaultRouteTemplate(userID, routeID int64) *errno.Error {
	s.store.Lock()
	defer s.store.Unlock()

	template := s.store.Snapshot().RouteTemplates[routeID]
	if template == nil {
		return errno.ErrResourceNotFound
	}
	if template.UserID != userID {
		return errno.ErrUserForbidden
	}

	for _, item := range s.store.Snapshot().RouteTemplates {
		if item.UserID == userID {
			item.IsDefault = item.ID == routeID
		}
	}
	return nil
}

func (s *Service) routeTemplatesByUserLocked(userID int64) []*domain.RouteTemplate {
	var items []*domain.RouteTemplate
	for _, route := range s.store.Snapshot().RouteTemplates {
		if route.UserID == userID {
			items = append(items, route)
		}
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ID < items[j].ID })
	return items
}

func (s *Service) PricePreview(input PricePreviewInput) (*PricePreviewResult, *errno.Error) {
	if input.SeatCount <= 0 {
		input.SeatCount = 1
	}
	metrics, appErr := s.loadRouteMetrics(input)
	if appErr != nil {
		return nil, errno.New("PARAM_INVALID", "路线距离必须大于 0", http.StatusBadRequest)
	}
	mileage, toll, serviceFee, total := calculatePrice(metrics.DistanceMeter)
	return &PricePreviewResult{
		MileageFeeFen: mileage,
		TollFeeFen:    toll,
		ServiceFeeFen: serviceFee,
		TotalFeeFen:   total,
		DistanceMeter: metrics.DistanceMeter,
	}, nil
}

func (s *Service) RouteScorePreview(input PricePreviewInput) (*RouteScorePreviewResult, *errno.Error) {
	metrics, appErr := s.loadRouteMetrics(input)
	if appErr != nil {
		return nil, appErr
	}
	score := directnessScoreByDistance(metrics.DistanceMeter, input.StartLat, input.StartLng, input.EndLat, input.EndLng)
	passed := score >= s.routePassScore

	s.store.Lock()
	defer s.store.Unlock()

	snapshot := &domain.RuleSnapshot{
		ID:           s.store.NextID("rule_snapshot"),
		RuleType:     "ROUTE_SCORE",
		RuleVersion:  "v1",
		SnapshotJSON: marshalJSON(input),
		CreatedAt:    now(),
	}
	s.store.Snapshot().RuleSnapshots[snapshot.ID] = snapshot

	message := "椤鸿矾搴﹂鏍￠獙閫氳繃"
	if !passed {
		message = "椤鸿矾搴﹂鏍￠獙鏈€氳繃"
	}
	return &RouteScorePreviewResult{
		RouteScore:     score,
		Passed:         passed,
		RuleSnapshotID: snapshot.ID,
		Message:        message,
	}, nil
}
