-- board
CREATE TABLE `board` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL UNIQUE,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `title` VARCHAR(256) NOT NULL DEFAULT '',
  `description` TEXT NOT NULL
);

-- board_column
CREATE TABLE `board_column` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL UNIQUE,
  `board_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `title` VARCHAR(256) NOT NULL DEFAULT '',
  `order` INT NOT NULL DEFAULT 0,
  UNIQUE(`board_id`,`order`)
);

-- card
CREATE TABLE `card` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `uid` VARCHAR(256) NOT NULL UNIQUE,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `title` VARCHAR(256) NOT NULL DEFAULT '',
  `description` TEXT NOT NULL,
  `status` VARCHAR(256) NOT NULL DEFAULT '',
  `type` VARCHAR(256) NOT NULL DEFAULT '',
  `assignee_id` INT DEFAULT NULL,
  `priority` VARCHAR(256) NOT NULL DEFAULT '',
  `size` VARCHAR(256) NOT NULL DEFAULT '',
  `due_ts` BIGINT DEFAULT NULL,
  `payload` JSON NOT NULL
);

-- card_placement
CREATE TABLE `card_placement` (
  `card_id` INT NOT NULL,
  `board_id` INT NOT NULL,
  `column_id` INT NOT NULL,
  `order` INT NOT NULL DEFAULT 0,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(`card_id`,`board_id`)
);

-- card_relation
CREATE TABLE `card_relation` (
  `card_id` INT NOT NULL,
  `related_card_id` INT NOT NULL,
  `type` VARCHAR(256) NOT NULL,
  UNIQUE(`card_id`,`related_card_id`,`type`)
);

-- card_memo_link
CREATE TABLE `card_memo_link` (
  `card_id` INT NOT NULL UNIQUE,
  `memo_id` INT NOT NULL
);

-- card_subtask
CREATE TABLE `card_subtask` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `card_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `title` VARCHAR(256) NOT NULL DEFAULT '',
  `done` BOOLEAN NOT NULL DEFAULT FALSE,
  `order` INT NOT NULL DEFAULT 0
);

-- card_comment
CREATE TABLE `card_comment` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `card_id` INT NOT NULL,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `content` TEXT NOT NULL
);

-- card_time_entry
CREATE TABLE `card_time_entry` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `card_id` INT NOT NULL,
  `creator_id` INT NOT NULL,
  `created_ts` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `start_ts` BIGINT NOT NULL,
  `end_ts` BIGINT NOT NULL
);

-- attachment
ALTER TABLE `attachment` ADD COLUMN `card_id` INT DEFAULT NULL;
