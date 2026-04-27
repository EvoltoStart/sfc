package wechatmini

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"sfc/server/internal/service"
)

type client struct {
	appID      string
	secret     string
	baseURL    string
	httpClient *http.Client
}

func New(appID, secret string) service.WechatMiniappClient {
	appID = strings.TrimSpace(appID)
	secret = strings.TrimSpace(secret)
	if appID == "" || secret == "" {
		return service.NewFakeWechatMiniappClient()
	}
	return &client{
		appID:      appID,
		secret:     secret,
		baseURL:    "https://api.weixin.qq.com",
		httpClient: &http.Client{Timeout: 8 * time.Second},
	}
}

func (c *client) Code2Session(ctx context.Context, code string) (*service.WechatSession, error) {
	values := url.Values{}
	values.Set("appid", c.appID)
	values.Set("secret", c.secret)
	values.Set("js_code", strings.TrimSpace(code))
	values.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/sns/jscode2session?"+values.Encode(), nil)
	if err != nil {
		return nil, err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var payload struct {
		OpenID     string `json:"openid"`
		UnionID    string `json:"unionid"`
		SessionKey string `json:"session_key"`
		ErrCode    int    `json:"errcode"`
		ErrMsg     string `json:"errmsg"`
	}
	if err = json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("wechat code2session http status=%d", resp.StatusCode)
	}
	if payload.ErrCode != 0 {
		return nil, fmt.Errorf("wechat code2session errcode=%d errmsg=%s", payload.ErrCode, payload.ErrMsg)
	}
	if strings.TrimSpace(payload.OpenID) == "" {
		return nil, fmt.Errorf("wechat code2session missing openid")
	}
	return &service.WechatSession{
		OpenID:     payload.OpenID,
		UnionID:    payload.UnionID,
		SessionKey: payload.SessionKey,
	}, nil
}
