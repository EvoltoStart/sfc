package bootstrap

import (
	appconfig "sfc/server/internal/config"
	"sfc/server/internal/infrastructure/mapclient"
	"sfc/server/internal/infrastructure/paymentgateway"
	"sfc/server/internal/infrastructure/wechatmini"
	"sfc/server/internal/service"
	"sfc/server/internal/store"
)

func defaultConfig() service.Config {
	return service.Config{
		PaymentNotifyURL: "http://127.0.0.1:8080/api/v1/payments/callback/alipay",
		PaymentReturnURL: "https://sandbox.alipay.com",
		ShareBaseURL:     "https://share.sfc.local",
	}
}

func NewService(appStore store.Store) *service.Service {
	return service.NewWithDependencies(appStore, service.Dependencies{
		MapClient:      mapclient.NewFallback(),
		PaymentGateway: paymentgateway.NewMock(),
		WechatMiniapp:  service.NewFakeWechatMiniappClient(),
		Config:         defaultConfig(),
	})
}

func NewServiceFromConfig(appStore store.Store, cfg appconfig.AppConfig) *service.Service {
	mapClient := mapclient.NewAMap(cfg.AMapKey, cfg.AMapBaseURL)
	if cfg.AMapFake {
		mapClient = mapclient.NewFallback()
	}
	wechatClient := wechatmini.New(cfg.WechatMiniappAppID, cfg.WechatMiniappSecret)
	if cfg.WechatMiniappFake {
		wechatClient = service.NewFakeWechatMiniappClient()
	}
	return service.NewWithDependencies(appStore, service.Dependencies{
		MapClient:      mapClient,
		PaymentGateway: paymentgateway.NewAlipaySandbox(cfg.AlipayAppID, cfg.AlipayPrivateKey, cfg.AlipayPublicKey),
		WechatMiniapp:  wechatClient,
		Config:         cfg.ServiceConfig(),
	})
}

func NewServiceFromEnv(appStore store.Store) (*service.Service, error) {
	cfg, err := appconfig.LoadFromEnv()
	if err != nil {
		return nil, err
	}
	return NewServiceFromConfig(appStore, cfg), nil
}

func NewStoreFromConfig(cfg appconfig.AppConfig) (store.Store, error) {
	return store.NewSQLiteStore(cfg.SQLitePath)
}

func NewStoreFromEnv() (store.Store, error) {
	cfg, err := appconfig.LoadFromEnv()
	if err != nil {
		return nil, err
	}
	return NewStoreFromConfig(cfg)
}
