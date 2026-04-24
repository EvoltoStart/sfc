package store

type Store interface {
	Lock()
	Unlock()
	NextID(kind string) int64
	Snapshot() *MemoryStore
}
