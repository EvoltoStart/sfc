package service

import "context"

type WechatMiniappClient interface {
	Code2Session(ctx context.Context, code string) (*WechatSession, error)
}

type WechatSession struct {
	OpenID     string
	UnionID    string
	SessionKey string
}

type fakeWechatMiniappClient struct{}

func NewFakeWechatMiniappClient() WechatMiniappClient {
	return fakeWechatMiniappClient{}
}

func (fakeWechatMiniappClient) Code2Session(_ context.Context, code string) (*WechatSession, error) {
	return &WechatSession{OpenID: code}, nil
}
