import React from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import StatusTag from '@/components/StatusTag'
import type { Task, OrderStatus } from '@/types'
import { WorkTypeMap } from '@/types'
import { formatMu } from '@/utils/format'

export interface TaskTimelineProps {
  tasks: Task[]
  showActions?: boolean
  onStart?: (task: Task) => void
  onFinish?: (task: Task) => void
  onNavigate?: (task: Task) => void
}

const getDotClass = (status: OrderStatus): string => {
  if (status === 'working') return styles.dotWorking
  if (status === 'done' || status === 'settled') return styles.dotDone
  return styles.dotPending
}

const getLineClass = (status: OrderStatus): string => {
  if (status === 'done' || status === 'settled') return styles.lineDone
  return ''
}

const TaskTimeline: React.FC<TaskTimelineProps> = ({ tasks, showActions = false, onStart, onFinish, onNavigate }) => {
  if (tasks.length === 0) {
    return (
      <View style={{ padding: 48, textAlign: 'center' }}>
        <Text style={{ fontSize: 28, color: '#86909C' }}>📭 暂无任务安排</Text>
      </View>
    )
  }

  const handleNavigate = (task: Task) => {
    if (onNavigate) {
      onNavigate(task)
    } else if (task.lat && task.lng) {
      Taro.openLocation({
        latitude: task.lat,
        longitude: task.lng,
        name: task.farmerName + '的地',
        address: task.address
      }).catch(err => {
        console.error('[TaskTimeline] 导航失败:', err)
      })
    }
  }

  return (
    <View className={styles.timeline}>
      {tasks.map((task, idx) => {
        const isLast = idx === tasks.length - 1
        return (
          <View key={task.id} className={styles.timelineItem}>
            <View className={styles.timelineLeft}>
              <Text className={styles.timeText}>{task.startTime}</Text>
              <Text className={styles.durationText}>至 {task.endTime}</Text>
            </View>

            <View className={styles.timelineMiddle}>
              <View className={classnames(styles.dot, getDotClass(task.status))} />
              {!isLast && <View className={classnames(styles.line, getLineClass(task.status))} />}
            </View>

            <View className={styles.timelineRight}>
              <View className={styles.taskCard}>
                <View className={styles.taskTop}>
                  <View style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <Text className={styles.seqNo}>{task.sequence}</Text>
                    <Text className={styles.taskTitle}>{task.farmerName}</Text>
                  </View>
                  <StatusTag type={task.status} />
                </View>

                <View className={styles.taskMeta}>
                  <Text className={styles.metaIcon}>📍</Text>
                  <Text style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.address}
                  </Text>
                </View>

                <View className={styles.taskMeta}>
                  <Text className={styles.metaIcon}>🔧</Text>
                  <Text>{WorkTypeMap[task.workType]} · {task.machineName}</Text>
                </View>

                <View className={styles.taskBottom}>
                  <Text className={styles.areaText}>{formatMu(task.area)} 亩</Text>
                  {showActions && (
                    <View className={styles.taskActions}>
                      <Button
                        className={styles.actionBtnOutline}
                        onClick={() => handleNavigate(task)}
                      >
                        导航
                      </Button>
                      {task.status === 'dispatched' && (
                        <Button
                          className={styles.actionBtn}
                          onClick={() => onStart && onStart(task)}
                        >
                          到场
                        </Button>
                      )}
                      {task.status === 'working' && (
                        <Button
                          className={styles.actionBtn}
                          onClick={() => onFinish && onFinish(task)}
                        >
                          完工
                        </Button>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

export default TaskTimeline
