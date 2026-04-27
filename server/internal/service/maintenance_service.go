package service

import (
	"time"

	"sfc/server/internal/domain"
)

type MaintenanceResult struct {
	ExpiredPendingPayOrders int `json:"expiredPendingPayOrders"`
}

func (s *Service) RunMaintenanceOnce(currentTime time.Time) MaintenanceResult {
	if currentTime.IsZero() {
		currentTime = now()
	}

	s.store.Lock()
	defer s.store.Unlock()

	result := MaintenanceResult{}
	for _, order := range s.store.Snapshot().Orders {
		if order.OrderStatus != domain.OrderStatusPendingPassengerPay {
			continue
		}
		payment := s.store.Snapshot().PaymentOrdersByOrder[order.ID]
		expireAt := order.CreatedAt.Add(15 * time.Minute)
		if payment != nil && !payment.PayExpireAt.IsZero() {
			expireAt = payment.PayExpireAt
		}
		if currentTime.Before(expireAt) {
			continue
		}

		oldStatus := order.OrderStatus
		order.OrderStatus = domain.OrderStatusCancelled
		order.CancelReason = "待支付超时自动取消"
		order.UpdatedAt = currentTime
		if payment != nil && payment.PayStatus != domain.PaymentStatusPaid {
			payment.PayStatus = domain.PaymentStatusFail
		}
		trip := s.store.Snapshot().Trips[order.TripID]
		if trip != nil && trip.SeatAvailable < trip.SeatTotal {
			trip.SeatAvailable++
		}
		s.appendOrderLogLocked(order.ID, oldStatus, order.OrderStatus, "SYSTEM", 0, "待支付超时自动取消")
		s.refreshTripStatusLocked(order.TripID)
		result.ExpiredPendingPayOrders++
	}
	return result
}
