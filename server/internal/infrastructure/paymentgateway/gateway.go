package paymentgateway

import (
	"context"
	"crypto"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	alipaySDK "github.com/smartwalle/alipay/v3"

	"sfc/server/internal/domain"
	"sfc/server/internal/service"
)

type mockGateway struct{}

func NewMock() service.PaymentGateway {
	return mockGateway{}
}

func (mockGateway) Channel() string {
	return "MOCK"
}

func (mockGateway) CreateOrder(_ context.Context, req service.PaymentGatewayCreateRequest) (*service.PaymentGatewayCreateResult, error) {
	nowValue := time.Now().UTC()
	return &service.PaymentGatewayCreateResult{
		PayParams: map[string]any{
			"provider":  "MOCK",
			"nonceStr":  "NONCE" + strconv.FormatInt(req.AmountFen, 10),
			"package":   "mock_payment",
			"timestamp": nowValue.Unix(),
			"signType":  "HMAC-SHA256",
		},
	}, nil
}

func (mockGateway) ParseNotification(_ context.Context, r *http.Request) (*service.PaymentGatewayNotification, error) {
	if err := r.ParseForm(); err != nil {
		return nil, err
	}

	outTradeNo := strings.TrimSpace(r.PostFormValue("out_trade_no"))
	if outTradeNo == "" {
		outTradeNo = strings.TrimSpace(r.PostFormValue("outTradeNo"))
	}
	if outTradeNo == "" {
		return nil, errors.New("out trade no is required")
	}

	payStatus := strings.TrimSpace(r.PostFormValue("payStatus"))
	if payStatus == "" {
		payStatus = strings.TrimSpace(r.PostFormValue("trade_status"))
	}
	switch payStatus {
	case "TRADE_SUCCESS", "TRADE_FINISHED", domain.PaymentStatusPaid:
		payStatus = domain.PaymentStatusPaid
	case "TRADE_CLOSED", domain.PaymentStatusFail:
		payStatus = domain.PaymentStatusFail
	default:
		payStatus = domain.PaymentStatusPaying
	}

	providerTradeNo := strings.TrimSpace(r.PostFormValue("trade_no"))
	if providerTradeNo == "" {
		providerTradeNo = strings.TrimSpace(r.PostFormValue("providerTradeNo"))
	}

	return &service.PaymentGatewayNotification{
		OutTradeNo:      outTradeNo,
		ProviderTradeNo: providerTradeNo,
		PayStatus:       payStatus,
	}, nil
}

type alipayGateway struct {
	client *alipaySDK.Client
}

func NewAlipaySandbox(appID, privateKey, publicKey string) service.PaymentGateway {
	appID = strings.TrimSpace(appID)
	privateKey = normalizePEM(privateKey)
	publicKey = normalizePEM(publicKey)
	if appID == "" || privateKey == "" || publicKey == "" {
		return NewMock()
	}

	client, err := alipaySDK.New(appID, privateKey, false, alipaySDK.WithNewSandboxGateway())
	if err != nil {
		return NewMock()
	}
	if err = client.LoadAliPayPublicKey(publicKey); err != nil {
		return NewMock()
	}
	return &alipayGateway{client: client}
}

func (g *alipayGateway) Channel() string {
	return "ALIPAY"
}

func (g *alipayGateway) CreateOrder(_ context.Context, req service.PaymentGatewayCreateRequest) (*service.PaymentGatewayCreateResult, error) {
	payURL, err := g.client.TradeWapPay(alipaySDK.TradeWapPay{
		Trade: alipaySDK.Trade{
			NotifyURL:      strings.TrimSpace(req.NotifyURL),
			ReturnURL:      strings.TrimSpace(req.ReturnURL),
			Subject:        "顺风车订单 " + req.OrderNo,
			Body:           "顺风车平台出行支付",
			OutTradeNo:     req.OutTradeNo,
			TotalAmount:    formatFenToYuan(req.AmountFen),
			ProductCode:    "QUICK_WAP_WAY",
			TimeoutExpress: formatTimeoutExpress(req.ExpireDuration),
		},
	})
	if err != nil {
		return nil, err
	}

	payURLString := payURL.String()
	return &service.PaymentGatewayCreateResult{
		PayURL: payURLString,
		PayParams: map[string]any{
			"provider":   "ALIPAY",
			"paymentUrl": payURLString,
			"signType":   crypto.SHA256.String(),
		},
	}, nil
}

func (g *alipayGateway) ParseNotification(ctx context.Context, r *http.Request) (*service.PaymentGatewayNotification, error) {
	if err := r.ParseForm(); err != nil {
		return nil, err
	}
	notification, err := g.client.DecodeNotification(ctx, url.Values(r.PostForm))
	if err != nil {
		return nil, err
	}

	payStatus := domain.PaymentStatusPaying
	switch notification.TradeStatus {
	case alipaySDK.TradeStatusSuccess, alipaySDK.TradeStatusFinished:
		payStatus = domain.PaymentStatusPaid
	case alipaySDK.TradeStatusClosed:
		payStatus = domain.PaymentStatusFail
	}

	return &service.PaymentGatewayNotification{
		OutTradeNo:      notification.OutTradeNo,
		ProviderTradeNo: notification.TradeNo,
		PayStatus:       payStatus,
	}, nil
}

func normalizePEM(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	return strings.ReplaceAll(value, `\n`, "\n")
}

func formatTimeoutExpress(duration time.Duration) string {
	if duration <= 0 {
		return "15m"
	}
	minutes := int(duration.Round(time.Minute) / time.Minute)
	if minutes <= 0 {
		minutes = 15
	}
	return strconv.Itoa(minutes) + "m"
}

func formatFenToYuan(amountFen int64) string {
	return strconv.FormatFloat(float64(amountFen)/100, 'f', 2, 64)
}
