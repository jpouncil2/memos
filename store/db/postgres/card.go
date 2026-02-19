package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/encoding/protojson"

	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateCard(ctx context.Context, create *store.Card) (*store.Card, error) {
	fields := []string{"uid", "creator_id", "title", "description", "status", "type", "assignee_id", "priority", "size", "due_ts", "payload"}
	args := []any{create.UID, create.CreatorID, create.Title, create.Description, create.Status, create.Type, create.AssigneeID, create.Priority, create.Size, create.DueTs}

	payload := "{}"
	if create.Payload != nil {
		payloadBytes, err := protojson.Marshal(create.Payload)
		if err != nil {
			return nil, errors.Wrap(err, "failed to marshal card payload")
		}
		payload = string(payloadBytes)
	}
	args = append(args, payload)

	stmt := "INSERT INTO card (" + strings.Join(fields, ", ") + ") VALUES (" + placeholders(len(args)-1) + ", " + placeholder(len(args)) + "::jsonb) RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, args...).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListCards(ctx context.Context, find *store.FindCard) ([]*store.Card, error) {
	where, args := []string{"1 = 1"}, []any{}

	if v := find.ID; v != nil {
		where, args = append(where, "card.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.UID; v != nil {
		where, args = append(where, "card.uid = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CreatorID; v != nil {
		where, args = append(where, "card.creator_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.AssigneeID; v != nil {
		where, args = append(where, "card.assignee_id = "+placeholder(len(args)+1)), append(args, *v)
	}

	query := "SELECT card.id, card.uid, card.creator_id, card.created_ts, card.updated_ts, card.title, card.description, card.status, card.type, card.assignee_id, card.priority, card.size, card.due_ts, card.payload FROM card WHERE " +
		strings.Join(where, " AND ") + " ORDER BY card.updated_ts DESC"
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

	list := make([]*store.Card, 0)
	for rows.Next() {
		card := store.Card{}
		var assigneeID sql.NullInt32
		var dueTs sql.NullInt64
		var payloadBytes []byte
		if err := rows.Scan(
			&card.ID,
			&card.UID,
			&card.CreatorID,
			&card.CreatedTs,
			&card.UpdatedTs,
			&card.Title,
			&card.Description,
			&card.Status,
			&card.Type,
			&assigneeID,
			&card.Priority,
			&card.Size,
			&dueTs,
			&payloadBytes,
		); err != nil {
			return nil, err
		}
		if assigneeID.Valid {
			card.AssigneeID = &assigneeID.Int32
		}
		if dueTs.Valid {
			card.DueTs = &dueTs.Int64
		}
		payload := &storepb.CardPayload{}
		if len(payloadBytes) > 0 {
			if err := protojsonUnmarshaler.Unmarshal(payloadBytes, payload); err != nil {
				return nil, err
			}
		}
		card.Payload = payload
		list = append(list, &card)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) UpdateCard(ctx context.Context, update *store.UpdateCard) error {
	set, args := []string{}, []any{}

	if v := update.Title; v != nil {
		set, args = append(set, "title = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Description; v != nil {
		set, args = append(set, "description = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Status; v != nil {
		set, args = append(set, "status = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Type; v != nil {
		set, args = append(set, "type = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.AssigneeID; v != nil {
		if *v == 0 {
			set = append(set, "assignee_id = NULL")
		} else {
			set, args = append(set, "assignee_id = "+placeholder(len(args)+1)), append(args, *v)
		}
	}
	if v := update.Priority; v != nil {
		set, args = append(set, "priority = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Size; v != nil {
		set, args = append(set, "size = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.DueTs; v != nil {
		if *v == 0 {
			set = append(set, "due_ts = NULL")
		} else {
			set, args = append(set, "due_ts = "+placeholder(len(args)+1)), append(args, *v)
		}
	}
	if v := update.Payload; v != nil {
		payloadBytes, err := protojson.Marshal(v)
		if err != nil {
			return errors.Wrap(err, "failed to marshal card payload")
		}
		set, args = append(set, "payload = "+placeholder(len(args)+1)+"::jsonb"), append(args, string(payloadBytes))
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}

	args = append(args, update.ID)
	stmt := "UPDATE card SET " + strings.Join(set, ", ") + " WHERE id = " + placeholder(len(args))
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return errors.Wrap(err, "failed to update card")
	}
	return nil
}

func (d *DB) DeleteCard(ctx context.Context, delete *store.DeleteCard) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM card WHERE id = "+placeholder(1), delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete card")
	}
	return nil
}

func (d *DB) UpsertCardPlacement(ctx context.Context, create *store.CardPlacement) (*store.CardPlacement, error) {
	stmt := `
		INSERT INTO card_placement (card_id, board_id, column_id, "order", created_ts, updated_ts)
		VALUES ($1, $2, $3, $4, EXTRACT(EPOCH FROM NOW()), EXTRACT(EPOCH FROM NOW()))
		ON CONFLICT (card_id, board_id)
		DO UPDATE SET column_id = EXCLUDED.column_id, "order" = EXCLUDED."order", updated_ts = EXTRACT(EPOCH FROM NOW())
		RETURNING created_ts, updated_ts
	`
	if err := d.db.QueryRowContext(ctx, stmt, create.CardID, create.BoardID, create.ColumnID, create.Order).Scan(&create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListCardPlacements(ctx context.Context, find *store.FindCardPlacement) ([]*store.CardPlacement, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.CardID; v != nil {
		where, args = append(where, "card_placement.card_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.BoardID; v != nil {
		where, args = append(where, "card_placement.board_id = "+placeholder(len(args)+1)), append(args, *v)
	}

	query := "SELECT card_id, board_id, column_id, \"order\", created_ts, updated_ts FROM card_placement WHERE " +
		strings.Join(where, " AND ") + " ORDER BY \"order\" ASC"
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.CardPlacement, 0)
	for rows.Next() {
		placement := store.CardPlacement{}
		if err := rows.Scan(
			&placement.CardID,
			&placement.BoardID,
			&placement.ColumnID,
			&placement.Order,
			&placement.CreatedTs,
			&placement.UpdatedTs,
		); err != nil {
			return nil, err
		}
		list = append(list, &placement)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) DeleteCardPlacement(ctx context.Context, delete *store.DeleteCardPlacement) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM card_placement WHERE card_id = "+placeholder(1)+" AND board_id = "+placeholder(2), delete.CardID, delete.BoardID); err != nil {
		return errors.Wrap(err, "failed to delete card placement")
	}
	return nil
}

func (d *DB) UpsertCardRelation(ctx context.Context, create *store.CardRelation) (*store.CardRelation, error) {
	stmt := "INSERT INTO card_relation (card_id, related_card_id, type) VALUES ($1, $2, $3) ON CONFLICT (card_id, related_card_id, type) DO NOTHING"
	if _, err := d.db.ExecContext(ctx, stmt, create.CardID, create.RelatedCardID, create.Type); err != nil {
		return nil, errors.Wrap(err, "failed to upsert card relation")
	}
	return create, nil
}

func (d *DB) ListCardRelations(ctx context.Context, find *store.FindCardRelation) ([]*store.CardRelation, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.CardID; v != nil {
		where, args = append(where, "card_relation.card_id = "+placeholder(len(args)+1)), append(args, *v)
	}
	query := "SELECT card_id, related_card_id, type FROM card_relation WHERE " + strings.Join(where, " AND ")
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.CardRelation, 0)
	for rows.Next() {
		relation := store.CardRelation{}
		if err := rows.Scan(&relation.CardID, &relation.RelatedCardID, &relation.Type); err != nil {
			return nil, err
		}
		list = append(list, &relation)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) DeleteCardRelation(ctx context.Context, delete *store.DeleteCardRelation) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM card_relation WHERE card_id = "+placeholder(1)+" AND related_card_id = "+placeholder(2)+" AND type = "+placeholder(3), delete.CardID, delete.RelatedCardID, delete.Type); err != nil {
		return errors.Wrap(err, "failed to delete card relation")
	}
	return nil
}

func (d *DB) UpsertCardMemoLink(ctx context.Context, create *store.CardMemoLink) (*store.CardMemoLink, error) {
	stmt := `
		INSERT INTO card_memo_link (card_id, memo_id)
		VALUES ($1, $2)
		ON CONFLICT (card_id)
		DO UPDATE SET memo_id = EXCLUDED.memo_id
	`
	if _, err := d.db.ExecContext(ctx, stmt, create.CardID, create.MemoID); err != nil {
		return nil, errors.Wrap(err, "failed to upsert card memo link")
	}
	return create, nil
}

func (d *DB) GetCardMemoLink(ctx context.Context, find *store.FindCardMemoLink) (*store.CardMemoLink, error) {
	if find.CardID == nil {
		return nil, nil
	}
	row := d.db.QueryRowContext(ctx, "SELECT card_id, memo_id FROM card_memo_link WHERE card_id = "+placeholder(1), *find.CardID)
	link := store.CardMemoLink{}
	if err := row.Scan(&link.CardID, &link.MemoID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &link, nil
}

func (d *DB) DeleteCardMemoLink(ctx context.Context, delete *store.DeleteCardMemoLink) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM card_memo_link WHERE card_id = "+placeholder(1), delete.CardID); err != nil {
		return errors.Wrap(err, "failed to delete card memo link")
	}
	return nil
}

func (d *DB) CreateCardSubtask(ctx context.Context, create *store.CardSubtask) (*store.CardSubtask, error) {
	stmt := "INSERT INTO card_subtask (card_id, title, done, \"order\") VALUES ($1, $2, $3, $4) RETURNING id, created_ts, updated_ts"
	if err := d.db.QueryRowContext(ctx, stmt, create.CardID, create.Title, create.Done, create.Order).Scan(&create.ID, &create.CreatedTs, &create.UpdatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListCardSubtasks(ctx context.Context, find *store.FindCardSubtask) ([]*store.CardSubtask, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.ID; v != nil {
		where, args = append(where, "card_subtask.id = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := find.CardID; v != nil {
		where, args = append(where, "card_subtask.card_id = "+placeholder(len(args)+1)), append(args, *v)
	}

	query := "SELECT id, card_id, created_ts, updated_ts, title, done, \"order\" FROM card_subtask WHERE " +
		strings.Join(where, " AND ") + " ORDER BY \"order\" ASC"
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.CardSubtask, 0)
	for rows.Next() {
		subtask := store.CardSubtask{}
		if err := rows.Scan(&subtask.ID, &subtask.CardID, &subtask.CreatedTs, &subtask.UpdatedTs, &subtask.Title, &subtask.Done, &subtask.Order); err != nil {
			return nil, err
		}
		list = append(list, &subtask)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) UpdateCardSubtask(ctx context.Context, update *store.UpdateCardSubtask) error {
	set, args := []string{}, []any{}
	if v := update.Title; v != nil {
		set, args = append(set, "title = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Done; v != nil {
		set, args = append(set, "done = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.Order; v != nil {
		set, args = append(set, "\"order\" = "+placeholder(len(args)+1)), append(args, *v)
	}
	if v := update.UpdatedTs; v != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *v)
	}
	args = append(args, update.ID)
	stmt := "UPDATE card_subtask SET " + strings.Join(set, ", ") + " WHERE id = " + placeholder(len(args))
	if _, err := d.db.ExecContext(ctx, stmt, args...); err != nil {
		return errors.Wrap(err, "failed to update card subtask")
	}
	return nil
}

func (d *DB) DeleteCardSubtask(ctx context.Context, delete *store.DeleteCardSubtask) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM card_subtask WHERE id = "+placeholder(1), delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete card subtask")
	}
	return nil
}

func (d *DB) CreateCardComment(ctx context.Context, create *store.CardComment) (*store.CardComment, error) {
	stmt := "INSERT INTO card_comment (card_id, creator_id, content) VALUES ($1, $2, $3) RETURNING id, created_ts"
	if err := d.db.QueryRowContext(ctx, stmt, create.CardID, create.CreatorID, create.Content).Scan(&create.ID, &create.CreatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListCardComments(ctx context.Context, find *store.FindCardComment) ([]*store.CardComment, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.CardID; v != nil {
		where, args = append(where, "card_comment.card_id = "+placeholder(len(args)+1)), append(args, *v)
	}

	query := "SELECT id, card_id, creator_id, created_ts, content FROM card_comment WHERE " +
		strings.Join(where, " AND ") + " ORDER BY created_ts DESC"
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.CardComment, 0)
	for rows.Next() {
		comment := store.CardComment{}
		if err := rows.Scan(&comment.ID, &comment.CardID, &comment.CreatorID, &comment.CreatedTs, &comment.Content); err != nil {
			return nil, err
		}
		list = append(list, &comment)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) CreateCardTimeEntry(ctx context.Context, create *store.CardTimeEntry) (*store.CardTimeEntry, error) {
	stmt := "INSERT INTO card_time_entry (card_id, creator_id, start_ts, end_ts) VALUES ($1, $2, $3, $4) RETURNING id, created_ts"
	if err := d.db.QueryRowContext(ctx, stmt, create.CardID, create.CreatorID, create.StartTs, create.EndTs).Scan(&create.ID, &create.CreatedTs); err != nil {
		return nil, err
	}
	return create, nil
}

func (d *DB) ListCardTimeEntries(ctx context.Context, find *store.FindCardTimeEntry) ([]*store.CardTimeEntry, error) {
	where, args := []string{"1 = 1"}, []any{}
	if v := find.CardID; v != nil {
		where, args = append(where, "card_time_entry.card_id = "+placeholder(len(args)+1)), append(args, *v)
	}

	query := "SELECT id, card_id, creator_id, created_ts, start_ts, end_ts FROM card_time_entry WHERE " +
		strings.Join(where, " AND ") + " ORDER BY created_ts DESC"
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]*store.CardTimeEntry, 0)
	for rows.Next() {
		entry := store.CardTimeEntry{}
		if err := rows.Scan(&entry.ID, &entry.CardID, &entry.CreatorID, &entry.CreatedTs, &entry.StartTs, &entry.EndTs); err != nil {
			return nil, err
		}
		list = append(list, &entry)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return list, nil
}

func (d *DB) DeleteCardTimeEntry(ctx context.Context, delete *store.DeleteCardTimeEntry) error {
	if _, err := d.db.ExecContext(ctx, "DELETE FROM card_time_entry WHERE id = "+placeholder(1), delete.ID); err != nil {
		return errors.Wrap(err, "failed to delete card time entry")
	}
	return nil
}
