import { useEffect, useState } from "react";
import { createSeedState } from "../data/seed";
import type { AppState } from "../types";

const STORAGE_KEY = "peishi-bench-v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.gems) && Array.isArray(parsed.orders)) {
        return parsed;
      }
    }
  } catch {
    // 存储损坏时回落到预置数据
  }
  return createSeedState();
}

export function usePersistentState(): [
  AppState,
  React.Dispatch<React.SetStateAction<AppState>>,
  () => void,
] {
  const [state, setState] = useState<AppState>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 写入失败（隐私模式/配额）仅影响刷新保留，不阻断操作
    }
  }, [state]);

  const reset = () => setState(createSeedState());

  return [state, setState, reset];
}
