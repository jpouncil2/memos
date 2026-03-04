package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"sync"
	"time"
)

type event struct {
	Time    time.Time       `json:"time"`
	Method  string          `json:"method"`
	Path    string          `json:"path"`
	Headers map[string]any  `json:"headers"`
	Body    json.RawMessage `json:"body"`
}

type store struct {
	mu     sync.Mutex
	events []event
	limit  int
}

func (s *store) add(e event) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.events = append([]event{e}, s.events...)
	if len(s.events) > s.limit {
		s.events = s.events[:s.limit]
	}
}

func (s *store) list() []event {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]event, len(s.events))
	copy(out, s.events)
	return out
}

func main() {
	addr := flag.String("addr", ":8787", "listen address")
	limit := flag.Int("limit", 100, "max in-memory events")
	flag.Parse()

	st := &store{limit: *limit}

	http.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		var body json.RawMessage
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"code":1,"message":"invalid json"}`, http.StatusBadRequest)
			return
		}

		headers := map[string]any{}
		for k, v := range r.Header {
			headers[k] = v
		}

		st.add(event{
			Time:    time.Now().UTC(),
			Method:  r.Method,
			Path:    r.URL.Path,
			Headers: headers,
			Body:    body,
		})

		log.Printf("webhook received: method=%s path=%s", r.Method, r.URL.Path)

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	http.HandleFunc("/events", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(st.list())
	})

	log.Printf("webhook test receiver listening on %s", *addr)
	log.Printf("POST target: http://127.0.0.1%s/webhook", *addr)
	log.Printf("Inspect events: http://127.0.0.1%s/events", *addr)
	if err := http.ListenAndServe(*addr, nil); err != nil {
		log.Fatal(err)
	}
}
