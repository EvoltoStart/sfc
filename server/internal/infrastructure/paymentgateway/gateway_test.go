package paymentgateway

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	alipaySDK "github.com/smartwalle/alipay/v3"
	"github.com/smartwalle/nsign"

	"sfc/server/internal/domain"
	"sfc/server/internal/service"
)

func TestAlipayPaymentGatewayCreateOrder(t *testing.T) {
	gateway, _ := newTestAlipayGateway(t)

	result, err := gateway.CreateOrder(context.Background(), service.PaymentGatewayCreateRequest{
		OutTradeNo:     "PO202604180001",
		OrderNo:        "RO202604180001",
		AmountFen:      12345,
		NotifyURL:      "https://example.com/notify",
		ReturnURL:      "https://example.com/return",
		ExpireDuration: 15 * time.Minute,
	})
	if err != nil {
		t.Fatalf("create order failed: %v", err)
	}
	if result.PayURL == "" {
		t.Fatal("expected pay url")
	}
	if !strings.Contains(result.PayURL, "openapi-sandbox.dl.alipaydev.com") {
		t.Fatalf("expected sandbox gateway url, got %s", result.PayURL)
	}
	if result.PayParams["provider"] != "ALIPAY" {
		t.Fatalf("unexpected provider: %v", result.PayParams["provider"])
	}
}

func TestAlipayPaymentGatewayParseNotification(t *testing.T) {
	gateway, client := newTestAlipayGateway(t)

	values := url.Values{}
	values.Set("out_trade_no", "PO202604180001")
	values.Set("trade_no", "2026041800000001")
	values.Set("trade_status", "TRADE_SUCCESS")
	values.Set("sign_type", "RSA2")
	signature, err := client.SignValues(values, nsign.WithIgnore("sign_type"))
	if err != nil {
		t.Fatalf("sign notification failed: %v", err)
	}
	values.Set("sign", base64.StdEncoding.EncodeToString(signature))

	req := httptest.NewRequest(http.MethodPost, "/notify", strings.NewReader(values.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	notification, err := gateway.ParseNotification(context.Background(), req)
	if err != nil {
		t.Fatalf("parse notification failed: %v", err)
	}
	if notification.OutTradeNo != "PO202604180001" {
		t.Fatalf("unexpected out trade no: %s", notification.OutTradeNo)
	}
	if notification.ProviderTradeNo != "2026041800000001" {
		t.Fatalf("unexpected provider trade no: %s", notification.ProviderTradeNo)
	}
	if notification.PayStatus != domain.PaymentStatusPaid {
		t.Fatalf("unexpected pay status: %s", notification.PayStatus)
	}
}

func newTestAlipayGateway(t *testing.T) (*alipayGateway, *alipaySDK.Client) {
	t.Helper()

	privateKey, publicKey := generateTestKeyPair(t)
	client, err := alipaySDK.New("2021000000000000", privateKey, false, alipaySDK.WithNewSandboxGateway())
	if err != nil {
		t.Fatalf("create alipay client failed: %v", err)
	}
	if err = client.LoadAliPayPublicKey(publicKey); err != nil {
		t.Fatalf("load alipay public key failed: %v", err)
	}
	return &alipayGateway{client: client}, client
}

func generateTestKeyPair(t *testing.T) (string, string) {
	t.Helper()

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate private key failed: %v", err)
	}

	privateDER, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		t.Fatalf("marshal private key failed: %v", err)
	}
	privatePEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: privateDER})

	publicDER, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		t.Fatalf("marshal public key failed: %v", err)
	}
	publicPEM := pem.EncodeToMemory(&pem.Block{Type: "PUBLIC KEY", Bytes: publicDER})

	return string(privatePEM), string(publicPEM)
}
