import type { Gem, JewelryPiece, Order, Slot } from "../types";
import { isAssignable } from "../domain/logic";

interface Point {
  x: number;
  y: number;
  r: number;
}

const KIND_FILL: Record<string, string> = {
  钻石: "#e0f2fe",
  蓝宝石: "#3b82f6",
  祖母绿: "#10b981",
  红宝石: "#e11d48",
};

interface SeatDiagramProps {
  order: Order;
  gemsById: Map<string, Gem>;
  selectedSlot: string | null;
  onSelectSlot: (slotId: string) => void;
}

// 主石居中，配石按首饰部位环形/竖向排布
function seatPoints(order: Order): Record<string, Point> {
  const main = order.slots.find((s) => s.role === "主石");
  const sides = order.slots.filter((s) => s.role === "配石");
  const points: Record<string, Point> = {};
  if (main) points[main.id] = { x: 120, y: 62, r: main.role === "主石" ? 22 : 12 };

  if (order.piece === "戒指") {
    const cx = 120;
    const cy = 66;
    const radius = 40;
    sides.forEach((s, i) => {
      const angle = -Math.PI / 2 + (i - (sides.length - 1) / 2) * (Math.PI * 0.52);
      points[s.id] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), r: 11 };
    });
  } else if (order.piece === "吊坠") {
    sides.forEach((s, i) => {
      const angle = (i / Math.max(sides.length - 1, 1)) * Math.PI;
      points[s.id] = { x: 120 + 52 * Math.cos(angle), y: 122 + 30 * Math.sin(angle), r: 11 };
    });
  } else {
    // 耳饰：左右对称两瓣
    const coords: Array<[number, number]> = [
      [70, 120],
      [170, 120],
      [70, 158],
      [170, 158],
      [70, 196],
      [170, 196],
    ];
    sides.forEach((s, i) => {
      const [x, y] = coords[i % coords.length];
      points[s.id] = { x, y, r: 12 };
    });
  }
  return points;
}

function ShapeMark({ gem, x, y, r }: { gem: Gem; x: number; y: number; r: number }) {
  const fill = KIND_FILL[gem.kind] ?? "#cbd5e1";
  const common = { fill, stroke: "#0f172a", strokeWidth: 1.1 };
  switch (gem.shape) {
    case "圆形":
      return <circle cx={x} cy={y} r={r} {...common} />;
    case "椭圆":
      return <ellipse cx={x} cy={y} rx={r + 4} ry={r - 2} {...common} />;
    case "祖母绿切":
      return <rect x={x - r - 2} y={y - r + 2} width={(r + 2) * 2} height={(r - 2) * 2} rx={2} {...common} />;
    case "梨形":
      return (
        <path
          d={`M ${x} ${y - r - 3} C ${x + r + 2} ${y - r + 4}, ${x + r} ${y + r}, ${x} ${y + r} C ${x - r} ${y + r}, ${x - r - 2} ${y - r + 4}, ${x} ${y - r - 3} Z`}
          {...common}
        />
      );
  }
}

function PieceBase({ piece }: { piece: JewelryPiece }) {
  if (piece === "戒指") {
    return (
      <>
        <ellipse cx={120} cy={150} rx={74} ry={52} fill="none" stroke="#94a3b8" strokeWidth={8} />
        <path d="M60 108 Q120 58 180 108" fill="none" stroke="#64748b" strokeWidth={5} strokeLinecap="round" />
      </>
    );
  }
  if (piece === "吊坠") {
    return (
      <>
        <path d="M120 4 v26" stroke="#64748b" strokeWidth={3} />
        <circle cx={120} cy={12} r={7} fill="none" stroke="#94a3b8" strokeWidth={3} />
        <path d="M76 96 Q120 64 164 96 Q164 168 120 186 Q76 168 76 96 Z" fill="none" stroke="#94a3b8" strokeWidth={4} />
      </>
    );
  }
  return (
    <>
      <path d="M120 8 v14 M82 30 h76" stroke="#64748b" strokeWidth={3} strokeLinecap="round" />
      <path d="M70 48 Q38 110 70 196 Q102 110 70 48 Z" fill="none" stroke="#94a3b8" strokeWidth={3} />
      <path d="M170 48 Q202 110 170 196 Q138 110 170 48 Z" fill="none" stroke="#94a3b8" strokeWidth={3} />
    </>
  );
}

export function SeatDiagram({ order, gemsById, selectedSlot, onSelectSlot }: SeatDiagramProps) {
  const points = seatPoints(order);

  return (
    <svg className="seat-diagram" viewBox="0 0 240 212" role="img" aria-label={`${order.piece}镶嵌位置示意图`}>
      <PieceBase piece={order.piece} />
      {order.slots.map((slot: Slot) => {
        const p = points[slot.id];
        const gem = gemsById.get(order.draft[slot.id] ?? "");
        const active = selectedSlot === slot.id;
        const seatFill = gem
          ? isAssignable(gem)
            ? "rgba(15,118,110,0.18)"
            : "rgba(190,18,60,0.18)"
          : "rgba(148,163,184,0.16)";
        const stroke = active ? "#be123c" : "#64748b";
        const numberMatch = slot.label.match(/\d+/);
        const seatText = slot.role === "主石" ? "主" : numberMatch ? numberMatch[0] : "配";
        return (
          <g
            key={slot.id}
            className="seat"
            onClick={() => onSelectSlot(slot.id)}
            style={{ cursor: "pointer" }}
          >
            {gem ? (
              <>
                <circle cx={p.x} cy={p.y} r={p.r + 6} fill={seatFill} stroke={stroke} strokeWidth={active ? 2.4 : 1.2} strokeDasharray={order.status === "待镶" ? undefined : "4 3"} />
                <ShapeMark gem={gem} x={p.x} y={p.y} r={p.r} />
              </>
            ) : (
              <circle cx={p.x} cy={p.y} r={p.r} fill={seatFill} stroke={stroke} strokeWidth={active ? 2.4 : 1.2} strokeDasharray="4 3" />
            )}
            <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={9} fill={gem ? "#0f172a" : "#64748b"} style={{ pointerEvents: "none", fontWeight: 600 }}>
              {seatText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
