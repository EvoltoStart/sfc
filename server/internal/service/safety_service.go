package service

import (
	"strings"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

type SafetyConfigInput struct {
	ShareEnabled           bool    `json:"shareEnabled"`
	DefaultShareContactIDs []int64 `json:"defaultShareContactIds"`
	RecordEnabled          bool    `json:"recordEnabled"`
}

type SafetyShareLinkInput struct {
	OrderID    int64   `json:"orderId"`
	ContactIDs []int64 `json:"contactIds"`
}

type SafetySOSInput struct {
	OrderID    int64   `json:"orderId"`
	CurrentLat float64 `json:"currentLat"`
	CurrentLng float64 `json:"currentLng"`
	Remark     string  `json:"remark"`
}

type SafetyTracePointInput struct {
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	RecordedAt string  `json:"recordedAt"`
}

type SafetyTraceBatchInput struct {
	OrderID int64                   `json:"orderId"`
	Points  []SafetyTracePointInput `json:"points"`
}

func (s *Service) GetSafetyConfig(userID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	config := s.ensureSafetyConfigLocked(userID)
	return map[string]any{
		"shareEnabled":           config.ShareTripByDefault,
		"defaultShareContactIds": cloneInt64Slice(config.DefaultShareContactIDs),
		"recordEnabled":          config.TraceVisibleToContacts,
		"recordNotice":           "行程轨迹仅在行程中采集，用于安全回溯与异常核查。",
	}, nil
}

func (s *Service) UpdateSafetyConfig(userID int64, input SafetyConfigInput) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	config := s.ensureSafetyConfigLocked(userID)
	config.ShareTripByDefault = input.ShareEnabled
	config.TraceVisibleToContacts = input.RecordEnabled
	config.DefaultShareContactIDs = s.filterContactIDsLocked(userID, input.DefaultShareContactIDs)
	config.SOSAutoNotifyContacts = len(config.DefaultShareContactIDs) > 0
	config.UpdatedAt = now()

	return map[string]any{
		"success": true,
	}, nil
}

func (s *Service) CreateSafetyShareLink(userID int64, input SafetyShareLinkInput) (map[string]any, *errno.Error) {
	if input.OrderID <= 0 {
		return nil, errno.ErrParamInvalid
	}

	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[input.OrderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.DriverUserID != userID && order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	config := s.ensureSafetyConfigLocked(userID)
	contactIDs := s.filterContactIDsLocked(userID, input.ContactIDs)
	if len(contactIDs) == 0 {
		contactIDs = cloneInt64Slice(config.DefaultShareContactIDs)
	}

	currentTime := now()
	link := &domain.SafetyShareLink{
		ID:        s.store.NextID("safety_share_link"),
		UserID:    userID,
		OrderID:   order.ID,
		TripID:    order.TripID,
		Token:     generateToken("share-link", order.ID),
		ExpiresAt: currentTime.Add(24 * time.Hour),
		CreatedAt: currentTime,
	}
	link.ShareURL = strings.TrimRight(s.config.ShareBaseURL, "/") + "/share/" + link.Token
	s.store.Snapshot().SafetyShareLinks[link.ID] = link

	if len(contactIDs) > 0 {
		config.DefaultShareContactIDs = contactIDs
		config.UpdatedAt = currentTime
	}

	return map[string]any{
		"shareUrl":   link.ShareURL,
		"expireAt":   link.ExpiresAt,
		"contactIds": contactIDs,
	}, nil
}

func (s *Service) CreateSafetySOS(userID int64, input SafetySOSInput) (map[string]any, *errno.Error) {
	if input.OrderID <= 0 {
		return nil, errno.ErrParamInvalid
	}

	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[input.OrderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.DriverUserID != userID && order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	config := s.ensureSafetyConfigLocked(userID)
	contactIDs := cloneInt64Slice(config.DefaultShareContactIDs)
	if len(contactIDs) == 0 {
		contactIDs = s.defaultShareContactIDsLocked(userID)
	}

	event := &domain.SafetySOSEvent{
		ID:               s.store.NextID("safety_sos_event"),
		UserID:           userID,
		OrderID:          order.ID,
		CurrentLat:       input.CurrentLat,
		CurrentLng:       input.CurrentLng,
		Message:          strings.TrimSpace(input.Remark),
		NotifyContactIDs: contactIDs,
		EventStatus:      "CREATED",
		CreatedAt:        now(),
	}
	s.store.Snapshot().SafetySOSEvents[event.ID] = event

	return map[string]any{
		"sosEventId":  event.ID,
		"eventStatus": event.EventStatus,
		"notified":    len(contactIDs) > 0,
	}, nil
}

func (s *Service) UploadTracePoints(userID int64, input SafetyTraceBatchInput) (map[string]any, *errno.Error) {
	if input.OrderID <= 0 || len(input.Points) == 0 {
		return nil, errno.ErrParamInvalid
	}

	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[input.OrderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.DriverUserID != userID && order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}

	recorded := 0
	for _, point := range input.Points {
		recordedAt := now()
		if strings.TrimSpace(point.RecordedAt) != "" {
			parsed, appErr := parseRFC3339(point.RecordedAt)
			if appErr != nil {
				return nil, appErr
			}
			recordedAt = parsed
		}

		tracePoint := &domain.SafetyTracePoint{
			ID:         s.store.NextID("safety_trace_point"),
			OrderID:    order.ID,
			UserID:     userID,
			Lat:        point.Lat,
			Lng:        point.Lng,
			RecordedAt: recordedAt,
		}
		s.store.Snapshot().SafetyTracePoints[order.ID] = append(s.store.Snapshot().SafetyTracePoints[order.ID], tracePoint)
		recorded++
	}

	return map[string]any{
		"success":       true,
		"recordedCount": recorded,
	}, nil
}

func (s *Service) GetTraceSummary(userID, orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.DriverUserID != userID && order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}

	return s.traceSummaryLocked(order), nil
}

func (s *Service) filterContactIDsLocked(userID int64, contactIDs []int64) []int64 {
	if len(contactIDs) == 0 {
		return nil
	}

	allowed := map[int64]struct{}{}
	for _, contact := range s.store.Snapshot().Contacts {
		if contact.UserID == userID {
			allowed[contact.ID] = struct{}{}
		}
	}

	result := make([]int64, 0, len(contactIDs))
	seen := map[int64]struct{}{}
	for _, contactID := range contactIDs {
		if _, ok := allowed[contactID]; !ok {
			continue
		}
		if _, exists := seen[contactID]; exists {
			continue
		}
		seen[contactID] = struct{}{}
		result = append(result, contactID)
	}
	return result
}
