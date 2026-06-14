import React from 'react'
import { Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'
import {
  OrderStatus, OrderStatusMap,
  MachineStatus, MachineStatusMap
} from '@/types'

export type TagType =
  | OrderStatus
  | MachineStatus
  | 'reported' | 'repairing'
  | 'paid' | 'partial'

const typeMap: Record<TagType, string> = {
  ...OrderStatusMap,
  ...MachineStatusMap,
  reported: '待维修',
  repairing: '维修中',
  paid: '已付清',
  partial: '部分付'
}

export interface StatusTagProps {
  type: TagType
  text?: string
}

const StatusTag: React.FC<StatusTagProps> = ({ type, text }) => {
  const displayText = text || typeMap[type] || type
  const classNameMap: Record<string, string> = {
    pending: styles.tagPending,
    dispatched: styles.tagDispatched,
    working: styles.tagWorking,
    done: styles.tagDone,
    settled: styles.tagSettled,
    cancelled: styles.tagCancelled,
    rescheduled: styles.tagRescheduled,
    idle: styles.tagIdle,
    repair: styles.tagRepair,
    reserved: styles.tagReserved,
    reported: styles.tagReported,
    repairing: styles.tagRepairing,
    done_repair: styles.tagRepairDone,
    paid: styles.tagPaid,
    partial: styles.tagPartial
  }

  let cls = classNameMap[type]
  if (type === 'done' && !text) cls = styles.tagDone
  if (type === 'repair') cls = styles.tagRepair

  return (
    <Text className={classnames(styles.statusTag, cls)}>
      {displayText}
    </Text>
  )
}

export default StatusTag
