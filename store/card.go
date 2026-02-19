package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

type Card struct {
	ID          int32
	UID         string
	CreatorID   int32
	CreatedTs   int64
	UpdatedTs   int64
	Title       string
	Description string
	Status      string
	Type        string
	AssigneeID  *int32
	Priority    string
	Size        string
	DueTs       *int64
	Payload     *storepb.CardPayload
}

type FindCard struct {
	ID         *int32
	UID        *string
	CreatorID  *int32
	AssigneeID *int32

	Limit  *int
	Offset *int
}

type UpdateCard struct {
	ID          int32
	Title       *string
	Description *string
	Status      *string
	Type        *string
	AssigneeID  *int32
	Priority    *string
	Size        *string
	DueTs       *int64
	Payload     *storepb.CardPayload
	UpdatedTs   *int64
}

type DeleteCard struct {
	ID int32
}

func (s *Store) CreateCard(ctx context.Context, create *Card) (*Card, error) {
	return s.driver.CreateCard(ctx, create)
}

func (s *Store) ListCards(ctx context.Context, find *FindCard) ([]*Card, error) {
	return s.driver.ListCards(ctx, find)
}

func (s *Store) GetCard(ctx context.Context, find *FindCard) (*Card, error) {
	cards, err := s.driver.ListCards(ctx, find)
	if err != nil {
		return nil, err
	}
	if len(cards) == 0 {
		return nil, nil
	}
	return cards[0], nil
}

func (s *Store) UpdateCard(ctx context.Context, update *UpdateCard) error {
	return s.driver.UpdateCard(ctx, update)
}

func (s *Store) DeleteCard(ctx context.Context, delete *DeleteCard) error {
	return s.driver.DeleteCard(ctx, delete)
}

type CardPlacement struct {
	CardID    int32
	BoardID   int32
	ColumnID  int32
	Order     int32
	CreatedTs int64
	UpdatedTs int64
}

type FindCardPlacement struct {
	CardID  *int32
	BoardID *int32
}

type DeleteCardPlacement struct {
	CardID  int32
	BoardID int32
}

func (s *Store) UpsertCardPlacement(ctx context.Context, create *CardPlacement) (*CardPlacement, error) {
	return s.driver.UpsertCardPlacement(ctx, create)
}

func (s *Store) ListCardPlacements(ctx context.Context, find *FindCardPlacement) ([]*CardPlacement, error) {
	return s.driver.ListCardPlacements(ctx, find)
}

func (s *Store) DeleteCardPlacement(ctx context.Context, delete *DeleteCardPlacement) error {
	return s.driver.DeleteCardPlacement(ctx, delete)
}

type CardRelation struct {
	CardID        int32
	RelatedCardID int32
	Type          string
}

type FindCardRelation struct {
	CardID *int32
}

type DeleteCardRelation struct {
	CardID        int32
	RelatedCardID int32
	Type          string
}

func (s *Store) UpsertCardRelation(ctx context.Context, create *CardRelation) (*CardRelation, error) {
	return s.driver.UpsertCardRelation(ctx, create)
}

func (s *Store) ListCardRelations(ctx context.Context, find *FindCardRelation) ([]*CardRelation, error) {
	return s.driver.ListCardRelations(ctx, find)
}

func (s *Store) DeleteCardRelation(ctx context.Context, delete *DeleteCardRelation) error {
	return s.driver.DeleteCardRelation(ctx, delete)
}

type CardMemoLink struct {
	CardID int32
	MemoID int32
}

type FindCardMemoLink struct {
	CardID *int32
}

type DeleteCardMemoLink struct {
	CardID int32
}

func (s *Store) UpsertCardMemoLink(ctx context.Context, create *CardMemoLink) (*CardMemoLink, error) {
	return s.driver.UpsertCardMemoLink(ctx, create)
}

func (s *Store) GetCardMemoLink(ctx context.Context, find *FindCardMemoLink) (*CardMemoLink, error) {
	return s.driver.GetCardMemoLink(ctx, find)
}

func (s *Store) DeleteCardMemoLink(ctx context.Context, delete *DeleteCardMemoLink) error {
	return s.driver.DeleteCardMemoLink(ctx, delete)
}

type CardSubtask struct {
	ID        int32
	CardID    int32
	CreatedTs int64
	UpdatedTs int64
	Title     string
	Done      bool
	Order     int32
}

type FindCardSubtask struct {
	ID     *int32
	CardID *int32
}

type UpdateCardSubtask struct {
	ID        int32
	Title     *string
	Done      *bool
	Order     *int32
	UpdatedTs *int64
}

type DeleteCardSubtask struct {
	ID int32
}

func (s *Store) CreateCardSubtask(ctx context.Context, create *CardSubtask) (*CardSubtask, error) {
	return s.driver.CreateCardSubtask(ctx, create)
}

func (s *Store) ListCardSubtasks(ctx context.Context, find *FindCardSubtask) ([]*CardSubtask, error) {
	return s.driver.ListCardSubtasks(ctx, find)
}

func (s *Store) UpdateCardSubtask(ctx context.Context, update *UpdateCardSubtask) error {
	return s.driver.UpdateCardSubtask(ctx, update)
}

func (s *Store) DeleteCardSubtask(ctx context.Context, delete *DeleteCardSubtask) error {
	return s.driver.DeleteCardSubtask(ctx, delete)
}

type CardComment struct {
	ID        int32
	CardID    int32
	CreatorID int32
	CreatedTs int64
	Content   string
}

type FindCardComment struct {
	CardID *int32
}

func (s *Store) CreateCardComment(ctx context.Context, create *CardComment) (*CardComment, error) {
	return s.driver.CreateCardComment(ctx, create)
}

func (s *Store) ListCardComments(ctx context.Context, find *FindCardComment) ([]*CardComment, error) {
	return s.driver.ListCardComments(ctx, find)
}

type CardTimeEntry struct {
	ID        int32
	CardID    int32
	CreatorID int32
	CreatedTs int64
	StartTs   int64
	EndTs     int64
}

type FindCardTimeEntry struct {
	CardID *int32
}

type DeleteCardTimeEntry struct {
	ID int32
}

func (s *Store) CreateCardTimeEntry(ctx context.Context, create *CardTimeEntry) (*CardTimeEntry, error) {
	return s.driver.CreateCardTimeEntry(ctx, create)
}

func (s *Store) ListCardTimeEntries(ctx context.Context, find *FindCardTimeEntry) ([]*CardTimeEntry, error) {
	return s.driver.ListCardTimeEntries(ctx, find)
}

func (s *Store) DeleteCardTimeEntry(ctx context.Context, delete *DeleteCardTimeEntry) error {
	return s.driver.DeleteCardTimeEntry(ctx, delete)
}
