package bootstrap

import (
	"os"
	"strings"

	"sfc/server/internal/infrastructure/mapclient"
	"sfc/server/internal/infrastructure/paymentgateway"
	"sfc/server/internal/service"
	"sfc/server/internal/store"
)

func envFirst(keys ...string) string {
	for _, key := range keys {
		value := strings.TrimSpace(os.Getenv(key))
		if value != "" {
			return value
		}
	}
	return ""
}

func defaultConfig() service.Config {
	return service.Config{
		PaymentNotifyURL: "http://127.0.0.1:8080/api/v1/payments/callback/alipay",
		PaymentReturnURL: "https://sandbox.alipay.com",
		ShareBaseURL:     "https://share.sfc.local",
	}
}

func configFromEnv() service.Config {
	cfg := defaultConfig()
	if value := envFirst("SFC_ALIPAY_NOTIFY_URL", "SFC_PAYMENT_NOTIFY_URL"); value != "" {
		cfg.PaymentNotifyURL = value
	}
	if value := envFirst("SFC_ALIPAY_RETURN_URL", "SFC_PAYMENT_RETURN_URL"); value != "" {
		cfg.PaymentReturnURL = value
	}
	if value := envFirst("SFC_SHARE_BASE_URL"); value != "" {
		cfg.ShareBaseURL = strings.TrimRight(value, "/")
	}
	return cfg
}

func NewService(memoryStore *store.MemoryStore) *service.Service {
	return service.NewWithDependencies(memoryStore, service.Dependencies{
		MapClient:      mapclient.NewFallback(),
		PaymentGateway: paymentgateway.NewMock(),
		Config:         defaultConfig(),
	})
}

func NewServiceFromEnv(memoryStore *store.MemoryStore) *service.Service {
	return service.NewWithDependencies(memoryStore, service.Dependencies{
		MapClient:      mapclient.NewAMap(envFirst("SFC_AMAP_KEY", "MAP_KEY"), envFirst("SFC_AMAP_BASE_URL")),
		PaymentGateway: paymentgateway.NewAlipaySandbox(envFirst("SFC_ALIPAY_APP_ID"), envFirst("SFC_ALIPAY_PRIVATE_KEY"), envFirst("SFC_ALIPAY_PUBLIC_KEY")),
		Config:         configFromEnv(),
	})
}
