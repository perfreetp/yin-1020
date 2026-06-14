import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import StatusTag from '@/components/StatusTag'
import { mockMachines } from '@/data/mockMachines'
import { mockTasks, getTasksByMachine } from '@/data/mockTasks'
import type { Machine, MachineStatus, Task, OrderStatus } from '@/types'
import { MachineTypeMap } from '@/types'
import { formatDate, formatMu } from '@/utils/format'

const typeIcons: Record<string, string> = {
  tractor: '🚜',
  rotavator: '🔄',
  seeder: '🌱',
  transplanter: '🌾',
  harvester: '🌽',
  truck: '🚚'
}

const FILTERS: { key: MachineStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'idle', label: '空闲' },
  { key: 'working', label: '作业中' },
  { key: 'repair', label: '维修中' }
]

const gen7Days = () => {
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const now = new Date()
  const days: { date: string; label: string; day: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000)
    const m = d.getMonth() + 1
    const dd = d.getDate()
    let label = ''
    if (i === 0) label = '今天'
    else if (i === 1) label = '明天'
    else if (i === 2) label = '后天'
    else label = weekMap[d.getDay()]
    days.push({
      date: formatDate(d.toISOString()),
      label,
      day: `${m}/${dd}`
    })
  }
  return days
}

const taskBlockClass = (status: OrderStatus) => {
  if (status === 'working') return styles.taskBarWorking
  if (status === 'done' || status === 'settled') return styles.taskBarDone
  return ''
}

const SchedulePage: React.FC = () => {
  const days7 = useMemo(() => gen7Days(), [])
  const [currentDate, setCurrentDate] = useState(days7[0].date)
  const [filter, setFilter] = useState<MachineStatus | 'all'>('all')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['M003']))

  const summary = useMemo(() => {
    const all = mockMachines
    return {
      total: all.length,
      idle: all.filter(m => m.status === 'idle').length,
      working: all.filter(m => m.status === 'working').length,
      repair: all.filter(m => m.status === 'repair').length
    }
  }, [])

  const filteredMachines = useMemo(() => {
    if (filter === 'all') return mockMachines
    return mockMachines.filter(m => m.status === filter)
  }, [filter])

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setExpandedIds(newSet)
  }

  const getMachineTasks = (machineId: string): Task[] => {
    return getTasksByMachine(machineId).filter(t => t.workDate === currentDate)
  }

  const handleDispatch = (m: Machine) => {
    if (m.status !== 'idle' && m.status !== 'reserved') {
      Taro.showToast({ title: '该设备当前不可用', icon: 'none' })
      return
    }
    Taro.navigateTo({ url: '/pages/map-dispatch/index' })
  }

  const handleRepair = (m: Machine) => {
    Taro.showActionSheet({
      itemList: ['查看维修记录', '登记新故障'],
      success: (res) => {
        if (res.tapIndex === 1) {
          Taro.navigateTo({ url: '/pages/maintenance/index' })
        } else {
          Taro.navigateTo({ url: '/pages/maintenance/index' })
        }
      }
    })
  }

  const handleTaskDetail = (task: Task) => {
    Taro.showModal({
      title: `${task.farmerName} - ${task.area}亩`,
      content: `地址：${task.address}\n时间：${task.startTime}-${task.endTime}\n机械：${task.machineName}`,
      confirmText: '去导航',
      confirmColor: '#2E8B57',
      cancelText: '关闭',
      success: (res) => {
        if (res.confirm && task.lat && task.lng) {
          Taro.openLocation({
            latitude: task.lat,
            longitude: task.lng,
            name: task.farmerName + '的地',
            address: task.address
          })
        }
      }
    })
  }

  return (
    <ScrollView scrollY className={styles.page} enhanced showScrollbar={false}>
      {/* 日期滚动条 */}
      <ScrollView scrollX className={styles.dateBar} enhanced showScrollbar={false}>
        {days7.map(d => (
          <Text
            key={d.date}
            className={classnames(styles.dateChip, {
              [styles.dateChipActive]: currentDate === d.date
            })}
            onClick={() => setCurrentDate(d.date)}
          >
            {d.label} {d.day}
          </Text>
        ))}
      </ScrollView>

      {/* 概览统计 */}
      <View className={styles.summaryBar}>
        <View className={styles.summaryItem}>
          <View className={styles.summaryNum} style={{ color: '#1D2129' }}>{summary.total}</View>
          <View className={styles.summaryLabel}>机械总数</View>
        </View>
        <View className={styles.summaryItem}>
          <View className={styles.summaryNum} style={{ color: '#1890FF' }}>{summary.idle}</View>
          <View className={styles.summaryLabel}>空闲</View>
        </View>
        <View className={styles.summaryItem}>
          <View className={styles.summaryNum} style={{ color: '#FA8C16' }}>{summary.working}</View>
          <View className={styles.summaryLabel}>作业中</View>
        </View>
        <View className={styles.summaryItem}>
          <View className={styles.summaryNum} style={{ color: '#F5222D' }}>{summary.repair}</View>
          <View className={styles.summaryLabel}>维修</View>
        </View>
      </View>

      {/* 筛选Tab */}
      <View className={styles.filterTabs}>
        {FILTERS.map(f => (
          <Text
            key={f.key}
            className={classnames(styles.tabItem, {
              [styles.tabItemActive]: filter === f.key
            })}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Text>
        ))}
      </View>

      {/* 机械列表 */}
      <View className={styles.listWrap}>
        {filteredMachines.length === 0 ? (
          <View className={styles.emptyWrap}>
            <View className={styles.emptyIcon}>📭</View>
            <View className={styles.emptyText}>当前筛选条件下暂无机械</View>
          </View>
        ) : (
          filteredMachines.map(m => {
            const isExpanded = expandedIds.has(m.id)
            const tasks = getMachineTasks(m.id)
            return (
              <View key={m.id} className={styles.machineCard}>
                <View className={styles.machineHeader} onClick={() => toggleExpand(m.id)}>
                  <View className={styles.machineIcon}>
                    {typeIcons[m.type] || '🚜'}
                  </View>
                  <View className={styles.machineInfo}>
                    <View style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Text className={styles.machineName}>{m.name}</Text>
                      <StatusTag type={m.status} />
                    </View>
                    <Text className={styles.machineSub}>
                      {MachineTypeMap[m.type]} · {m.plateNo} · {m.operatorName}
                    </Text>
                  </View>
                  <Text className={classnames(styles.arrow, { [styles.arrowUp]: isExpanded })}>
                    ▼
                  </Text>
                </View>

                {isExpanded && (
                  <View className={styles.scheduleBody}>
                    <View className={styles.sectionSubTitle}>
                      <Text>📅 当日排班</Text>
                      <Text className={styles.taskCount}>共 {tasks.length} 个任务</Text>
                    </View>

                    {tasks.length === 0 ? (
                      m.status === 'repair' ? (
                        <View className={styles.freeBlock}>
                          <Text className={styles.freeText}>🔧 维修中，暂停排班</Text>
                        </View>
                      ) : (
                        <View className={styles.freeBlock}>
                          <Text className={styles.freeText}>✅ 当日全天空闲，可立即派工</Text>
                        </View>
                      )
                    ) : (
                      <View className={styles.simpleTimeline}>
                        {tasks.map(t => (
                          <View
                            key={t.id}
                            className={styles.taskBlock}
                            onClick={() => handleTaskDetail(t)}
                          >
                            <View>
                              <Text className={styles.taskTime}>{t.startTime}</Text>
                              <Text className={styles.taskTimeRange}>~{t.endTime}</Text>
                            </View>
                            <View className={classnames(styles.taskBar, taskBlockClass(t.status))}>
                              <Text className={styles.taskName}>
                                第{t.sequence}单 · {t.farmerName} · {formatMu(t.area)}亩
                              </Text>
                              <Text className={styles.taskDesc}>{t.address}</Text>
                            </View>
                            <StatusTag type={t.status} />
                          </View>
                        ))}
                      </View>
                    )}

                    <View className={styles.cardActions}>
                      {m.status === 'repair' ? (
                        <>
                          <Button className={classnames(styles.actionBtn, styles.btnOutline)} onClick={() => handleRepair(m)}>
                            查看维修
                          </Button>
                          <Button
                            className={classnames(styles.actionBtn, styles.btnPrimary)}
                            onClick={() => Taro.navigateTo({ url: '/pages/maintenance/index' })}
                          >
                            安排替换
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            className={classnames(styles.actionBtn, styles.btnOutline)}
                            onClick={() => Taro.makePhoneCall({ phoneNumber: '138' + Math.floor(Math.random()*100000000) }).catch(()=>{})}
                          >
                            联系机手
                          </Button>
                          <Button className={classnames(styles.actionBtn, styles.btnPrimary)} onClick={() => handleDispatch(m)}>
                            立即派工
                          </Button>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </View>
            )
          })
        )}
      </View>

      <View style={{ height: 64 }} />
    </ScrollView>
  )
}

export default SchedulePage
