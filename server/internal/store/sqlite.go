package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"sfc/server/internal/domain"

	_ "modernc.org/sqlite"
)

const sqliteStateKey = "memory_snapshot"

type SQLiteStore struct {
	memory *MemoryStore
	db     *sql.DB
}

type persistedState struct {
	IDs                  map[string]int64                     `json:"ids"`
	Users                map[int64]*domain.User               `json:"users"`
	UsersByOpenID        map[string]*domain.User              `json:"usersByOpenId"`
	Sessions             map[string]*domain.Session           `json:"sessions"`
	AdminUsers           map[int64]*domain.AdminUser          `json:"adminUsers"`
	AdminSessions        map[string]*domain.AdminSession      `json:"adminSessions"`
	RealnameAuths        map[int64]*domain.RealnameAuth       `json:"realnameAuths"`
	Contacts             map[int64]*domain.EmergencyContact   `json:"contacts"`
	SafetyConfigs        map[int64]*domain.SafetyConfig       `json:"safetyConfigs"`
	SafetySOSEvents      map[int64]*domain.SafetySOSEvent     `json:"safetySOSEvents"`
	SafetyShareLinks     map[int64]*domain.SafetyShareLink    `json:"safetyShareLinks"`
	SafetyTracePoints    map[int64][]*domain.SafetyTracePoint `json:"safetyTracePoints"`
	Licenses             map[int64]*domain.DriverLicense      `json:"licenses"`
	Vehicles             map[int64]*domain.Vehicle            `json:"vehicles"`
	RouteTemplates       map[int64]*domain.RouteTemplate      `json:"routeTemplates"`
	Trips                map[int64]*domain.Trip               `json:"trips"`
	JoinRequests         map[int64]*domain.JoinRequest        `json:"joinRequests"`
	Orders               map[int64]*domain.RideOrder          `json:"orders"`
	OrderLogs            map[int64][]*domain.OrderStatusLog   `json:"orderLogs"`
	PaymentOrders        map[int64]*domain.PaymentOrder       `json:"paymentOrders"`
	PaymentOrdersByOrder map[int64]*domain.PaymentOrder       `json:"paymentOrdersByOrder"`
	PaymentOrdersByTrade map[string]*domain.PaymentOrder      `json:"paymentOrdersByTrade"`
	RefundOrders         map[int64]*domain.RefundOrder        `json:"refundOrders"`
	RefundOrdersByOrder  map[int64]*domain.RefundOrder        `json:"refundOrdersByOrder"`
	SettlementsByOrder   map[int64]*domain.SettlementRecord   `json:"settlementsByOrder"`
	WalletAccounts       map[int64]*domain.WalletAccount      `json:"walletAccounts"`
	WalletLedgers        map[int64][]*domain.WalletLedger     `json:"walletLedgers"`
	Withdraws            map[int64]*domain.WithdrawRecord     `json:"withdraws"`
	RuleSnapshots        map[int64]*domain.RuleSnapshot       `json:"ruleSnapshots"`
	PricingLogs          map[int64]*domain.PricingAuditLog    `json:"pricingLogs"`
	FrequencyLogs        map[int64]*domain.FrequencyLimitLog  `json:"frequencyLogs"`
	AuditTasks           map[int64]*domain.AuditTask          `json:"auditTasks"`
	OperationAuditLogs   map[int64]*domain.OperationAuditLog  `json:"operationAuditLogs"`
	CMSBanners           map[int64]*domain.CMSBanner          `json:"cmsBanners"`
	CMSArticles          map[string]*domain.CMSArticle        `json:"cmsArticles"`
}

func NewSQLiteStore(path string) (*SQLiteStore, error) {
	if path == "" {
		return nil, fmt.Errorf("sqlite path is required")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if _, err = db.Exec(`CREATE TABLE IF NOT EXISTS app_state (state_key TEXT PRIMARY KEY, state_json BLOB NOT NULL)`); err != nil {
		_ = db.Close()
		return nil, err
	}

	sqliteStore := &SQLiteStore{
		memory: NewMemoryStore(),
		db:     db,
	}
	if err = sqliteStore.load(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return sqliteStore, nil
}

func (s *SQLiteStore) Lock() {
	s.memory.Lock()
}

func (s *SQLiteStore) Unlock() {
	if err := s.saveLocked(); err != nil {
		log.Printf("sqlite store persist failed: %v", err)
	}
	s.memory.Unlock()
}

func (s *SQLiteStore) NextID(kind string) int64 {
	return s.memory.NextID(kind)
}

func (s *SQLiteStore) Snapshot() *MemoryStore {
	return s.memory
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) load() error {
	var raw []byte
	err := s.db.QueryRow(`SELECT state_json FROM app_state WHERE state_key = ?`, sqliteStateKey).Scan(&raw)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}

	var state persistedState
	if err = json.Unmarshal(raw, &state); err != nil {
		return err
	}
	applyPersistedState(s.memory, &state)
	return nil
}

func (s *SQLiteStore) saveLocked() error {
	state := buildPersistedState(s.memory)
	raw, err := json.Marshal(state)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`INSERT INTO app_state(state_key, state_json) VALUES(?, ?) ON CONFLICT(state_key) DO UPDATE SET state_json = excluded.state_json`, sqliteStateKey, raw)
	return err
}

func buildPersistedState(memory *MemoryStore) *persistedState {
	return &persistedState{
		IDs:                  memory.IDs,
		Users:                memory.Users,
		UsersByOpenID:        memory.UsersByOpenID,
		Sessions:             memory.Sessions,
		AdminUsers:           memory.AdminUsers,
		AdminSessions:        memory.AdminSessions,
		RealnameAuths:        memory.RealnameAuths,
		Contacts:             memory.Contacts,
		SafetyConfigs:        memory.SafetyConfigs,
		SafetySOSEvents:      memory.SafetySOSEvents,
		SafetyShareLinks:     memory.SafetyShareLinks,
		SafetyTracePoints:    memory.SafetyTracePoints,
		Licenses:             memory.Licenses,
		Vehicles:             memory.Vehicles,
		RouteTemplates:       memory.RouteTemplates,
		Trips:                memory.Trips,
		JoinRequests:         memory.JoinRequests,
		Orders:               memory.Orders,
		OrderLogs:            memory.OrderLogs,
		PaymentOrders:        memory.PaymentOrders,
		PaymentOrdersByOrder: memory.PaymentOrdersByOrder,
		PaymentOrdersByTrade: memory.PaymentOrdersByTrade,
		RefundOrders:         memory.RefundOrders,
		RefundOrdersByOrder:  memory.RefundOrdersByOrder,
		SettlementsByOrder:   memory.SettlementsByOrder,
		WalletAccounts:       memory.WalletAccounts,
		WalletLedgers:        memory.WalletLedgers,
		Withdraws:            memory.Withdraws,
		RuleSnapshots:        memory.RuleSnapshots,
		PricingLogs:          memory.PricingLogs,
		FrequencyLogs:        memory.FrequencyLogs,
		AuditTasks:           memory.AuditTasks,
		OperationAuditLogs:   memory.OperationAuditLogs,
		CMSBanners:           memory.CMSBanners,
		CMSArticles:          memory.CMSArticles,
	}
}

func applyPersistedState(memory *MemoryStore, state *persistedState) {
	if state == nil {
		return
	}
	memory.IDs = state.IDs
	memory.Users = state.Users
	memory.UsersByOpenID = state.UsersByOpenID
	memory.Sessions = state.Sessions
	memory.AdminUsers = state.AdminUsers
	memory.AdminSessions = state.AdminSessions
	memory.RealnameAuths = state.RealnameAuths
	memory.Contacts = state.Contacts
	memory.SafetyConfigs = state.SafetyConfigs
	memory.SafetySOSEvents = state.SafetySOSEvents
	memory.SafetyShareLinks = state.SafetyShareLinks
	memory.SafetyTracePoints = state.SafetyTracePoints
	memory.Licenses = state.Licenses
	memory.Vehicles = state.Vehicles
	memory.RouteTemplates = state.RouteTemplates
	memory.Trips = state.Trips
	memory.JoinRequests = state.JoinRequests
	memory.Orders = state.Orders
	memory.OrderLogs = state.OrderLogs
	memory.PaymentOrders = state.PaymentOrders
	memory.PaymentOrdersByOrder = state.PaymentOrdersByOrder
	memory.PaymentOrdersByTrade = state.PaymentOrdersByTrade
	memory.RefundOrders = state.RefundOrders
	memory.RefundOrdersByOrder = state.RefundOrdersByOrder
	memory.SettlementsByOrder = state.SettlementsByOrder
	memory.WalletAccounts = state.WalletAccounts
	memory.WalletLedgers = state.WalletLedgers
	memory.Withdraws = state.Withdraws
	memory.RuleSnapshots = state.RuleSnapshots
	memory.PricingLogs = state.PricingLogs
	memory.FrequencyLogs = state.FrequencyLogs
	memory.AuditTasks = state.AuditTasks
	memory.OperationAuditLogs = state.OperationAuditLogs
	memory.CMSBanners = state.CMSBanners
	memory.CMSArticles = state.CMSArticles
	ensurePersistedMaps(memory)
}

func ensurePersistedMaps(memory *MemoryStore) {
	if memory.OperationAuditLogs == nil {
		memory.OperationAuditLogs = map[int64]*domain.OperationAuditLog{}
	}
}
