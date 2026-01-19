import type { DragEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { PlusIcon } from "lucide-react";
import { useBoardCardDefaults } from "@/hooks/useBoardCardDefaults";
import {
  useBoardColumns,
  useBoards,
  useCardPlacements,
  useCards,
  useCreateBoard,
  useCreateBoardColumn,
  useCreateCard,
  useUpsertCardPlacement,
  useUpdateCard,
} from "@/hooks/useBoardQueries";
import { cn } from "@/lib/utils";
import CardDetailSheet from "@/components/Board/CardDetailSheet";

const Board = () => {
  const { data: boardsResponse } = useBoards();
  const boards = boardsResponse?.boards ?? [];
  const [activeBoard, setActiveBoard] = useState<string>("");
  const [activeCard, setActiveCard] = useState<string | null>(null);

  const { defaults } = useBoardCardDefaults();
  const createBoard = useCreateBoard();
  const createColumn = useCreateBoardColumn();
  const createCard = useCreateCard();
  const upsertPlacement = useUpsertCardPlacement();
  const updateCard = useUpdateCard();

  useEffect(() => {
    if (!activeBoard && boards.length > 0) {
      setActiveBoard(boards[0].name);
    }
  }, [boards, activeBoard]);

  const { data: columnsResponse } = useBoardColumns(activeBoard, { enabled: Boolean(activeBoard) });
  const columns = useMemo(() => (columnsResponse?.columns ?? []).slice().sort((a, b) => a.order - b.order), [columnsResponse]);

  const { data: cardsResponse } = useCards({ pageSize: 1000 });
  const cards = cardsResponse?.cards ?? [];
  const { data: placementsResponse } = useCardPlacements(activeBoard, { enabled: Boolean(activeBoard) });
  const placements = placementsResponse?.placements ?? [];

  const cardMap = useMemo(() => {
    const map = new Map<string, typeof cards[number]>();
    for (const card of cards) {
      map.set(card.name, card);
    }
    return map;
  }, [cards]);

  const placementsByColumn = useMemo(() => {
    const map = new Map<string, typeof placements>();
    for (const placement of placements) {
      const list = map.get(placement.column) ?? [];
      list.push(placement);
      map.set(placement.column, list);
    }
    for (const [column, list] of map.entries()) {
      map.set(
        column,
        list.slice().sort((a, b) => a.order - b.order),
      );
    }
    return map;
  }, [placements]);

  const handleCreateBoard = () => {
    const title = window.prompt("Board name");
    if (!title) return;
    createBoard.mutate(
      { title },
      {
        onSuccess: (board) => {
          setActiveBoard(board.name);
        },
      },
    );
  };

  const handleCreateColumn = () => {
    if (!activeBoard) return;
    const title = window.prompt("Column name");
    if (!title) return;
    createColumn.mutate({ parent: activeBoard, column: { title, order: columns.length } });
  };

  const getNextOrder = (columnName: string) => {
    const list = placementsByColumn.get(columnName) ?? [];
    if (list.length === 0) return 0;
    return Math.max(...list.map((item) => item.order)) + 1;
  };

  const handleCreateCard = async (columnName: string, status?: string) => {
    const title = window.prompt("Card title");
    if (!title) return;
    const nextCard: Record<string, string> = {
      title,
      status: status ?? "",
    };
    if (defaults.defaultType) {
      nextCard.type = defaults.defaultType;
    }
    if (defaults.defaultPriority) {
      nextCard.priority = defaults.defaultPriority;
    }
    if (defaults.defaultSize) {
      nextCard.size = defaults.defaultSize;
    }
    createCard.mutate(
      nextCard,
      {
        onSuccess: (card) => {
          upsertPlacement.mutate({
            board: activeBoard,
            column: columnName,
            card: card.name,
            order: getNextOrder(columnName),
          });
        },
      },
    );
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, columnName: string) => {
    event.preventDefault();
    const cardName = event.dataTransfer.getData("text/plain");
    if (!cardName || !activeBoard) return;
    upsertPlacement.mutate({
      board: activeBoard,
      column: columnName,
      card: cardName,
      order: getNextOrder(columnName),
    });
    const column = columns.find((item) => item.name === columnName);
    if (column) {
      updateCard.mutate({ update: { name: cardName, status: column.title || column.name }, updateMask: ["status"] });
    }
  };

  return (
    <div className="w-full h-full">
      {boards.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">No boards yet.</p>
          <button type="button" className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm" onClick={handleCreateBoard}>
            <PlusIcon className="h-4 w-4" />
            Create your first board
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={activeBoard}
            onChange={(e) => setActiveBoard(e.target.value)}
            className={cn("h-9 rounded-md border border-border bg-transparent px-3 text-sm", "focus:border-border focus:outline-none")}
          >
            {boards.map((board) => (
              <option key={board.name} value={board.name}>
                {board.title || board.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            onClick={handleCreateBoard}
          >
            <PlusIcon className="h-4 w-4" />
            New board
          </button>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          onClick={handleCreateColumn}
          disabled={!activeBoard}
        >
          <PlusIcon className="h-4 w-4" />
          Add column
        </button>
      </div>

      <div className="mt-6 flex gap-4 overflow-x-auto pb-6">
        {columns.map((column) => {
          const columnPlacements = placementsByColumn.get(column.name) ?? [];
          return (
            <div
              key={column.name}
              className="min-w-[260px] max-w-[260px] rounded-2xl border border-border bg-background/80 p-3 shadow-sm"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => handleDrop(event, column.name)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{column.title}</h3>
                <span className="text-xs text-muted-foreground">{columnPlacements.length}</span>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {columnPlacements.map((placement) => {
                  const card = cardMap.get(placement.card);
                  if (!card) return null;
                  return (
                    <div
                      key={placement.card}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData("text/plain", placement.card);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onClick={() => setActiveCard(placement.card)}
                      className="cursor-pointer rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-xs transition hover:border-primary/60"
                    >
                      <div className="font-medium">{card.title}</div>
                      {card.tags?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                          {card.tags.map((tag) => (
                            <span key={tag} className="rounded-full border border-border px-2 py-0.5">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                <button
                  type="button"
                  className="mt-2 inline-flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => handleCreateCard(column.name, column.title)}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add card
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <CardDetailSheet
        cardName={activeCard}
        open={Boolean(activeCard)}
        onOpenChange={(open) => !open && setActiveCard(null)}
        boardName={activeBoard}
        columns={columns}
      />
    </div>
  );
};

export default Board;
