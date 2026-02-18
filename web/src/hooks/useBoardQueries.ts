import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { boardServiceClient } from "@/connect";
import type { ListBoardsRequest, ListCardsRequest } from "@/types/proto/api/v1/board_service_pb";
import {
  BoardColumnSchema,
  BoardSchema,
  CardCommentSchema,
  CardPlacementSchema,
  CardSchema,
  CardSubtaskSchema,
  CardTimeEntrySchema,
  ListBoardsRequestSchema,
  ListCardsRequestSchema,
} from "@/types/proto/api/v1/board_service_pb";

type MsgInput = Record<string, unknown>;

export const boardKeys = {
  all: ["boards"] as const,
  lists: () => [...boardKeys.all, "list"] as const,
  list: (filters?: Partial<ListBoardsRequest>) => [...boardKeys.lists(), filters] as const,
  columns: (boardName?: string) => [...boardKeys.all, "columns", boardName] as const,
  cards: () => [...boardKeys.all, "cards"] as const,
  card: (name: string) => [...boardKeys.cards(), "detail", name] as const,
  placements: (boardName?: string) => [...boardKeys.all, "placements", boardName] as const,
  relations: (cardName?: string) => [...boardKeys.all, "relations", cardName] as const,
  subtasks: (cardName?: string) => [...boardKeys.all, "subtasks", cardName] as const,
  comments: (cardName?: string) => [...boardKeys.all, "comments", cardName] as const,
  timeEntries: (cardName?: string) => [...boardKeys.all, "timeEntries", cardName] as const,
};

export function useBoards(request: Partial<ListBoardsRequest> = {}) {
  return useQuery({
    queryKey: boardKeys.list(request),
    queryFn: async () => {
      const response = await boardServiceClient.listBoards(create(ListBoardsRequestSchema, request as Record<string, unknown>));
      return response;
    },
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (board: MsgInput) => {
      return await boardServiceClient.createBoard({ board: create(BoardSchema, board) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.lists() });
    },
  });
}

export function useBoardColumns(boardName?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: boardKeys.columns(boardName),
    queryFn: async () => {
      if (!boardName) return { columns: [] };
      return await boardServiceClient.listBoardColumns({ parent: boardName });
    },
    enabled: options?.enabled ?? Boolean(boardName),
  });
}

export function useCreateBoardColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ parent, column }: { parent: string; column: MsgInput }) => {
      return await boardServiceClient.createBoardColumn({ parent, column: create(BoardColumnSchema, column) });
    },
    onSuccess: (_column, variables) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.columns(variables.parent) });
    },
  });
}

export function useUpdateBoardColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ column, updateMask }: { column: MsgInput; updateMask: string[] }) => {
      return await boardServiceClient.updateBoardColumn({
        column: create(BoardColumnSchema, column),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
    },
    onSuccess: (column) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.columns(column.board) });
      queryClient.invalidateQueries({ queryKey: boardKeys.placements(column.board) });
      queryClient.invalidateQueries({ queryKey: boardKeys.cards() });
    },
  });
}

export function useCards(request: Partial<ListCardsRequest> = {}) {
  return useQuery({
    queryKey: boardKeys.cards(),
    queryFn: async () => {
      const response = await boardServiceClient.listCards(create(ListCardsRequestSchema, request as Record<string, unknown>));
      return response;
    },
  });
}

export function useCard(name?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: name ? boardKeys.card(name) : boardKeys.card(""),
    queryFn: async () => {
      if (!name) return undefined;
      return await boardServiceClient.getCard({ name });
    },
    enabled: options?.enabled ?? Boolean(name),
  });
}

export function useCreateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (card: MsgInput) => {
      return await boardServiceClient.createCard({ card: create(CardSchema, card) });
    },
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.cards() });
      queryClient.setQueryData(boardKeys.card(card.name), card);
    },
  });
}

export function useUpdateCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ update, updateMask }: { update: MsgInput; updateMask: string[] }) => {
      return await boardServiceClient.updateCard({
        card: create(CardSchema, update),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
    },
    onSuccess: (card) => {
      queryClient.setQueryData(boardKeys.card(card.name), card);
      queryClient.invalidateQueries({ queryKey: boardKeys.cards() });
      queryClient.invalidateQueries({ queryKey: boardKeys.placements() });
    },
  });
}

export function useDeleteCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await boardServiceClient.deleteCard({ name });
      return name;
    },
    onSuccess: (name) => {
      queryClient.removeQueries({ queryKey: boardKeys.card(name) });
      queryClient.invalidateQueries({ queryKey: boardKeys.cards() });
      queryClient.invalidateQueries({ queryKey: boardKeys.placements() });
    },
  });
}

export function useCardPlacements(boardName?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: boardKeys.placements(boardName),
    queryFn: async () => {
      if (!boardName) return { placements: [] };
      return await boardServiceClient.listCardPlacements({ board: boardName });
    },
    enabled: options?.enabled ?? Boolean(boardName),
  });
}

export function useUpsertCardPlacement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (placement: MsgInput) => {
      return await boardServiceClient.upsertCardPlacement({ placement: create(CardPlacementSchema, placement) });
    },
    onSuccess: (placement) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.placements(placement.board) });
      queryClient.invalidateQueries({ queryKey: boardKeys.cards() });
    },
  });
}

export function useCardRelations(cardName?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: boardKeys.relations(cardName),
    queryFn: async () => {
      if (!cardName) return { relations: [] };
      return await boardServiceClient.listCardRelations({ name: cardName });
    },
    enabled: options?.enabled ?? Boolean(cardName),
  });
}

export function useUpsertCardRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (relation: { card: string; relatedCard: string; type: number }) => {
      return await boardServiceClient.upsertCardRelation({
        name: relation.card,
        relatedCard: relation.relatedCard,
        type: relation.type,
      });
    },
    onSuccess: (_relation, variables) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.relations(variables.card) });
      queryClient.invalidateQueries({ queryKey: boardKeys.cards() });
    },
  });
}

export function useDeleteCardRelation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await boardServiceClient.deleteCardRelation({ name });
      return name;
    },
    onSuccess: (_name, variables) => {
      const cardName = variables.split("/relations/")[0];
      queryClient.invalidateQueries({ queryKey: boardKeys.relations(cardName) });
      queryClient.invalidateQueries({ queryKey: boardKeys.cards() });
    },
  });
}

export function useCardSubtasks(cardName?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: boardKeys.subtasks(cardName),
    queryFn: async () => {
      if (!cardName) return { subtasks: [] };
      return await boardServiceClient.listCardSubtasks({ parent: cardName });
    },
    enabled: options?.enabled ?? Boolean(cardName),
  });
}

export function useCreateCardSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ parent, subtask }: { parent: string; subtask: MsgInput }) => {
      return await boardServiceClient.createCardSubtask({ parent, subtask: create(CardSubtaskSchema, subtask) });
    },
    onSuccess: (_subtask, variables) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.subtasks(variables.parent) });
    },
  });
}

export function useUpdateCardSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subtask, updateMask }: { subtask: MsgInput; updateMask: string[] }) => {
      return await boardServiceClient.updateCardSubtask({
        subtask: create(CardSubtaskSchema, subtask),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
    },
    onSuccess: (subtask) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.subtasks(subtask.card) });
    },
  });
}

export function useDeleteCardSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await boardServiceClient.deleteCardSubtask({ name });
      return name;
    },
    onSuccess: (name) => {
      const cardName = name.split("/subtasks/")[0];
      queryClient.invalidateQueries({ queryKey: boardKeys.subtasks(cardName) });
    },
  });
}

export function useCardComments(cardName?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: boardKeys.comments(cardName),
    queryFn: async () => {
      if (!cardName) return { comments: [] };
      return await boardServiceClient.listCardComments({ parent: cardName });
    },
    enabled: options?.enabled ?? Boolean(cardName),
  });
}

export function useCreateCardComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ parent, comment }: { parent: string; comment: MsgInput }) => {
      return await boardServiceClient.createCardComment({ parent, comment: create(CardCommentSchema, comment) });
    },
    onSuccess: (_comment, variables) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.comments(variables.parent) });
    },
  });
}

export function useCardTimeEntries(cardName?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: boardKeys.timeEntries(cardName),
    queryFn: async () => {
      if (!cardName) return { timeEntries: [] };
      return await boardServiceClient.listCardTimeEntries({ parent: cardName });
    },
    enabled: options?.enabled ?? Boolean(cardName),
  });
}

export function useCreateCardTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ parent, timeEntry }: { parent: string; timeEntry: MsgInput }) => {
      return await boardServiceClient.createCardTimeEntry({ parent, timeEntry: create(CardTimeEntrySchema, timeEntry) });
    },
    onSuccess: (_entry, variables) => {
      queryClient.invalidateQueries({ queryKey: boardKeys.timeEntries(variables.parent) });
    },
  });
}

export function useDeleteCardTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await boardServiceClient.deleteCardTimeEntry({ name });
      return name;
    },
    onSuccess: (name) => {
      const cardName = name.split("/timeEntries/")[0];
      queryClient.invalidateQueries({ queryKey: boardKeys.timeEntries(cardName) });
    },
  });
}
