import { useEffect, useState } from "react";
import { BOARD_DEFAULTS_EVENT, loadBoardCardDefaults, saveBoardCardDefaults } from "@/utils/boardDefaults";
import type { BoardCardDefaults } from "@/utils/boardDefaults";

export const useBoardCardDefaults = () => {
  const [defaults, setDefaults] = useState<BoardCardDefaults>(loadBoardCardDefaults());

  useEffect(() => {
    const handleUpdate = () => {
      setDefaults(loadBoardCardDefaults());
    };

    window.addEventListener(BOARD_DEFAULTS_EVENT, handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener(BOARD_DEFAULTS_EVENT, handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const updateDefaults = (update: Partial<BoardCardDefaults>) => {
    const next = saveBoardCardDefaults(update);
    setDefaults(next);
  };

  return { defaults, updateDefaults };
};
