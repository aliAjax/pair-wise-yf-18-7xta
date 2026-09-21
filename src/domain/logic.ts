import type {
  Gem,
  OccupancyMap,
  Order,
  Slot,
  SlotError,
} from "../types";

// 主配石容量线：≥0.5ct 视为主石容量，其余为配石容量
export const MAIN_CARAT = 0.5;

export function isMainCapacity(gem: Gem): boolean {
  return gem.carat >= MAIN_CARAT;
}

export function hasOpenDefect(gem: Gem): boolean {
  return gem.defect?.open === true;
}

// 可占位的宝石必须：已分拣 且 缺陷已处理（无缺陷或缺陷已关闭）
export function isAssignable(gem: Gem): boolean {
  return gem.sorted && !hasOpenDefect(gem);
}

export function shapeMatches(slot: Slot, gem: Gem): boolean {
  return gem.shape === slot.shape;
}

export function sizeMatches(slot: Slot, gem: Gem): boolean {
  return Math.abs(gem.sizeMm - slot.sizeMm) <= slot.toleranceMm + 1e-9;
}

export function roleMatches(slot: Slot, gem: Gem): boolean {
  return slot.role === "主石" ? isMainCapacity(gem) : !isMainCapacity(gem);
}

// 依据已落位订单构建占用索引（含因缺陷重开而暂停的占用）
export function buildOccupancy(orders: Order[]): OccupancyMap {
  const map: OccupancyMap = {};
  for (const order of orders) {
    if (order.status !== "待镶") continue;
    for (const slot of order.slots) {
      const gemId = order.draft[slot.id];
      if (!gemId) continue;
      map[gemId] = {
        orderId: order.id,
        slotId: slot.id,
        paused: false, // 暂停状态结合宝石实时缺陷在派生层判断
      };
    }
  }
  return map;
}

// 某宝石当前是否处于暂停占用（在待镶订单上，缺陷被重新打开）
export function isPaused(
  gem: Gem,
  orders: Order[],
  occupancy: OccupancyMap,
): boolean {
  const info = occupancy[gem.id];
  return Boolean(info && hasOpenDefect(gem));
}

function checkSlot(
  order: Order,
  slot: Slot,
  gemId: string | undefined,
  gemsById: Map<string, Gem>,
  occupancy: OccupancyMap,
  seen: Set<string>,
): string | null {
  if (!gemId) return "镶嵌位空缺，需选择宝石";
  const gem = gemsById.get(gemId);
  if (!gem) return "宝石不存在";
  if (!gem.sorted) return `${gemId} 尚未分拣，不可占位`;
  if (hasOpenDefect(gem)) return `${gemId} 缺陷未处理（${gem.defect?.note ?? ""}），不可占位`;
  const holder = occupancy[gemId];
  if (holder && holder.orderId !== order.id) {
    return `${gemId} 已在订单 ${holder.orderId} 待镶，同颗宝石只能待镶一处`;
  }
  if (seen.has(gemId)) return `${gemId} 在本单内被重复选用`;
  seen.add(gemId);
  if (!shapeMatches(slot, gem))
    return `${gemId} 形状为 ${gem.shape}，与镶嵌位要求 ${slot.shape} 不符`;
  if (!sizeMatches(slot, gem))
    return `${gemId} 尺寸 ${gem.sizeMm.toFixed(2)}mm 超出 ${slot.sizeMm.toFixed(1)}±${slot.toleranceMm.toFixed(1)}mm 范围`;
  if (!roleMatches(slot, gem))
    return slot.role === "主石"
      ? `${gemId} 仅 ${gem.carat}ct，未达主石容量线 ${MAIN_CARAT}ct`
      : `${gemId} 达 ${gem.carat}ct，超出配石容量线 ${MAIN_CARAT}ct`;
  return null;
}

// 整单校验：任一位不符，整单不落，原分配保持不变
export function validateOrder(
  order: Order,
  gems: Gem[],
  orders: Order[],
): SlotError[] {
  const gemsById = new Map(gems.map((g) => [g.id, g]));
  const occupancy = buildOccupancy(orders);
  const errors: SlotError[] = [];
  const seen = new Set<string>();
  for (const slot of order.slots) {
    const message = checkSlot(
      order,
      slot,
      order.draft[slot.id],
      gemsById,
      occupancy,
      seen,
    );
    if (message) errors.push({ slotId: slot.id, message });
  }
  return errors;
}

// 单个镶嵌位的实时提示（用于编辑中即时反馈，不修改任何状态）
export function slotHint(
  order: Order,
  slot: Slot,
  gems: Gem[],
  orders: Order[],
): string | null {
  const gemId = order.draft[slot.id];
  if (!gemId) return null;
  const gemsById = new Map(gems.map((g) => [g.id, g]));
  const occupancy = buildOccupancy(orders);
  // 以“跳过本位、其余位先入集合”的方式检测本单内重复选用
  const seen = new Set<string>();
  for (const s of order.slots) {
    if (s.id === slot.id) continue;
    const other = order.draft[s.id];
    if (other) seen.add(other);
  }
  return checkSlot(order, slot, gemId, gemsById, occupancy, seen);
}
