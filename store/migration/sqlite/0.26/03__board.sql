-- board
CREATE TABLE board (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

-- board_column
CREATE TABLE board_column (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  board_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  title TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL DEFAULT 0,
  UNIQUE(board_id, "order")
);

-- card
CREATE TABLE card (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  assignee_id INTEGER,
  priority TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  due_ts BIGINT,
  payload TEXT NOT NULL DEFAULT '{}'
);

-- card_placement
CREATE TABLE card_placement (
  card_id INTEGER NOT NULL,
  board_id INTEGER NOT NULL,
  column_id INTEGER NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(card_id, board_id)
);

-- card_relation
CREATE TABLE card_relation (
  card_id INTEGER NOT NULL,
  related_card_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  UNIQUE(card_id, related_card_id, type)
);

-- card_memo_link
CREATE TABLE card_memo_link (
  card_id INTEGER NOT NULL UNIQUE,
  memo_id INTEGER NOT NULL
);

-- card_subtask
CREATE TABLE card_subtask (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  updated_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  title TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL CHECK (done IN (0, 1)) DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0
);

-- card_comment
CREATE TABLE card_comment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  content TEXT NOT NULL DEFAULT ''
);

-- card_time_entry
CREATE TABLE card_time_entry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT (strftime('%s', 'now')),
  start_ts BIGINT NOT NULL,
  end_ts BIGINT NOT NULL
);

-- attachment
ALTER TABLE attachment ADD COLUMN card_id INTEGER;
