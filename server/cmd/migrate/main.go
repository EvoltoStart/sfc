package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"sfc/server/internal/migration"
)

func main() {
	dsn := flag.String("dsn", os.Getenv("SFC_MYSQL_DSN"), "MySQL DSN，默认读取 SFC_MYSQL_DSN")
	dir := flag.String("dir", "migrations", "迁移文件目录")
	direction := flag.String("direction", string(migration.DirectionUp), "迁移方向：up 或 down")
	timeout := flag.Duration("timeout", 30*time.Second, "迁移超时时间")
	flag.Parse()

	if *dsn == "" {
		log.Fatal("dsn is required: pass -dsn or set SFC_MYSQL_DSN")
	}

	db, err := sql.Open("mysql", *dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	if err = db.PingContext(ctx); err != nil {
		log.Fatal(err)
	}

	applied, err := migration.RunDir(ctx, db, *dir, migration.Direction(*direction))
	if err != nil {
		log.Fatal(err)
	}
	for _, file := range applied {
		fmt.Printf("%s %s statements=%d\n", *direction, file.Name, file.StatementCount)
	}
}
