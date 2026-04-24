package httpapi

import (
	"encoding/json"
	"net/http"
	"strconv"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/common/middleware"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewRouter(svc *service.Service) http.Handler {
	handler := &Handler{svc: svc}
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", handler.healthz)
	registerAuthRoutes(mux, svc, handler)
	registerUserRoutes(mux, svc, handler)
	registerDriverRoutes(mux, svc, handler)
	registerRouteRoutes(mux, svc, handler)
	registerTripRoutes(mux, svc, handler)
	registerMatchingRoutes(mux, svc, handler)
	registerOrderRoutes(mux, svc, handler)
	registerPaymentRoutes(mux, svc, handler)
	registerWalletRoutes(mux, svc, handler)
	registerSafetyRoutes(mux, svc, handler)
	registerAdminRoutes(mux, svc, handler)

	return middleware.Recoverer(middleware.RequestID(mux))
}

func (h *Handler) healthz(w http.ResponseWriter, r *http.Request) {
	response.Success(w, r, map[string]any{
		"status": "ok",
	})
}

func decodeJSON(r *http.Request, target any) *errno.Error {
	defer r.Body.Close()
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return errno.New("PARAM_INVALID", "请求体格式错误", http.StatusBadRequest)
	}
	return nil
}

func parsePathID(r *http.Request, name string) (int64, *errno.Error) {
	value := r.PathValue(name)
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, errno.New("PARAM_INVALID", "路径参数非法", http.StatusBadRequest)
	}
	return id, nil
}

func parsePathIDOrZero(r *http.Request, name string) (int64, *errno.Error) {
	value := r.PathValue(name)
	if value == "" {
		return 0, nil
	}
	return parsePathID(r, name)
}

func parsePageParams(r *http.Request) (int, int) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	return page, pageSize
}
