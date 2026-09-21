import { useEffect, useMemo, useState, type ReactNode } from "react";
import "./styles.css";
import PositionDiagram from "./console/PositionDiagram";
import {
  buildOccupancy,
  clearStorage,
  cloneSeed,
  formatTime,
  gemFitReason,
  loadState,
  lockedElsewhere,
  makeLog,
  REJECT_TEXT,
  saveState,
  validatePlacement,
  type Occupancy,
} from "./console/logic";
import type { Gem, OrderState, PersistState, Shape } from "./console/types";

const SHAPES: Shape[] = ["圆形", "椭圆", "梨形", "祖母绿切"];

const SIZE_BUCKETS: { key: string; label: string; test: (g: Gem) => boolean }[] = [
  { key: "all", label: "全部尺寸", test: () => true },
  { key: "s15", label: "1.4–1.6mm 围石", test: (g) => g.sizeMm >= 1.4 && g.sizeMm <= 1.6 },
  { key: "s25", label: "2.4–2.6mm 梨形", test: (g) => g.sizeMm >= 2.4 && g.sizeMm <= 2.6 },
  { key: "s30", label: "2.9–3.1mm 排石", test: (g) => g.sizeMm >= 2.9 && g.sizeMm <= 3.1 },
  { key: "main", label: "4mm 以上主石", test: (g) => g.sizeMm >= 4 },
];

function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "muted" | "brand"; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function gemStatus(gem: Gem, occ: Occupancy | undefined): { tone: "ok" | "warn" | "bad" | "muted" | "brand"; text: string } {
  if (occ?.placed) {
    return occ.paused
      ? { tone: "warn", text: `暂停占用 · ${occ.slotLabel}（${occ.orderId}）` }
      : { tone: "brand", text: `待镶 · ${occ.slotLabel}（${occ.orderId}）` };
  }
  if (occ) return { tone: "muted", text: `草拟于 ${occ.orderId} · ${occ.slotLabel}` };
  if (!gem.sorted) return { tone: "muted", text: "未分拣，不可占位" };
  if (gem.defect.open) return { tone: "bad", text: "缺陷待处理，不可占位" };
  return { tone: "ok", text: "可分配" };
}

function App() {
  const [state, setState] = useState<PersistState>(() => loadState());
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [sizeKey, setSizeKey] = useState("all");
  const [batch, setBatch] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [orderTab, setOrderTab] = useState(state.orders[0]?.id ?? "");
  const [activeSlot, setActiveSlot] = useState("");

  useEffect(() => {
    saveState(state);
  }, [state]);

  const { gems, orders, log } = state;
  const gemMap = useMemo(() => new Map(gems.map((g) => [g.id, g])), [gems]);
  const occupancy = useMemo(() => buildOccupancy(orders), [orders]);
  const batches = useMemo(() => Array.from(new Set(gems.map((g) => g.batch))).sort(), [gems]);

  const activeOrder = orders.find((o) => o.id === orderTab) ?? orders[0];

  // ---------- 派生指标 ----------
  const placedCount = orders.reduce(
    (sum, o) => sum + (o.placed ? o.slots.filter((s) => o.assignment[s.key]).length : 0),
    0,
  );
  const openDefects = gems.filter((g) => g.defect.open).length;
  const totalCarat = gems.reduce((sum, g) => sum + g.carat, 0);
  const pausedCount = orders.filter((o) => o.placed && o.paused).length;

  // ---------- 筛选 ----------
  const sizeBucket = SIZE_BUCKETS.find((b) => b.key === sizeKey) ?? SIZE_BUCKETS[0];
  const visibleGems = gems.filter((g) => {
    if (shapes.length && !shapes.includes(g.shape)) return false;
    if (!sizeBucket.test(g)) return false;
    if (batch !== "all" && g.batch !== batch) return false;
    if (keyword && !`${g.id}${g.kind}${g.clarity}${g.cut}`.toLowerCase().includes(keyword.toLowerCase())) {
      return false;
    }
    return true;
  });

  // ---------- 操作 ----------
  const pushLog = (level: "info" | "warn", text: string) =>
    setState((s) => ({ ...s, log: makeLog(s.log, level, text), savedAt: Date.now() }));

  const assignSlot = (orderId: string, slotKey: string, gemIdOrEmpty: string) => {
    const gemId = gemIdOrEmpty || null;
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, assignment: { ...o.assignment, [slotKey]: gemId }, error: null }
          : o,
      ),
      savedAt: Date.now(),
    }));
    if (gemId) {
      const gem = gemMap.get(gemId);
      const order = orders.find((o) => o.id === orderId);
      const slot = order?.slots.find((sl) => sl.key === slotKey);
      if (gem && slot) pushLog("info", `草拟：${gemId} 放入 ${orderId}「${slot.label}」。`);
    }
  };

  const clearDraft = (orderId: string) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId ? { ...o, assignment: Object.fromEntries(o.slots.map((sl) => [sl.key, null])), error: null } : o,
      ),
      savedAt: Date.now(),
    }));
    pushLog("info", `已清空订单 ${orderId} 的草拟分配（宝石仍可分配）。`);
  };

  // 整单原子落位：任一不符则整单不落，原分配不变
  const placeOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const problems = validatePlacement(order, gems, orders);
    if (problems.length) {
      setState((s) => ({
        ...s,
        orders: s.orders.map((o) => (o.id === orderId ? { ...o, error: problems.join("；") } : o)),
        log: makeLog(s.log, "warn", `${orderId} 整单未落位：${problems.join("；")}（原分配不变）。`),
        savedAt: Date.now(),
      }));
      return;
    }
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, placed: true, paused: false, error: null } : o)),
      log: makeLog(s.log, "info", `${orderId}「${order.name}」整单落位，${order.slots.length} 颗宝石进入待镶。`),
      savedAt: Date.now(),
    }));
  };

  // 撤回：恢复可分配（保留草拟便于重新落位）
  const withdrawOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const ids = order.slots.map((s) => order.assignment[s.key]).filter(Boolean).join("、");
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => (o.id === orderId ? { ...o, placed: false, paused: false, error: null } : o)),
      log: makeLog(s.log, "info", `${orderId} 撤回，${ids} 恢复可分配（草拟保留）。`),
      savedAt: Date.now(),
    }));
  };

  const toggleSorted = (gemId: string) => {
    const gem = gemMap.get(gemId);
    if (!gem) return;
    const next = !gem.sorted;
    setState((s) => ({
      ...s,
      gems: s.gems.map((g) => (g.id === gemId ? { ...g, sorted: next } : g)),
      log: makeLog(s.log, next ? "info" : "warn", `${gemId} ${next ? "已分拣，可参与配石" : "分拣标记被撤回，暂停参与配石"}。`),
      savedAt: Date.now(),
    }));
  };

  // 处理缺陷：关闭缺陷并登记处理结论
  const closeDefect = (gemId: string) => {
    const gem = gemMap.get(gemId);
    if (!gem) return;
    const note = window.prompt(`登记 ${gemId} 的缺陷处理结论：`, gem.defect.handledNote ?? "已复检合格");
    if (note === null) return;
    setState((s) => {
      const nextGems = s.gems.map((g) =>
        g.id === gemId ? { ...g, defect: { ...g.defect, open: false, handledNote: note || "已处理" } } : g,
      );
      // 若该石处于暂停中的待镶订单，缺陷清零后恢复占用
      const occ = buildOccupancy(s.orders).get(gemId);
      let nextOrders = s.orders;
      let resumeText = "";
      if (occ?.placed && occ.paused) {
        const order = s.orders.find((o) => o.id === occ.orderId);
        const orderGems = order
          ? order.slots.map((sl) => nextGems.find((g) => g.id === order.assignment[sl.key])).filter(Boolean) as Gem[]
          : [];
        if (orderGems.every((g) => !g.defect.open)) {
          nextOrders = nextOrders.map((o) => (o.id === occ.orderId ? { ...o, paused: false } : o));
          resumeText = `；订单 ${occ.orderId} 缺陷清零，占用恢复`;
        }
      }
      return {
        ...s,
        gems: nextGems,
        orders: nextOrders,
        log: makeLog(s.log, "info", `${gemId} 缺陷已处理并留档：${note || "已处理"}${resumeText}。`),
        savedAt: Date.now(),
      };
    });
  };

  // 缺陷重新打开：暂停占用并留档
  const reopenDefect = (gemId: string) => {
    const gem = gemMap.get(gemId);
    if (!gem) return;
    const note = window.prompt(`重新登记 ${gemId} 的缺陷：`, gem.defect.note || "");
    if (note === null) return;
    setState((s) => {
      const nextGems = s.gems.map((g) =>
        g.id === gemId ? { ...g, defect: { ...g.defect, open: true, note: note || "复检发现缺陷" } } : g,
      );
      const occ = buildOccupancy(s.orders).get(gemId);
      let nextOrders = s.orders;
      let pauseText = "";
      if (occ?.placed) {
        nextOrders = nextOrders.map((o) => (o.id === occ.orderId ? { ...o, paused: true } : o));
        pauseText = `；订单 ${occ.orderId} 暂停占用，「${occ.slotLabel}」留档待处理`;
      }
      return {
        ...s,
        gems: nextGems,
        orders: nextOrders,
        log: makeLog(s.log, "warn", `${gemId} 缺陷重新打开：${note || "复检发现缺陷"}${pauseText}。`),
        savedAt: Date.now(),
      };
    });
  };

  const resetAll = () => {
    if (!window.confirm("恢复预置的三张订单与十二颗宝石？本机当前配石数据将被覆盖。")) return;
    clearStorage();
    const fresh = cloneSeed();
    setState(fresh);
    setOrderTab(fresh.orders[0].id);
    setShapes([]);
    setSizeKey("all");
    setBatch("all");
    setKeyword("");
  };

  // ---------- 渲染 ----------
  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62006 · 珠宝镶嵌工作台 · Port 62006</p>
        <h1>镶嵌配石台</h1>
        <span>
          仅“已分拣且缺陷已处理”的宝石可占位；同颗宝石跨订单只能待镶一处。尺寸或主配石容量不符时整单不落、原分配不变；撤回后恢复可分配，缺陷重新打开将暂停占用并留档。数据仅存本机，刷新保留。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>分拣批次</small>
          <strong>{batches.length}</strong>
        </article>
        <article>
          <small>待镶嵌（处）</small>
          <strong>{placedCount}</strong>
          {pausedCount > 0 && <em className="metric-note warn">{pausedCount} 单暂停</em>}
        </article>
        <article>
          <small>缺陷待处理</small>
          <strong className={openDefects ? "num-bad" : ""}>{openDefects}</strong>
        </article>
        <article>
          <small>总克拉</small>
          <strong>{totalCarat.toFixed(2)}</strong>
        </article>
      </section>

      <section className="workspace console-workspace">
        <aside className="panel">
          <h2>批次与筛选</h2>

          <p className="filter-label">分拣批次</p>
          <div className="chips">
            <button className={batch === "all" ? "chip-on" : ""} onClick={() => setBatch("all")}>
              全部批次
            </button>
            {batches.map((b) => (
              <button key={b} className={batch === b ? "chip-on" : ""} onClick={() => setBatch(b)}>
                {b}
              </button>
            ))}
          </div>

          <p className="filter-label">形状筛选</p>
          <div className="chips">
            {SHAPES.map((shape) => {
              const on = shapes.includes(shape);
              return (
                <button
                  key={shape}
                  className={on ? "chip-on" : ""}
                  onClick={() => setShapes((prev) => (on ? prev.filter((s) => s !== shape) : [...prev, shape]))}
                >
                  {shape}
                </button>
              );
            })}
          </div>

          <p className="filter-label">尺寸筛选</p>
          <select className="select" value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
            {SIZE_BUCKETS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>

          <p className="filter-label">编号 / 种类检索</p>
          <input placeholder="如 ST-2048 或 钻石" value={keyword} onChange={(e) => setKeyword(e.target.value)} />

          <div className="rule-box">
            <h3>占位规则</h3>
            <ul>
              <li>已分拣 + 缺陷关闭，才可占位</li>
              <li>跨订单一颗宝石只能待镶一处</li>
              <li>形状、尺寸区间、主/配石容量逐位校验</li>
              <li>任一不符：整单不落，原分配不变</li>
              <li>撤回恢复可分配；缺陷重开暂停并留档</li>
            </ul>
          </div>
        </aside>

        <section className="panel">
          <div className="order-tabs">
            {orders.map((o) => (
              <button
                key={o.id}
                className={"order-tab" + (activeOrder.id === o.id ? " on" : "")}
                onClick={() => {
                  setOrderTab(o.id);
                  setActiveSlot("");
                }}
              >
                <b>{o.id}</b>
                <span>{o.name}</span>
                {o.placed && !o.paused && <i className="tab-dot ok" title="待镶" />}
                {o.placed && o.paused && <i className="tab-dot warn" title="暂停" />}
              </button>
            ))}
          </div>

          <OrderBoard
            key={activeOrder.id}
            order={activeOrder}
            gems={gems}
            gemMap={gemMap}
            occupancy={occupancy}
            orders={orders}
            activeSlot={activeSlot}
            onSelectSlot={setActiveSlot}
            onAssign={assignSlot}
            onPlace={placeOrder}
            onWithdraw={withdrawOrder}
            onClearDraft={clearDraft}
          />
        </section>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>宝石清单</p>
            <h2>{batch === "all" ? "全批次" : batch} · {visibleGems.length} / {gems.length} 颗</h2>
          </div>
          <button onClick={resetAll}>恢复预置数据</button>
        </div>
        <div className="table-scroll">
          <table className="gem-table">
            <thead>
              <tr>
                <th>编号</th>
                <th>种类</th>
                <th>形状</th>
                <th>克拉</th>
                <th>尺寸 mm</th>
                <th>净度</th>
                <th>切工</th>
                <th>主/配</th>
                <th>批次</th>
                <th>分拣</th>
                <th>缺陷</th>
                <th>占用 / 状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {visibleGems.map((gem) => {
                const occ = occupancy.get(gem.id);
                const status = gemStatus(gem, occ);
                const locked = occ?.placed;
                return (
                  <tr key={gem.id}>
                    <td className="mono">{gem.id}</td>
                    <td>{gem.kind}</td>
                    <td>{gem.shape}</td>
                    <td>{gem.carat.toFixed(3).replace(/0+$/, "").replace(/\.$/, ".0")}</td>
                    <td>{gem.sizeMm.toFixed(2).replace(/0$/, "")}</td>
                    <td>{gem.clarity}</td>
                    <td>{gem.cut}</td>
                    <td>
                      <Badge tone={gem.grade === "main" ? "brand" : "muted"}>
                        {gem.grade === "main" ? "主石" : "配石"}
                      </Badge>
                    </td>
                    <td className="mono">{gem.batch}</td>
                    <td>
                      {gem.sorted ? <Badge tone="ok">已分拣</Badge> : <Badge tone="muted">未分拣</Badge>}
                    </td>
                    <td>
                      {gem.defect.open ? (
                        <div className="defect-cell">
                          <Badge tone="bad">待处理</Badge>
                          <span>{gem.defect.note}</span>
                        </div>
                      ) : gem.defect.note ? (
                        <div className="defect-cell">
                          <Badge tone="ok">已处理</Badge>
                          <span title={gem.defect.handledNote}>{gem.defect.note} → {gem.defect.handledNote}</span>
                        </div>
                      ) : (
                        <span className="muted-text">—</span>
                      )}
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.text}</Badge>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button disabled={locked} title={locked ? "待镶中不可改分拣状态" : ""} onClick={() => toggleSorted(gem.id)}>
                          {gem.sorted ? "撤销分拣" : "标记分拣"}
                        </button>
                        {gem.defect.open ? (
                          <button className="accent-btn" onClick={() => closeDefect(gem.id)}>
                            处理缺陷
                          </button>
                        ) : (
                          <button
                            className="ghost-btn"
                            title="重新打开缺陷将暂停该石所在待镶订单"
                            onClick={() => reopenDefect(gem.id)}
                          >
                            重开缺陷
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel log-panel">
        <div className="heading">
          <div>
            <p>操作留档</p>
            <h2>配石操作日志（{log.length}）</h2>
          </div>
          <div className="sync-state">
            <span className="sync-dot" />
            本地数据已同步 · {formatTime(state.savedAt)} · 刷新保留，无后端依赖
          </div>
        </div>
        <div className="log-list">
          {log.slice().reverse().map((entry) => (
            <div key={entry.id} className={`log-entry ${entry.level}`}>
              <time>{formatTime(entry.at)}</time>
              <span>{entry.text}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

// ---------------- 订单工作台 ----------------

interface BoardProps {
  order: OrderState;
  gems: Gem[];
  gemMap: Map<string, Gem>;
  occupancy: Map<string, Occupancy>;
  orders: OrderState[];
  activeSlot: string;
  onSelectSlot: (key: string) => void;
  onAssign: (orderId: string, slotKey: string, gemId: string) => void;
  onPlace: (orderId: string) => void;
  onWithdraw: (orderId: string) => void;
  onClearDraft: (orderId: string) => void;
}

function OrderBoard({
  order,
  gemMap,
  occupancy,
  orders,
  activeSlot,
  onSelectSlot,
  onAssign,
  onPlace,
  onWithdraw,
  onClearDraft,
}: BoardProps) {
  const selectedSlotKey = activeSlot && order.slots.some((s) => s.key === activeSlot) ? activeSlot : order.slots[0].key;
  const filled = order.slots.filter((s) => order.assignment[s.key]).length;

  return (
    <div className="order-board">
      <div className="order-head">
        <div>
          <h2>
            {order.name} <span className="mono muted-text">{order.id}</span>
          </h2>
          <p className="order-sub">
            共 {order.slots.length} 个镶嵌位 · 已选 {filled}
            {order.placed && !order.paused && <Badge tone="ok">已落单 · 待镶</Badge>}
            {order.placed && order.paused && <Badge tone="warn">暂停占用 · 缺陷待处理</Badge>}
            {!order.placed && <Badge tone="muted">草拟中</Badge>}
          </p>
        </div>
        <div className="order-actions">
          {!order.placed && (
            <>
              <button className="primary" onClick={() => onPlace(order.id)}>
                整单落位
              </button>
              <button onClick={() => onClearDraft(order.id)}>清空草拟</button>
            </>
          )}
          {order.placed && (
            <button className="accent-btn" onClick={() => onWithdraw(order.id)}>
              撤回（恢复可分配）
            </button>
          )}
        </div>
      </div>

      {order.error && (
        <div className="order-error">
          <b>整单未落位，原分配不变：</b>
          {order.error}
        </div>
      )}

      <div className="board-grid">
        <div className="diagram-wrap">
          <PositionDiagram
            order={order}
            activeSlot={selectedSlotKey}
            onSelectSlot={order.placed ? () => undefined : onSelectSlot}
            gemShapeOf={(id) => (id ? gemMap.get(id)?.shape ?? null : null)}
          />
          <div className="diagram-legend">
            <span><i className="lg main" /> 主石位</span>
            <span><i className="lg" /> 配石位</span>
            <span><i className="lg empty" /> 空位</span>
            <span>点击点位选择镶嵌位</span>
          </div>
        </div>

        <div className="slots">
          {order.slots.map((slot) => {
            const gemId = order.assignment[slot.key];
            const gem = gemId ? gemMap.get(gemId) : undefined;
            const fit = gem ? gemFitReason(gem, slot) : "none";
            const elsewhere = gemId
              ? orders.find((o) => o.id !== order.id && Object.values(o.assignment).includes(gemId))
              : undefined;
            const openHere = selectedSlotKey === slot.key;
            return (
              <div
                key={slot.key}
                className={"slot-card" + (openHere ? " open" : "") + (slot.role === "main" ? " is-main" : "")}
                onClick={() => !order.placed && onSelectSlot(slot.key)}
              >
                <div className="slot-head">
                  <b>{slot.label}</b>
                  <span className="req">
                    需 {slot.shape} · {slot.minMm}–{slot.maxMm}mm · {slot.role === "main" ? "主石" : "配石"}
                  </span>
                </div>
                <select
                  className="select slot-select"
                  value={gemId ?? ""}
                  disabled={order.placed}
                  onChange={(e) => onAssign(order.id, slot.key, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="">— 空置 —</option>
                  {Array.from(gemMap.values()).map((g) => {
                    const reason = gemFitReason(g, slot);
                    const lock = lockedElsewhere(occupancy, g.id, order.id, slot.key);
                    const duplicated =
                      !lock &&
                      order.slots.some((s) => s.key !== slot.key && order.assignment[s.key] === g.id);
                    // 未分拣 / 缺陷未处理 / 已在他单待镶 / 本单重复：不可占位；
                    // 形状、尺寸、主配容量不符允许草拟，整单落位时统一拦截。
                    const hardBlock = reason === "not-sorted" || reason === "defect-open";
                    const disabled = !!lock || duplicated || hardBlock;
                    const tag =
                      lock ? `（已待镶 ${lock.orderId}）`
                      : duplicated ? "（本单已用）"
                      : reason === "not-sorted" ? "（尚未分拣）"
                      : reason === "defect-open" ? "（缺陷未处理）"
                      : reason !== "none" ? `（${REJECT_TEXT[reason]}，落位拦截）`
                      : " ✓";
                    return (
                      <option key={g.id} value={g.id} disabled={disabled}>
                        {g.id} · {g.kind} · {g.shape}{g.sizeMm}mm · {g.grade === "main" ? "主" : "配"}{tag}
                      </option>
                    );
                  })}
                </select>
                {gem && fit !== "none" && <div className="slot-warn">⚠ {REJECT_TEXT[fit]}</div>}
                {gem && elsewhere && (
                  <div className="slot-warn soft">⇄ 该石同时出现在 {elsewhere.id} 的草拟中，落位时整单拦截</div>
                )}
                {gem && fit === "none" && !elsewhere && <div className="slot-ok">✓ 形状 / 尺寸 / 主配容量匹配</div>}
                {gem?.defect.open && <div className="slot-warn">缺陷已重新打开：{gem.defect.note}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
