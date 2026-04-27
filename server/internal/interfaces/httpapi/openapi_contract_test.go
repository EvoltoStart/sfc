package httpapi

import (
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"testing"
)

func TestOpenAPIRoutesAreRegistered(t *testing.T) {
	root := findRepoRoot(t)
	docRoutes := extractMatches(
		t,
		filepath.Join(root, "docs", "顺风车OpenAPI接口清单.md"),
		regexp.MustCompile("### `(?P<method>GET|POST|PUT|DELETE|PATCH) (?P<path>[^`]+)`"),
	)
	registeredRoutes := extractMatches(
		t,
		filepath.Join(root, "server", "internal", "interfaces", "httpapi", "route_registrations.go"),
		regexp.MustCompile(`HandleFunc\("(?P<method>GET|POST|PUT|DELETE|PATCH) (?P<path>[^"]+)"`),
	)
	for route := range extractMatches(
		t,
		filepath.Join(root, "server", "internal", "interfaces", "httpapi", "admin_registrations.go"),
		regexp.MustCompile(`HandleFunc\("(?P<method>GET|POST|PUT|DELETE|PATCH) (?P<path>[^"]+)"`),
	) {
		registeredRoutes[route] = true
	}

	var missing []string
	for route := range docRoutes {
		if !registeredRoutes[route] {
			missing = append(missing, route)
		}
	}
	sort.Strings(missing)
	if len(missing) > 0 {
		t.Fatalf("OpenAPI routes missing registrations: %v", missing)
	}
}

func extractMatches(t *testing.T, path string, pattern *regexp.Regexp) map[string]bool {
	t.Helper()
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	result := map[string]bool{}
	for _, match := range pattern.FindAllStringSubmatch(string(raw), -1) {
		result[match[1]+" "+match[2]] = true
	}
	return result
}

func findRepoRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	for {
		if _, err = os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("repo root not found")
		}
		dir = parent
	}
}
