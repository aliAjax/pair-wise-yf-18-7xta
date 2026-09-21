// 镶嵌配石台领域模型

export type Shape = "圆形" | "椭圆" | "梨形" | "祖母绿切";
export type JewelryPiece = "戒指" | "吊坠" | "耳饰";
export type GemKind = "钻石" | "蓝宝石" | "祖母绿" | "红宝石";
export type Clarity = "VVS1" | "VVS2" | "VS1" | "VS2" | "SI1" | "SI2";
export type Cut = "理想切工" | "优良切工" | "良好切工";
export type SlotRole = "主石" | "配石";

export interface GemDefect {
  open: boolean; // 缺陷是否未处理
  note: string; // 缺陷备注
  foundAt: string; // 首次记录时间
}

export interface Gem {
  id: string; // 宝石编号
  kind: GemKind; // 种类
  shape: Shape; // 形状
  carat: number; // 克拉重量
  sizeMm: number; // 尺寸（直径/长轴，毫米）
  clarity: Clarity; // 净度
  color: string; // 颜色
  cut: Cut; // 切工
  sorted: boolean; // 分拣状态
  batch: string; // 分拣批次
  defect: GemDefect | null; // 缺陷
}

export interface Slot {
  id: string; // 镶嵌位编号
  label: string; // 镶嵌位名称
  role: SlotRole; // 主石位 / 配石位
  shape: Shape; // 要求形状
  sizeMm: number; // 标称尺寸
  toleranceMm: number; // 允许尺寸误差
}

export type OrderStatus = "待配石" | "待镶";

export interface Order {
  id: string; // 订单编号
  name: string;
  piece: JewelryPiece; // 镶嵌位置（首饰部位）
  slots: Slot[];
  status: OrderStatus;
  placedAt: string | null;
  draft: Record<string, string>; // slotId -> gemId，编辑中的配石方案
}

export interface ArchiveEntry {
  id: number;
  time: string;
  event: string;
  detail: string;
}

export interface AppState {
  version: number;
  gems: Gem[];
  orders: Order[];
  archive: ArchiveEntry[];
  nextArchiveId: number;
}

export interface SlotError {
  slotId: string;
  message: string;
}

export interface AssignmentInfo {
  orderId: string;
  slotId: string;
  paused: boolean; // 因缺陷重新打开而暂停占用
}

export type OccupancyMap = Record<string, AssignmentInfo>;
