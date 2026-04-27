package config

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"sfc/server/internal/service"
)

type AppConfig struct {
	Env        string
	ServerAddr string
	SQLitePath string
	MySQLDSN   string

	AMapKey     string
	AMapBaseURL string
	AMapFake    bool

	AlipayAppID      string
	AlipayPrivateKey string
	AlipayPublicKey  string
	PaymentNotifyURL string
	PaymentReturnURL string

	ShareBaseURL string

	WechatMiniappAppID  string
	WechatMiniappSecret string
	WechatMiniappFake   bool
}

func LoadFromEnv() (AppConfig, error) {
	fileValues := loadDotenvFiles(".env", ".env.example")
	cfg := AppConfig{
		Env:                 configFirst(fileValues, "SFC_ENV", "APP_ENV"),
		ServerAddr:          configFirst(fileValues, "SFC_SERVER_ADDR"),
		SQLitePath:          configFirst(fileValues, "SFC_SQLITE_PATH"),
		MySQLDSN:            configFirst(fileValues, "SFC_MYSQL_DSN"),
		AMapKey:             configFirst(fileValues, "SFC_AMAP_KEY", "MAP_KEY"),
		AMapBaseURL:         configFirst(fileValues, "SFC_AMAP_BASE_URL"),
		AMapFake:            parseBool(configFirst(fileValues, "SFC_AMAP_FAKE")),
		AlipayAppID:         configFirst(fileValues, "SFC_ALIPAY_APP_ID"),
		AlipayPrivateKey:    configFirst(fileValues, "SFC_ALIPAY_PRIVATE_KEY"),
		AlipayPublicKey:     configFirst(fileValues, "SFC_ALIPAY_PUBLIC_KEY"),
		PaymentNotifyURL:    configFirst(fileValues, "SFC_ALIPAY_NOTIFY_URL", "SFC_PAYMENT_NOTIFY_URL"),
		PaymentReturnURL:    configFirst(fileValues, "SFC_ALIPAY_RETURN_URL", "SFC_PAYMENT_RETURN_URL"),
		ShareBaseURL:        strings.TrimRight(configFirst(fileValues, "SFC_SHARE_BASE_URL"), "/"),
		WechatMiniappAppID:  configFirst(fileValues, "SFC_WECHAT_MINIAPP_APP_ID"),
		WechatMiniappSecret: configFirst(fileValues, "SFC_WECHAT_MINIAPP_SECRET"),
		WechatMiniappFake:   parseBool(configFirst(fileValues, "SFC_WECHAT_MINIAPP_FAKE_LOGIN")),
	}
	if cfg.Env == "" {
		cfg.Env = "dev"
	}
	if cfg.ServerAddr == "" {
		cfg.ServerAddr = ":8080"
	}
	if cfg.SQLitePath == "" {
		cfg.SQLitePath = filepath.Join("data", "sfc.db")
	}
	if cfg.PaymentNotifyURL == "" {
		cfg.PaymentNotifyURL = "http://127.0.0.1:8080/api/v1/payments/callback/alipay"
	}
	if cfg.PaymentReturnURL == "" {
		cfg.PaymentReturnURL = "https://sandbox.alipay.com"
	}
	if cfg.ShareBaseURL == "" {
		cfg.ShareBaseURL = "https://share.sfc.local"
	}
	return cfg, cfg.Validate()
}

func (c AppConfig) Validate() error {
	switch c.Env {
	case "dev", "test", "local":
		return nil
	case "staging", "prod":
		var missing []string
		if !c.AMapFake && c.AMapKey == "" {
			missing = append(missing, "SFC_AMAP_KEY")
		}
		if c.AlipayAppID == "" {
			missing = append(missing, "SFC_ALIPAY_APP_ID")
		}
		if c.AlipayPrivateKey == "" {
			missing = append(missing, "SFC_ALIPAY_PRIVATE_KEY")
		}
		if c.AlipayPublicKey == "" {
			missing = append(missing, "SFC_ALIPAY_PUBLIC_KEY")
		}
		if !c.WechatMiniappFake && c.WechatMiniappAppID == "" {
			missing = append(missing, "SFC_WECHAT_MINIAPP_APP_ID")
		}
		if !c.WechatMiniappFake && c.WechatMiniappSecret == "" {
			missing = append(missing, "SFC_WECHAT_MINIAPP_SECRET")
		}
		if len(missing) > 0 {
			return fmt.Errorf("%s environment missing required config: %s", c.Env, strings.Join(missing, ", "))
		}
		return nil
	default:
		return fmt.Errorf("unsupported SFC_ENV %q", c.Env)
	}
}

func (c AppConfig) ServiceConfig() service.Config {
	return service.Config{
		PaymentNotifyURL: c.PaymentNotifyURL,
		PaymentReturnURL: c.PaymentReturnURL,
		ShareBaseURL:     c.ShareBaseURL,
	}
}

func configFirst(fileValues map[string]string, keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return strings.Trim(value, `"`)
		}
	}
	for _, key := range keys {
		if value := strings.TrimSpace(fileValues[key]); value != "" {
			return strings.Trim(value, `"`)
		}
	}
	return ""
}

func loadDotenvFiles(paths ...string) map[string]string {
	values := map[string]string{}
	for i := len(paths) - 1; i >= 0; i-- {
		path := paths[i]
		file, err := os.Open(path)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			key, value, ok := strings.Cut(line, "=")
			if !ok {
				continue
			}
			key = strings.TrimSpace(key)
			if key == "" {
				continue
			}
			values[key] = strings.Trim(strings.TrimSpace(value), `"`)
		}
		_ = file.Close()
	}
	return values
}

func parseBool(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}
