import { useState } from "react";
import type { Gem, OccupancyMap, Order, Shape } from "../types";
import { hasOpenDefect, isPaused, isAssignable } from "../domain/logic";

interface GemTableProps {
  gems: Gem[];
  orders: Order[];
  occupancy: OccupancyMap;
  shapeFilter: Shape | "全部";
  sizeFilter: string;
  batchFilter: string;
  onToggleSorted: (gemId: string) => void;
  onToggleDefect: (gemId: string) => void;
  onAddDefect: (gemId: string, note: string) => void;
}

function sizeBand(sizeMm: number): string {
  if (sizeMm < 3) return "小配石 (<3mm)";
  if (sizeMm < 5) return "配石 (3–5mm)";
  if (sizeMm < 7) return "中石 (5–7mm)";
  return "主石 (≥7mm)";
}

export function sizeBandOf(gem: Gem): string {
  return sizeBand(gem.sizeMm);
}

function GemRow({
  gem,
  orders,
  occupancy,
  onToggleSorted,
  onToggleDefect,
  onAddDefect,
}: {
  gem: Gem;
  orders: Order[];
  occupancy: OccupancyMap;
  onToggleSorted: (id: string) => void;
  onToggleDefect: (id: string) => void;
  onAddDefect: (id: string, note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const holder = occupancy[gem.id];
  const heldOrder = holder ? orders.find((o) => o.id === holder.orderId) : undefined;
  const paused = isPaused(gem, orders, occupancy);
  const open = hasOpenDefect(gem);

  return (
    <tr className={paused ? "paused-row" : ""}>
      <td><b>{gem.id}</b></td>
      <td>{gem.kind}</td>
      <td>{gem.shape}</td>
      <td>{gem.carat.toFixed(2)}ct</td>
      <td>{gem.sizeMm.toFixed(2)}mm</td>
      <td>{gem.clarity}</td>
      <td>{gem.color}</td>
      <td>{gem.cut}</td>
      <td>{gem.batch}</td>
      <td>
        <button
          className={`mini ${gem.sorted ? "done" : "todo"}`}
          disabled={Boolean(holder)}
          title={holder ? "已占用宝石需先撤回订单" : "切换分拣状态"}
          onClick={() => onToggleSorted(gem.id)}
        >
          {gem.sorted ? "已分拣" : "未分拣"}
        </button>
      </td>
      <td className="defect-cell">
        <button className={`mini ${open ? "todo" : gem.defect ? "resolved" : "none"}`} onClick={() => onToggleDefect(gem.id)}>
          {open ? "缺陷未处理" : gem.defect ? "缺陷已处理" : "无缺陷"}
        </button>
        {gem.defect && (
          <div className="defect-note">
            {gem.defect.note}
            <small>登记于 {gem.defect.foundAt}</small>
          </div>
        )}
        {editing ? (
          <div className="defect-add">
            <input
              autoFocus
              placeholder="缺陷备注"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && note.trim()) {
                  onAddDefect(gem.id, note.trim());
                  setNote("");
                  setEditing(false);
                }
              }}
            />
            <button
              className="mini primary"
              onClick={() => {
                if (note.trim()) {
                  onAddDefect(gem.id, note.trim());
                  setNote("");
                  setEditing(false);
                }
              }}
            >
              登记
            </button>
          </div>
        ) : (
          <button className="link" onClick={() => setEditing(true)}>＋登记缺陷</button>
        )}
      </td>
      <td>
        {heldOrder ? (
          <span className={`seat-ref ${paused ? "paused" : ""}`}>
            {heldOrder.id}
            {paused ? " · 占用暂停" : " · 待镶"}
          </span>
        ) : isAssignable(gem) ? (
          <span className="seat-ref free">可分配</span>
        ) : (
          <span className="seat-ref locked">不可占位</span>
        )}
      </td>
    </tr>
  );
}

export function GemTable(props: GemTableProps) {
  const {
    gems,
    orders,
    occupancy,
    shapeFilter,
    sizeFilter,
    batchFilter,
    onToggleSorted,
    onToggleDefect,
    onAddDefect,
  } = props;

  const visible = gems.filter((g) => {
    if (shapeFilter !== "全部" && g.shape !== shapeFilter) return false;
    if (sizeFilter !== "全部" && sizeBand(g.sizeMm) !== sizeFilter) return false;
    if (batchFilter !== "全部" && g.batch !== batchFilter) return false;
    return true;
  });

  return (
    <div className="table-scroll">
      <table className="gem-table">
        <thead>
          <tr>
            <th>编号</th>
            <th>种类</th>
            <th>形状</th>
            <th>克拉</th>
            <th>尺寸</th>
            <th>净度</th>
            <th>颜色</th>
            <th>切工</th>
            <th>分拣批次</th>
            <th>分拣状态</th>
            <th>缺陷与处理</th>
            <th>镶嵌位</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((gem) => (
            <GemRow
              key={gem.id}
              gem={gem}
              orders={orders}
              occupancy={occupancy}
              onToggleSorted={onToggleSorted}
              onToggleDefect={onToggleDefect}
              onAddDefect={onAddDefect}
            />
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={12} className="empty-row">当前筛选条件下没有宝石</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
