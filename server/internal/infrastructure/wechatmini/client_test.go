package wechatmini

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCode2Session(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("appid") != "app" {
			t.Fatalf("unexpected appid")
		}
		if r.URL.Query().Get("secret") != "secret" {
			t.Fatalf("unexpected secret")
		}
		if r.URL.Query().Get("js_code") != "code" {
			t.Fatalf("unexpected code")
		}
		_, _ = w.Write([]byte(`{"openid":"openid-1","unionid":"union-1","session_key":"session-1"}`))
	}))
	defer server.Close()

	c := New("app", "secret").(*client)
	c.baseURL = server.URL

	session, err := c.Code2Session(context.Background(), "code")
	if err != nil {
		t.Fatal(err)
	}
	if session.OpenID != "openid-1" || session.UnionID != "union-1" {
		t.Fatalf("unexpected session: %#v", session)
	}
}

func TestCode2SessionReturnsProviderError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"errcode":40029,"errmsg":"invalid code"}`))
	}))
	defer server.Close()

	c := New("app", "secret").(*client)
	c.baseURL = server.URL

	if _, err := c.Code2Session(context.Background(), "bad-code"); err == nil {
		t.Fatal("expected provider error")
	}
}
