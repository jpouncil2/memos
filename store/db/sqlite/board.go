package sqlite

import (
	"context"
	"fmt"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (d *DB) CreateBoard(ctx context.Context, create *store.Board) (*store.Board, error) {
	fields := []string{"`uid`", "`creator_id`", "`title`", "`description`"}
	placeholder := []string{"?", "?", "?", "?"}
	args := []any{create.UID, create.CreatorID, create.Title, create.Description}

	stmt := "INSERT INTO `board` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `created_ts`, `updated_ts`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListBoards(ctx context.Context, find *store.FindBoard) ([]*store.Board, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`board`.`id` = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "`board`.`uid` = ?"), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "`board`.`creator_id` = ?"), append(args, *v)
	}

	query := "SELECT `board`.`id`, `board`.`uid`, `board`.`creator_id`, `board`.`created_ts`, `board`.`updated_ts`, `board`.`title`, `board`.`description` FROM `board` WHERE " +
		strings.Join(where, " AND ") + " ORDER BY `board`.`updated_ts` DESC"
	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.Board, 0)
	for rows.Next() {
		board := store.Board{}
		if err := rows.Scan(
			&board.ID,
			&board.UID,
			&board.CreatorID,
			&board.CreatedTs,
			&board.UpdatedTs,
			&board.Title,
			&board.Description,
		); err != nil {
			return nil, err
		}
		list = append(list, &board)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) UpdateBoard(ctx context.Context, update *store.UpdateBoard) error {
	set, args := []string{}, []any{}

	if v := update.Title; v != nil {
		set, args = append(set, "`title` = ?"), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "`description` = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = ?"), append(args, *v)
	}

	args = append(args, update.ID)
	stmt := "UPDATE `board` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return errors.Wrap(err, "failed to update board")
	}
	return nil
}

func (d *DB) DeleteBoard(ctx context.Context, delete *store.DeleteBoard) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM `board` WHERE `id` = ?", delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete board")
	}
	return nil
}

func (d *DB) CreateBoardColumn(ctx context.Context, create *store.BoardColumn) (*store.BoardColumn, error) {
	fields := []string{"`uid`", "`board_id`", "`title`", "`order`"}
	placeholder := []string{"?", "?", "?", "?"}
	args := []any{create.UID, create.BoardID, create.Title, create.Order}

	stmt := "INSERT INTO `board_column` (" + strings.Join(fields, ", ") + ") VALUES (" + strings.Join(placeholder, ", ") + ") RETURNING `id`, `created_ts`, `updated_ts`"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListBoardColumns(ctx context.Context, find *store.FindBoardColumn) ([]*store.BoardColumn, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "`board_column`.`id` = ?"), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "`board_column`.`uid` = ?"), append(args, *v)
	}
	if v := find.BoardID; v != nil {
		where, args = append(where, "`board_column`.`board_id` = ?"), append(args, *v)
	}

	query := "SELECT `board_column`.`id`, `board_column`.`uid`, `board_column`.`board_id`, `board_column`.`created_ts`, `board_column`.`updated_ts`, `board_column`.`title`, `board_column`.`order` FROM `board_column` WHERE " +
		strings.Join(where, " AND ") + " ORDER BY `board_column`.`order` ASC"
	if find.Limit != nil {
		query = fmt.Sprintf("%s LIMIT %d", query, *find.Limit)
		if find.Offset != nil {
			query = fmt.Sprintf("%s OFFSET %d", query, *find.Offset)
		}
	}

	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.BoardColumn, 0)
	for rows.Next() {
		column := store.BoardColumn{}
		if err := rows.Scan(
			&column.ID,
			&column.UID,
			&column.BoardID,
			&column.CreatedTs,
			&column.UpdatedTs,
			&column.Title,
			&column.Order,
		); err != nil {
			return nil, err
		}
		list = append(list, &column)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) UpdateBoardColumn(ctx context.Context, update *store.UpdateBoardColumn) error {
	set, args := []string{}, []any{}

	if v := update.Title; v != nil {
		set, args = append(set, "`title` = ?"), append(args, *v)
	}
	if v := update.Order; v != nil {
		set, args = append(set, "`order` = ?"), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "`updated_ts` = ?"), append(args, *v)
	}

	args = append(args, update.ID)
	stmt := "UPDATE `board_column` SET " + strings.Join(set, ", ") + " WHERE `id` = ?"
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return errors.Wrap(err, "failed to update board column")
	}
	return nil
}

func (d *DB) DeleteBoardColumn(ctx context.Context, delete *store.DeleteBoardColumn) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM `board_column` WHERE `id` = ?", delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete board column")
	}
	return nil
}
