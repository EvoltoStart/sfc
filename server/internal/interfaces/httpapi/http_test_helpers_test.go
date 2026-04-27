package httpapi

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"sfc/server/internal/bootstrap"
	"sfc/server/internal/store"
)

func newEnvBackedTestServer(t *testing.T, env map[string]string) *httptest.Server {
	t.Helper()
	for key, value := range env {
		t.Setenv(key, value)
	}
	svc, err := bootstrap.NewServiceFromEnv(store.NewMemoryStore())
	if err != nil {
		t.Fatalf("create service from env failed: %v", err)
	}
	return httptest.NewServer(NewRouter(svc))
}

func generateTestPEMKeys(t *testing.T) (string, string) {
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

func doFormRequestRaw(t *testing.T, client *http.Client, method, url string, body string, headers map[string]string) (int, string) {
	t.Helper()

	req, err := http.NewRequest(method, url, strings.NewReader(body))
	if err != nil {
		t.Fatalf("create request failed: %v", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	for key, value := range headers {
		req.Header.Set(key, value)
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("do form request failed: %v", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read form response failed: %v", err)
	}
	return resp.StatusCode, string(data)
}
