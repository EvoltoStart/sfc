package service

import (
	"sfc/server/internal/store"
)

type Service struct {
	store          store.Store
	routePassScore float64
	mapClient      MapClient
	paymentGateway PaymentGateway
	wechatMiniapp  WechatMiniappClient
	config         Config
}

type Config struct {
	PaymentNotifyURL string
	PaymentReturnURL string
	ShareBaseURL     string
}

type Dependencies struct {
	MapClient      MapClient
	PaymentGateway PaymentGateway
	WechatMiniapp  WechatMiniappClient
	Config         Config
}

func NewWithDependencies(store store.Store, deps Dependencies) *Service {
	if deps.Config.PaymentNotifyURL == "" {
		deps.Config.PaymentNotifyURL = "http://127.0.0.1:8080/api/v1/payments/callback/alipay"
	}
	if deps.Config.PaymentReturnURL == "" {
		deps.Config.PaymentReturnURL = "https://sandbox.alipay.com"
	}
	if deps.Config.ShareBaseURL == "" {
		deps.Config.ShareBaseURL = "https://share.sfc.local"
	}
	if deps.WechatMiniapp == nil {
		deps.WechatMiniapp = NewFakeWechatMiniappClient()
	}
	return &Service{
		store:          store,
		routePassScore: 90,
		mapClient:      deps.MapClient,
		paymentGateway: deps.PaymentGateway,
		wechatMiniapp:  deps.WechatMiniapp,
		config:         deps.Config,
	}
}
