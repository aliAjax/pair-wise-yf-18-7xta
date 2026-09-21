import { useMemo, useState } from "react";
import "./styles.css";
import type { Shape, SlotError } from "./types";
import { usePersistentState } from "./hooks/usePersistentState";
import { buildOccupancy, validateOrder } from "./domain/logic";
import { nowStamp } from "./domain/time";
import { OrderCard } from "./components/OrderCard";
import { GemTable, sizeBandOf } from "./components/GemTable";
import { Archive } from "./components/Archive";

const SHAPES: Array<Shape | "全部"> = ["全部", "圆形", "椭圆", "梨形", "祖母绿切"];
const SIZE_BANDS = ["全部", "小配石 (<3mm)", "配石 (3–5mm)", "中石 (5–7mm)", "主石 (≥7mm)"];

function App() {
  const [state, setState, resetSeed] = usePersistentState();
  const { gems, orders, archive } = state;

  const [shapeFilter, setShapeFilter] = useState<Shape | "全部">("全部");
  const [sizeFilter, setSizeFilter] = useState("全部");
  const [batchFilter, setBatchFilter] = useState("全部");
  const [attempts, setAttempts] = useState<Record<string, SlotError[] | null>>({});

  const occupancy = useMemo(() => buildOccupancy(orders), [orders]);
  const batches = useMemo(() => Array.from(new Set(gems.map((g) => g.batch))).sort(), [gems]);

  const occupiedGems = gems.filter((g) => occupancy[g.id]);
  const metrics = [
    { label: "分拣批次", value: batches.length },
    { label: "待镶嵌", value: occupiedGems.length },
    { label: "缺陷备注", value: gems.filter((g) => g.defect?.open).length },
    { label: "总克拉", value: occupiedGems.reduce((sum, g) => sum + g.carat, 0).toFixed(2) },
  ];

  const appendArchive = (
    prev: typeof state,
    event: string,
    detail: string,
  ) => ({
    ...prev,
    nextArchiveId: prev.nextArchiveId + 1,
    archive: [
      { id: prev.nextArchiveId, time: nowStamp(), event, detail },
      ...prev.archive,
    ],
  });

  // 整单落位：全部镶嵌位校验通过才提交；否则整单不落、原分配不变
  const handlePlace = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === "待镶") return;
    const errors = validateOrder(order, gems, orders);
    if (errors.length > 0) {
      setAttempts((cur) => ({ ...cur, [orderId]: errors }));
      setState((prev) =>
        appendArchive(
          prev,
          "落位被拒",
          `订单 ${orderId} 校验未通过（${errors.length} 项），整单不落，原分配保持不变。`,
        ),
      );
      return;
    }
    setState((prev) => {
      let next = {
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId ? { ...o, status: "待镶" as const, placedAt: nowStamp() } : o,
        ),
      };
      const gemIds = order.slots.map((s) => order.draft[s.id]).join("、");
      next = appendArchive(next, "整单落位", `订单 ${orderId} ${order.name} 全部 ${order.slots.length} 位占位（${gemIds}），进入待镶。`);
      return next;
    });
    setAttempts((cur) => ({ ...cur, [orderId]: null }));
  };

  // 撤回整单：释放全部宝石，恢复可分配
  const handleWithdraw = (orderId: string) => {
    setState((prev) =>
      appendArchive(
        {
          ...prev,
          orders: prev.orders.map((o) =>
            o.id === orderId ? { ...o, status: "待配石" as const, placedAt: null } : o,
          ),
        },
        "整单撤回",
        `订单 ${orderId} 撤回，镶嵌位上的宝石全部恢复可分配，配石方案保留待调整。`,
      ),
    );
  };

  const handleDraftChange = (orderId: string, slotId: string, gemId: string) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              draft: { ...o.draft, [slotId]: gemId },
            }
          : o,
      ),
    }));
    setAttempts((cur) => (cur[orderId] ? { ...cur, [orderId]: null } : cur));
  };

  const handleToggleSorted = (gemId: string) => {
    const gem = gems.find((g) => g.id === gemId);
    if (!gem || occupancy[gemId]) return;
    setState((prev) => {
      const target = prev.gems.find((g) => g.id === gemId)!;
      const sorted = !target.sorted;
      let next = {
        ...prev,
        gems: prev.gems.map((g) => (g.id === gemId ? { ...g, sorted } : g)),
      };
      next = appendArchive(
        next,
        sorted ? "分拣完成" : "退回分拣",
        sorted
          ? `宝石 ${gemId} 完成分拣，进入可分配池。`
          : `宝石 ${gemId} 标记为未分拣，退出可分配池。`,
      );
      return next;
    });
  };

  const handleToggleDefect = (gemId: string) => {
    const gem = gems.find((g) => g.id === gemId);
    if (!gem) return;
    const occupied = Boolean(occupancy[gemId]);
    setState((prev) => {
      const target = prev.gems.find((g) => g.id === gemId)!;
      const willOpen = !target.defect?.open;
      let next = {
        ...prev,
        gems: prev.gems.map((g) =>
          g.id === gemId
            ? {
                ...g,
                defect: g.defect
                  ? { ...g.defect, open: willOpen }
                  : { open: true, note: "待补充缺陷备注", foundAt: nowStamp() },
              }
            : g,
        ),
      };
      if (willOpen && occupied) {
        next = appendArchive(
          next,
          "缺陷重开·暂停占用",
          `宝石 ${gemId} 缺陷重新打开，其待镶占用已暂停并留档，处理完成前不计入可分配。`,
        );
      } else if (willOpen) {
        next = appendArchive(next, "缺陷登记", `宝石 ${gemId} 标记缺陷未处理，暂不可占位。`);
      } else {
        next = appendArchive(
          next,
          "缺陷关闭",
          occupied
            ? `宝石 ${gemId} 缺陷处理完成，暂停解除，恢复待镶占用。`
            : `宝石 ${gemId} 缺陷处理完成，恢复可分配。`,
        );
      }
      return next;
    });
  };

  const handleAddDefect = (gemId: string, note: string) => {
    const occupied = Boolean(occupancy[gemId]);
    setState((prev) => {
      let next = {
        ...prev,
        gems: prev.gems.map((g) =>
          g.id === gemId
            ? { ...g, defect: { open: true, note, foundAt: nowStamp() } }
            : g,
        ),
      };
      next = appendArchive(
        next,
        occupied ? "缺陷重开·暂停占用" : "缺陷登记",
        `宝石 ${gemId} 登记缺陷「${note}」${occupied ? "，待镶占用暂停并留档" : "，暂不可占位"}。`,
      );
      return next;
    });
  };

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62006 · 源提示词8 · Port 62006</p>
        <h1>珠宝镶嵌 · 配石台</h1>
        <span>
          在分拣壳内完成按订单配石：仅已分拣且缺陷已处理的宝石可占位；同颗宝石跨订单只能待镶一处；
          尺寸或主配石容量不符时整单不落、原分配不变。撤回恢复可分配，缺陷重开暂停占用并留档。数据仅存本地浏览器。
        </span>
      </section>

      <section className="metrics">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <section className="workspace orders-layout">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            orders={orders}
            gems={gems}
            occupancy={occupancy}
            attemptErrors={attempts[order.id] ?? null}
            onDraftChange={handleDraftChange}
            onPlace={handlePlace}
            onWithdraw={handleWithdraw}
          />
        ))}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>宝石批次台账</p>
            <h2>十二颗宝石 · 尺寸筛选</h2>
          </div>
          <div className="filters-inline">
            <label>
              <span>形状</span>
              <select value={shapeFilter} onChange={(e) => setShapeFilter(e.target.value as Shape | "全部")}>
                {SHAPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>尺寸</span>
              <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
                {SIZE_BANDS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              <span>分拣批次</span>
              <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
                <option value="全部">全部</option>
                {batches.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <GemTable
          gems={gems}
          orders={orders}
          occupancy={occupancy}
          shapeFilter={shapeFilter}
          sizeFilter={sizeFilter}
          batchFilter={batchFilter}
          onToggleSorted={handleToggleSorted}
          onToggleDefect={handleToggleDefect}
          onAddDefect={handleAddDefect}
        />
        <p className="table-hint">
          尺寸分段：{gems.map((g) => `${g.id} ${g.sizeMm}mm/${sizeBandOf(g).split(" ")[0]}`).join("；")}
        </p>
      </section>

      <section className="workspace bottom-layout">
        <section className="panel">
          <div className="heading">
            <div>
              <p>留档</p>
              <h2>操作与缺陷档案</h2>
            </div>
          </div>
          <Archive entries={archive} />
        </section>
        <aside className="panel">
          <h2>本地数据同步</h2>
          <p className="sync-note">
            所有订单、配石方案、批次、缺陷与档案自动写入浏览器 localStorage，刷新页面后保留；
            全程不接后端、不依赖外部服务。
          </p>
          <button
            className="primary"
            onClick={() => {
              if (window.confirm("恢复预置三张订单与十二颗宝石？当前本地改动将被覆盖。")) {
                resetSeed();
                setAttempts({});
              }
            }}
          >
            恢复预置数据
          </button>
          <ul className="rule-list">
            <li>已分拣 + 缺陷已处理，方可占位</li>
            <li>同颗宝石跨订单仅能待镶一处</li>
            <li>形状/尺寸误差/主配石容量任一不符，整单不落</li>
            <li>撤回整单释放宝石，方案保留</li>
            <li>缺陷重开暂停占用并留档，关闭后恢复</li>
          </ul>
        </aside>
      </section>
    </main>
  );
}

export default App;
