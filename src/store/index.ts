import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import Taro from '@tarojs/taro'
import type {
  Order, Task, Machine, Settlement, SettlementPaymentLog,
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
  finishTask: (taskId: string, actualArea?: number, actualHours?: number, beforePhotos?: string[], afterPhotos?: string[]) => Settlement | null

  // ========== 机械相关 ==========
  updateMachineStatus: (id: string, status: MachineStatus) => void
  getMachinesByType: (type: string) => Machine[]
  getAvailableMachines: (date: string, workType: WorkType) => Machine[]

  // ========== 结算相关 ==========
  createSettlementFromOrder: (orderId: string, actualArea?: number, actualHours?: number) => Settlement | null
  updateSettlement: (id: string, updates: Partial<Settlement>) => void
  markPaid: (id: string, amount?: number, remark?: string) => void
  markAdvance: (id: string, amount?: number, remark?: string) => void
  cancelAdvance: (id: string, remark?: string) => void
  recordFarmerRepayment: (id: string, amount: number, remark?: string) => void

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

        const wasDispatched = order.status === 'dispatched' || order.status === 'working'
        const originalMachineId = order.machineId
        const originalMachineName = order.machineName

        // 移除旧任务（旧日期的）
        const oldRelatedTasks = tasks.filter((t) => t.orderId === orderId)

        set((state) => {
          // 构建新的任务集合：移除旧日期的旧任务
          let newTasks = state.tasks.filter((t) => t.orderId !== orderId)

          // 如果已派工且已派工，要在新日期重新生成新任务
          if (wasDispatched && originalMachineId) {
            // 计算新日期该机械已有任务数
            const seq = newTasks.filter(
              (t) => t.machineId === originalMachineId && t.workDate === newDate
            ).length + 1
            const startHour = 7 + seq * 2
            const startTime = `${Math.min(startHour, 17).toString().padStart(2, '0')}:00`
            const endHour = Math.min(startHour + 2, 19)
            const endTime = `${endHour.toString().padStart(2, '0')}:00`
            const rescheduledTask = {
              id: 'task_' + Date.now(),
              orderId: order.id,
              orderNo: order.orderNo,
              machineId: originalMachineId,
              machineName: originalMachineName || '',
              farmerName: order.farmerName,
              address: order.address,
              workType: order.workType,
              area: order.area,
              workDate: newDate,
              startTime,
              endTime,
              sequence: seq,
              status: 'dispatched',
              lat: order.lat,
              lng: order.lng
            } as Task
            newTasks = [...newTasks, rescheduledTask]
          }

          // 更新订单
          const newOrders = state.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  workDate: newDate,
                  status: wasDispatched ? ('dispatched' as OrderStatus) : ('rescheduled' as OrderStatus),
                  rescheduleReason: reason,
                  remark: o.remark
                    ? `${o.remark}；改期原因：${reason}（原日期：${o.workDate}）`
                    : `改期原因：${reason}（原日期：${o.workDate}）`
                }
              : o
          )

          // 重新计算每台机械的状态：
          // - 如果原机械状态：如果该机械在 有任务还没 done/没 cancelled 就 reserved/working
          const newMachines = state.machines.map((m) => {
            const mTasks = newTasks.filter((t) => t.machineId === m.id && t.status !== 'cancelled' && t.status !== 'done' && t.status !== 'settled')
            // 当日（今天）有 working 的就 working，否则有任务的 reserved，否则 idle
            const today = formatDate(new Date().toISOString())
            const todayMTasks = mTasks.filter((t) => t.workDate === today)
            if (todayMTasks.some((t) => t.status === 'working')) {
              return { ...m, status: 'working' as MachineStatus }
            } else if (mTasks.length > 0) {
              return { ...m, status: 'reserved' as MachineStatus }
            }
            return { ...m, status: 'idle' as MachineStatus }
          })

          return {
            orders: newOrders,
            tasks: newTasks,
            machines: newMachines
          }
        })

        console.log('[Store] rescheduleOrder:', orderId, '→', newDate, 'wasDispatched=' + wasDispatched, 'reason:', reason)
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
        if (!task) return null
        const order = orders.find((o) => o.id === task.orderId)
        if (!order) return null

        const finalArea = actualArea ?? order.area
        const finalHours = actualHours

        // 先计算 settlement（如果需要新建）
        let settlement: Settlement | null = null
        const existingSettlement = get().settlements.find((s) => s.orderId === task.orderId)
        if (!existingSettlement) {
          const unitType: 'mu' | 'hour' = order.pricePerMu ? 'mu' : 'hour'
          const unitPrice = order.pricePerMu || order.pricePerHour || 0
          const totalAmount = calcOrderPrice(finalArea, order.pricePerMu, finalHours, order.pricePerHour)
          const fuelCost = finalArea * (order.pricePerMu ? 1.2 : 0)
          const operatorFee = totalAmount * 0.25
          const profit = totalAmount - fuelCost - operatorFee

          settlement = {
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
            status: 'pending',
            paymentLogs: []
          }
        } else {
          settlement = existingSettlement
        }

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

          // 生成待结算记录（如果之前没有）
          let newSettlements = state.settlements
          if (settlement && !state.settlements.find((s) => s.id === settlement!.id)) {
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

        console.log('[Store] finishTask:', taskId, 'area=' + finalArea, 'hours=' + finalHours, 'settleId=' + settlement?.id)
        return settlement
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
          status: 'pending',
          paymentLogs: []
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

      markPaid: (id, amount, remark) => {
        const { settlements } = get()
        const s = settlements.find((x) => x.id === id)
        if (!s) return

        const payAmount = amount ?? (s.unpaidAmount || 0)
        const newPaid = (s.paidAmount || 0) + payAmount
        const newUnpaid = Math.max(0, (s.unpaidAmount || s.totalAmount) - payAmount)
        const newStatus: Settlement['status'] =
          newUnpaid <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending'

        // 流水
        const log: SettlementPaymentLog = {
          id: 'log_' + Date.now(),
          type: 'farmer_pay',
          amount: payAmount,
          time: new Date().toISOString(),
          remark: remark || '农户付款'
        }

        // 同步更新订单状态
        const orderId = s.orderId

        set((state) => ({
          settlements: state.settlements.map((x) =>
            x.id === id
              ? {
                  ...x,
                  paidAmount: newPaid,
                  unpaidAmount: newUnpaid,
                  status: newStatus,
                  paymentLogs: [...(x.paymentLogs || []), log]
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

      markAdvance: (id, amount, remark) => {
        const { settlements } = get()
        const s = settlements.find((x) => x.id === id)
        if (!s) return

        const advAmount = amount ?? (s.unpaidAmount || s.totalAmount || 0)
        const newAdvance = (s.advanceAmount || 0) + advAmount
        // 注意：垫付不算"农户已付"，paidAmount 不变
        const newPaid = s.paidAmount || 0
        // unpaid 减少（因为社里垫了）
        const newUnpaid = Math.max(0, (s.unpaidAmount || s.totalAmount) - advAmount)
        // 状态：如果 unpaid 已经没有了，说明账面上还清了，但农户还要还钱给社，所以 advanced
        const newStatus: Settlement['status'] =
          newUnpaid <= 0 ? 'advanced' : newPaid > 0 || newAdvance > 0 ? 'partial' : 'pending'

        const log: SettlementPaymentLog = {
          id: 'log_' + Date.now(),
          type: 'advance',
          amount: advAmount,
          time: new Date().toISOString(),
          remark: remark || '合作社垫付'
        }

        set((state) => ({
          settlements: state.settlements.map((x) =>
            x.id === id
              ? {
                  ...x,
                  advanceAmount: newAdvance,
                  paidAmount: newPaid,
                  unpaidAmount: newUnpaid,
                  status: newStatus,
                  paymentLogs: [...(x.paymentLogs || []), log]
                }
              : x
          )
        }))
        console.log('[Store] markAdvance:', id, advAmount, '→', newStatus)
      },

      cancelAdvance: (id, remark) => {
        const { settlements } = get()
        const s = settlements.find((x) => x.id === id)
        if (!s) return

        const cancelledAdvance = s.advanceAmount || 0
        // 取消垫付则 unpaid 加回去
        const newUnpaid = (s.unpaidAmount || 0) + cancelledAdvance
        const paid = s.paidAmount || 0
        // 如果新 unpaid >= total，就 pending；否则 partial；full paid
        const newStatus: Settlement['status'] =
          paid >= (s.totalAmount || 0) ? 'paid' : paid > 0 ? 'partial' : 'pending'

        const log: SettlementPaymentLog = {
          id: 'log_' + Date.now(),
          type: 'cancel_advance',
          amount: cancelledAdvance,
          time: new Date().toISOString(),
          remark: remark || '取消垫付'
        }

        set((state) => ({
          settlements: state.settlements.map((x) =>
            x.id === id
              ? {
                  ...x,
                  advanceAmount: 0,
                  unpaidAmount: newUnpaid,
                  status: newStatus,
                  paymentLogs: [...(x.paymentLogs || []), log]
                }
              : x
          )
        }))
        console.log('[Store] cancelAdvance:', id)
      },

      // 登记农户回款（针对已垫付的账单，农户把钱还给社里）
      recordFarmerRepayment: (id, amount, remark) => {
        const { settlements } = get()
        const s = settlements.find((x) => x.id === id)
        if (!s) return
        if (!s.advanceAmount || s.advanceAmount <= 0) {
          console.warn('[Store] recordFarmerRepayment: no advance to repay', id)
          return
        }

        const repay = Math.min(amount, s.advanceAmount)
        const newAdvance = (s.advanceAmount || 0) - repay
        // 回款相当于社里把垫付收回来了，paidAmount + repay（农户真实支付了）
        const newPaid = (s.paidAmount || 0) + repay
        // unpaid 已经在垫付时扣了，所以 unpaid 不变
        const unpaid = s.unpaidAmount || 0
        const total = s.totalAmount || 0
        // 状态：如果 paid + advance(剩余) >= total 且 newAdvance==0，就 paid
        const newStatus: Settlement['status'] =
          newPaid >= total ? 'paid' : newPaid > 0 || newAdvance > 0 ? 'partial' : 'pending'

        const log: SettlementPaymentLog = {
          id: 'log_' + Date.now(),
          type: 'farmer_pay',
          amount: repay,
          time: new Date().toISOString(),
          remark: remark || '农户还垫付'
        }

        set((state) => ({
          settlements: state.settlements.map((x) =>
            x.id === id
              ? {
                  ...x,
                  advanceAmount: newAdvance,
                  paidAmount: newPaid,
                  unpaidAmount: unpaid,
                  status: newStatus,
                  paymentLogs: [...(x.paymentLogs || []), log]
                }
              : x
          )
        }))
        console.log('[Store] recordFarmerRepayment:', id, repay, '→ status=' + newStatus)
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
