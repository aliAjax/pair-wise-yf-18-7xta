import { SEED_GEMS, SEED_LOG, SEED_ORDERS } from "./seed";
import type { Gem, LogEntry, OrderState, PersistState, SlotSpec } from "./types";

const STORAGE_KEY = "hxyfront-62006-setting-console-v1";

export function cloneSeed(): PersistState {
  return {
    gems: structuredClone(SEED_GEMS),
    orders: structuredClone(SEED_ORDERS),
    log: structuredClone(SEED_LOG),
    savedAt: Date.now(),
  };
}

export function loadState(): PersistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSeed();
    const parsed = JSON.parse(raw) as Partial<PersistState>;
    if (!Array.isArray(parsed.gems) || !Array.isArray(parsed.orders) || !Array.isArray(parsed.log)) {
      return cloneSeed();
    }
    return {
      gems: parsed.gems as Gem[],
      orders: parsed.orders as OrderState[],
      log: parsed.log as LogEntry[],
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return cloneSeed();
  }
}

export function saveState(state: PersistState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearStorage() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------- 占位关系 ----------

export interface Occupancy {
  orderId: string;
  orderName: string;
  slotKey: string;
  slotLabel: string;
  placed: boolean;
  paused: boolean;
}

export function buildOccupancy(orders: OrderState[]): Map<string, Occupancy> {
  const map = new Map<string, Occupancy>();
  for (const order of orders) {
    for (const slot of order.slots) {
      const gemId = order.assignment[slot.key];
      if (gemId && !map.has(gemId)) {
        map.set(gemId, {
          orderId: order.id,
          orderName: order.name,
          slotKey: slot.key,
          slotLabel: slot.label,
          placed: order.placed,
          paused: order.paused,
        });
      }
    }
  }
  return map;
}

// 仅“已落单待镶”的占用才会锁死跨订单分配（草稿仅在落单校验时拦截）
export function lockedElsewhere(
  occupancy: Map<string, Occupancy>,
  gemId: string,
  currentOrderId: string,
  currentSlotKey: string,
): Occupancy | null {
  const occ = occupancy.get(gemId);
  if (!occ) return null;
  if (occ.orderId === currentOrderId && occ.slotKey === currentSlotKey) return null;
  if (occ.orderId === currentOrderId) return occ; // 同单其它位
  return occ.placed ? occ : null; // 跨订单：只有已待镶才锁定下拉
}

// ---------- 单颗宝石能否进某位 ----------

export type RejectReason =
  | "not-sorted"
  | "defect-open"
  | "shape"
  | "size"
  | "grade"
  | "none";

export function gemFitReason(gem: Gem, slot: SlotSpec): RejectReason {
  if (!gem.sorted) return "not-sorted";
  if (gem.defect.open) return "defect-open";
  if (gem.shape !== slot.shape) return "shape";
  if (gem.sizeMm < slot.minMm || gem.sizeMm > slot.maxMm) return "size";
  if (gem.grade !== slot.role) return "grade";
  return "none";
}

export const REJECT_TEXT: Record<Exclude<RejectReason, "none">, string> = {
  "not-sorted": "尚未分拣",
  "defect-open": "缺陷未处理",
  shape: "形状不符",
  size: "尺寸不符",
  grade: "主/配石容量不符",
};

// ---------- 整单原子校验：任一不符则整单不落，原分配不变 ----------

export function validatePlacement(
  order: OrderState,
  gems: Gem[],
  orders: OrderState[],
): string[] {
  const problems: string[] = [];
  const gemMap = new Map(gems.map((g) => [g.id, g]));
  const seen = new Map<string, string>();

  for (const slot of order.slots) {
    const gemId = order.assignment[slot.key];
    if (!gemId) {
      problems.push(`「${slot.label}」空缺`);
      continue;
    }
    const gem = gemMap.get(gemId);
    if (!gem) {
      problems.push(`「${slot.label}」所选宝石已不存在`);
      continue;
    }
    const reason = gemFitReason(gem, slot);
    if (reason !== "none") {
      problems.push(`「${slot.label}」${gem.id}：${REJECT_TEXT[reason]}`);
    }
    // 同颗宝石跨订单只能待镶一处（其它订单草稿/待镶均拦截）
    const other = orders.find(
      (o) => o.id !== order.id && Object.values(o.assignment).includes(gemId),
    );
    if (other) {
      const otherSlot = other.slots.find((s) => other.assignment[s.key] === gemId);
      problems.push(
        `「${slot.label}」${gemId} 已在订单 ${other.id}「${otherSlot?.label ?? ""}」`,
      );
    }
    if (seen.has(gemId)) {
      problems.push(`「${slot.label}」${gemId} 与本单「${seen.get(gemId)}」重复`);
    } else {
      seen.set(gemId, slot.label);
    }
  }
  return problems;
}

// ---------- 日志 ----------

export function makeLog(entries: LogEntry[], level: "info" | "warn", text: string): LogEntry[] {
  const maxId = entries.reduce((max, e) => Math.max(max, e.id), 0);
  return [...entries, { id: maxId + 1, at: Date.now(), level, text }];
}

export function formatTime(at: number): string {
  const d = new Date(at);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
