// 作业类型
export type WorkType = 'plow' | 'rotary' | 'sow' | 'transplant' | 'harvest' | 'other'

// 作业类型映射
export const WorkTypeMap: Record<WorkType, string> = {
  plow: '耕地',
  rotary: '旋地',
  sow: '播种',
  transplant: '插秧',
  harvest: '收割',
  other: '其他'
}

// 订单状态
export type OrderStatus = 'pending' | 'dispatched' | 'working' | 'done' | 'settled' | 'cancelled' | 'rescheduled'

export const OrderStatusMap: Record<OrderStatus, string> = {
  pending: '待派工',
  dispatched: '已派工',
  working: '作业中',
  done: '已完工',
  settled: '已结算',
  cancelled: '已取消',
  rescheduled: '已改期'
}

// 机械状态
export type MachineStatus = 'idle' | 'working' | 'repair' | 'reserved'

export const MachineStatusMap: Record<MachineStatus, string> = {
  idle: '空闲',
  working: '作业中',
  repair: '维修中',
  reserved: '已预约'
}

// 机械类型
export type MachineType = 'tractor' | 'rotavator' | 'seeder' | 'transplanter' | 'harvester' | 'truck'

export const MachineTypeMap: Record<MachineType, string> = {
  tractor: '拖拉机',
  rotavator: '旋耕机',
  seeder: '播种机',
  transplanter: '插秧机',
  harvester: '收割机',
  truck: '转运车'
}

// 农户信息
export interface Farmer {
  id: string
  name: string
  phone: string
  village: string
  address: string
}

// 机手信息
export interface Operator {
  id: string
  name: string
  phone: string
  avatar?: string
  experience: number
}

// 机械信息
export interface Machine {
  id: string
  name: string
  plateNo: string
  type: MachineType
  model: string
  status: MachineStatus
  operatorId: string
  operatorName: string
  year: number
  fuelPerMu?: number
  workCapacity?: number
  lat?: number
  lng?: number
  distance?: number
}

// 订单信息
export interface Order {
  id: string
  orderNo: string
  farmerId: string
  farmerName: string
  farmerPhone: string
  village: string
  address: string
  workType: WorkType
  cropType?: string
  area: number
  workDate: string
  timeSlot?: string
  lat?: number
  lng?: number
  machineId?: string
  machineName?: string
  operatorId?: string
  operatorName?: string
  status: OrderStatus
  pricePerMu?: number
  pricePerHour?: number
  totalPrice?: number
  actualArea?: number
  actualHours?: number
  arriveTime?: string
  finishTime?: string
  beforePhotos?: string[]
  afterPhotos?: string[]
  remark?: string
  createdAt: string
}

// 任务信息（机手视角）
export interface Task {
  id: string
  orderId: string
  orderNo: string
  machineId: string
  machineName: string
  farmerName: string
  address: string
  workType: WorkType
  area: number
  workDate: string
  startTime: string
  endTime: string
  sequence: number
  status: OrderStatus
  lat?: number
  lng?: number
}

// 结算信息
export interface Settlement {
  id: string
  orderId: string
  orderNo: string
  farmerName: string
  workType: WorkType
  area: number
  actualArea?: number
  actualHours?: number
  unitPrice: number
  unitType: 'mu' | 'hour'
  totalAmount: number
  subsidy?: number
  advanceAmount?: number
  paidAmount?: number
  unpaidAmount?: number
  fuelCost?: number
  operatorFee?: number
  profit?: number
  settleDate: string
  status: 'pending' | 'partial' | 'paid'
}

// 维修记录
export interface RepairRecord {
  id: string
  machineId: string
  machineName: string
  faultDesc: string
  reportTime: string
  repairTime?: string
  finishTime?: string
  cost?: number
  status: 'reported' | 'repairing' | 'done'
  replacementMachineId?: string
  replacementMachineName?: string
  remark?: string
}

// 保养记录
export interface MaintenanceRecord {
  id: string
  machineId: string
  machineName: string
  type: string
  date: string
  mileage?: number
  cost?: number
  nextDate?: string
  remark?: string
}

// 首页统计数据
export interface DashboardStats {
  todayOrders: number
  pendingDispatch: number
  inProgress: number
  pendingSettlement: number
  todayArea: number
  todayFuel: number
  todayIncome: number
}
