package errno

import "net/http"

type Error struct {
	Code    string
	Message string
	Status  int
}

func (e *Error) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func New(code, message string, status int) *Error {
	return &Error{
		Code:    code,
		Message: message,
		Status:  status,
	}
}

func Internal(message string) *Error {
	if message == "" {
		message = "服务内部错误"
	}
	return New("INTERNAL_ERROR", message, http.StatusInternalServerError)
}

var (
	ErrParamInvalid           = New("PARAM_INVALID", "参数错误", http.StatusBadRequest)
	ErrUserNotLogin           = New("USER_NOT_LOGIN", "用户未登录", http.StatusUnauthorized)
	ErrUserForbidden          = New("USER_FORBIDDEN", "当前用户无权操作", http.StatusForbidden)
	ErrResourceNotFound       = New("RESOURCE_NOT_FOUND", "资源不存在", http.StatusNotFound)
	ErrRepeatSubmit           = New("REPEAT_SUBMIT", "请勿重复提交", http.StatusConflict)
	ErrTripStatusInvalid      = New("TRIP_STATUS_INVALID", "当前行程状态不允许该操作", http.StatusConflict)
	ErrOrderStatusInvalid     = New("ORDER_STATUS_INVALID", "当前订单状态不允许该操作", http.StatusConflict)
	ErrPaymentStatusInvalid   = New("PAYMENT_STATUS_INVALID", "当前支付状态不允许该操作", http.StatusConflict)
	ErrDriverNotVerified      = New("DRIVER_NOT_VERIFIED", "车主认证未完成，无法发布行程", http.StatusBadRequest)
	ErrRouteScoreNotPass      = New("ROUTE_SCORE_NOT_PASS", "顺路度校验未通过", http.StatusBadRequest)
	ErrFrequencyLimitExceeded = New("FREQUENCY_LIMIT_EXCEEDED", "接单频控超限", http.StatusBadRequest)
	ErrPermissionDenied       = New("PERMISSION_DENIED", "权限不足", http.StatusForbidden)
	ErrPaymentFailed          = New("PAYMENT_FAILED", "支付处理失败", http.StatusBadRequest)
	ErrRefundFailed           = New("REFUND_FAILED", "退款处理失败", http.StatusBadRequest)
	ErrUnsupportedOperation   = New("UNSUPPORTED_OPERATION", "当前功能暂不支持", http.StatusNotImplemented)
)
