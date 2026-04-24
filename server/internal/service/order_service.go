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

type JoinRequestCreateInput struct {
	TripID    int64   `json:"tripId"`
	StartName string  `json:"startName"`
	StartLat  float64 `json:"startLat"`
	StartLng  float64 `json:"startLng"`
	EndName   string  `json:"endName"`
	EndLat    float64 `json:"endLat"`
	EndLng    float64 `json:"endLng"`
}

func (s *Service) CreateJoinRequest(userID int64, input JoinRequestCreateInput) (map[string]any, *errno.Error) {
	if input.TripID <= 0 || strings.TrimSpace(input.StartName) == "" || strings.TrimSpace(input.EndName) == "" {
		return nil, errno.New("PARAM_INVALID", "同行申请参数不完整", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	trip := s.store.Snapshot().Trips[input.TripID]
	if trip == nil {
		return nil, errno.ErrResourceNotFound
	}
	if trip.DriverUserID == userID {
		return nil, errno.ErrUserForbidden
	}
	if trip.TripStatus != domain.TripStatusPublished && trip.TripStatus != domain.TripStatusMatching {
		return nil, errno.ErrTripStatusInvalid
	}
	if trip.SeatAvailable <= 0 {
		return nil, errno.New("TRIP_NO_SEAT", "当前行程无可用座位", http.StatusConflict)
	}

	if score := matchRouteScore(input.StartLat, input.StartLng, input.EndLat, input.EndLng, trip); score < s.routePassScore {
		return nil, errno.ErrRouteScoreNotPass
	}

	for _, item := range s.store.Snapshot().JoinRequests {
		if item.TripID == input.TripID && item.PassengerUserID == userID &&
			(item.RequestStatus == domain.JoinRequestStatusPending || item.RequestStatus == domain.JoinRequestStatusAccepted) {
			return nil, errno.ErrRepeatSubmit
		}
	}

	request := &domain.JoinRequest{
		ID:              s.store.NextID("join_request"),
		TripID:          input.TripID,
		PassengerUserID: userID,
		StartName:       strings.TrimSpace(input.StartName),
		StartLat:        input.StartLat,
		StartLng:        input.StartLng,
		EndName:         strings.TrimSpace(input.EndName),
		EndLat:          input.EndLat,
		EndLng:          input.EndLng,
		RequestStatus:   domain.JoinRequestStatusPending,
		CreatedAt:       now(),
	}
	s.store.Snapshot().JoinRequests[request.ID] = request
	trip.TripStatus = domain.TripStatusMatching

	return map[string]any{
		"joinRequestId": request.ID,
		"requestStatus": request.RequestStatus,
	}, nil
}

func (s *Service) ListMyJoinRequests(userID int64, status string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	type item struct {
		RecordType    string         `json:"recordType"`
		JoinRequestID int64          `json:"joinRequestId"`
		TripID        int64          `json:"tripId"`
		RequestStatus string         `json:"requestStatus"`
		RouteSummary  string         `json:"routeSummary"`
		DriverInfo    map[string]any `json:"driverInfo"`
		CreatedAt     time.Time      `json:"createdAt"`
	}

	var items []item
	for _, request := range s.store.Snapshot().JoinRequests {
		if request.PassengerUserID != userID {
			continue
		}
		if status != "" && request.RequestStatus != status {
			continue
		}
		trip := s.store.Snapshot().Trips[request.TripID]
		driver := s.store.Snapshot().Users[trip.DriverUserID]
		items = append(items, item{
			RecordType:    "JOIN_REQUEST",
			JoinRequestID: request.ID,
			TripID:        request.TripID,
			RequestStatus: request.RequestStatus,
			RouteSummary:  fmt.Sprintf("%s -> %s", request.StartName, request.EndName),
			DriverInfo: map[string]any{
				"userId":   driver.ID,
				"nickname": driver.Nickname,
			},
			CreatedAt: request.CreatedAt,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{
		"list":     paged,
		"page":     currentPage,
		"pageSize": currentPageSize,
		"total":    total,
	}, nil
}

func (s *Service) GetJoinRequest(userID, joinRequestID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}
	request := s.store.Snapshot().JoinRequests[joinRequestID]
	if request == nil {
		return nil, errno.ErrResourceNotFound
	}
	trip := s.store.Snapshot().Trips[request.TripID]
	if request.PassengerUserID != userID && trip.DriverUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	driver := s.store.Snapshot().Users[trip.DriverUserID]

	return map[string]any{
		"recordType":    "JOIN_REQUEST",
		"joinRequestId": request.ID,
		"tripId":        request.TripID,
		"requestStatus": request.RequestStatus,
		"driverInfo": map[string]any{
			"userId":   driver.ID,
			"nickname": driver.Nickname,
		},
		"routeInfo": map[string]any{
			"tripRouteSummary": fmt.Sprintf("%s -> %s", trip.StartName, trip.EndName),
		},
		"startPoint": map[string]any{
			"name": request.StartName,
			"lat":  request.StartLat,
			"lng":  request.StartLng,
		},
		"endPoint": map[string]any{
			"name": request.EndName,
			"lat":  request.EndLat,
			"lng":  request.EndLng,
		},
		"acceptedAt":  request.AcceptedAt,
		"rejectedAt":  request.RejectedAt,
		"cancelledAt": request.CancelledAt,
		"expiredAt":   request.ExpiredAt,
	}, nil
}

func (s *Service) CancelJoinRequest(userID, joinRequestID int64, reason string) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	request := s.store.Snapshot().JoinRequests[joinRequestID]
	if request == nil {
		return nil, errno.ErrResourceNotFound
	}
	if request.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if request.RequestStatus != domain.JoinRequestStatusPending {
		return nil, errno.ErrOrderStatusInvalid
	}
	currentTime := now()
	request.RequestStatus = domain.JoinRequestStatusCancelled
	request.CancelledAt = &currentTime
	request.Remark = strings.TrimSpace(reason)
	s.refreshTripStatusLocked(request.TripID)
	return map[string]any{
		"success":       true,
		"requestStatus": request.RequestStatus,
	}, nil
}

func (s *Service) ListDriverJoinRequests(userID, tripID int64, status string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	type item struct {
		JoinRequestID     int64          `json:"joinRequestId"`
		TripID            int64          `json:"tripId"`
		PassengerInfo     map[string]any `json:"passengerInfo"`
		ApplyAt           time.Time      `json:"applyAt"`
		HistoryOrderCount int            `json:"historyOrderCount"`
		CreditTags        []string       `json:"creditTags"`
		RequestStatus     string         `json:"requestStatus"`
	}

	var items []item
	for _, request := range s.store.Snapshot().JoinRequests {
		trip := s.store.Snapshot().Trips[request.TripID]
		if trip == nil || trip.DriverUserID != userID {
			continue
		}
		if tripID > 0 && request.TripID != tripID {
			continue
		}
		if status != "" && request.RequestStatus != status {
			continue
		}
		passenger := s.store.Snapshot().Users[request.PassengerUserID]
		historyCount := 0
		for _, order := range s.store.Snapshot().Orders {
			if order.PassengerUserID == request.PassengerUserID && order.OrderStatus == domain.OrderStatusCompleted {
				historyCount++
			}
		}
		items = append(items, item{
			JoinRequestID: request.ID,
			TripID:        request.TripID,
			PassengerInfo: map[string]any{
				"userId":   passenger.ID,
				"nickname": passenger.Nickname,
			},
			ApplyAt:           request.CreatedAt,
			HistoryOrderCount: historyCount,
			CreditTags:        []string{"瀹炲悕璁よ瘉鐢ㄦ埛"},
			RequestStatus:     request.RequestStatus,
		})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].ApplyAt.After(items[j].ApplyAt) })
	paged, currentPage, currentPageSize, total := paginate(items, page, pageSize)
	return map[string]any{
		"list":     paged,
		"page":     currentPage,
		"pageSize": currentPageSize,
		"total":    total,
	}, nil
}

func (s *Service) AcceptJoinRequest(userID, joinRequestID int64, remark string) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	request := s.store.Snapshot().JoinRequests[joinRequestID]
	if request == nil {
		return nil, errno.ErrResourceNotFound
	}
	trip := s.store.Snapshot().Trips[request.TripID]
	if trip == nil {
		return nil, errno.ErrResourceNotFound
	}
	if trip.DriverUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if request.RequestStatus != domain.JoinRequestStatusPending {
		return nil, errno.ErrRepeatSubmit
	}
	if trip.SeatAvailable <= 0 {
		return nil, errno.New("TRIP_NO_SEAT", "当前行程无可用座位", http.StatusConflict)
	}
	for _, order := range s.store.Snapshot().Orders {
		if order.JoinRequestID == request.ID {
			return nil, errno.ErrRepeatSubmit
		}
	}

	currentTime := now()
	request.RequestStatus = domain.JoinRequestStatusAccepted
	request.AcceptedAt = &currentTime
	request.Remark = strings.TrimSpace(remark)

	order := &domain.RideOrder{
		ID:               s.store.NextID("ride_order"),
		OrderNo:          generateOrderNo("RO", s.store.NextID("order_no")),
		TripID:           trip.ID,
		JoinRequestID:    request.ID,
		DriverUserID:     trip.DriverUserID,
		PassengerUserID:  request.PassengerUserID,
		OrderStatus:      domain.OrderStatusPendingPassengerPay,
		PayableAmountFen: trip.PriceTotalFen,
		ServiceFeeFen:    trip.ServiceFeeFen,
		DistanceMeter:    trip.DistanceMeter,
		CreatedAt:        currentTime,
		UpdatedAt:        currentTime,
	}
	s.store.Snapshot().Orders[order.ID] = order
	trip.SeatAvailable--
	trip.TripStatus = domain.TripStatusMatching

	s.appendOrderLogLocked(order.ID, "", order.OrderStatus, "DRIVER", userID, "司机接受同行申请")

	return map[string]any{
		"orderId":     order.ID,
		"orderStatus": order.OrderStatus,
		"payExpireAt": currentTime.Add(15 * time.Minute),
	}, nil
}

func (s *Service) RejectJoinRequest(userID, joinRequestID int64, reason string) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	request := s.store.Snapshot().JoinRequests[joinRequestID]
	if request == nil {
		return nil, errno.ErrResourceNotFound
	}
	trip := s.store.Snapshot().Trips[request.TripID]
	if trip == nil {
		return nil, errno.ErrResourceNotFound
	}
	if trip.DriverUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if request.RequestStatus != domain.JoinRequestStatusPending {
		return nil, errno.ErrRepeatSubmit
	}

	currentTime := now()
	request.RequestStatus = domain.JoinRequestStatusRejected
	request.RejectedAt = &currentTime
	request.Remark = strings.TrimSpace(reason)
	s.refreshTripStatusLocked(request.TripID)

	return map[string]any{
		"success":       true,
		"requestStatus": request.RequestStatus,
	}, nil
}

func (s *Service) ListOrders(userID int64, role, status string, page, pageSize int) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	if _, appErr := s.findUserLocked(userID); appErr != nil {
		return nil, appErr
	}

	type item struct {
		RecordType       string         `json:"recordType"`
		OrderID          int64          `json:"orderId"`
		OrderNo          string         `json:"orderNo"`
		JoinRequestID    int64          `json:"joinRequestId"`
		RouteSummary     string         `json:"routeSummary"`
		DepartAt         time.Time      `json:"departAt"`
		DriverInfo       map[string]any `json:"driverInfo,omitempty"`
		PassengerInfo    map[string]any `json:"passengerInfo,omitempty"`
		OrderStatus      string         `json:"orderStatus"`
		PayableAmountFen int64          `json:"payableAmountFen"`
	}

	var items []item
	for _, order := range s.store.Snapshot().Orders {
		if role == "driver" {
			if order.DriverUserID != userID {
				continue
			}
		} else if role == "passenger" {
			if order.PassengerUserID != userID {
				continue
			}
		} else if order.DriverUserID != userID && order.PassengerUserID != userID {
			continue
		}
		if status != "" && order.OrderStatus != status {
			continue
		}
		trip := s.store.Snapshot().Trips[order.TripID]
		driver := s.store.Snapshot().Users[order.DriverUserID]
		passenger := s.store.Snapshot().Users[order.PassengerUserID]
		record := item{
			RecordType:       "ORDER",
			OrderID:          order.ID,
			OrderNo:          order.OrderNo,
			JoinRequestID:    order.JoinRequestID,
			RouteSummary:     fmt.Sprintf("%s -> %s", trip.StartName, trip.EndName),
			DepartAt:         trip.DepartAt,
			OrderStatus:      order.OrderStatus,
			PayableAmountFen: order.PayableAmountFen,
		}
		if role == "driver" {
			record.PassengerInfo = map[string]any{"userId": passenger.ID, "nickname": passenger.Nickname}
		} else {
			record.DriverInfo = map[string]any{"userId": driver.ID, "nickname": driver.Nickname}
		}
		items = append(items, record)
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

func (s *Service) GetOrder(userID, orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.DriverUserID != userID && order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}

	trip := s.store.Snapshot().Trips[order.TripID]
	driver := s.store.Snapshot().Users[order.DriverUserID]
	passenger := s.store.Snapshot().Users[order.PassengerUserID]
	return map[string]any{
		"recordType":    "ORDER",
		"orderId":       order.ID,
		"orderNo":       order.OrderNo,
		"joinRequestId": order.JoinRequestID,
		"orderStatus":   order.OrderStatus,
		"driverInfo": map[string]any{
			"userId":   driver.ID,
			"nickname": driver.Nickname,
		},
		"passengerInfo": map[string]any{
			"userId":   passenger.ID,
			"nickname": passenger.Nickname,
		},
		"routeInfo": map[string]any{
			"startName": trip.StartName,
			"endName":   trip.EndName,
			"departAt":  trip.DepartAt,
		},
		"priceInfo": map[string]any{
			"payableAmountFen": order.PayableAmountFen,
			"serviceFeeFen":    order.ServiceFeeFen,
			"distanceMeter":    order.DistanceMeter,
		},
		"boardConfirmedAt":   order.BoardConfirmedAt,
		"arrivalConfirmedAt": order.ArrivalConfirmedAt,
		"trackSummary":       s.traceSummaryLocked(order),
		"safetyActions":      []string{"SOS"},
		"settlementInfo":     s.store.Snapshot().SettlementsByOrder[order.ID],
	}, nil
}

func (s *Service) ConfirmBoard(userID, orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if order.OrderStatus != domain.OrderStatusPendingDepart {
		return nil, errno.ErrOrderStatusInvalid
	}

	currentTime := now()
	order.BoardConfirmedAt = &currentTime
	oldStatus := order.OrderStatus
	order.OrderStatus = domain.OrderStatusInProgress
	order.UpdatedAt = currentTime
	trip := s.store.Snapshot().Trips[order.TripID]
	trip.TripStatus = domain.TripStatusInProgress
	s.appendOrderLogLocked(order.ID, oldStatus, order.OrderStatus, "PASSENGER", userID, "乘客确认上车")

	return map[string]any{
		"success":          true,
		"orderStatus":      order.OrderStatus,
		"boardConfirmedAt": order.BoardConfirmedAt,
	}, nil
}

func (s *Service) ConfirmArrival(userID, orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}
	if order.OrderStatus != domain.OrderStatusInProgress {
		return nil, errno.ErrOrderStatusInvalid
	}

	currentTime := now()
	order.ArrivalConfirmedAt = &currentTime
	oldStatus := order.OrderStatus
	order.OrderStatus = domain.OrderStatusCompleted
	order.UpdatedAt = currentTime
	s.appendOrderLogLocked(order.ID, oldStatus, order.OrderStatus, "PASSENGER", userID, "乘客确认到达")

	if s.store.Snapshot().SettlementsByOrder[order.ID] == nil {
		settleAmount := order.PayableAmountFen - order.ServiceFeeFen
		settlement := &domain.SettlementRecord{
			ID:              s.store.NextID("settlement_record"),
			OrderID:         order.ID,
			DriverUserID:    order.DriverUserID,
			SettleAmountFen: settleAmount,
			SettleStatus:    domain.SettlementStatusDone,
			SettledAt:       currentTime,
		}
		s.store.Snapshot().SettlementsByOrder[order.ID] = settlement
		s.appendWalletLedgerLocked(order.DriverUserID, "SETTLEMENT", settleAmount, order.OrderNo, "璁㈠崟瀹屾垚缁撶畻鍏ヨ处")
	}
	s.refreshTripStatusLocked(order.TripID)

	return map[string]any{
		"success":             true,
		"orderStatus":         order.OrderStatus,
		"arrivalConfirmedAt":  order.ArrivalConfirmedAt,
		"settlementTriggered": true,
	}, nil
}

func (s *Service) CancelOrder(userID, orderID int64, reason string) (map[string]any, *errno.Error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errno.New("PARAM_INVALID", "取消原因不能为空", http.StatusBadRequest)
	}

	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.DriverUserID != userID && order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}

	trip := s.store.Snapshot().Trips[order.TripID]
	oldStatus := order.OrderStatus
	currentTime := now()

	switch order.OrderStatus {
	case domain.OrderStatusPendingPassengerPay:
		order.OrderStatus = domain.OrderStatusCancelled
		order.CancelReason = reason
		order.UpdatedAt = currentTime
		if trip.SeatAvailable < trip.SeatTotal {
			trip.SeatAvailable++
		}
		s.appendOrderLogLocked(order.ID, oldStatus, order.OrderStatus, "USER", userID, "取消待支付订单")
		s.refreshTripStatusLocked(order.TripID)
		return map[string]any{
			"success":     true,
			"orderStatus": order.OrderStatus,
			"refundInfo":  map[string]any{},
		}, nil
	case domain.OrderStatusPendingDepart:
		refundInfo, appErr := s.refundOrderLocked(order, reason, 0)
		if appErr != nil {
			return nil, appErr
		}
		return map[string]any{
			"success":     true,
			"orderStatus": order.OrderStatus,
			"refundInfo":  refundInfo,
		}, nil
	case domain.OrderStatusInProgress:
		order.OrderStatus = domain.OrderStatusExceptionHandling
		order.ExceptionFlag = true
		order.CancelReason = reason
		order.UpdatedAt = currentTime
		s.appendOrderLogLocked(order.ID, oldStatus, order.OrderStatus, "USER", userID, "上车后取消，进入异常处理")
		return map[string]any{
			"success":     true,
			"orderStatus": order.OrderStatus,
			"refundInfo":  map[string]any{},
		}, nil
	default:
		return nil, errno.ErrOrderStatusInvalid
	}
}

func (s *Service) appendOrderLogLocked(orderID int64, fromStatus, toStatus, operatorType string, operatorID int64, remark string) {
	log := &domain.OrderStatusLog{
		ID:           s.store.NextID("order_status_log"),
		OrderID:      orderID,
		FromStatus:   fromStatus,
		ToStatus:     toStatus,
		OperatorType: operatorType,
		OperatorID:   operatorID,
		Remark:       remark,
		CreatedAt:    now(),
	}
	s.store.Snapshot().OrderLogs[orderID] = append(s.store.Snapshot().OrderLogs[orderID], log)
}

func (s *Service) refreshTripStatusLocked(tripID int64) {
	trip := s.store.Snapshot().Trips[tripID]
	if trip == nil || trip.TripStatus == domain.TripStatusCancelled {
		return
	}

	hasCompleted := false
	hasInProgress := false
	hasConfirmed := false
	hasMatching := false
	for _, order := range s.store.Snapshot().Orders {
		if order.TripID != tripID {
			continue
		}
		switch order.OrderStatus {
		case domain.OrderStatusInProgress:
			hasInProgress = true
		case domain.OrderStatusPendingDepart:
			hasConfirmed = true
		case domain.OrderStatusPendingPassengerPay:
			hasMatching = true
		case domain.OrderStatusCompleted:
			hasCompleted = true
		}
	}
	if hasInProgress {
		trip.TripStatus = domain.TripStatusInProgress
		return
	}
	if hasConfirmed {
		trip.TripStatus = domain.TripStatusConfirmed
		return
	}
	if hasMatching {
		trip.TripStatus = domain.TripStatusMatching
		return
	}
	if hasCompleted {
		trip.TripStatus = domain.TripStatusCompleted
		return
	}

	for _, request := range s.store.Snapshot().JoinRequests {
		if request.TripID == tripID && request.RequestStatus == domain.JoinRequestStatusPending {
			trip.TripStatus = domain.TripStatusMatching
			return
		}
	}
	trip.TripStatus = domain.TripStatusPublished
}
