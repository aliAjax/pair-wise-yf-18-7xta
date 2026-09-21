import { useState } from "react";
import type { Gem, OccupancyMap, Order, SlotError } from "../types";
import {
  MAIN_CARAT,
  hasOpenDefect,
  isMainCapacity,
  slotHint,
} from "../domain/logic";
import { SeatDiagram } from "./SeatDiagram";

interface OrderCardProps {
  order: Order;
  orders: Order[];
  gems: Gem[];
  occupancy: OccupancyMap;
  attemptErrors: SlotError[] | null;
  onDraftChange: (orderId: string, slotId: string, gemId: string) => void;
  onPlace: (orderId: string) => void;
  onWithdraw: (orderId: string) => void;
}

function gemBadges(gem: Gem): string {
  const tags: string[] = [];
  if (!gem.sorted) tags.push("未分拣");
  if (hasOpenDefect(gem)) tags.push("缺陷未处理");
  if (!isMainCapacity(gem)) tags.push("配石容量");
  return tags.length ? `（${tags.join("·")}）` : "";
}

export function OrderCard({
  order,
  orders,
  gems,
  occupancy,
  attemptErrors,
  onDraftChange,
  onPlace,
  onWithdraw,
}: OrderCardProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const placed = order.status === "待镶";
  const gemsById = new Map(gems.map((g) => [g.id, g]));
  const filled = order.slots.filter((s) => order.draft[s.id]).length;
  const errorMap = new Map((attemptErrors ?? []).map((e) => [e.slotId, e.message]));

  return (
    <article className={`panel order-card ${placed ? "is-placed" : ""}`}>
      <div className="heading">
        <div>
          <p>{order.id} · {order.piece}</p>
          <h2>{order.name}</h2>
        </div>
        <span className={`status-pill ${placed ? "placed" : "draft"}`}>
          {placed ? "待镶" : "待配石"}
        </span>
      </div>

      <div className="order-body">
        <div className="diagram-wrap">
          <SeatDiagram
            order={order}
            gemsById={gemsById}
            selectedSlot={selectedSlot}
            onSelectSlot={(id) => setSelectedSlot((cur) => (cur === id ? null : id))}
          />
          <p className="diagram-caption">
            镶嵌位置示意 · 点击石位可定位下方配石行
          </p>
          <p className="diagram-caption">
            主配石容量线：{MAIN_CARAT}ct · 已选 {filled}/{order.slots.length} 位
          </p>
        </div>

        <div className="slot-rows">
          {order.slots.map((slot) => {
            const gemId = order.draft[slot.id] ?? "";
            const gem = gemsById.get(gemId);
            const holder = gemId ? occupancy[gemId] : undefined;
            const heldElsewhere = Boolean(holder && holder.orderId !== order.id);
            const pausedHere = Boolean(holder && holder.orderId === order.id && gem && hasOpenDefect(gem));
            const liveHint = slotHint(order, slot, gems, orders);
            const hint = errorMap.get(slot.id) ?? liveHint;
            return (
              <div
                key={slot.id}
                className={`slot-row ${selectedSlot === slot.id ? "selected" : ""}`}
                onClick={() => setSelectedSlot(slot.id)}
              >
                <div className="slot-meta">
                  <b>{slot.label}</b>
                  <span>
                    {slot.role} · {slot.shape} · {slot.sizeMm.toFixed(1)}±{slot.toleranceMm.toFixed(1)}mm
                  </span>
                </div>
                <select
                  value={gemId}
                  disabled={placed}
                  onChange={(e) => onDraftChange(order.id, slot.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">— 选择宝石 —</option>
                  {gems.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.id} · {g.kind} · {g.shape} · {g.carat}ct · {g.sizeMm}mm
                      {g.id === gemId ? "" : gemBadges(g)}
                    </option>
                  ))}
                </select>
                {gem && (
                  <span className={`slot-flag ${pausedHere ? "paused" : heldElsewhere ? "held" : hint ? "bad" : "ok"}`}>
                    {pausedHere
                      ? "暂停占用"
                      : heldElsewhere
                        ? `他单占用 ${holder!.orderId}`
                        : hint
                          ? "不符"
                          : "可占位"}
                  </span>
                )}
                {hint && !placed && <small className="slot-error">{hint}</small>}
                {pausedHere && <small className="slot-error">缺陷重新打开，占用已暂停并留档</small>}
              </div>
            );
          })}
        </div>
      </div>

      {attemptErrors && attemptErrors.length > 0 && (
        <div className="order-banner bad">
          尺寸或主配石容量等校验未通过，整单不落，原分配保持不变（{attemptErrors.length} 项）
        </div>
      )}

      <div className="order-actions">
        {!placed ? (
          <button className="primary" onClick={() => onPlace(order.id)}>
            整单落位
          </button>
        ) : (
          <button onClick={() => onWithdraw(order.id)}>撤回整单</button>
        )}
        <span className="action-note">
          {placed
            ? `已于 ${order.placedAt ?? ""} 落位，撤回后宝石恢复可分配`
            : "同颗宝石跨订单只能待镶一处；任一位不符则整单不落"}
        </span>
      </div>
    </article>
  );
}
