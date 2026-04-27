package config

import (
	"os"
	"testing"
)

func TestValidateAllowsDevFallbacks(t *testing.T) {
	cfg := AppConfig{Env: "dev"}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("dev config should allow local fallbacks: %v", err)
	}
}

func TestValidateRejectsProdMissingExternalCredentials(t *testing.T) {
	cfg := AppConfig{Env: "prod"}
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected prod config validation to fail")
	}
}

func TestValidateAcceptsProdExternalCredentials(t *testing.T) {
	cfg := AppConfig{
		Env:                 "prod",
		AMapKey:             "amap-key",
		AlipayAppID:         "app-id",
		AlipayPrivateKey:    "private-key",
		AlipayPublicKey:     "public-key",
		WechatMiniappAppID:  "wx-app",
		WechatMiniappSecret: "wx-secret",
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("prod config should pass: %v", err)
	}
}

func TestValidateAcceptsProdFakeWechatForNonPaymentTesting(t *testing.T) {
	cfg := AppConfig{
		Env:               "prod",
		AMapKey:           "amap-key",
		AlipayAppID:       "app-id",
		AlipayPrivateKey:  "private-key",
		AlipayPublicKey:   "public-key",
		WechatMiniappFake: true,
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("prod config with fake wechat should pass when explicitly enabled: %v", err)
	}
}

func TestConfigFirstPrefersEnvironmentOverDotenv(t *testing.T) {
	t.Setenv("SFC_SERVER_ADDR", ":19090")
	value := configFirst(map[string]string{"SFC_SERVER_ADDR": ":18080"}, "SFC_SERVER_ADDR")
	if value != ":19090" {
		t.Fatalf("expected env value, got %q", value)
	}
}

func TestLoadDotenvFilesUsesLaterOverrideOrder(t *testing.T) {
	dir := t.TempDir()
	t.Chdir(dir)
	if err := os.WriteFile(".env.example", []byte("SFC_ENV=dev\nSFC_SERVER_ADDR=:18080\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(".env", []byte("SFC_SERVER_ADDR=:19090\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	values := loadDotenvFiles(".env", ".env.example")
	if values["SFC_SERVER_ADDR"] != ":19090" {
		t.Fatalf("expected .env to override .env.example, got %q", values["SFC_SERVER_ADDR"])
	}
}
