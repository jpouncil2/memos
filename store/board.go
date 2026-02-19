package store

import "context"

type Board struct {
	ID          int32
	UID         string
	CreatorID   int32
	CreatedTs   int64
	UpdatedTs   int64
	Title       string
	Description string
}

type FindBoard struct {
	ID        *int32
	UID       *string
	CreatorID *int32

	Limit  *int
	Offset *int
}

type UpdateBoard struct {
	ID          int32
	Title       *string
	Description *string
	UpdatedTs   *int64
}

type DeleteBoard struct {
	ID int32
}

func (s *Store) CreateBoard(ctx context.Context, create *Board) (*Board, error) {
	return s.driver.CreateBoard(ctx, create)
}

func (s *Store) ListBoards(ctx context.Context, find *FindBoard) ([]*Board, error) {
	return s.driver.ListBoards(ctx, find)
}

func (s *Store) GetBoard(ctx context.Context, find *FindBoard) (*Board, error) {
	boards, err := s.driver.ListBoards(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(boards) == 0 {
		return nil, nil
	}
	return boards[0], nil
}

func (s *Store) UpdateBoard(ctx context.Context, update *UpdateBoard) error {
	return s.driver.UpdateBoard(ctx, update)
}

func (s *Store) DeleteBoard(ctx context.Context, delete *DeleteBoard) error {
	return s.driver.DeleteBoard(ctx, delete)
}

type BoardColumn struct {
	ID        int32
	UID       string
	BoardID   int32
	CreatedTs int64
	UpdatedTs int64
	Title     string
	Order     int32
}

type FindBoardColumn struct {
	ID      *int32
	UID     *string
	BoardID *int32

	Limit  *int
	Offset *int
}

type UpdateBoardColumn struct {
	ID        int32
	Title     *string
	Order     *int32
	UpdatedTs *int64
}

type DeleteBoardColumn struct {
	ID int32
}

func (s *Store) CreateBoardColumn(ctx context.Context, create *BoardColumn) (*BoardColumn, error) {
	return s.driver.CreateBoardColumn(ctx, create)
}

func (s *Store) ListBoardColumns(ctx context.Context, find *FindBoardColumn) ([]*BoardColumn, error) {
	return s.driver.ListBoardColumns(ctx, find)
}

func (s *Store) GetBoardColumn(ctx context.Context, find *FindBoardColumn) (*BoardColumn, error) {
	columns, err := s.driver.ListBoardColumns(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(columns) == 0 {
		return nil, nil
	}
	return columns[0], nil
}

func (s *Store) UpdateBoardColumn(ctx context.Context, update *UpdateBoardColumn) error {
	return s.driver.UpdateBoardColumn(ctx, update)
}

func (s *Store) DeleteBoardColumn(ctx context.Context, delete *DeleteBoardColumn) error {
	return s.driver.DeleteBoardColumn(ctx, delete)
}
