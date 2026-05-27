package runner

import "context"

// Semaphore bounds the number of in-flight jobs. Acquire blocks the caller
// until a slot is free or ctx is cancelled. It never rejects; queueing is the
// whole point — the HTTP layer must not return 503 just because the pool is
// full.
type Semaphore struct {
	ch chan struct{}
}

// NewSemaphore returns a semaphore with n slots. n must be > 0; callers
// resolve "0 → NumCPU" before constructing.
func NewSemaphore(n int) *Semaphore {
	if n <= 0 {
		n = 1
	}
	return &Semaphore{ch: make(chan struct{}, n)}
}

// Acquire takes a slot, blocking until one is free or ctx is done.
func (s *Semaphore) Acquire(ctx context.Context) error {
	select {
	case s.ch <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Release returns a slot. Safe to call only after a successful Acquire.
func (s *Semaphore) Release() {
	<-s.ch
}

// Capacity returns the configured maximum number of concurrent slots.
func (s *Semaphore) Capacity() int {
	return cap(s.ch)
}

// InFlight returns the current number of held slots.
func (s *Semaphore) InFlight() int {
	return len(s.ch)
}
