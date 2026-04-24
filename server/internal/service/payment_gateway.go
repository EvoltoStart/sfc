package service

import (
	"context"
	"net/http"
	"time"
)

type PaymentGateway interface {
	Channel() string
	CreateOrder(ctx context.Context, req PaymentGatewayCreateRequest) (*PaymentGatewayCreateResult, error)
	ParseNotification(ctx context.Context, r *http.Request) (*PaymentGatewayNotification, error)
}

type PaymentGatewayCreateRequest struct {
	OutTradeNo     string
	OrderNo        string
	AmountFen      int64
	NotifyURL      string
	ReturnURL      string
	ExpireDuration time.Duration
}

type PaymentGatewayCreateResult struct {
	PayURL    string
	PayParams map[string]any
}

type PaymentGatewayNotification struct {
	OutTradeNo      string
	ProviderTradeNo string
	PayStatus       string
}
