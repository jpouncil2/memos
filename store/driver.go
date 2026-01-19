package store

import (
	"context"
	"database/sql"
)

// Driver is an interface for store driver.
// It contains all methods that store database driver should implement.
type Driver interface {
	GetDB() *sql.DB
	Close() error

	IsInitialized(ctx context.Context) (bool, error)

	// Activity model related methods.
	CreateActivity(ctx context.Context, create *Activity) (*Activity, error)
	ListActivities(ctx context.Context, find *FindActivity) ([]*Activity, error)

	// Attachment model related methods.
	CreateAttachment(ctx context.Context, create *Attachment) (*Attachment, error)
	ListAttachments(ctx context.Context, find *FindAttachment) ([]*Attachment, error)
	UpdateAttachment(ctx context.Context, update *UpdateAttachment) error
	DeleteAttachment(ctx context.Context, delete *DeleteAttachment) error

	// Memo model related methods.
	CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
	ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
	UpdateMemo(ctx context.Context, update *UpdateMemo) error
	DeleteMemo(ctx context.Context, delete *DeleteMemo) error

	// MemoRelation model related methods.
	UpsertMemoRelation(ctx context.Context, create *MemoRelation) (*MemoRelation, error)
	ListMemoRelations(ctx context.Context, find *FindMemoRelation) ([]*MemoRelation, error)
	DeleteMemoRelation(ctx context.Context, delete *DeleteMemoRelation) error

	// Board model related methods.
	CreateBoard(ctx context.Context, create *Board) (*Board, error)
	ListBoards(ctx context.Context, find *FindBoard) ([]*Board, error)
	UpdateBoard(ctx context.Context, update *UpdateBoard) error
	DeleteBoard(ctx context.Context, delete *DeleteBoard) error

	// BoardColumn model related methods.
	CreateBoardColumn(ctx context.Context, create *BoardColumn) (*BoardColumn, error)
	ListBoardColumns(ctx context.Context, find *FindBoardColumn) ([]*BoardColumn, error)
	UpdateBoardColumn(ctx context.Context, update *UpdateBoardColumn) error
	DeleteBoardColumn(ctx context.Context, delete *DeleteBoardColumn) error

	// Card model related methods.
	CreateCard(ctx context.Context, create *Card) (*Card, error)
	ListCards(ctx context.Context, find *FindCard) ([]*Card, error)
	UpdateCard(ctx context.Context, update *UpdateCard) error
	DeleteCard(ctx context.Context, delete *DeleteCard) error

	// CardPlacement model related methods.
	UpsertCardPlacement(ctx context.Context, create *CardPlacement) (*CardPlacement, error)
	ListCardPlacements(ctx context.Context, find *FindCardPlacement) ([]*CardPlacement, error)
	DeleteCardPlacement(ctx context.Context, delete *DeleteCardPlacement) error

	// CardRelation model related methods.
	UpsertCardRelation(ctx context.Context, create *CardRelation) (*CardRelation, error)
	ListCardRelations(ctx context.Context, find *FindCardRelation) ([]*CardRelation, error)
	DeleteCardRelation(ctx context.Context, delete *DeleteCardRelation) error

	// CardMemoLink model related methods.
	UpsertCardMemoLink(ctx context.Context, create *CardMemoLink) (*CardMemoLink, error)
	GetCardMemoLink(ctx context.Context, find *FindCardMemoLink) (*CardMemoLink, error)
	DeleteCardMemoLink(ctx context.Context, delete *DeleteCardMemoLink) error

	// CardSubtask model related methods.
	CreateCardSubtask(ctx context.Context, create *CardSubtask) (*CardSubtask, error)
	ListCardSubtasks(ctx context.Context, find *FindCardSubtask) ([]*CardSubtask, error)
	UpdateCardSubtask(ctx context.Context, update *UpdateCardSubtask) error
	DeleteCardSubtask(ctx context.Context, delete *DeleteCardSubtask) error

	// CardComment model related methods.
	CreateCardComment(ctx context.Context, create *CardComment) (*CardComment, error)
	ListCardComments(ctx context.Context, find *FindCardComment) ([]*CardComment, error)

	// CardTimeEntry model related methods.
	CreateCardTimeEntry(ctx context.Context, create *CardTimeEntry) (*CardTimeEntry, error)
	ListCardTimeEntries(ctx context.Context, find *FindCardTimeEntry) ([]*CardTimeEntry, error)
	DeleteCardTimeEntry(ctx context.Context, delete *DeleteCardTimeEntry) error

	// InstanceSetting model related methods.
	UpsertInstanceSetting(ctx context.Context, upsert *InstanceSetting) (*InstanceSetting, error)
	ListInstanceSettings(ctx context.Context, find *FindInstanceSetting) ([]*InstanceSetting, error)
	DeleteInstanceSetting(ctx context.Context, delete *DeleteInstanceSetting) error

	// User model related methods.
	CreateUser(ctx context.Context, create *User) (*User, error)
	UpdateUser(ctx context.Context, update *UpdateUser) (*User, error)
	ListUsers(ctx context.Context, find *FindUser) ([]*User, error)
	DeleteUser(ctx context.Context, delete *DeleteUser) error

	// UserSetting model related methods.
	UpsertUserSetting(ctx context.Context, upsert *UserSetting) (*UserSetting, error)
	ListUserSettings(ctx context.Context, find *FindUserSetting) ([]*UserSetting, error)
	GetUserByPATHash(ctx context.Context, tokenHash string) (*PATQueryResult, error)

	// IdentityProvider model related methods.
	CreateIdentityProvider(ctx context.Context, create *IdentityProvider) (*IdentityProvider, error)
	ListIdentityProviders(ctx context.Context, find *FindIdentityProvider) ([]*IdentityProvider, error)
	UpdateIdentityProvider(ctx context.Context, update *UpdateIdentityProvider) (*IdentityProvider, error)
	DeleteIdentityProvider(ctx context.Context, delete *DeleteIdentityProvider) error

	// Inbox model related methods.
	CreateInbox(ctx context.Context, create *Inbox) (*Inbox, error)
	ListInboxes(ctx context.Context, find *FindInbox) ([]*Inbox, error)
	UpdateInbox(ctx context.Context, update *UpdateInbox) (*Inbox, error)
	DeleteInbox(ctx context.Context, delete *DeleteInbox) error

	// Reaction model related methods.
	UpsertReaction(ctx context.Context, create *Reaction) (*Reaction, error)
	ListReactions(ctx context.Context, find *FindReaction) ([]*Reaction, error)
	GetReaction(ctx context.Context, find *FindReaction) (*Reaction, error)
	DeleteReaction(ctx context.Context, delete *DeleteReaction) error
}
