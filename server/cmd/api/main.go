package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"sfc/server/internal/bootstrap"
	httpapi "sfc/server/internal/interfaces/httpapi"
	"sfc/server/internal/store"
)

func main() {
	addr := os.Getenv("SFC_SERVER_ADDR")
	if addr == "" {
		addr = ":8080"
	}

	svc := bootstrap.NewServiceFromEnv(store.NewMemoryStore())
	router := httpapi.NewRouter(svc)

	server := &http.Server{
		Addr:              addr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	log.Printf("sfc backend listening on %s", addr)
	log.Fatal(server.ListenAndServe())
}
