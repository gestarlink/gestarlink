-- GestarLink CRM, Cloudflare D1. Never store raw IP addresses.
CREATE TABLE IF NOT EXISTS visitors (
 id TEXT PRIMARY KEY, first_seen TEXT NOT NULL DEFAULT (datetime('now')),
 last_seen TEXT NOT NULL DEFAULT (datetime('now')), source TEXT NOT NULL DEFAULT 'direct',
 campaign TEXT NOT NULL DEFAULT '', landing TEXT NOT NULL DEFAULT '/', country TEXT NOT NULL DEFAULT '',
 consent INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
 id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, type TEXT NOT NULL,
 path TEXT NOT NULL DEFAULT '/', value TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type,created_at);
CREATE TABLE IF NOT EXISTS threads (
 id TEXT PRIMARY KEY, visitor_id TEXT NOT NULL, intent TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'new', source TEXT NOT NULL DEFAULT 'direct',
 page TEXT NOT NULL DEFAULT '/', lang TEXT NOT NULL DEFAULT 'pt',
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_threads_created ON threads(created_at);
CREATE TABLE IF NOT EXISTS messages (
 id TEXT PRIMARY KEY, thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('user','assistant')),
 body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id,created_at);
CREATE TABLE IF NOT EXISTS leads (
 id TEXT PRIMARY KEY, thread_id TEXT UNIQUE NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
 name TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
 company TEXT NOT NULL DEFAULT '', service TEXT NOT NULL DEFAULT '',
 summary TEXT NOT NULL DEFAULT '', stage TEXT NOT NULL DEFAULT 'new',
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage,created_at);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS auth_attempts (fingerprint TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, since INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS api_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0);
