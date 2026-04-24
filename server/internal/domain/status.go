package domain

const (
	UserStatusActive    = "ACTIVE"
	UserStatusForbidden = "FORBIDDEN"

	AuthStatusPending  = "PENDING"
	AuthStatusApproved = "APPROVED"
	AuthStatusRejected = "REJECTED"

	RealnameStatusUnsubmitted = "UNSUBMITTED"

	TripStatusDraft      = "DRAFT"
	TripStatusPublished  = "PUBLISHED"
	TripStatusMatching   = "MATCHING"
	TripStatusConfirmed  = "CONFIRMED"
	TripStatusInProgress = "IN_PROGRESS"
	TripStatusCompleted  = "COMPLETED"
	TripStatusCancelled  = "CANCELLED"

	JoinRequestStatusPending   = "PENDING_DRIVER_CONFIRM"
	JoinRequestStatusAccepted  = "ACCEPTED"
	JoinRequestStatusRejected  = "REJECTED"
	JoinRequestStatusCancelled = "CANCELLED"
	JoinRequestStatusExpired   = "EXPIRED"

	OrderStatusPendingPassengerPay = "PENDING_PASSENGER_PAY"
	OrderStatusPendingDepart       = "PENDING_DEPART"
	OrderStatusInProgress          = "IN_PROGRESS"
	OrderStatusPendingArrival      = "PENDING_ARRIVAL_CONFIRM"
	OrderStatusCompleted           = "COMPLETED"
	OrderStatusCancelled           = "CANCELLED"
	OrderStatusExceptionHandling   = "EXCEPTION_HANDLING"
	OrderStatusRefunded            = "REFUNDED"

	PaymentStatusInit      = "INIT"
	PaymentStatusPaying    = "PAYING"
	PaymentStatusPaid      = "PAID"
	PaymentStatusFail      = "FAIL"
	PaymentStatusRefunding = "REFUNDING"
	PaymentStatusRefunded  = "REFUNDED"

	SettlementStatusPending = "PENDING"
	SettlementStatusDone    = "DONE"

	WithdrawStatusPending = "PENDING"
	WithdrawStatusDone    = "DONE"
	WithdrawStatusFailed  = "FAILED"

	AuditTaskStatusPending  = "PENDING"
	AuditTaskStatusApproved = "APPROVED"
	AuditTaskStatusRejected = "REJECTED"

	AdminUserStatusActive   = "ACTIVE"
	AdminUserStatusDisabled = "DISABLED"

	RolePassenger = "PASSENGER"
	RoleDriver    = "DRIVER"
)
