import type { Settlement, RepairRecord, MaintenanceRecord, DashboardStats } from '@/types'

export const mockSettlements: Settlement[] = [
  {
    id: 'S001',
    orderId: '6',
    orderNo: 'NJ240614006',
    farmerName: '赵大娘',
    workType: 'harvest',
    area: 4.5,
    actualArea: 4.5,
    unitPrice: 80,
    unitType: 'mu',
    totalAmount: 360,
    subsidy: 0,
    advanceAmount: 0,
    paidAmount: 360,
    unpaidAmount: 0,
    fuelCost: 45,
    operatorFee: 100,
    profit: 215,
    settleDate: '2024-06-14',
    status: 'paid'
  },
  {
    id: 'S002',
    orderId: '5',
    orderNo: 'NJ240614005',
    farmerName: '陈老汉',
    workType: 'harvest',
    area: 15.0,
    actualArea: 14.8,
    unitPrice: 80,
    unitType: 'mu',
    totalAmount: 1184,
    subsidy: 100,
    advanceAmount: 500,
    paidAmount: 500,
    unpaidAmount: 184,
    fuelCost: 148,
    operatorFee: 300,
    profit: 736,
    settleDate: '2024-06-14',
    status: 'partial'
  },
  {
    id: 'S003',
    orderId: '2',
    orderNo: 'NJ240615002',
    farmerName: '李婶',
    workType: 'harvest',
    area: 8.0,
    unitPrice: 80,
    unitType: 'mu',
    totalAmount: 640,
    fuelCost: 80,
    operatorFee: 160,
    profit: 400,
    settleDate: '2024-06-15',
    status: 'pending'
  },
  {
    id: 'S004',
    orderId: '1',
    orderNo: 'NJ240615001',
    farmerName: '张大爷',
    workType: 'harvest',
    area: 12.5,
    unitPrice: 80,
    unitType: 'mu',
    totalAmount: 1000,
    fuelCost: 125,
    operatorFee: 250,
    profit: 625,
    settleDate: '2024-06-15',
    status: 'pending'
  }
]

export const mockRepairRecords: RepairRecord[] = [
  {
    id: 'R001',
    machineId: 'M005',
    machineName: '常发-旋耕机',
    faultDesc: '旋耕刀磨损严重，作业效果差',
    reportTime: '2024-06-14 17:30',
    status: 'repairing',
    remark: '已联系维修人员明天上门'
  },
  {
    id: 'R002',
    machineId: 'M003',
    machineName: '东方红-收割机',
    faultDesc: '皮带异响，需要检查',
    reportTime: '2024-06-12 09:00',
    repairTime: '2024-06-12 14:00',
    finishTime: '2024-06-12 16:30',
    cost: 280,
    status: 'done',
    remark: '更换了皮带'
  }
]

export const mockMaintenanceRecords: MaintenanceRecord[] = [
  {
    id: 'MA001',
    machineId: 'M003',
    machineName: '东方红-收割机',
    type: '季度保养',
    date: '2024-06-01',
    mileage: 1250,
    cost: 680,
    nextDate: '2024-09-01',
    remark: '更换机油、滤芯、检查链条'
  },
  {
    id: 'MA002',
    machineId: 'M001',
    machineName: '东风-拖拉机',
    type: '月度保养',
    date: '2024-06-05',
    mileage: 860,
    cost: 320,
    nextDate: '2024-07-05',
    remark: '常规检查'
  }
]

export const mockDashboardStats: DashboardStats = {
  todayOrders: 5,
  pendingDispatch: 4,
  inProgress: 1,
  pendingSettlement: 2,
  todayArea: 28.5,
  todayFuel: 68.2,
  todayIncome: 2280
}

export interface SeasonSummary {
  totalOrders: number
  totalArea: number
  totalIncome: number
  totalFuelCost: number
  totalProfit: number
  avgPricePerMu: number
  topWorkType: { type: string; count: number; area: number }[]
  monthlyData: { month: string; income: number; area: number }[]
}

export const mockSeasonSummary: SeasonSummary = {
  totalOrders: 126,
  totalArea: 856.5,
  totalIncome: 68520,
  totalFuelCost: 12350,
  totalProfit: 42180,
  avgPricePerMu: 80,
  topWorkType: [
    { type: '收割', count: 58, area: 420.5 },
    { type: '旋地', count: 32, area: 218.0 },
    { type: '耕地', count: 18, area: 125.0 },
    { type: '播种', count: 12, area: 72.0 },
    { type: '插秧', count: 6, area: 21.0 }
  ],
  monthlyData: [
    { month: '5月上', income: 8520, area: 105 },
    { month: '5月下', income: 15680, area: 195 },
    { month: '6月上', income: 28200, area: 356 },
    { month: '6月下', income: 16120, area: 200.5 }
  ]
}
