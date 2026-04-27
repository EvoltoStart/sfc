package migration

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type Direction string

const (
	DirectionUp   Direction = "up"
	DirectionDown Direction = "down"
)

type AppliedFile struct {
	Name           string
	StatementCount int
}

func RunDir(ctx context.Context, db *sql.DB, dir string, direction Direction) ([]AppliedFile, error) {
	if db == nil {
		return nil, fmt.Errorf("db is required")
	}
	files, err := filesForDirection(dir, direction)
	if err != nil {
		return nil, err
	}

	applied := make([]AppliedFile, 0, len(files))
	for _, path := range files {
		raw, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		statements := SplitStatements(string(raw))
		for _, statement := range statements {
			if _, err = db.ExecContext(ctx, statement); err != nil {
				return applied, fmt.Errorf("%s: %w", filepath.Base(path), err)
			}
		}
		applied = append(applied, AppliedFile{
			Name:           filepath.Base(path),
			StatementCount: len(statements),
		})
	}
	return applied, nil
}

func filesForDirection(dir string, direction Direction) ([]string, error) {
	if direction != DirectionUp && direction != DirectionDown {
		return nil, fmt.Errorf("unsupported migration direction %q", direction)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	suffix := "." + string(direction) + ".sql"
	var files []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), suffix) {
			continue
		}
		files = append(files, filepath.Join(dir, entry.Name()))
	}
	sort.Strings(files)
	if direction == DirectionDown {
		for i, j := 0, len(files)-1; i < j; i, j = i+1, j-1 {
			files[i], files[j] = files[j], files[i]
		}
	}
	return files, nil
}

func SplitStatements(sqlText string) []string {
	lines := strings.Split(sqlText, "\n")
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "--") {
			continue
		}
		cleaned = append(cleaned, line)
	}

	parts := strings.Split(strings.Join(cleaned, "\n"), ";")
	statements := make([]string, 0, len(parts))
	for _, part := range parts {
		statement := strings.TrimSpace(part)
		if statement == "" {
			continue
		}
		statements = append(statements, statement)
	}
	return statements
}
