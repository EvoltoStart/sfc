package store

import (
	"testing"
	"time"

	"sfc/server/internal/domain"
)

func TestSQLiteStorePersistsSnapshot(t *testing.T) {
	dbPath := t.TempDir() + "\\sfc-test.db"
	firstStore, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("create sqlite store failed: %v", err)
	}

	firstStore.Lock()
	userID := firstStore.NextID("user")
	firstStore.Snapshot().Users[userID] = &domain.User{
		ID:             userID,
		OpenID:         "sqlite-user",
		Nickname:       "sqlite-user",
		RealnameStatus: domain.RealnameStatusUnsubmitted,
		UserStatus:     domain.UserStatusActive,
		LastLoginAt:    time.Now().UTC(),
		CreatedAt:      time.Now().UTC(),
	}
	firstStore.Snapshot().IDs["custom"] = 42
	firstStore.Unlock()
	if err = firstStore.Close(); err != nil {
		t.Fatalf("close first sqlite store failed: %v", err)
	}

	secondStore, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("reopen sqlite store failed: %v", err)
	}
	defer func() { _ = secondStore.Close() }()

	secondStore.Lock()
	defer secondStore.Unlock()
	if secondStore.Snapshot().Users[userID] == nil {
		t.Fatal("expect persisted user after reopen")
	}
	if secondStore.Snapshot().IDs["custom"] != 42 {
		t.Fatalf("expect persisted ids, got %d", secondStore.Snapshot().IDs["custom"])
	}
}
