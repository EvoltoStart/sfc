package main

import (
	"log"
	"net/http"
	"time"

	"sfc/server/internal/bootstrap"
	appconfig "sfc/server/internal/config"
	httpapi "sfc/server/internal/interfaces/httpapi"
)

func main() {
	cfg, err := appconfig.LoadFromEnv()
	if err != nil {
		log.Fatal(err)
	}

	appStore, err := bootstrap.NewStoreFromConfig(cfg)
	if err != nil {
		log.Fatal(err)
	}
	svc := bootstrap.NewServiceFromConfig(appStore, cfg)
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			result := svc.RunMaintenanceOnce(time.Now().UTC())
			if result.ExpiredPendingPayOrders > 0 {
				log.Printf("maintenance expiredPendingPayOrders=%d", result.ExpiredPendingPayOrders)
			}
		}
	}()
	router := httpapi.NewRouter(svc)

	server := &http.Server{
		Addr:              cfg.ServerAddr,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
	}

	log.Printf("sfc backend listening on %s env=%s", cfg.ServerAddr, cfg.Env)
	log.Fatal(server.ListenAndServe())
}
