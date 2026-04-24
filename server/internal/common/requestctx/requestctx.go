package requestctx

import "context"

type contextKey string

const (
	requestIDKey   contextKey = "request_id"
	userIDKey      contextKey = "user_id"
	adminUserIDKey contextKey = "admin_user_id"
	tokenKey       contextKey = "token"
)

func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, requestIDKey, requestID)
}

func RequestID(ctx context.Context) string {
	if requestID, ok := ctx.Value(requestIDKey).(string); ok {
		return requestID
	}
	return ""
}

func WithUserID(ctx context.Context, userID int64) context.Context {
	return context.WithValue(ctx, userIDKey, userID)
}

func UserID(ctx context.Context) int64 {
	if userID, ok := ctx.Value(userIDKey).(int64); ok {
		return userID
	}
	return 0
}

func WithAdminUserID(ctx context.Context, adminUserID int64) context.Context {
	return context.WithValue(ctx, adminUserIDKey, adminUserID)
}

func AdminUserID(ctx context.Context) int64 {
	if adminUserID, ok := ctx.Value(adminUserIDKey).(int64); ok {
		return adminUserID
	}
	return 0
}

func WithToken(ctx context.Context, token string) context.Context {
	return context.WithValue(ctx, tokenKey, token)
}

func Token(ctx context.Context) string {
	if token, ok := ctx.Value(tokenKey).(string); ok {
		return token
	}
	return ""
}
