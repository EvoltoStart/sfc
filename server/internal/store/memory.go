package store

import (
	"sync"

	"sfc/server/internal/domain"
)

type MemoryStore struct {
	Mu sync.Mutex

	IDs map[string]int64

	Users         map[int64]*domain.User
	UsersByOpenID map[string]*domain.User
	Sessions      map[string]*domain.Session

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

	RuleSnapshots map[int64]*domain.RuleSnapshot
	PricingLogs   map[int64]*domain.PricingAuditLog
	FrequencyLogs map[int64]*domain.FrequencyLimitLog
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		IDs:                  map[string]int64{},
		Users:                map[int64]*domain.User{},
		UsersByOpenID:        map[string]*domain.User{},
		Sessions:             map[string]*domain.Session{},
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
	}
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
