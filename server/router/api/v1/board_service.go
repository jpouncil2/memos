package v1

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/lithammer/shortuuid/v4"
	"github.com/pkg/errors"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/internal/base"
	"github.com/usememos/memos/internal/util"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

const (
	cardRelationParent = "PARENT"
	cardRelationEpic   = "EPIC"
)

func (s *APIV1Service) ListBoards(ctx context.Context, request *v1pb.ListBoardsRequest) (*v1pb.ListBoardsResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	find := &store.FindBoard{CreatorID: &user.ID}

	limit := int(request.PageSize)
	offset := 0
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = int(pageToken.Limit)
		offset = int(pageToken.Offset)
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	limitPlusOne := limit + 1
	find.Limit = &limitPlusOne
	find.Offset = &offset

	boards, err := s.Store.ListBoards(ctx, find)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list boards: %v", err)
	}

	response := &v1pb.ListBoardsResponse{}
	if len(boards) == limitPlusOne {
		boards = boards[:limit]
		nextPageToken, err := getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to generate page token: %v", err)
		}
		response.NextPageToken = nextPageToken
	}

	for _, board := range boards {
		response.Boards = append(response.Boards, convertBoardFromStore(board))
	}
	response.TotalSize = int32(len(response.Boards))
	return response, nil
}

func (s *APIV1Service) CreateBoard(ctx context.Context, request *v1pb.CreateBoardRequest) (*v1pb.Board, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.Board == nil {
		return nil, status.Errorf(codes.InvalidArgument, "board is required")
	}

	boardUID := strings.TrimSpace(request.BoardId)
	if boardUID == "" {
		boardUID = shortuuid.New()
	} else if !base.UIDMatcher.MatchString(boardUID) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board_id format")
	}
	if strings.TrimSpace(request.Board.Title) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}

	create := &store.Board{
		UID:         boardUID,
		CreatorID:   user.ID,
		Title:       request.Board.Title,
		Description: request.Board.Description,
	}
	board, err := s.Store.CreateBoard(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create board: %v", err)
	}
	return convertBoardFromStore(board), nil
}

func (s *APIV1Service) GetBoard(ctx context.Context, request *v1pb.GetBoardRequest) (*v1pb.Board, error) {
	boardUID, err := ExtractBoardUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board: %v", err)
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || board.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	return convertBoardFromStore(board), nil
}

func (s *APIV1Service) UpdateBoard(ctx context.Context, request *v1pb.UpdateBoardRequest) (*v1pb.Board, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}
	boardUID, err := ExtractBoardUIDFromName(request.Board.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board: %v", err)
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || board.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateBoard{ID: board.ID}
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			update.Title = &request.Board.Title
		case "description":
			update.Description = &request.Board.Description
		case "update_time":
			updatedTs := time.Now().Unix()
			update.UpdatedTs = &updatedTs
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}
	if update.UpdatedTs == nil {
		updatedTs := time.Now().Unix()
		update.UpdatedTs = &updatedTs
	}
	if err := s.Store.UpdateBoard(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update board")
	}

	board, err = s.Store.GetBoard(ctx, &store.FindBoard{ID: &board.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board")
	}
	return convertBoardFromStore(board), nil
}

func (s *APIV1Service) DeleteBoard(ctx context.Context, request *v1pb.DeleteBoardRequest) (*emptypb.Empty, error) {
	boardUID, err := ExtractBoardUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board")
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || board.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	columns, err := s.Store.ListBoardColumns(ctx, &store.FindBoardColumn{BoardID: &board.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list board columns")
	}
	for _, column := range columns {
		if err := s.Store.DeleteBoardColumn(ctx, &store.DeleteBoardColumn{ID: column.ID}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to delete board column")
		}
	}

	placements, err := s.Store.ListCardPlacements(ctx, &store.FindCardPlacement{BoardID: &board.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card placements")
	}
	for _, placement := range placements {
		if err := s.Store.DeleteCardPlacement(ctx, &store.DeleteCardPlacement{CardID: placement.CardID, BoardID: placement.BoardID}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to delete card placement")
		}
		emptyStatus := ""
		updatedTs := time.Now().Unix()
		_ = s.Store.UpdateCard(ctx, &store.UpdateCard{ID: placement.CardID, Status: &emptyStatus, UpdatedTs: &updatedTs})
	}

	if err := s.Store.DeleteBoard(ctx, &store.DeleteBoard{ID: board.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete board")
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListBoardColumns(ctx context.Context, request *v1pb.ListBoardColumnsRequest) (*v1pb.ListBoardColumnsResponse, error) {
	boardUID, err := ExtractBoardUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board")
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || board.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	columns, err := s.Store.ListBoardColumns(ctx, &store.FindBoardColumn{BoardID: &board.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list board columns")
	}
	response := &v1pb.ListBoardColumnsResponse{}
	for _, column := range columns {
		response.Columns = append(response.Columns, convertBoardColumnFromStore(board.UID, column))
	}
	return response, nil
}

func (s *APIV1Service) CreateBoardColumn(ctx context.Context, request *v1pb.CreateBoardColumnRequest) (*v1pb.BoardColumn, error) {
	if request.Column == nil {
		return nil, status.Errorf(codes.InvalidArgument, "column is required")
	}
	boardUID, err := ExtractBoardUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board")
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || board.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	columnUID := strings.TrimSpace(request.ColumnId)
	if columnUID == "" {
		columnUID = shortuuid.New()
	} else if !base.UIDMatcher.MatchString(columnUID) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid column_id format")
	}

	if strings.TrimSpace(request.Column.Title) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}

	create := &store.BoardColumn{
		UID:     columnUID,
		BoardID: board.ID,
		Title:   request.Column.Title,
		Order:   request.Column.Order,
	}
	column, err := s.Store.CreateBoardColumn(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create board column")
	}
	return convertBoardColumnFromStore(board.UID, column), nil
}

func (s *APIV1Service) UpdateBoardColumn(ctx context.Context, request *v1pb.UpdateBoardColumnRequest) (*v1pb.BoardColumn, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}
	boardUID, columnUID, err := ExtractBoardColumnUIDFromName(request.Column.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid column name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board")
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	column, err := s.Store.GetBoardColumn(ctx, &store.FindBoardColumn{UID: &columnUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get column")
	}
	if column == nil {
		return nil, status.Errorf(codes.NotFound, "column not found")
	}
	if column.BoardID != board.ID {
		return nil, status.Errorf(codes.InvalidArgument, "column does not belong to board")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || board.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateBoardColumn{ID: column.ID}
	var titleUpdated bool
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			update.Title = &request.Column.Title
			titleUpdated = true
		case "order":
			update.Order = &request.Column.Order
		case "update_time":
			updatedTs := time.Now().Unix()
			update.UpdatedTs = &updatedTs
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}
	if update.UpdatedTs == nil {
		updatedTs := time.Now().Unix()
		update.UpdatedTs = &updatedTs
	}
	if err := s.Store.UpdateBoardColumn(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update board column")
	}

	if titleUpdated {
		placements, err := s.Store.ListCardPlacements(ctx, &store.FindCardPlacement{BoardID: &board.ID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list card placements")
		}
		for _, placement := range placements {
			if placement.ColumnID != column.ID {
				continue
			}
			updatedTs := time.Now().Unix()
			statusTitle := request.Column.Title
			_ = s.Store.UpdateCard(ctx, &store.UpdateCard{ID: placement.CardID, Status: &statusTitle, UpdatedTs: &updatedTs})
		}
	}

	column, err = s.Store.GetBoardColumn(ctx, &store.FindBoardColumn{ID: &column.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get column")
	}
	return convertBoardColumnFromStore(board.UID, column), nil
}

func (s *APIV1Service) DeleteBoardColumn(ctx context.Context, request *v1pb.DeleteBoardColumnRequest) (*emptypb.Empty, error) {
	boardUID, columnUID, err := ExtractBoardColumnUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid column name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get board")
	}
	if board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	column, err := s.Store.GetBoardColumn(ctx, &store.FindBoardColumn{UID: &columnUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get column")
	}
	if column == nil {
		return nil, status.Errorf(codes.NotFound, "column not found")
	}
	if column.BoardID != board.ID {
		return nil, status.Errorf(codes.InvalidArgument, "column does not belong to board")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || board.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	placements, err := s.Store.ListCardPlacements(ctx, &store.FindCardPlacement{BoardID: &board.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card placements")
	}
	for _, placement := range placements {
		if placement.ColumnID != column.ID {
			continue
		}
		if err := s.Store.DeleteCardPlacement(ctx, &store.DeleteCardPlacement{CardID: placement.CardID, BoardID: placement.BoardID}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to delete card placement")
		}
		emptyStatus := ""
		updatedTs := time.Now().Unix()
		_ = s.Store.UpdateCard(ctx, &store.UpdateCard{ID: placement.CardID, Status: &emptyStatus, UpdatedTs: &updatedTs})
	}

	if err := s.Store.DeleteBoardColumn(ctx, &store.DeleteBoardColumn{ID: column.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete board column")
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListCards(ctx context.Context, request *v1pb.ListCardsRequest) (*v1pb.ListCardsResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	find := &store.FindCard{CreatorID: &user.ID}

	limit := int(request.PageSize)
	offset := 0
	if request.PageToken != "" {
		var pageToken v1pb.PageToken
		if err := unmarshalPageToken(request.PageToken, &pageToken); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid page token: %v", err)
		}
		limit = int(pageToken.Limit)
		offset = int(pageToken.Offset)
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	limitPlusOne := limit + 1
	find.Limit = &limitPlusOne
	find.Offset = &offset

	cards, err := s.Store.ListCards(ctx, find)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list cards: %v", err)
	}

	response := &v1pb.ListCardsResponse{}
	if len(cards) == limitPlusOne {
		cards = cards[:limit]
		nextPageToken, err := getPageToken(limit, offset+limit)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to generate page token: %v", err)
		}
		response.NextPageToken = nextPageToken
	}
	for _, card := range cards {
		cardMessage, err := s.convertCardFromStore(ctx, card)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to convert card: %v", err)
		}
		response.Cards = append(response.Cards, cardMessage)
	}
	response.TotalSize = int32(len(response.Cards))
	return response, nil
}

func (s *APIV1Service) CreateCard(ctx context.Context, request *v1pb.CreateCardRequest) (*v1pb.Card, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if request.Card == nil {
		return nil, status.Errorf(codes.InvalidArgument, "card is required")
	}

	cardUID := strings.TrimSpace(request.CardId)
	if cardUID == "" {
		cardUID = shortuuid.New()
	} else if !base.UIDMatcher.MatchString(cardUID) {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card_id format")
	}
	if strings.TrimSpace(request.Card.Title) == "" {
		return nil, status.Errorf(codes.InvalidArgument, "title is required")
	}

	var assigneeID *int32
	if request.Card.Assignee != "" {
		userID, err := ExtractUserIDFromName(request.Card.Assignee)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid assignee name: %v", err)
		}
		assigneeID = &userID
	}

	var dueTs *int64
	if request.Card.DueTime != nil {
		ts := request.Card.DueTime.AsTime().Unix()
		dueTs = &ts
	}

	payload := &storepb.CardPayload{
		Tags: request.Card.Tags,
	}

	create := &store.Card{
		UID:         cardUID,
		CreatorID:   user.ID,
		Title:       request.Card.Title,
		Description: request.Card.Description,
		Status:      request.Card.Status,
		Type:        request.Card.Type,
		AssigneeID:  assigneeID,
		Priority:    request.Card.Priority,
		Size:        request.Card.Size,
		DueTs:       dueTs,
		Payload:     payload,
	}
	card, err := s.Store.CreateCard(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create card: %v", err)
	}

	if request.Card.Memo != "" {
		memoUID, err := ExtractMemoUIDFromName(request.Card.Memo)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
		}
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get memo")
		}
		if memo == nil || memo.CreatorID != user.ID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		if _, err := s.Store.UpsertCardMemoLink(ctx, &store.CardMemoLink{CardID: card.ID, MemoID: memo.ID}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to link memo")
		}
	}

	if request.Card.Parent != "" {
		parentUID, err := ExtractCardUIDFromName(request.Card.Parent)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid parent card name: %v", err)
		}
		parent, err := s.Store.GetCard(ctx, &store.FindCard{UID: &parentUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get parent card")
		}
		if parent == nil || parent.CreatorID != user.ID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		if _, err := s.Store.UpsertCardRelation(ctx, &store.CardRelation{CardID: card.ID, RelatedCardID: parent.ID, Type: cardRelationParent}); err != nil {
			return nil, status.Errorf(codes.Internal, "failed to set parent relation")
		}
	}

	return s.convertCardFromStore(ctx, card)
}

func (s *APIV1Service) GetCard(ctx context.Context, request *v1pb.GetCardRequest) (*v1pb.Card, error) {
	cardUID, err := ExtractCardUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get card")
	}
	if card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	return s.convertCardFromStore(ctx, card)
}

func (s *APIV1Service) UpdateCard(ctx context.Context, request *v1pb.UpdateCardRequest) (*v1pb.Card, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}
	cardUID, err := ExtractCardUIDFromName(request.Card.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get card")
	}
	if card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateCard{ID: card.ID}
	updatedTs := time.Now().Unix()
	update.UpdatedTs = &updatedTs

	var updateMemoLink *string
	var updateParent *string
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			update.Title = &request.Card.Title
		case "description":
			update.Description = &request.Card.Description
		case "status":
			update.Status = &request.Card.Status
		case "type":
			update.Type = &request.Card.Type
		case "assignee":
			if request.Card.Assignee == "" {
				clearID := int32(0)
				update.AssigneeID = &clearID
			} else {
				assigneeID, err := ExtractUserIDFromName(request.Card.Assignee)
				if err != nil {
					return nil, status.Errorf(codes.InvalidArgument, "invalid assignee name: %v", err)
				}
				update.AssigneeID = &assigneeID
			}
		case "priority":
			update.Priority = &request.Card.Priority
		case "size":
			update.Size = &request.Card.Size
		case "due_time":
			if request.Card.DueTime == nil {
				clearTs := int64(0)
				update.DueTs = &clearTs
			} else {
				dueTs := request.Card.DueTime.AsTime().Unix()
				update.DueTs = &dueTs
			}
		case "tags":
			payload := card.Payload
			if payload == nil {
				payload = &storepb.CardPayload{}
			}
			payload.Tags = request.Card.Tags
			update.Payload = payload
		case "memo":
			updateMemoLink = &request.Card.Memo
		case "parent":
			updateParent = &request.Card.Parent
		default:
			return nil, status.Errorf(codes.InvalidArgument, "invalid update path: %s", path)
		}
	}

	if err := s.Store.UpdateCard(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update card")
	}

	if updateMemoLink != nil {
		if *updateMemoLink == "" {
			_ = s.Store.DeleteCardMemoLink(ctx, &store.DeleteCardMemoLink{CardID: card.ID})
		} else {
			memoUID, err := ExtractMemoUIDFromName(*updateMemoLink)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %v", err)
			}
			memo, err := s.Store.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get memo")
			}
			if memo == nil || memo.CreatorID != user.ID {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
			if _, err := s.Store.UpsertCardMemoLink(ctx, &store.CardMemoLink{CardID: card.ID, MemoID: memo.ID}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update memo link")
			}
		}
	}

	if updateParent != nil {
		relations, err := s.Store.ListCardRelations(ctx, &store.FindCardRelation{CardID: &card.ID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list card relations")
		}
		for _, relation := range relations {
			if relation.Type != cardRelationParent {
				continue
			}
			_ = s.Store.DeleteCardRelation(ctx, &store.DeleteCardRelation{CardID: relation.CardID, RelatedCardID: relation.RelatedCardID, Type: relation.Type})
		}
		if *updateParent != "" {
			parentUID, err := ExtractCardUIDFromName(*updateParent)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid parent card name: %v", err)
			}
			parent, err := s.Store.GetCard(ctx, &store.FindCard{UID: &parentUID})
			if err != nil {
				return nil, status.Errorf(codes.Internal, "failed to get parent card")
			}
			if parent == nil || parent.CreatorID != user.ID {
				return nil, status.Errorf(codes.PermissionDenied, "permission denied")
			}
			if _, err := s.Store.UpsertCardRelation(ctx, &store.CardRelation{CardID: card.ID, RelatedCardID: parent.ID, Type: cardRelationParent}); err != nil {
				return nil, status.Errorf(codes.Internal, "failed to update parent relation")
			}
		}
	}

	card, err = s.Store.GetCard(ctx, &store.FindCard{ID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get card")
	}
	return s.convertCardFromStore(ctx, card)
}

func (s *APIV1Service) DeleteCard(ctx context.Context, request *v1pb.DeleteCardRequest) (*emptypb.Empty, error) {
	cardUID, err := ExtractCardUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get card")
	}
	if card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	placements, err := s.Store.ListCardPlacements(ctx, &store.FindCardPlacement{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card placements")
	}
	for _, placement := range placements {
		_ = s.Store.DeleteCardPlacement(ctx, &store.DeleteCardPlacement{CardID: placement.CardID, BoardID: placement.BoardID})
	}

	relations, err := s.Store.ListCardRelations(ctx, &store.FindCardRelation{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card relations")
	}
	for _, relation := range relations {
		_ = s.Store.DeleteCardRelation(ctx, &store.DeleteCardRelation{CardID: relation.CardID, RelatedCardID: relation.RelatedCardID, Type: relation.Type})
	}

	_ = s.Store.DeleteCardMemoLink(ctx, &store.DeleteCardMemoLink{CardID: card.ID})

	subtasks, err := s.Store.ListCardSubtasks(ctx, &store.FindCardSubtask{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card subtasks")
	}
	for _, subtask := range subtasks {
		_ = s.Store.DeleteCardSubtask(ctx, &store.DeleteCardSubtask{ID: subtask.ID})
	}

	timeEntries, err := s.Store.ListCardTimeEntries(ctx, &store.FindCardTimeEntry{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card time entries")
	}
	for _, entry := range timeEntries {
		_ = s.Store.DeleteCardTimeEntry(ctx, &store.DeleteCardTimeEntry{ID: entry.ID})
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card attachments")
	}
	for _, attachment := range attachments {
		_ = s.Store.DeleteAttachment(ctx, &store.DeleteAttachment{ID: attachment.ID})
	}

	if err := s.Store.DeleteCard(ctx, &store.DeleteCard{ID: card.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete card")
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListCardPlacements(ctx context.Context, request *v1pb.ListCardPlacementsRequest) (*v1pb.ListCardPlacementsResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	find := &store.FindCardPlacement{}
	var board *store.Board
	var card *store.Card

	if request.Board != "" {
		boardUID, err := ExtractBoardUIDFromName(request.Board)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
		}
		board, err = s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get board")
		}
		if board == nil || board.CreatorID != user.ID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		find.BoardID = &board.ID
	}
	if request.Card != "" {
		cardUID, err := ExtractCardUIDFromName(request.Card)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
		}
		card, err = s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get card")
		}
		if card == nil || card.CreatorID != user.ID {
			return nil, status.Errorf(codes.PermissionDenied, "permission denied")
		}
		find.CardID = &card.ID
	}

	placements, err := s.Store.ListCardPlacements(ctx, find)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card placements")
	}

	response := &v1pb.ListCardPlacementsResponse{}
	for _, placement := range placements {
		boardRecord := board
		if boardRecord == nil || boardRecord.ID != placement.BoardID {
			boardRecord, err = s.Store.GetBoard(ctx, &store.FindBoard{ID: &placement.BoardID})
			if err != nil || boardRecord == nil {
				continue
			}
		}
		column, err := s.Store.GetBoardColumn(ctx, &store.FindBoardColumn{ID: &placement.ColumnID})
		if err != nil || column == nil {
			continue
		}
		cardRecord := card
		if cardRecord == nil || cardRecord.ID != placement.CardID {
			cardRecord, err = s.Store.GetCard(ctx, &store.FindCard{ID: &placement.CardID})
			if err != nil || cardRecord == nil {
				continue
			}
		}
		if cardRecord.CreatorID != user.ID {
			continue
		}
		response.Placements = append(response.Placements, &v1pb.CardPlacement{
			Board:      constructBoardName(boardRecord.UID),
			Column:     constructBoardColumnName(boardRecord.UID, column.UID),
			Card:       constructCardName(cardRecord.UID),
			Order:      placement.Order,
			CreateTime: timestamppb.New(time.Unix(placement.CreatedTs, 0)),
			UpdateTime: timestamppb.New(time.Unix(placement.UpdatedTs, 0)),
		})
	}

	return response, nil
}

func (s *APIV1Service) UpsertCardPlacement(ctx context.Context, request *v1pb.UpsertCardPlacementRequest) (*v1pb.CardPlacement, error) {
	if request.Placement == nil {
		return nil, status.Errorf(codes.InvalidArgument, "placement is required")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	boardUID, err := ExtractBoardUIDFromName(request.Placement.Board)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid board name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil || board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	if board.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	columnBoardUID, columnUID, err := ExtractBoardColumnUIDFromName(request.Placement.Column)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid column name: %v", err)
	}
	if columnBoardUID != boardUID {
		return nil, status.Errorf(codes.InvalidArgument, "column does not belong to board")
	}
	column, err := s.Store.GetBoardColumn(ctx, &store.FindBoardColumn{UID: &columnUID})
	if err != nil || column == nil {
		return nil, status.Errorf(codes.NotFound, "column not found")
	}

	cardUID, err := ExtractCardUIDFromName(request.Placement.Card)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	if card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	placement := &store.CardPlacement{
		CardID:   card.ID,
		BoardID:  board.ID,
		ColumnID: column.ID,
		Order:    request.Placement.Order,
	}
	placement, err = s.Store.UpsertCardPlacement(ctx, placement)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert card placement")
	}

	statusTitle := column.Title
	updatedTs := time.Now().Unix()
	_ = s.Store.UpdateCard(ctx, &store.UpdateCard{ID: card.ID, Status: &statusTitle, UpdatedTs: &updatedTs})

	return &v1pb.CardPlacement{
		Board:      constructBoardName(board.UID),
		Column:     constructBoardColumnName(board.UID, column.UID),
		Card:       constructCardName(card.UID),
		Order:      placement.Order,
		CreateTime: timestamppb.New(time.Unix(placement.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(placement.UpdatedTs, 0)),
	}, nil
}

func (s *APIV1Service) DeleteCardPlacement(ctx context.Context, request *v1pb.DeleteCardPlacementRequest) (*emptypb.Empty, error) {
	boardUID, columnUID, cardUID, err := ExtractCardPlacementTokens(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid placement name: %v", err)
	}
	board, err := s.Store.GetBoard(ctx, &store.FindBoard{UID: &boardUID})
	if err != nil || board == nil {
		return nil, status.Errorf(codes.NotFound, "board not found")
	}
	column, err := s.Store.GetBoardColumn(ctx, &store.FindBoardColumn{UID: &columnUID})
	if err != nil || column == nil {
		return nil, status.Errorf(codes.NotFound, "column not found")
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || board.CreatorID != user.ID || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if column.BoardID != board.ID {
		return nil, status.Errorf(codes.InvalidArgument, "column does not belong to board")
	}

	if err := s.Store.DeleteCardPlacement(ctx, &store.DeleteCardPlacement{CardID: card.ID, BoardID: board.ID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete card placement")
	}
	emptyStatus := ""
	updatedTs := time.Now().Unix()
	_ = s.Store.UpdateCard(ctx, &store.UpdateCard{ID: card.ID, Status: &emptyStatus, UpdatedTs: &updatedTs})
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListCardRelations(ctx context.Context, request *v1pb.ListCardRelationsRequest) (*v1pb.ListCardRelationsResponse, error) {
	cardUID, err := ExtractCardUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get card")
	}
	if card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	relations, err := s.Store.ListCardRelations(ctx, &store.FindCardRelation{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card relations")
	}

	response := &v1pb.ListCardRelationsResponse{}
	for _, relation := range relations {
		related, err := s.Store.GetCard(ctx, &store.FindCard{ID: &relation.RelatedCardID})
		if err != nil || related == nil {
			continue
		}
		response.Relations = append(response.Relations, &v1pb.CardRelation{
			Name:        constructCardRelationName(cardUID, related.UID),
			Card:        constructCardName(cardUID),
			RelatedCard: constructCardName(related.UID),
			Type:        convertCardRelationTypeFromStore(relation.Type),
		})
	}
	return response, nil
}

func (s *APIV1Service) UpsertCardRelation(ctx context.Context, request *v1pb.UpsertCardRelationRequest) (*v1pb.CardRelation, error) {
	cardUID, err := ExtractCardUIDFromName(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get card")
	}
	if card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	relatedUID, err := ExtractCardUIDFromName(request.RelatedCard)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid related card name: %v", err)
	}
	related, err := s.Store.GetCard(ctx, &store.FindCard{UID: &relatedUID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get related card")
	}
	if related == nil || related.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	relationType, err := convertCardRelationTypeToStore(request.Type)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid relation type")
	}
	if relationType == cardRelationParent {
		existing, err := s.Store.ListCardRelations(ctx, &store.FindCardRelation{CardID: &card.ID})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to list card relations")
		}
		for _, relation := range existing {
			if relation.Type != cardRelationParent {
				continue
			}
			_ = s.Store.DeleteCardRelation(ctx, &store.DeleteCardRelation{CardID: relation.CardID, RelatedCardID: relation.RelatedCardID, Type: relation.Type})
		}
	}

	if _, err := s.Store.UpsertCardRelation(ctx, &store.CardRelation{
		CardID:        card.ID,
		RelatedCardID: related.ID,
		Type:          relationType,
	}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to upsert card relation")
	}
	return &v1pb.CardRelation{
		Name:        constructCardRelationName(cardUID, related.UID),
		Card:        constructCardName(cardUID),
		RelatedCard: constructCardName(related.UID),
		Type:        request.Type,
	}, nil
}

func (s *APIV1Service) DeleteCardRelation(ctx context.Context, request *v1pb.DeleteCardRelationRequest) (*emptypb.Empty, error) {
	cardUID, relatedUID, err := extractCardRelationTokens(request.Name)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid relation name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	related, err := s.Store.GetCard(ctx, &store.FindCard{UID: &relatedUID})
	if err != nil || related == nil {
		return nil, status.Errorf(codes.NotFound, "related card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	relations, err := s.Store.ListCardRelations(ctx, &store.FindCardRelation{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card relations")
	}
	for _, relation := range relations {
		if relation.RelatedCardID != related.ID {
			continue
		}
		_ = s.Store.DeleteCardRelation(ctx, &store.DeleteCardRelation{CardID: relation.CardID, RelatedCardID: relation.RelatedCardID, Type: relation.Type})
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListCardSubtasks(ctx context.Context, request *v1pb.ListCardSubtasksRequest) (*v1pb.ListCardSubtasksResponse, error) {
	cardUID, err := ExtractCardUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	subtasks, err := s.Store.ListCardSubtasks(ctx, &store.FindCardSubtask{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card subtasks")
	}
	response := &v1pb.ListCardSubtasksResponse{}
	for _, subtask := range subtasks {
		response.Subtasks = append(response.Subtasks, &v1pb.CardSubtask{
			Name:       constructCardSubtaskName(cardUID, subtask.ID),
			Card:       constructCardName(cardUID),
			CreateTime: timestamppb.New(time.Unix(subtask.CreatedTs, 0)),
			UpdateTime: timestamppb.New(time.Unix(subtask.UpdatedTs, 0)),
			Title:      subtask.Title,
			Done:       subtask.Done,
			Order:      subtask.Order,
		})
	}
	return response, nil
}

func (s *APIV1Service) CreateCardSubtask(ctx context.Context, request *v1pb.CreateCardSubtaskRequest) (*v1pb.CardSubtask, error) {
	if request.Subtask == nil {
		return nil, status.Errorf(codes.InvalidArgument, "subtask is required")
	}
	cardUID, err := ExtractCardUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	create := &store.CardSubtask{
		CardID: card.ID,
		Title:  request.Subtask.Title,
		Done:   request.Subtask.Done,
		Order:  request.Subtask.Order,
	}
	subtask, err := s.Store.CreateCardSubtask(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create card subtask")
	}
	return &v1pb.CardSubtask{
		Name:       constructCardSubtaskName(cardUID, subtask.ID),
		Card:       constructCardName(cardUID),
		CreateTime: timestamppb.New(time.Unix(subtask.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(subtask.UpdatedTs, 0)),
		Title:      subtask.Title,
		Done:       subtask.Done,
		Order:      subtask.Order,
	}, nil
}

func (s *APIV1Service) UpdateCardSubtask(ctx context.Context, request *v1pb.UpdateCardSubtaskRequest) (*v1pb.CardSubtask, error) {
	if request.UpdateMask == nil || len(request.UpdateMask.Paths) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "update mask is required")
	}
	cardUID, subtaskID, err := extractCardSubresourceID(request.Subtask.Name, "subtasks/")
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid subtask name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	update := &store.UpdateCardSubtask{ID: subtaskID}
	for _, path := range request.UpdateMask.Paths {
		switch path {
		case "title":
			update.Title = &request.Subtask.Title
		case "done":
			update.Done = &request.Subtask.Done
		case "order":
			update.Order = &request.Subtask.Order
		case "update_time":
			updatedTs := time.Now().Unix()
			update.UpdatedTs = &updatedTs
		}
	}
	if update.UpdatedTs == nil {
		updatedTs := time.Now().Unix()
		update.UpdatedTs = &updatedTs
	}
	if err := s.Store.UpdateCardSubtask(ctx, update); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to update card subtask")
	}

	subtask, err := s.Store.ListCardSubtasks(ctx, &store.FindCardSubtask{ID: &subtaskID})
	if err != nil || len(subtask) == 0 {
		return nil, status.Errorf(codes.NotFound, "subtask not found")
	}
	item := subtask[0]
	return &v1pb.CardSubtask{
		Name:       constructCardSubtaskName(cardUID, item.ID),
		Card:       constructCardName(cardUID),
		CreateTime: timestamppb.New(time.Unix(item.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(item.UpdatedTs, 0)),
		Title:      item.Title,
		Done:       item.Done,
		Order:      item.Order,
	}, nil
}

func (s *APIV1Service) DeleteCardSubtask(ctx context.Context, request *v1pb.DeleteCardSubtaskRequest) (*emptypb.Empty, error) {
	cardUID, subtaskID, err := extractCardSubresourceID(request.Name, "subtasks/")
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid subtask name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err := s.Store.DeleteCardSubtask(ctx, &store.DeleteCardSubtask{ID: subtaskID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete card subtask")
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) ListCardComments(ctx context.Context, request *v1pb.ListCardCommentsRequest) (*v1pb.ListCardCommentsResponse, error) {
	cardUID, err := ExtractCardUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	comments, err := s.Store.ListCardComments(ctx, &store.FindCardComment{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card comments")
	}
	response := &v1pb.ListCardCommentsResponse{}
	for _, comment := range comments {
		response.Comments = append(response.Comments, &v1pb.CardComment{
			Name:       constructCardCommentName(cardUID, comment.ID),
			Card:       constructCardName(cardUID),
			Creator:    fmt.Sprintf("%s%d", UserNamePrefix, comment.CreatorID),
			CreateTime: timestamppb.New(time.Unix(comment.CreatedTs, 0)),
			Content:    comment.Content,
		})
	}
	return response, nil
}

func (s *APIV1Service) CreateCardComment(ctx context.Context, request *v1pb.CreateCardCommentRequest) (*v1pb.CardComment, error) {
	if request.Comment == nil {
		return nil, status.Errorf(codes.InvalidArgument, "comment is required")
	}
	cardUID, err := ExtractCardUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	create := &store.CardComment{
		CardID:    card.ID,
		CreatorID: user.ID,
		Content:   request.Comment.Content,
	}
	comment, err := s.Store.CreateCardComment(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create card comment")
	}
	return &v1pb.CardComment{
		Name:       constructCardCommentName(cardUID, comment.ID),
		Card:       constructCardName(cardUID),
		Creator:    fmt.Sprintf("%s%d", UserNamePrefix, comment.CreatorID),
		CreateTime: timestamppb.New(time.Unix(comment.CreatedTs, 0)),
		Content:    comment.Content,
	}, nil
}

func (s *APIV1Service) ListCardTimeEntries(ctx context.Context, request *v1pb.ListCardTimeEntriesRequest) (*v1pb.ListCardTimeEntriesResponse, error) {
	cardUID, err := ExtractCardUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	entries, err := s.Store.ListCardTimeEntries(ctx, &store.FindCardTimeEntry{CardID: &card.ID})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to list card time entries")
	}
	response := &v1pb.ListCardTimeEntriesResponse{}
	for _, entry := range entries {
		response.TimeEntries = append(response.TimeEntries, &v1pb.CardTimeEntry{
			Name:       constructCardTimeEntryName(cardUID, entry.ID),
			Card:       constructCardName(cardUID),
			Creator:    fmt.Sprintf("%s%d", UserNamePrefix, entry.CreatorID),
			CreateTime: timestamppb.New(time.Unix(entry.CreatedTs, 0)),
			StartTime:  timestamppb.New(time.Unix(entry.StartTs, 0)),
			EndTime:    timestamppb.New(time.Unix(entry.EndTs, 0)),
		})
	}
	return response, nil
}

func (s *APIV1Service) CreateCardTimeEntry(ctx context.Context, request *v1pb.CreateCardTimeEntryRequest) (*v1pb.CardTimeEntry, error) {
	if request.TimeEntry == nil {
		return nil, status.Errorf(codes.InvalidArgument, "time entry is required")
	}
	cardUID, err := ExtractCardUIDFromName(request.Parent)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid card name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	if request.TimeEntry.StartTime == nil || request.TimeEntry.EndTime == nil {
		return nil, status.Errorf(codes.InvalidArgument, "start_time and end_time are required")
	}

	create := &store.CardTimeEntry{
		CardID:    card.ID,
		CreatorID: user.ID,
		StartTs:   request.TimeEntry.StartTime.AsTime().Unix(),
		EndTs:     request.TimeEntry.EndTime.AsTime().Unix(),
	}
	entry, err := s.Store.CreateCardTimeEntry(ctx, create)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create card time entry")
	}
	return &v1pb.CardTimeEntry{
		Name:       constructCardTimeEntryName(cardUID, entry.ID),
		Card:       constructCardName(cardUID),
		Creator:    fmt.Sprintf("%s%d", UserNamePrefix, entry.CreatorID),
		CreateTime: timestamppb.New(time.Unix(entry.CreatedTs, 0)),
		StartTime:  timestamppb.New(time.Unix(entry.StartTs, 0)),
		EndTime:    timestamppb.New(time.Unix(entry.EndTs, 0)),
	}, nil
}

func (s *APIV1Service) DeleteCardTimeEntry(ctx context.Context, request *v1pb.DeleteCardTimeEntryRequest) (*emptypb.Empty, error) {
	cardUID, entryID, err := extractCardSubresourceID(request.Name, "timeEntries/")
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid time entry name: %v", err)
	}
	card, err := s.Store.GetCard(ctx, &store.FindCard{UID: &cardUID})
	if err != nil || card == nil {
		return nil, status.Errorf(codes.NotFound, "card not found")
	}
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user")
	}
	if user == nil || card.CreatorID != user.ID {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}

	if err := s.Store.DeleteCardTimeEntry(ctx, &store.DeleteCardTimeEntry{ID: entryID}); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to delete time entry")
	}
	return &emptypb.Empty{}, nil
}

func (s *APIV1Service) convertCardFromStore(ctx context.Context, card *store.Card) (*v1pb.Card, error) {
	cardMessage := &v1pb.Card{
		Name:        constructCardName(card.UID),
		Creator:     fmt.Sprintf("%s%d", UserNamePrefix, card.CreatorID),
		CreateTime:  timestamppb.New(time.Unix(card.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(card.UpdatedTs, 0)),
		Title:       card.Title,
		Description: card.Description,
		Status:      card.Status,
		Type:        card.Type,
		Priority:    card.Priority,
		Size:        card.Size,
	}
	if card.AssigneeID != nil {
		cardMessage.Assignee = fmt.Sprintf("%s%d", UserNamePrefix, *card.AssigneeID)
	}
	if card.DueTs != nil && *card.DueTs > 0 {
		cardMessage.DueTime = timestamppb.New(time.Unix(*card.DueTs, 0))
	}
	if card.Payload != nil {
		cardMessage.Tags = card.Payload.Tags
	}

	attachments, err := s.Store.ListAttachments(ctx, &store.FindAttachment{CardID: &card.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list card attachments")
	}
	for _, attachment := range attachments {
		cardMessage.Attachments = append(cardMessage.Attachments, convertAttachmentFromStore(attachment))
	}

	link, err := s.Store.GetCardMemoLink(ctx, &store.FindCardMemoLink{CardID: &card.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to get card memo link")
	}
	if link != nil {
		memo, err := s.Store.GetMemo(ctx, &store.FindMemo{ID: &link.MemoID})
		if err == nil && memo != nil {
			cardMessage.Memo = constructMemoName(memo.UID)
		}
	}

	relations, err := s.Store.ListCardRelations(ctx, &store.FindCardRelation{CardID: &card.ID})
	if err != nil {
		return nil, errors.Wrap(err, "failed to list card relations")
	}
	for _, relation := range relations {
		if relation.Type != cardRelationParent {
			continue
		}
		parent, err := s.Store.GetCard(ctx, &store.FindCard{ID: &relation.RelatedCardID})
		if err == nil && parent != nil {
			parentName := constructCardName(parent.UID)
			cardMessage.Parent = parentName
			break
		}
	}

	return cardMessage, nil
}

func convertBoardFromStore(board *store.Board) *v1pb.Board {
	return &v1pb.Board{
		Name:        constructBoardName(board.UID),
		Creator:     fmt.Sprintf("%s%d", UserNamePrefix, board.CreatorID),
		CreateTime:  timestamppb.New(time.Unix(board.CreatedTs, 0)),
		UpdateTime:  timestamppb.New(time.Unix(board.UpdatedTs, 0)),
		Title:       board.Title,
		Description: board.Description,
	}
}

func convertBoardColumnFromStore(boardUID string, column *store.BoardColumn) *v1pb.BoardColumn {
	return &v1pb.BoardColumn{
		Name:       constructBoardColumnName(boardUID, column.UID),
		Board:      constructBoardName(boardUID),
		CreateTime: timestamppb.New(time.Unix(column.CreatedTs, 0)),
		UpdateTime: timestamppb.New(time.Unix(column.UpdatedTs, 0)),
		Title:      column.Title,
		Order:      column.Order,
	}
}

func convertCardRelationTypeToStore(relationType v1pb.CardRelationType) (string, error) {
	switch relationType {
	case v1pb.CardRelationType_CARD_RELATION_PARENT:
		return cardRelationParent, nil
	case v1pb.CardRelationType_CARD_RELATION_EPIC:
		return cardRelationEpic, nil
	default:
		return "", errors.New("invalid relation type")
	}
}

func convertCardRelationTypeFromStore(relationType string) v1pb.CardRelationType {
	switch relationType {
	case cardRelationParent:
		return v1pb.CardRelationType_CARD_RELATION_PARENT
	case cardRelationEpic:
		return v1pb.CardRelationType_CARD_RELATION_EPIC
	default:
		return v1pb.CardRelationType_CARD_RELATION_TYPE_UNSPECIFIED
	}
}

func constructBoardName(uid string) string {
	return fmt.Sprintf("%s%s", BoardNamePrefix, uid)
}

func constructBoardColumnName(boardUID string, columnUID string) string {
	return fmt.Sprintf("%s%s/%s%s", BoardNamePrefix, boardUID, BoardColumnNamePrefix, columnUID)
}

func constructCardName(uid string) string {
	return fmt.Sprintf("%s%s", CardNamePrefix, uid)
}

func constructMemoName(uid string) string {
	return fmt.Sprintf("%s%s", MemoNamePrefix, uid)
}

func constructCardRelationName(cardUID string, relatedUID string) string {
	return fmt.Sprintf("%s%s/relations/%s", CardNamePrefix, cardUID, relatedUID)
}

func constructCardSubtaskName(cardUID string, subtaskID int32) string {
	return fmt.Sprintf("%s%s/subtasks/%d", CardNamePrefix, cardUID, subtaskID)
}

func constructCardCommentName(cardUID string, commentID int32) string {
	return fmt.Sprintf("%s%s/comments/%d", CardNamePrefix, cardUID, commentID)
}

func constructCardTimeEntryName(cardUID string, entryID int32) string {
	return fmt.Sprintf("%s%s/timeEntries/%d", CardNamePrefix, cardUID, entryID)
}

func extractCardRelationTokens(name string) (string, string, error) {
	tokens, err := GetNameParentTokens(name, CardNamePrefix, "relations/")
	if err != nil {
		return "", "", err
	}
	return tokens[0], tokens[1], nil
}

func extractCardSubresourceID(name string, prefix string) (string, int32, error) {
	tokens, err := GetNameParentTokens(name, CardNamePrefix, prefix)
	if err != nil {
		return "", 0, err
	}
	id, err := util.ConvertStringToInt32(tokens[1])
	if err != nil {
		return "", 0, errors.Errorf("invalid id: %v", err)
	}
	return tokens[0], id, nil
}
