package migration

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSplitStatementsIgnoresCommentsAndBlankLines(t *testing.T) {
	input := `
-- comment
CREATE TABLE a (id bigint);

CREATE TABLE b (id bigint);
`
	statements := SplitStatements(input)
	if len(statements) != 2 {
		t.Fatalf("expected 2 statements, got %d", len(statements))
	}
	if !strings.HasPrefix(statements[0], "CREATE TABLE a") {
		t.Fatalf("unexpected first statement: %s", statements[0])
	}
}

func TestFilesForDirectionOrdering(t *testing.T) {
	dir := t.TempDir()
	for _, name := range []string{
		"000002_second.up.sql",
		"000001_first.up.sql",
		"000001_first.down.sql",
		"000002_second.down.sql",
		"README.md",
	} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte("SELECT 1;"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	upFiles, err := filesForDirection(dir, DirectionUp)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(upFiles[0]) != "000001_first.up.sql" || filepath.Base(upFiles[1]) != "000002_second.up.sql" {
		t.Fatalf("unexpected up order: %#v", upFiles)
	}

	downFiles, err := filesForDirection(dir, DirectionDown)
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(downFiles[0]) != "000002_second.down.sql" || filepath.Base(downFiles[1]) != "000001_first.down.sql" {
		t.Fatalf("unexpected down order: %#v", downFiles)
	}
}
