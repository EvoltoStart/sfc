package service

import (
	"context"
	"net/http"
	"strings"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/domain"
)

func (s *Service) CreatePaymentOrder(userID, orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		s.store.Unlock()
		return nil, errno.ErrResourceNotFound
	}
	if order.PassengerUserID != userID {
		s.store.Unlock()
		return nil, errno.ErrUserForbidden
	}
	if order.OrderStatus != domain.OrderStatusPendingPassengerPay {
		s.store.Unlock()
		return nil, errno.ErrOrderStatusInvalid
	}

	currentTime := now()
	payment := s.store.Snapshot().PaymentOrdersByOrder[orderID]
	if payment == nil {
		payment = &domain.PaymentOrder{
			ID:             s.store.NextID("payment_order"),
			BizOrderID:     orderID,
			OutTradeNo:     generateOrderNo("PO", s.store.NextID("payment_trade")),
			PayChannel:     s.paymentGateway.Channel(),
			PayStatus:      domain.PaymentStatusPaying,
			TotalAmountFen: order.PayableAmountFen,
			PayExpireAt:    currentTime.Add(15 * time.Minute),
			CreatedAt:      currentTime,
		}
		s.store.Snapshot().PaymentOrders[payment.ID] = payment
		s.store.Snapshot().PaymentOrdersByOrder[orderID] = payment
		s.store.Snapshot().PaymentOrdersByTrade[payment.OutTradeNo] = payment
	}

	outTradeNo := payment.OutTradeNo
	orderNo := order.OrderNo
	amountFen := order.PayableAmountFen
	expireDuration := time.Until(payment.PayExpireAt)
	s.store.Unlock()

	createResult, err := s.paymentGateway.CreateOrder(context.Background(), PaymentGatewayCreateRequest{
		OutTradeNo:     outTradeNo,
		OrderNo:        orderNo,
		AmountFen:      amountFen,
		NotifyURL:      s.config.PaymentNotifyURL,
		ReturnURL:      s.config.PaymentReturnURL,
		ExpireDuration: expireDuration,
	})
	if err != nil {
		return nil, errno.ErrPaymentFailed
	}

	s.store.Lock()
	defer s.store.Unlock()
	payment = s.store.Snapshot().PaymentOrdersByOrder[orderID]
	if payment == nil {
		return nil, errno.ErrResourceNotFound
	}

	payment.PayChannel = s.paymentGateway.Channel()
	if createResult != nil {
		payment.PayURL = createResult.PayURL
	}

	payParams := map[string]any{}
	if createResult != nil && createResult.PayParams != nil {
		payParams = createResult.PayParams
	}

	return map[string]any{
		"paymentOrderId": payment.ID,
		"outTradeNo":     payment.OutTradeNo,
		"payChannel":     payment.PayChannel,
		"payUrl":         payment.PayURL,
		"payParams":      payParams,
		"payExpireAt":    payment.PayExpireAt,
	}, nil
}

func (s *Service) GetPaymentStatus(userID, orderID int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if order.DriverUserID != userID && order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}

	payment := s.store.Snapshot().PaymentOrdersByOrder[orderID]
	if payment == nil {
		return map[string]any{
			"payStatus": domain.PaymentStatusInit,
			"paidAt":    nil,
			"amountFen": order.PayableAmountFen,
		}, nil
	}

	return map[string]any{
		"payStatus":       payment.PayStatus,
		"paidAt":          payment.PaidAt,
		"amountFen":       payment.TotalAmountFen,
		"payChannel":      payment.PayChannel,
		"providerTradeNo": payment.ProviderTradeNo,
	}, nil
}

func (s *Service) PaymentCallback(outTradeNo, payStatus string) (map[string]any, *errno.Error) {
	return s.applyPaymentCallback(outTradeNo, "", payStatus)
}

func (s *Service) HandlePaymentNotification(ctx context.Context, r *http.Request) (map[string]any, *errno.Error) {
	notification, err := s.paymentGateway.ParseNotification(ctx, r)
	if err != nil || notification == nil {
		return nil, errno.ErrPaymentFailed
	}
	return s.applyPaymentCallback(notification.OutTradeNo, notification.ProviderTradeNo, notification.PayStatus)
}

func (s *Service) applyPaymentCallback(outTradeNo, providerTradeNo, payStatus string) (map[string]any, *errno.Error) {
	outTradeNo = strings.TrimSpace(outTradeNo)
	if outTradeNo == "" {
		return nil, errno.New("PARAM_INVALID", "outTradeNo 不能为空", http.StatusBadRequest)
	}
	payStatus = strings.TrimSpace(payStatus)
	if payStatus == "" {
		payStatus = domain.PaymentStatusPaid
	}

	s.store.Lock()
	defer s.store.Unlock()

	payment := s.store.Snapshot().PaymentOrdersByTrade[outTradeNo]
	if payment == nil {
		return nil, errno.ErrResourceNotFound
	}
	if payment.PayStatus == payStatus {
		return map[string]any{
			"success":    true,
			"idempotent": true,
			"payStatus":  payment.PayStatus,
		}, nil
	}
	if isPaymentTerminalStatus(payment.PayStatus) {
		return map[string]any{
			"success":    true,
			"idempotent": true,
			"ignored":    true,
			"payStatus":  payment.PayStatus,
		}, nil
	}

	order := s.store.Snapshot().Orders[payment.BizOrderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}

	currentTime := now()
	switch payStatus {
	case domain.PaymentStatusPaid:
		payment.PayStatus = domain.PaymentStatusPaid
		payment.PaidAt = &currentTime
		if strings.TrimSpace(providerTradeNo) != "" {
			payment.ProviderTradeNo = strings.TrimSpace(providerTradeNo)
		}

		if order.OrderStatus == domain.OrderStatusPendingPassengerPay {
			oldStatus := order.OrderStatus
			order.OrderStatus = domain.OrderStatusPendingDepart
			order.UpdatedAt = currentTime
			s.appendOrderLogLocked(order.ID, oldStatus, order.OrderStatus, "SYSTEM", 0, "支付回调成功，订单进入待出发")
			trip := s.store.Snapshot().Trips[order.TripID]
			if trip != nil {
				trip.TripStatus = domain.TripStatusConfirmed
			}
		}
	case domain.PaymentStatusFail:
		payment.PayStatus = domain.PaymentStatusFail
	default:
		return nil, errno.ErrPaymentFailed
	}

	return map[string]any{
		"success":    true,
		"idempotent": false,
		"payStatus":  payment.PayStatus,
	}, nil
}

func isPaymentTerminalStatus(status string) bool {
	switch status {
	case domain.PaymentStatusPaid, domain.PaymentStatusFail, domain.PaymentStatusRefunded:
		return true
	default:
		return false
	}
}

func (s *Service) CreateRefund(userID, orderID int64, reason string, refundAmountFen int64) (map[string]any, *errno.Error) {
	s.store.Lock()
	defer s.store.Unlock()

	order := s.store.Snapshot().Orders[orderID]
	if order == nil {
		return nil, errno.ErrResourceNotFound
	}
	if userID > 0 && order.DriverUserID != userID && order.PassengerUserID != userID {
		return nil, errno.ErrUserForbidden
	}

	return s.refundOrderLocked(order, reason, refundAmountFen)
}

func (s *Service) refundOrderLocked(order *domain.RideOrder, reason string, refundAmountFen int64) (map[string]any, *errno.Error) {
	if order.OrderStatus != domain.OrderStatusPendingDepart {
		return nil, errno.ErrOrderStatusInvalid
	}

	payment := s.store.Snapshot().PaymentOrdersByOrder[order.ID]
	if payment == nil {
		return nil, errno.ErrRefundFailed
	}
	if payment.PayStatus != domain.PaymentStatusPaid && payment.PayStatus != domain.PaymentStatusRefunded {
		return nil, errno.ErrPaymentStatusInvalid
	}

	if existing := s.store.Snapshot().RefundOrdersByOrder[order.ID]; existing != nil {
		return map[string]any{
			"refundOrderId": existing.ID,
			"refundStatus":  existing.RefundStatus,
			"refundNo":      existing.RefundNo,
		}, nil
	}

	if refundAmountFen <= 0 {
		refundAmountFen = order.PayableAmountFen
	}
	if refundAmountFen > order.PayableAmountFen {
		return nil, errno.New("PARAM_INVALID", "退款金额不能大于订单应付金额", http.StatusBadRequest)
	}

	refund := &domain.RefundOrder{
		ID:              s.store.NextID("refund_order"),
		OrderID:         order.ID,
		PaymentOrderID:  payment.ID,
		RefundNo:        generateOrderNo("RF", s.store.NextID("refund_no")),
		RefundAmountFen: refundAmountFen,
		RefundStatus:    domain.PaymentStatusRefunded,
		RefundReason:    strings.TrimSpace(reason),
		CreatedAt:       now(),
	}
	s.store.Snapshot().RefundOrders[refund.ID] = refund
	s.store.Snapshot().RefundOrdersByOrder[order.ID] = refund

	payment.PayStatus = domain.PaymentStatusRefunded
	oldStatus := order.OrderStatus
	order.OrderStatus = domain.OrderStatusRefunded
	order.CancelReason = strings.TrimSpace(reason)
	order.UpdatedAt = now()
	s.appendOrderLogLocked(order.ID, oldStatus, order.OrderStatus, "SYSTEM", 0, "订单退款完成")

	trip := s.store.Snapshot().Trips[order.TripID]
	if trip != nil && trip.SeatAvailable < trip.SeatTotal {
		trip.SeatAvailable++
	}
	s.refreshTripStatusLocked(order.TripID)

	return map[string]any{
		"refundOrderId": refund.ID,
		"refundStatus":  refund.RefundStatus,
		"refundNo":      refund.RefundNo,
	}, nil
}
