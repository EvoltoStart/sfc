package service

import (
	"testing"
	"time"

	"sfc/server/internal/domain"
	"sfc/server/internal/store"
)

func TestRunMaintenanceOnceExpiresPendingPayOrders(t *testing.T) {
	appStore := store.NewMemoryStore()
	svc := NewWithDependencies(appStore, Dependencies{})

	nowValue := time.Now().UTC()
	appStore.Trips[1] = &domain.Trip{
		ID:            1,
		SeatTotal:     2,
		SeatAvailable: 1,
		TripStatus:    domain.TripStatusMatching,
		CreatedAt:     nowValue.Add(-time.Hour),
	}
	appStore.Orders[1] = &domain.RideOrder{
		ID:               1,
		OrderNo:          "RO1",
		TripID:           1,
		OrderStatus:      domain.OrderStatusPendingPassengerPay,
		PayableAmountFen: 1000,
		CreatedAt:        nowValue.Add(-time.Hour),
	}
	appStore.PaymentOrdersByOrder[1] = &domain.PaymentOrder{
		ID:          1,
		BizOrderID:  1,
		OutTradeNo:  "PO1",
		PayStatus:   domain.PaymentStatusPaying,
		PayExpireAt: nowValue.Add(-30 * time.Minute),
	}

	result := svc.RunMaintenanceOnce(nowValue)
	if result.ExpiredPendingPayOrders != 1 {
		t.Fatalf("expected one expired order, got %d", result.ExpiredPendingPayOrders)
	}
	if appStore.Orders[1].OrderStatus != domain.OrderStatusCancelled {
		t.Fatalf("expected order cancelled, got %s", appStore.Orders[1].OrderStatus)
	}
	if appStore.Trips[1].SeatAvailable != 2 {
		t.Fatalf("expected seat released, got %d", appStore.Trips[1].SeatAvailable)
	}
	if appStore.PaymentOrdersByOrder[1].PayStatus != domain.PaymentStatusFail {
		t.Fatalf("expected payment failed, got %s", appStore.PaymentOrdersByOrder[1].PayStatus)
	}
}
