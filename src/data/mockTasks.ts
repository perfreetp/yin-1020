import type { Task } from '@/types'

export const mockTasks: Task[] = [
  {
    id: 'T001',
    orderId: '1',
    orderNo: 'NJ240615001',
    machineId: 'M003',
    machineName: '东方红-收割机',
    farmerName: '张大爷',
    address: '李家村3组东头地块',
    workType: 'harvest',
    area: 12.5,
    workDate: '2024-06-15',
    startTime: '08:00',
    endTime: '10:30',
    sequence: 1,
    status: 'working',
    lat: 34.2612,
    lng: 108.9402
  },
  {
    id: 'T002',
    orderId: '2',
    orderNo: 'NJ240615002',
    machineId: 'M003',
    machineName: '东方红-收割机',
    farmerName: '李婶',
    address: '王家村2组西大田',
    workType: 'harvest',
    area: 8.0,
    workDate: '2024-06-15',
    startTime: '14:00',
    endTime: '15:30',
    sequence: 2,
    status: 'dispatched',
    lat: 34.2712,
    lng: 108.9502
  },
  {
    id: 'T003',
    orderId: '3',
    orderNo: 'NJ240615003',
    machineId: 'M001',
    machineName: '东风-拖拉机',
    farmerName: '刘大叔',
    address: '张家村1组南地块',
    workType: 'rotary',
    area: 6.5,
    workDate: '2024-06-15',
    startTime: '09:00',
    endTime: '10:30',
    sequence: 1,
    status: 'pending',
    lat: 34.2512,
    lng: 108.9302
  },
  {
    id: 'T004',
    orderId: '5',
    orderNo: 'NJ240614005',
    machineId: 'M002',
    machineName: '雷沃-收割机',
    farmerName: '陈老汉',
    address: '陈家村4组东大地块',
    workType: 'harvest',
    area: 15.0,
    workDate: '2024-06-14',
    startTime: '08:00',
    endTime: '10:30',
    sequence: 1,
    status: 'done',
    lat: 34.2412,
    lng: 108.9202
  },
  {
    id: 'T005',
    orderId: '6',
    orderNo: 'NJ240614006',
    machineId: 'M003',
    machineName: '东方红-收割机',
    farmerName: '赵大娘',
    address: '王家村3组南坡地',
    workType: 'harvest',
    area: 4.5,
    workDate: '2024-06-14',
    startTime: '14:00',
    endTime: '15:20',
    sequence: 2,
    status: 'settled',
    lat: 34.2752,
    lng: 108.9552
  }
]

export const getTasksByDate = (date: string, machineId?: string): Task[] => {
  return mockTasks.filter(t => {
    if (t.workDate !== date) return false
    if (machineId && t.machineId !== machineId) return false
    return true
  }).sort((a, b) => a.sequence - b.sequence)
}

export const getTasksByMachine = (machineId: string): Task[] => {
  return mockTasks.filter(t => t.machineId === machineId).sort((a, b) => {
    return a.workDate.localeCompare(b.workDate) || a.sequence - b.sequence
  })
}
