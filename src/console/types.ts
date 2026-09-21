// 镶嵌配石台领域模型

export type Grade = "main" | "accent"; // 主石 / 配石
export type Shape = "圆形" | "椭圆" | "梨形" | "祖母绿切";
export type PieceKind = "ring" | "pendant" | "band";

export interface DefectState {
  open: boolean; // 是否仍有未处理缺陷
  note: string; // 缺陷描述（为空表示从未登记缺陷）
  handledNote?: string; // 处理结论
}

export interface Gem {
  id: string; // 编号
  kind: string; // 种类
  shape: Shape; // 形状
  carat: number; // 克拉
  sizeMm: number; // 尺寸（最大直径 mm）
  clarity: string; // 净度
  cut: string; // 切工
  grade: Grade; // 主石 / 配石级别（主配石容量）
  batch: string; // 分拣批次
  sorted: boolean; // 是否已分拣
  defect: DefectState; // 缺陷
}

export interface SlotSpec {
  key: string;
  label: string; // 镶嵌位名称
  role: Grade; // 该位需要主石还是配石
  shape: Shape; // 该位要求形状
  minMm: number; // 尺寸下限
  maxMm: number; // 尺寸上限
  x: number; // 位置示意坐标
  y: number;
}

export interface OrderSpec {
  id: string; // 订单编号
  name: string; // 款式名称
  piece: PieceKind; // 托型
  slots: SlotSpec[];
}

export interface OrderState extends OrderSpec {
  placed: boolean; // 是否已整单落位（待镶）
  paused: boolean; // 缺陷重开导致占用暂停
  assignment: Record<string, string | null>; // 镶嵌位 -> 宝石编号
  error?: string | null; // 最近一次整单校验失败原因
}

export interface LogEntry {
  id: number;
  at: number;
  level: "info" | "warn";
  text: string;
}

export interface PersistState {
  gems: Gem[];
  orders: OrderState[];
  log: LogEntry[];
  savedAt: number;
}
