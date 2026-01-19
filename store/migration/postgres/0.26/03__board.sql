-- board
CREATE TABLE board (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT ''
);

-- board_column
CREATE TABLE board_column (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  board_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  title TEXT NOT NULL DEFAULT '',
  "order" INTEGER NOT NULL DEFAULT 0,
  UNIQUE(board_id, "order")
);

-- card
CREATE TABLE card (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  assignee_id INTEGER,
  priority TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  due_ts BIGINT,
  payload JSONB NOT NULL DEFAULT '{}'
);

-- card_placement
CREATE TABLE card_placement (
  card_id INTEGER NOT NULL,
  board_id INTEGER NOT NULL,
  column_id INTEGER NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
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
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  updated_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  title TEXT NOT NULL DEFAULT '',
  done BOOLEAN NOT NULL DEFAULT FALSE,
  "order" INTEGER NOT NULL DEFAULT 0
);

-- card_comment
CREATE TABLE card_comment (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  content TEXT NOT NULL DEFAULT ''
);

-- card_time_entry
CREATE TABLE card_time_entry (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL,
  creator_id INTEGER NOT NULL,
  created_ts BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()),
  start_ts BIGINT NOT NULL,
  end_ts BIGINT NOT NULL
);

-- attachment
ALTER TABLE attachment ADD COLUMN card_id INTEGER DEFAULT NULL;
