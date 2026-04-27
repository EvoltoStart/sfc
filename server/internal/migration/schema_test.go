package migration

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

func TestInitialSchemaMigrationShape(t *testing.T) {
	upPath := "../../migrations/000001_init_schema.up.sql"
	downPath := "../../migrations/000001_init_schema.down.sql"

	upRaw, err := os.ReadFile(upPath)
	if err != nil {
		t.Fatal(err)
	}
	downRaw, err := os.ReadFile(downPath)
	if err != nil {
		t.Fatal(err)
	}

	up := string(upRaw)
	down := string(downRaw)
	createCount := regexp.MustCompile(`CREATE TABLE IF NOT EXISTS`).FindAllStringIndex(up, -1)
	dropCount := regexp.MustCompile(`DROP TABLE IF EXISTS`).FindAllStringIndex(down, -1)
	if len(createCount) != 39 {
		t.Fatalf("expected 39 create table statements, got %d", len(createCount))
	}
	if len(dropCount) != len(createCount) {
		t.Fatalf("drop table count %d does not match create table count %d", len(dropCount), len(createCount))
	}
	if strings.Count(up, "ENGINE=InnoDB") != len(createCount) {
		t.Fatalf("every table must use InnoDB")
	}
	for _, required := range []string{
		"`user`",
		"`trip`",
		"`ride_order`",
		"`payment_order`",
		"`wallet_ledger`",
		"`operation_audit_log`",
		"`admin_permission`",
	} {
		if !strings.Contains(up, "CREATE TABLE IF NOT EXISTS "+required) {
			t.Fatalf("missing required table %s", required)
		}
	}
}
