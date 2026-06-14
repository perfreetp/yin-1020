import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'
import type {
  Order, Task, Machine, Settlement,
  RepairRecord, MaintenanceRecord, DashboardStats,
  WorkType, OrderStatus, MachineStatus
} from '@/types'
import { mockOrders } from '@/data/mockOrders'
import { mockMachines } from '@/data/mockMachines'
import { mockTasks } from '@/data/mockTasks'
import { mockSettlements, mockRepairRecords, mockMaintenanceRecords, mockDashboardStats } from '@/data/mockSettlements'
import { genOrderNo, calcOrderPrice, formatDate, formatTime } from '@/utils/format'

// 本地存储适配（Taro 的 setStorageSync/getStorageSync）
const taroStorage = {
  getItem: (name: string): string | null => {
    try {
      const val = Taro.getStorageSync(name)
      return val || null
    } catch (e) {
      console.error('[Store] storage getItem error:', e)
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      Taro.setStorageSync(name, value)
    } catch (e) {
      console.error('[Store] storage setItem error:', e)
    }
  },
  removeItem: (name: string): void => {
    try {
      Taro.removeStorageSync(name)
    } catch (e) {
      console.error('[Store] storage removeItem error:', e)
    }
  }
}

export interface AppState {
  // 数据
  orders: Order[]
  tasks: Task[]
  machines: Machine[]
  settlements: Settlement[]
  repairRecords: RepairRecord[]
  maintenanceRecords: MaintenanceRecord[]

  // ========== 订单相关 ==========
  addOrder: (order: Omit<Order, 'id' | 'orderNo' | 'status' | 'createdAt'> & { status?: OrderStatus }) => Order
  updateOrder: (id: string, updates: Partial<Order>) => void
  getOrdersByStatus: (status: OrderStatus) => Order[]
  getOrdersByDate: (date: string) => Order[]
  getOrderById: (id: string) => Order | undefined

  // ========== 派工相关 ==========
  dispatchOrder: (orderId: string, machineId: string, sequence?: number) => Task | null
  rescheduleOrder: (orderId: string, newDate: string, reason: string) => void

  // ========== 任务相关 ==========
  getTasksByDate: (date: string, machineId?: string) => Task[]
  getTasksByMachine: (machineId: string) => Task[]
  updateTask: (id: string, updates: Partial<Task>) => void
  arriveTask: (taskId: string) => void
  finishTask: (taskId: string, actualArea?: number, actualHours?: number, beforePhotos?: string[], afterPhotos?: string[]) => void

  // ========== 机械相关 ==========
  updateMachineStatus: (id: string, status: MachineStatus) => void
  getMachinesByType: (type: string) => Machine[]
  getAvailableMachines: (date: string, workType: WorkType) => Machine[]

  // ========== 结算相关 ==========
  createSettlementFromOrder: (orderId: string, actualArea?: number, actualHours?: number) => Settlement | null
  updateSettlement: (id: string, updates: Partial<Settlement>) => void
  markPaid: (id: string, amount?: number) => void
  markAdvance: (id: string, amount?: number) => void
  cancelAdvance: (id: string) => void

  // ========== 首页统计 ==========
  getDashboardStats: () => DashboardStats

  // ========== 维修保养 ==========
  addRepairRecord: (record: Omit<RepairRecord, 'id'>) => RepairRecord
  updateRepairRecord: (id: string, updates: Partial<RepairRecord>) => void

  // ========== 重置（开发用） ==========
  resetAll: () => void
}

const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ===== 初始数据 =====
      orders: mockOrders as Order[],
      tasks: mockTasks as Task[],
      machines: mockMachines as Machine[],
      settlements: mockSettlements as Settlement[],
      repairRecords: mockRepairRecords as RepairRecord[],
      maintenanceRecords: mockMaintenanceRecords as MaintenanceRecord[],

      // ===== 订单操作 =====
      addOrder: (orderData) => {
        const now = new Date().toISOString()
        const newOrder: Order = {
          ...orderData,
          id: 'order_' + Date.now(),
          orderNo: genOrderNo(),
          status: orderData.status || 'pending',
          createdAt: now
        } as Order
        set((state) => ({ orders: [newOrder, ...state.orders] }))
        console.log('[Store] addOrder:', newOrder.orderNo)
        return newOrder
      },

      updateOrder: (id, updates) => {
        set((state) => ({
          orders: state.orders.map((o) => (o.id === id ? { ...o, ...updates } : o))
        }))
        console.log('[Store] updateOrder:', id, updates)
      },

      getOrdersByStatus: (status) => {
        return get().orders.filter((o) => o.status === status)
      },

      getOrdersByDate: (date) => {
        return get().orders.filter((o) => o.workDate === date)
      },

      getOrderById: (id) => {
        return get().orders.find((o) => o.id === id)
      },

      // ===== 派工操作 =====
      dispatchOrder: (orderId, machineId, sequence) => {
        const { orders, machines, tasks } = get()
        const order = orders.find((o) => o.id === orderId)
        const machine = machines.find((m) => m.id === machineId)
        if (!order || !machine) {
          console.error('[Store] dispatchOrder: order or machine not found')
          return null
        }
        if (order.status !== 'pending' && order.status !== 'rescheduled') {
          console.error('[Store] dispatchOrder: order not pending')
          return null
        }

        // 计算该机械当日已有任务数，决定 sequence
        const todayTasks = tasks.filter(
          (t) => t.machineId === machineId && t.workDate === order.workDate
        )
        const seq = sequence ?? todayTasks.length + 1

        // 估算起止时间（上午8点起，每任务约1.5小时 + 路程30分钟）
        const startHour = 7 + seq * 2
        const startTime = `${Math.min(startHour, 17).toString().padStart(2, '0')}:00`
        const endHour = Math.min(startHour + 2, 19)
        const endTime = `${endHour.toString().padStart(2, '0')}:00`

        // 生成任务
        const newTask: Task = {
          id: 'task_' + Date.now(),
          orderId: order.id,
          orderNo: order.orderNo,
          machineId: machine.id,
          machineName: machine.name,
          farmerName: order.farmerName,
          address: order.address,
          workType: order.workType,
          area: order.area,
          workDate: order.workDate,
          startTime,
          endTime,
          sequence: seq,
          status: 'dispatched',
          lat: order.lat,
          lng: order.lng
        }

        // 更新订单状态
        const updatedOrder: Partial<Order> = {
          status: 'dispatched',
          machineId: machine.id,
          machineName: machine.name,
          operatorId: machine.operatorId,
          operatorName: machine.operatorName
        }

        // 更新机械状态
        const hasWorkingTask = tasks.some(
          (t) => t.machineId === machineId && t.workDate === order.workDate && t.status === 'working'
        )
        const newMachineStatus: MachineStatus = hasWorkingTask ? 'working' : 'reserved'

        set((state) => ({
          orders: state.orders.map((o) => (o.id === orderId ? { ...o, ...updatedOrder } : o)),
          tasks: [...state.tasks, newTask],
          machines: state.machines.map((m) =>
            m.id === machineId ? { ...m, status: newMachineStatus } : m
          )
        }))

        console.log('[Store] dispatchOrder success:', orderId, '→', machineId, 'seq=' + seq)
        return newTask
      },

      rescheduleOrder: (orderId, newDate, reason) => {
        const { orders, tasks } = get()
        const order = orders.find((o) => o.id === orderId)
        if (!order) return

        // 移除关联的任务
        const relatedTasks = tasks.filter((t) => t.orderId === orderId)

        set((state) => ({
          orders: state.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  workDate: newDate,
                  status: 'rescheduled',
                  remark: o.remark
                    ? `${o.remark}；改期原因：${reason}`
                    : `改期原因：${reason}（原日期：${o.workDate}）`
                }
              : o
          ),
          tasks: state.tasks.filter((t) => t.orderId !== orderId),
          // 机械状态恢复：如果该机械当天没有其他任务了，变回idle
          machines: state.machines.map((m) => {
            const remainingTasks = state.tasks
              .filter((t) => t.machineId === m.id && t.orderId !== orderId && t.workDate === newDate)
            if (m.status === 'reserved' && remainingTasks.length === 0) {
              return { ...m, status: 'idle' as MachineStatus }
            }
            return m
          })
        }))

        console.log('[Store] rescheduleOrder:', orderId, '→', newDate, 'reason:', reason)
      },

      // ===== 任务操作 =====
      getTasksByDate: (date, machineId) => {
        return get()
          .tasks.filter((t) => {
            if (t.workDate !== date) return false
            if (machineId && t.machineId !== machineId) return false
            return true
          })
          .sort((a, b) => a.sequence - b.sequence)
      },

      getTasksByMachine: (machineId) => {
        return get()
          .tasks.filter((t) => t.machineId === machineId)
          .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.sequence - b.sequence)
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t))
        }))
      },

      arriveTask: (taskId) => {
        const now = new Date().toISOString()
        const timeStr = formatTime(now)
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task) return state
          return {
            tasks: state.tasks.map((t) =>
              t.id === taskId ? { ...t, status: 'working' as OrderStatus, startTime: timeStr } : t
            ),
            orders: state.orders.map((o) =>
              o.id === task.orderId ? { ...o, status: 'working' as OrderStatus, arriveTime: now } : o
            ),
            machines: state.machines.map((m) =>
              m.id === task.machineId ? { ...m, status: 'working' as MachineStatus } : m
            )
          }
        })
        console.log('[Store] arriveTask:', taskId, timeStr)
      },

      finishTask: (taskId, actualArea, actualHours, beforePhotos, afterPhotos) => {
        const now = new Date().toISOString()
        const timeStr = formatTime(now)
        const { tasks, orders } = get()
        const task = tasks.find((t) => t.id === taskId)
        if (!task) return
        const order = orders.find((o) => o.id === task.orderId)
        if (!order) return

        const finalArea = actualArea ?? order.area
        const finalHours = actualHours

        set((state) => {
          // 更新任务
          const updatedTasks = state.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'done' as OrderStatus, endTime: timeStr } : t
          )

          // 更新订单
          const updatedOrders = state.orders.map((o) =>
            o.id === task.orderId
              ? {
                  ...o,
                  status: 'done' as OrderStatus,
                  finishTime: now,
                  actualArea: finalArea,
                  actualHours: finalHours,
                  beforePhotos: beforePhotos || o.beforePhotos,
                  afterPhotos: afterPhotos || o.afterPhotos
                }
              : o
          )

          // 更新机械状态：如果当天还有其他未完成任务，保持working；否则idle
          const machineRemainingTasks = updatedTasks.filter(
            (t) => t.machineId === task.machineId && t.workDate === task.workDate && t.status !== 'done' && t.status !== 'settled'
          )
          const newMachineStatus: MachineStatus =
            machineRemainingTasks.length > 0 ? 'working' : 'idle'

          const updatedMachines = state.machines.map((m) =>
            m.id === task.machineId ? { ...m, status: newMachineStatus } : m
          )

          // 生成待结算记录
          let newSettlements = state.settlements
          const existSettle = state.settlements.find((s) => s.orderId === task.orderId)
          if (!existSettle) {
            const unitType: 'mu' | 'hour' = order.pricePerMu ? 'mu' : 'hour'
            const unitPrice = order.pricePerMu || order.pricePerHour || 0
            const totalAmount = calcOrderPrice(finalArea, order.pricePerMu, finalHours, order.pricePerHour)
            const fuelCost = finalArea * (order.pricePerMu ? 1.2 : 0)
            const operatorFee = totalAmount * 0.25
            const profit = totalAmount - fuelCost - operatorFee

            const settlement: Settlement = {
              id: 'settle_' + Date.now(),
              orderId: order.id,
              orderNo: order.orderNo,
              farmerName: order.farmerName,
              workType: order.workType,
              area: order.area,
              actualArea: finalArea,
              actualHours: finalHours,
              unitPrice,
              unitType,
              totalAmount,
              subsidy: 0,
              advanceAmount: 0,
              paidAmount: 0,
              unpaidAmount: totalAmount,
              fuelCost,
              operatorFee,
              profit,
              settleDate: formatDate(now),
              status: 'pending'
            }
            newSettlements = [settlement, ...state.settlements]
            console.log('[Store] finishTask: auto-create settlement', settlement.id)
          }

          return {
            tasks: updatedTasks,
            orders: updatedOrders,
            machines: updatedMachines,
            settlements: newSettlements
          }
        })

        console.log('[Store] finishTask:', taskId, 'area=' + finalArea, 'hours=' + finalHours)
      },

      // ===== 机械操作 =====
      updateMachineStatus: (id, status) => {
        set((state) => ({
          machines: state.machines.map((m) => (m.id === id ? { ...m, status } : m))
        }))
      },

      getMachinesByType: (type) => {
        return get().machines.filter((m) => m.type === type)
      },

      getAvailableMachines: (date, workType) => {
        const { machines, tasks } = get()
        // 对应可做该作业的机械类型
        const typeMap: Record<WorkType, string[]> = {
          harvest: ['harvester'],
          rotary: ['rotavator', 'tractor'],
          plow: ['tractor'],
          sow: ['seeder', 'tractor'],
          transplant: ['transplanter'],
          other: ['tractor']
        }
        const validTypes = typeMap[workType] || []

        // 过滤：类型匹配 + 非维修中 + 当天没有排满（简单判断当天任务 < 5）
        return machines
          .filter((m) => {
            if (m.status === 'repair') return false
            if (validTypes.length > 0 && !validTypes.includes(m.type)) return false
            const dayTasks = tasks.filter((t) => t.machineId === m.id && t.workDate === date && t.status !== 'cancelled')
            return dayTasks.length < 5
          })
          .sort((a, b) => (a.distance || 99999) - (b.distance || 99999))
      },

      // ===== 结算操作 =====
      createSettlementFromOrder: (orderId, actualArea, actualHours) => {
        const { orders, settlements } = get()
        const order = orders.find((o) => o.id === orderId)
        if (!order) return null
        if (settlements.some((s) => s.orderId === orderId)) {
          return settlements.find((s) => s.orderId === orderId)!
        }

        const unitType: 'mu' | 'hour' = order.pricePerMu ? 'mu' : 'hour'
        const unitPrice = order.pricePerMu || order.pricePerHour || 0
        const area = actualArea ?? order.actualArea ?? order.area
        const hours = actualHours ?? order.actualHours
        const totalAmount = calcOrderPrice(area, order.pricePerMu, hours, order.pricePerHour)
        const fuelCost = (area || 0) * 1.2
        const operatorFee = totalAmount * 0.25
        const profit = totalAmount - fuelCost - operatorFee

        const settlement: Settlement = {
          id: 'settle_' + Date.now(),
          orderId: order.id,
          orderNo: order.orderNo,
          farmerName: order.farmerName,
          workType: order.workType,
          area: order.area,
          actualArea: area,
          actualHours: hours,
          unitPrice,
          unitType,
          totalAmount,
          subsidy: 0,
          advanceAmount: 0,
          paidAmount: 0,
          unpaidAmount: totalAmount,
          fuelCost,
          operatorFee,
          profit,
          settleDate: formatDate(new Date().toISOString()),
          status: 'pending'
        }

        set((state) => ({ settlements: [settlement, ...state.settlements] }))
        console.log('[Store] createSettlementFromOrder:', settlement.id)
        return settlement
      },

      updateSettlement: (id, updates) => {
        set((state) => ({
          settlements: state.settlements.map((s) => (s.id === id ? { ...s, ...updates } : s))
        }))
      },

      markPaid: (id, amount) => {
        const { settlements } = get()
        const s = settlements.find((x) => x.id === id)
        if (!s) return

        const payAmount = amount ?? (s.unpaidAmount || 0)
        const newPaid = (s.paidAmount || 0) + payAmount
        const newUnpaid = Math.max(0, (s.unpaidAmount || s.totalAmount) - payAmount)
        const newStatus: 'pending' | 'partial' | 'paid' =
          newUnpaid <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending'

        // 同步更新订单状态
        const orderId = s.orderId

        set((state) => ({
          settlements: state.settlements.map((x) =>
            x.id === id
              ? {
                  ...x,
                  paidAmount: newPaid,
                  unpaidAmount: newUnpaid,
                  status: newStatus
                }
              : x
          ),
          orders: state.orders.map((o) =>
            o.id === orderId
              ? { ...o, status: newStatus === 'paid' ? ('settled' as OrderStatus) : o.status }
              : o
          )
        }))
        console.log('[Store] markPaid:', id, payAmount, '→', newStatus)
      },

      markAdvance: (id, amount) => {
        const { settlements } = get()
        const s = settlements.find((x) => x.id === id)
        if (!s) return

        const advAmount = amount ?? (s.unpaidAmount || s.totalAmount || 0)
        const newAdvance = (s.advanceAmount || 0) + advAmount
        const newUnpaid = Math.max(0, (s.unpaidAmount || s.totalAmount) - advAmount)
        // 垫付后状态：如果全垫完了就是 advanced，否则还是 partial
        const newStatus: 'pending' | 'partial' | 'paid' | 'advanced' =
          newUnpaid <= 0 ? 'advanced' : newAdvance > 0 ? 'partial' : 'pending'

        set((state) => ({
          settlements: state.settlements.map((x) =>
            x.id === id
              ? {
                  ...x,
                  advanceAmount: newAdvance,
                  unpaidAmount: newUnpaid,
                  status: newStatus
                }
              : x
          )
        }))
        console.log('[Store] markAdvance:', id, advAmount, '→', newStatus)
      },

      cancelAdvance: (id) => {
        const { settlements } = get()
        const s = settlements.find((x) => x.id === id)
        if (!s) return

        const totalAmount = s.totalAmount || 0
        const paidAmount = s.paidAmount || 0
        const newUnpaid = totalAmount - paidAmount
        const newStatus: 'pending' | 'partial' | 'paid' | 'advanced' =
          paidAmount >= totalAmount ? 'paid' : paidAmount > 0 ? 'partial' : 'pending'

        set((state) => ({
          settlements: state.settlements.map((x) =>
            x.id === id
              ? {
                  ...x,
                  advanceAmount: 0,
                  unpaidAmount: newUnpaid,
                  status: newStatus
                }
              : x
          )
        }))
        console.log('[Store] cancelAdvance:', id)
      },

      // ===== 首页统计 =====
      getDashboardStats: (): DashboardStats => {
        const { orders, tasks, settlements } = get()
        const today = formatDate(new Date().toISOString())

        const todayOrders = orders.filter((o) => o.workDate === today)
        const pendingDispatch = orders.filter((o) => o.status === 'pending' || o.status === 'rescheduled').length
        const inProgress = orders.filter((o) => o.status === 'working').length

        const pendingSettlement = settlements.filter((s) => s.status !== 'paid').length

        // 今日已完成的面积和收入
        const doneToday = tasks.filter((t) => t.workDate === today && (t.status === 'done' || t.status === 'settled'))
        const todayArea = doneToday.reduce((sum, t) => sum + t.area, 0)
        const todayFuel = todayArea * 1.2

        const todayIncome = settlements
          .filter((s) => s.settleDate === today)
          .reduce((sum, s) => sum + (s.totalAmount || 0), 0)

        return {
          todayOrders: todayOrders.length,
          pendingDispatch,
          inProgress,
          pendingSettlement,
          todayArea: Math.round(todayArea * 10) / 10,
          todayFuel: Math.round(todayFuel * 10) / 10,
          todayIncome
        }
      },

      // ===== 维修保养 =====
      addRepairRecord: (record) => {
        const newRecord: RepairRecord = {
          ...record,
          id: 'repair_' + Date.now()
        }
        set((state) => ({ repairRecords: [newRecord, ...state.repairRecords] }))
        // 同步更新机械状态为repair
        set((state) => ({
          machines: state.machines.map((m) =>
            m.id === record.machineId ? { ...m, status: 'repair' as MachineStatus } : m
          )
        }))
        return newRecord
      },

      updateRepairRecord: (id, updates) => {
        set((state) => ({
          repairRecords: state.repairRecords.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          )
        }))
        // 如果修复完成，机械状态改回idle
        if (updates.status === 'done') {
          const { repairRecords, machines } = get()
          const record = repairRecords.find((r) => r.id === id)
          if (record) {
            set((state) => ({
              machines: state.machines.map((m) =>
                m.id === record.machineId ? { ...m, status: 'idle' as MachineStatus } : m
              )
            }))
          }
        }
      },

      // ===== 重置 =====
      resetAll: () => {
        set({
          orders: mockOrders as Order[],
          tasks: mockTasks as Task[],
          machines: mockMachines as Machine[],
          settlements: mockSettlements as Settlement[],
          repairRecords: mockRepairRecords as RepairRecord[],
          maintenanceRecords: mockMaintenanceRecords as MaintenanceRecord[]
        })
        console.log('[Store] resetAll done')
      }
    }),
    {
      name: 'farm-machine-store',
      storage: createJSONStorage(() => taroStorage),
      version: 1
    }
  )
)

export default useAppStore
