package store

import (
	"sync"
	"time"

	"sfc/server/internal/domain"
)

type MemoryStore struct {
	Mu sync.Mutex

	IDs map[string]int64

	Users         map[int64]*domain.User
	UsersByOpenID map[string]*domain.User
	Sessions      map[string]*domain.Session
	AdminUsers    map[int64]*domain.AdminUser
	AdminSessions map[string]*domain.AdminSession

	RealnameAuths     map[int64]*domain.RealnameAuth
	Contacts          map[int64]*domain.EmergencyContact
	SafetyConfigs     map[int64]*domain.SafetyConfig
	SafetySOSEvents   map[int64]*domain.SafetySOSEvent
	SafetyShareLinks  map[int64]*domain.SafetyShareLink
	SafetyTracePoints map[int64][]*domain.SafetyTracePoint
	Licenses          map[int64]*domain.DriverLicense
	Vehicles          map[int64]*domain.Vehicle
	RouteTemplates    map[int64]*domain.RouteTemplate

	Trips        map[int64]*domain.Trip
	JoinRequests map[int64]*domain.JoinRequest
	Orders       map[int64]*domain.RideOrder
	OrderLogs    map[int64][]*domain.OrderStatusLog

	PaymentOrders        map[int64]*domain.PaymentOrder
	PaymentOrdersByOrder map[int64]*domain.PaymentOrder
	PaymentOrdersByTrade map[string]*domain.PaymentOrder
	RefundOrders         map[int64]*domain.RefundOrder
	RefundOrdersByOrder  map[int64]*domain.RefundOrder
	SettlementsByOrder   map[int64]*domain.SettlementRecord

	WalletAccounts map[int64]*domain.WalletAccount
	WalletLedgers  map[int64][]*domain.WalletLedger
	Withdraws      map[int64]*domain.WithdrawRecord

	RuleSnapshots      map[int64]*domain.RuleSnapshot
	PricingLogs        map[int64]*domain.PricingAuditLog
	FrequencyLogs      map[int64]*domain.FrequencyLimitLog
	AuditTasks         map[int64]*domain.AuditTask
	OperationAuditLogs map[int64]*domain.OperationAuditLog
	CMSBanners         map[int64]*domain.CMSBanner
	CMSArticles        map[string]*domain.CMSArticle
}

func NewMemoryStore() *MemoryStore {
	s := &MemoryStore{
		IDs:                  map[string]int64{},
		Users:                map[int64]*domain.User{},
		UsersByOpenID:        map[string]*domain.User{},
		Sessions:             map[string]*domain.Session{},
		AdminUsers:           map[int64]*domain.AdminUser{},
		AdminSessions:        map[string]*domain.AdminSession{},
		RealnameAuths:        map[int64]*domain.RealnameAuth{},
		Contacts:             map[int64]*domain.EmergencyContact{},
		SafetyConfigs:        map[int64]*domain.SafetyConfig{},
		SafetySOSEvents:      map[int64]*domain.SafetySOSEvent{},
		SafetyShareLinks:     map[int64]*domain.SafetyShareLink{},
		SafetyTracePoints:    map[int64][]*domain.SafetyTracePoint{},
		Licenses:             map[int64]*domain.DriverLicense{},
		Vehicles:             map[int64]*domain.Vehicle{},
		RouteTemplates:       map[int64]*domain.RouteTemplate{},
		Trips:                map[int64]*domain.Trip{},
		JoinRequests:         map[int64]*domain.JoinRequest{},
		Orders:               map[int64]*domain.RideOrder{},
		OrderLogs:            map[int64][]*domain.OrderStatusLog{},
		PaymentOrders:        map[int64]*domain.PaymentOrder{},
		PaymentOrdersByOrder: map[int64]*domain.PaymentOrder{},
		PaymentOrdersByTrade: map[string]*domain.PaymentOrder{},
		RefundOrders:         map[int64]*domain.RefundOrder{},
		RefundOrdersByOrder:  map[int64]*domain.RefundOrder{},
		SettlementsByOrder:   map[int64]*domain.SettlementRecord{},
		WalletAccounts:       map[int64]*domain.WalletAccount{},
		WalletLedgers:        map[int64][]*domain.WalletLedger{},
		Withdraws:            map[int64]*domain.WithdrawRecord{},
		RuleSnapshots:        map[int64]*domain.RuleSnapshot{},
		PricingLogs:          map[int64]*domain.PricingAuditLog{},
		FrequencyLogs:        map[int64]*domain.FrequencyLimitLog{},
		AuditTasks:           map[int64]*domain.AuditTask{},
		OperationAuditLogs:   map[int64]*domain.OperationAuditLog{},
		CMSBanners:           map[int64]*domain.CMSBanner{},
		CMSArticles:          map[string]*domain.CMSArticle{},
	}

	nowValue := time.Now().UTC()
	s.AdminUsers[1] = &domain.AdminUser{
		ID:          1,
		Username:    "admin",
		Password:    "admin123",
		DisplayName: "系统管理员",
		Status:      domain.AdminUserStatusActive,
		CreatedAt:   nowValue,
		RoleCodes:   []string{"SUPER_ADMIN"},
		MenuCodes:   []string{"dashboard", "audit", "orders", "risk", "finance", "cms"},
		ButtonCodes: []string{"audit:approve", "audit:reject", "cms:banner:create", "cms:banner:update", "cms:article:update"},
		DataScopes:  []string{"ALL"},
	}
	s.CMSArticles["USER_AGREEMENT"] = &domain.CMSArticle{ID: 1, Type: "USER_AGREEMENT", Title: "用户协议", Content: "默认用户协议内容", Status: "PUBLISHED", UpdatedAt: nowValue}
	s.CMSArticles["PRIVACY_POLICY"] = &domain.CMSArticle{ID: 2, Type: "PRIVACY_POLICY", Title: "隐私政策", Content: "默认隐私政策内容", Status: "PUBLISHED", UpdatedAt: nowValue}
	s.CMSArticles["SAFETY_NOTICE"] = &domain.CMSArticle{ID: 3, Type: "SAFETY_NOTICE", Title: "安全须知", Content: "默认安全须知内容", Status: "PUBLISHED", UpdatedAt: nowValue}
	s.CMSArticles["HELP_CENTER"] = &domain.CMSArticle{ID: 4, Type: "HELP_CENTER", Title: "帮助中心", Content: "默认帮助中心内容", Status: "PUBLISHED", UpdatedAt: nowValue}
	s.CMSBanners[1] = &domain.CMSBanner{ID: 1, Title: "默认轮播图", ImageURL: "https://example.com/banner.png", LinkURL: "https://example.com", SortNo: 1, Status: "ENABLED", UpdatedAt: nowValue}
	s.IDs["admin_user"] = 1
	s.IDs["cms_banner"] = 1
	s.IDs["cms_article"] = 4
	return s
}

func (s *MemoryStore) NextID(kind string) int64 {
	s.IDs[kind]++
	return s.IDs[kind]
}

func (s *MemoryStore) Lock() {
	s.Mu.Lock()
}

func (s *MemoryStore) Unlock() {
	s.Mu.Unlock()
}

func (s *MemoryStore) Snapshot() *MemoryStore {
	return s
}
