import type { OrderState } from "./types";

interface Props {
  order: OrderState;
  activeSlot: string;
  onSelectSlot: (key: string) => void;
  gemShapeOf: (gemId: string | null | undefined) => string | null;
}

// 镶嵌位置示意图：戒指 / 吊坠 / 排戒三种托型
export default function PositionDiagram({ order, activeSlot, onSelectSlot, gemShapeOf }: Props) {
  return (
    <svg className="diagram" viewBox="0 0 100 100" role="img" aria-label={`${order.name} 位置示意`}>
      {order.piece === "ring" && (
        <>
          <ellipse cx="50" cy="56" rx="30" ry="30" fill="none" stroke="#c9b37e" strokeWidth="4" />
          <circle cx="50" cy="46" r="15" fill="#f8f4e9" stroke="#c9b37e" strokeWidth="1.4" />
        </>
      )}
      {order.piece === "pendant" && (
        <>
          <path d="M20 6 H80" stroke="#c9b37e" strokeWidth="2.4" />
          <path d="M50 6 L50 20" stroke="#c9b37e" strokeWidth="1.6" />
          <path d="M50 78 C30 66 26 52 50 24 C74 52 70 66 50 78 Z" fill="#f8f4e9" stroke="#c9b37e" strokeWidth="1.4" />
        </>
      )}
      {order.piece === "band" && (
        <>
          <rect x="8" y="42" width="84" height="18" rx="9" fill="#f8f4e9" stroke="#c9b37e" strokeWidth="1.6" />
        </>
      )}

      {order.slots.map((slot) => {
        const gemId = order.assignment[slot.key];
        const shape = gemShapeOf(gemId);
        const active = activeSlot === slot.key;
        const r = slot.role === "main" ? 6.2 : 4.4;
        return (
          <g
            key={slot.key}
            className={"diagram-slot" + (active ? " active" : "")}
            transform={`translate(${slot.x} ${slot.y})`}
            onClick={() => onSelectSlot(slot.key)}
          >
            {shape === "圆形" && <circle r={r} className={slot.role === "main" ? "dot main" : "dot"} />}
            {shape === "椭圆" && <ellipse rx={r + 1.4} ry={r - 1.2} className={slot.role === "main" ? "dot main" : "dot"} />}
            {shape === "梨形" && <path d={`M0 ${-r - 1} C${r} ${-r} ${r} ${r} 0 ${r} C${-r} ${r} ${-r} ${-r} 0 ${-r - 1} Z`} className={slot.role === "main" ? "dot main" : "dot"} />}
            {shape === "祖母绿切" && <rect x={-(r - 1)} y={-(r - 1)} width={(r - 1) * 2} height={(r - 1) * 2} className={slot.role === "main" ? "dot main" : "dot"} />}
            {!shape && <circle r={r} className="dot empty" strokeDasharray="1.6 1.4" />}
            <text y="1.8" textAnchor="middle" className="dot-text">
              {gemId ? gemId.replace("ST-", "") : slot.label.replace(/[^\d]/g, "") || "位"}
            </text>
            <title>{slot.label}</title>
          </g>
        );
      })}
    </svg>
  );
}
