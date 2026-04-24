package response

import (
	"encoding/json"
	"net/http"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/common/requestctx"
)

type envelope struct {
	Code      any    `json:"code"`
	Message   string `json:"message"`
	Data      any    `json:"data"`
	RequestID string `json:"requestId"`
}

func Success(w http.ResponseWriter, r *http.Request, data any) {
	write(w, http.StatusOK, envelope{
		Code:      0,
		Message:   "ok",
		Data:      data,
		RequestID: requestctx.RequestID(r.Context()),
	})
}

func Error(w http.ResponseWriter, r *http.Request, appErr *errno.Error) {
	if appErr == nil {
		appErr = errno.Internal("")
	}
	status := appErr.Status
	if status == 0 {
		status = http.StatusBadRequest
	}
	write(w, status, envelope{
		Code:      appErr.Code,
		Message:   appErr.Message,
		Data:      map[string]any{},
		RequestID: requestctx.RequestID(r.Context()),
	})
}

func write(w http.ResponseWriter, status int, body envelope) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
