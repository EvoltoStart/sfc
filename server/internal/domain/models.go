package domain

import "time"

type User struct {
	ID             int64
	OpenID         string
	UnionID        string
	Mobile         string
	Nickname       string
	AvatarURL      string
	RealnameStatus string
	UserStatus     string
	LastLoginAt    time.Time
	CreatedAt      time.Time
}

type Session struct {
	Token     string
	UserID    int64
	CreatedAt time.Time
}

type RealnameAuth struct {
	ID           int64
	UserID       int64
	RealName     string
	IDCardMasked string
	AuthStatus   string
	SubmittedAt  time.Time
	ReviewedAt   *time.Time
	RejectReason string
}

type EmergencyContact struct {
	ID        int64
	UserID    int64
	Name      string
	Mobile    string
	Relation  string
	IsDefault bool
	CreatedAt time.Time
	UpdatedAt time.Time
}

type SafetyConfig struct {
	ID                     int64
	UserID                 int64
	ShareTripByDefault     bool
	DefaultShareContactIDs []int64
	SOSAutoNotifyContacts  bool
	TraceVisibleToContacts bool
	UpdatedAt              time.Time
}

type SafetySOSEvent struct {
	ID               int64
	UserID           int64
	OrderID          int64
	CurrentLat       float64
	CurrentLng       float64
	Message          string
	NotifyContactIDs []int64
	EventStatus      string
	CreatedAt        time.Time
}

type SafetyShareLink struct {
	ID        int64
	UserID    int64
	OrderID   int64
	TripID    int64
	Token     string
	ShareURL  string
	ExpiresAt time.Time
	CreatedAt time.Time
}

type SafetyTracePoint struct {
	ID         int64
	OrderID    int64
	UserID     int64
	Lat        float64
	Lng        float64
	RecordedAt time.Time
}

type DriverLicense struct {
	ID              int64
	UserID          int64
	LicenseNoMasked string
	IssueDate       string
	ExpireDate      string
	AuthStatus      string
	ImageURL        string
	SubmittedAt     time.Time
	ReviewedAt      *time.Time
	RejectReason    string
}

type Vehicle struct {
	ID              int64
	UserID          int64
	PlateNoMasked   string
	Brand           string
	Model           string
	Color           string
	SeatCount       int
	AuthStatus      string
	IsDefault       bool
	VehicleImageURL string
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type Waypoint struct {
	SeqNo     int     `json:"seqNo,omitempty"`
	PointName string  `json:"pointName,omitempty"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
}

type RouteTemplate struct {
	ID         int64
	UserID     int64
	RouteName  string
	StartName  string
	StartLat   float64
	StartLng   float64
	EndName    string
	EndLat     float64
	EndLng     float64
	Waypoints  []Waypoint
	TimePeriod string
	IsDefault  bool
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type Trip struct {
	ID                  int64
	DriverUserID        int64
	VehicleID           int64
	StartName           string
	StartLat            float64
	StartLng            float64
	EndName             string
	EndLat              float64
	EndLng              float64
	Waypoints           []Waypoint
	DepartAt            time.Time
	SeatTotal           int
	SeatAvailable       int
	PriceTotalFen       int64
	ServiceFeeFen       int64
	DistanceMeter       int64
	RouteScore          float64
	TripStatus          string
	FrequencySnapshotID int64
	FrequencyDayCount   int
	FrequencyMonthCount int
	CreatedAt           time.Time
	CancelledReason     string
}

type JoinRequest struct {
	ID              int64
	TripID          int64
	PassengerUserID int64
	StartName       string
	StartLat        float64
	StartLng        float64
	EndName         string
	EndLat          float64
	EndLng          float64
	RequestStatus   string
	AcceptedAt      *time.Time
	RejectedAt      *time.Time
	CancelledAt     *time.Time
	ExpiredAt       *time.Time
	Remark          string
	CreatedAt       time.Time
}

type RideOrder struct {
	ID                 int64
	OrderNo            string
	TripID             int64
	JoinRequestID      int64
	DriverUserID       int64
	PassengerUserID    int64
	OrderStatus        string
	PayableAmountFen   int64
	ServiceFeeFen      int64
	DistanceMeter      int64
	BoardConfirmedAt   *time.Time
	ArrivalConfirmedAt *time.Time
	CancelReason       string
	ExceptionFlag      bool
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

type OrderStatusLog struct {
	ID           int64
	OrderID      int64
	FromStatus   string
	ToStatus     string
	OperatorType string
	OperatorID   int64
	Remark       string
	CreatedAt    time.Time
}

type PaymentOrder struct {
	ID              int64
	BizOrderID      int64
	OutTradeNo      string
	PayChannel      string
	ProviderTradeNo string
	PayStatus       string
	PayURL          string
	PaidAt          *time.Time
	TotalAmountFen  int64
	PayExpireAt     time.Time
	CreatedAt       time.Time
}

type RefundOrder struct {
	ID              int64
	OrderID         int64
	PaymentOrderID  int64
	RefundNo        string
	RefundAmountFen int64
	RefundStatus    string
	RefundReason    string
	CreatedAt       time.Time
}

type SettlementRecord struct {
	ID              int64
	OrderID         int64
	DriverUserID    int64
	SettleAmountFen int64
	SettleStatus    string
	SettledAt       time.Time
}

type WalletAccount struct {
	ID                 int64
	UserID             int64
	AvailableAmountFen int64
	FrozenAmountFen    int64
	TotalIncomeFen     int64
	TotalWithdrawFen   int64
}

type WalletLedger struct {
	ID              int64
	AccountID       int64
	BizType         string
	ChangeAmountFen int64
	BalanceAfterFen int64
	BizNo           string
	Remark          string
	CreatedAt       time.Time
}

type WithdrawRecord struct {
	ID             int64
	UserID         int64
	WithdrawNo     string
	AmountFen      int64
	WithdrawStatus string
	Channel        string
	BankCardID     int64
	Remark         string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type RuleSnapshot struct {
	ID           int64
	RuleType     string
	RuleVersion  string
	SnapshotJSON string
	CreatedAt    time.Time
}

type PricingAuditLog struct {
	ID                int64
	TripID            int64
	PricingInputJSON  string
	PricingResultJSON string
	CreatedAt         time.Time
}

type FrequencyLimitLog struct {
	ID                int64
	DriverUserID      int64
	CityCode          string
	TripType          string
	CurrentDayCount   int
	CurrentMonthCount int
	RuleSnapshotID    int64
	Passed            bool
	CreatedAt         time.Time
}

type AdminUser struct {
	ID          int64
	Username    string
	Password    string
	DisplayName string
	Mobile      string
	Status      string
	LastLoginAt *time.Time
	CreatedAt   time.Time
	RoleCodes   []string
	ButtonCodes []string
	MenuCodes   []string
	DataScopes  []string
}

type AdminSession struct {
	Token       string
	AdminUserID int64
	CreatedAt   time.Time
}

type AuditTask struct {
	ID            int64
	TaskType      string
	BizID         int64
	ApplicantName string
	TaskStatus    string
	SubmittedAt   time.Time
	Remark        string
	MaterialList  []map[string]any
	HistoryLogs   []map[string]any
}

type CMSBanner struct {
	ID        int64
	Title     string
	ImageURL  string
	LinkURL   string
	SortNo    int
	Status    string
	UpdatedAt time.Time
}

type CMSArticle struct {
	ID        int64
	Type      string
	Title     string
	Content   string
	Status    string
	UpdatedAt time.Time
}
