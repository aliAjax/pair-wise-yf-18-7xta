import type { Gem, LogEntry, OrderState } from "./types";

// 预置三张订单

export const SEED_ORDERS: OrderState[] = [
  {
    id: "JD-1803",
    name: "蔷薇之誓 · 戒指",
    piece: "ring",
    placed: false,
    paused: false,
    error: null,
    assignment: { center: null, halo1: null, halo2: null, halo3: null, halo4: null },
    slots: [
      { key: "center", label: "中心主石位", role: "main", shape: "椭圆", minMm: 5.8, maxMm: 6.2, x: 50, y: 46 },
      { key: "halo1", label: "围石位 1", role: "accent", shape: "圆形", minMm: 1.4, maxMm: 1.6, x: 50, y: 18 },
      { key: "halo2", label: "围石位 2", role: "accent", shape: "圆形", minMm: 1.4, maxMm: 1.6, x: 82, y: 46 },
      { key: "halo3", label: "围石位 3", role: "accent", shape: "圆形", minMm: 1.4, maxMm: 1.6, x: 50, y: 74 },
      { key: "halo4", label: "围石位 4", role: "accent", shape: "圆形", minMm: 1.4, maxMm: 1.6, x: 18, y: 46 },
    ],
  },
  {
    id: "JD-1817",
    name: "藤蔓低语 · 吊坠",
    piece: "pendant",
    placed: false,
    paused: false,
    error: null,
    assignment: { head: null, leaf1: null, leaf2: null, leaf3: null },
    slots: [
      { key: "head", label: "吊坠主石位", role: "main", shape: "梨形", minMm: 4.8, maxMm: 5.2, x: 50, y: 34 },
      { key: "leaf1", label: "叶形配石 1", role: "accent", shape: "梨形", minMm: 2.4, maxMm: 2.6, x: 30, y: 64 },
      { key: "leaf2", label: "叶形配石 2", role: "accent", shape: "梨形", minMm: 2.4, maxMm: 2.6, x: 50, y: 70 },
      { key: "leaf3", label: "叶形配石 3", role: "accent", shape: "梨形", minMm: 2.4, maxMm: 2.6, x: 70, y: 64 },
    ],
  },
  {
    id: "JD-1824",
    name: "星河 · 排戒",
    piece: "band",
    placed: false,
    paused: false,
    error: null,
    assignment: { s1: null, s2: null, s3: null },
    slots: [
      { key: "s1", label: "排戒位 1", role: "accent", shape: "圆形", minMm: 2.9, maxMm: 3.1, x: 22, y: 50 },
      { key: "s2", label: "排戒位 2", role: "accent", shape: "圆形", minMm: 2.9, maxMm: 3.1, x: 50, y: 50 },
      { key: "s3", label: "排戒位 3", role: "accent", shape: "圆形", minMm: 2.9, maxMm: 3.1, x: 78, y: 50 },
    ],
  },
];

// 预置十二颗宝石
// 配比说明：三张订单凑齐后均可落位——
// JD-1803 需先将 ST-2064「标记分拣」；JD-1817 需先「处理」ST-2073 的缺陷；JD-1824 开箱即可落位。

export const SEED_GEMS: Gem[] = [
  {
    id: "ST-2048", kind: "蓝宝石", shape: "椭圆", carat: 1.02, sizeMm: 6.0,
    clarity: "VVS", cut: "椭圆明亮式", grade: "main", batch: "B-0912",
    sorted: true, defect: { open: false, note: "" },
  },
  {
    id: "ST-2061", kind: "钻石", shape: "圆形", carat: 0.015, sizeMm: 1.5,
    clarity: "VVS", cut: "圆形明亮式", grade: "accent", batch: "B-0912",
    sorted: true, defect: { open: false, note: "" },
  },
  {
    id: "ST-2062", kind: "钻石", shape: "圆形", carat: 0.014, sizeMm: 1.5,
    clarity: "VVS", cut: "圆形明亮式", grade: "accent", batch: "B-0912",
    sorted: true, defect: { open: false, note: "" },
  },
  {
    id: "ST-2063", kind: "钻石", shape: "圆形", carat: 0.016, sizeMm: 1.6,
    clarity: "VS", cut: "圆形明亮式", grade: "accent", batch: "B-0912",
    sorted: true, defect: { open: false, note: "" },
  },
  {
    id: "ST-2064", kind: "钻石", shape: "圆形", carat: 0.015, sizeMm: 1.5,
    clarity: "SI", cut: "圆形明亮式", grade: "accent", batch: "B-0912",
    sorted: false, // 未分拣，占位下拉中不可选
    defect: { open: false, note: "" },
  },
  {
    id: "ST-2071", kind: "石榴石", shape: "梨形", carat: 0.07, sizeMm: 2.5,
    clarity: "VS", cut: "梨形玫瑰式", grade: "accent", batch: "B-0915",
    sorted: true, defect: { open: false, note: "" },
  },
  {
    id: "ST-2072", kind: "石榴石", shape: "梨形", carat: 0.06, sizeMm: 2.4,
    clarity: "VVS", cut: "梨形玫瑰式", grade: "accent", batch: "B-0915",
    sorted: true, defect: { open: false, note: "" },
  },
  {
    id: "ST-2073", kind: "沙弗莱石", shape: "梨形", carat: 0.075, sizeMm: 2.5,
    clarity: "SI", cut: "梨形混合式", grade: "accent", batch: "B-0915",
    sorted: true,
    defect: { open: true, note: "尖部崩口，待重新切磨" },
  },
  {
    id: "ST-2081", kind: "钻石", shape: "圆形", carat: 0.11, sizeMm: 3.0,
    clarity: "VS", cut: "圆形明亮式", grade: "accent", batch: "B-0918",
    sorted: true, defect: { open: false, note: "" },
  },
  {
    id: "ST-2082", kind: "钻石", shape: "圆形", carat: 0.1, sizeMm: 3.0,
    clarity: "VVS", cut: "圆形明亮式", grade: "accent", batch: "B-0918",
    sorted: true,
    defect: {
      open: false,
      note: "台面轻微划痕",
      handledNote: "已重新抛光，复检合格（2026-09-18）",
    },
  },
  {
    id: "ST-2083", kind: "钻石", shape: "圆形", carat: 0.105, sizeMm: 3.0,
    clarity: "VVS", cut: "圆形明亮式", grade: "accent", batch: "B-0918",
    sorted: true, defect: { open: false, note: "" },
  },
  {
    id: "ST-2101", kind: "绿碧玺", shape: "梨形", carat: 1.35, sizeMm: 5.0,
    clarity: "VS", cut: "梨形阶梯式", grade: "main", batch: "B-0915",
    sorted: true, defect: { open: false, note: "" },
  },
];

export const SEED_LOG: LogEntry[] = [
  {
    id: 1,
    at: Date.parse("2026-09-21T09:10:00+08:00") || Date.now(),
    level: "info",
    text: "批次 B-0912 / B-0915 / B-0918 共 12 颗宝石入库，三张订单开台。",
  },
];
