package middleware

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"sfc/server/internal/common/errno"
	"sfc/server/internal/common/requestctx"
	"sfc/server/internal/common/response"
	"sfc/server/internal/service"
)

var requestSeq uint64

type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *statusRecorder) Write(data []byte) (int, error) {
	if r.status == 0 {
		r.status = http.StatusOK
	}
	n, err := r.ResponseWriter.Write(data)
	r.bytes += n
	return n, err
}

func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Trace-Id")
		if requestID == "" {
			requestID = fmt.Sprintf("req-%d-%d", time.Now().UnixMilli(), atomic.AddUint64(&requestSeq, 1))
		}
		ctx := requestctx.WithRequestID(r.Context(), requestID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func Recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic recovered, requestId=%s, panic=%v", requestctx.RequestID(r.Context()), rec)
				response.Error(w, r, errno.Internal("服务内部错误"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func AccessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		recorder := &statusRecorder{ResponseWriter: w}
		next.ServeHTTP(recorder, r)
		status := recorder.status
		if status == 0 {
			status = http.StatusOK
		}
		log.Printf(
			"request requestId=%s method=%s path=%s status=%d bytes=%d durationMs=%d userId=%d adminUserId=%d",
			requestctx.RequestID(r.Context()),
			r.Method,
			r.URL.Path,
			status,
			recorder.bytes,
			time.Since(startedAt).Milliseconds(),
			requestctx.UserID(r.Context()),
			requestctx.AdminUserID(r.Context()),
		)
	})
}

func RequireAuth(svc *service.Service, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
		if !strings.HasPrefix(authHeader, "Bearer ") {
			response.Error(w, r, errno.ErrUserNotLogin)
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		user, appErr := svc.Authenticate(token)
		if appErr != nil {
			response.Error(w, r, appErr)
			return
		}

		ctx := requestctx.WithUserID(r.Context(), user.ID)
		ctx = requestctx.WithToken(ctx, token)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func RequireAdminAuth(svc *service.Service, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := strings.TrimSpace(r.Header.Get("Authorization"))
		if !strings.HasPrefix(authHeader, "Bearer ") {
			response.Error(w, r, errno.ErrUserNotLogin)
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		adminUser, appErr := svc.AuthenticateAdmin(token)
		if appErr != nil {
			response.Error(w, r, appErr)
			return
		}

		ctx := requestctx.WithAdminUserID(r.Context(), adminUser.ID)
		ctx = requestctx.WithToken(ctx, token)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func RequireAdminPermission(svc *service.Service, permissionCode string, next http.HandlerFunc) http.HandlerFunc {
	return RequireAdminAuth(svc, func(w http.ResponseWriter, r *http.Request) {
		if !svc.AdminHasPermission(requestctx.AdminUserID(r.Context()), permissionCode) {
			response.Error(w, r, errno.ErrPermissionDenied)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func UserID(r *http.Request) int64 {
	return requestctx.UserID(r.Context())
}

func Token(r *http.Request) string {
	return requestctx.Token(r.Context())
}

func AdminUserID(r *http.Request) int64 {
	return requestctx.AdminUserID(r.Context())
}

func RequestIDFromContext(ctx context.Context) string {
	return requestctx.RequestID(ctx)
}
