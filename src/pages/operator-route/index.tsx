import React, { useMemo, useState } from 'react'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import useAppStore from '@/store'
import type { Task, Machine } from '@/types'
import { WorkTypeMap } from '@/types'
import { formatMu, formatDateTime } from '@/utils/format'

const OperatorRoutePage: React.FC = () => {
  const router = useRouter()
  const machineId = router.params.machineId || ''
  const date = router.params.date || new Date().toISOString().slice(0, 10)
  const initTaskIdx = parseInt(router.params.taskIdx || '0', 10) || 0

  const tasks = useAppStore((s) => s.tasks)
  const machines = useAppStore((s) => s.machines)
  const arriveTask = useAppStore((s) => s.arriveTask)
  const finishTask = useAppStore((s) => s.finishTask)

  const [currentIdx, setCurrentIdx] = useState(initTaskIdx)
  const [tick, setTick] = useState(0)

  useDidShow(() => {
    setTick((t) => t + 1)
  })

  const machine: Machine | undefined = useMemo(
    () => machines.find((m) => m.id === machineId),
    [machines]
  )

  // 该机械当天所有任务（按 sequence 排序）
  const dayTasks: Task[] = useMemo(() => {
    return tasks
      .filter((t) => t.machineId === machineId && t.workDate === date && t.status !== 'cancelled')
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
  }, [tasks, machineId, date, tick])

  const totalArea = useMemo(() => dayTasks.reduce((s, t) => s + (t.area || 0), 0), [dayTasks])

  const handlePrevTask = () => {
    setCurrentIdx((i) => Math.max(0, i - 1))
  }

  const handleNextTask = () => {
    setCurrentIdx((i) => Math.min(dayTasks.length - 1, i + 1))
  }

  const handleCallOperator = () => {
    if (!machine?.operatorPhone) {
      Taro.showToast({ title: '暂无联系电话', icon: 'none' })
      return
    }
    Taro.makePhoneCall({
      phoneNumber: machine.operatorPhone,
      fail: () => {
        Taro.showToast({ title: `机手电话：${machine.operatorPhone}`, icon: 'none' })
      }
    })
  }

  const handleNavigate = (task: Task) => {
    if (task.lat && task.lng) {
      Taro.openLocation({
        latitude: task.lat,
        longitude: task.lng,
        name: task.farmerName + '的地块',
        address: task.address
      })
    } else {
      // 模拟：用静态定位兜底
      Taro.showModal({
        title: '导航到作业现场',
        content: `${task.farmerName} - ${task.address}\n\n【模拟】该任务暂未配置经纬度，可手动输入地址：`,
        editable: true,
        placeholderText: '请输入详细地址',
        confirmText: '打开地图',
        success: (res) => {
          if (res.confirm) {
            // 微信小程序没有 searchLocation，降级：尝试用默认坐标打开
            try {
              Taro.openLocation({
                latitude: 32.0603,
                longitude: 118.7969,
                name: res.content || task.address,
                address: task.address,
                scale: 16
              })
            } catch (e) {
              Taro.showToast({ title: '地图未就绪', icon: 'none' })
            }
          }
        }
      })
    }
  }

  const handleArrive = (task: Task) => {
    Taro.showModal({
      title: '确认到场',
      content: `确认已到达 ${task.farmerName} 的地块？`,
      confirmText: '确认到场',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          arriveTask(task.id)
          Taro.showToast({ title: '已登记到场', icon: 'success' })
        }
      }
    })
  }

  const handleFinish = (task: Task) => {
    Taro.navigateTo({
      url: `/pages/task-finish/index?taskId=${task.id}`,
      fail: () => {
        // 降级
        Taro.showModal({
          title: '确认完工',
          content: `确认 ${task.farmerName} 的 ${task.area} 亩作业已完成？`,
          confirmText: '确认完工',
          confirmColor: '#2E8B57',
          success: (res) => {
            if (res.confirm) {
              finishTask(task.id)
              Taro.showToast({ title: '完工已登记', icon: 'success' })
            }
          }
        })
      }
    })
  }

  if (!machine) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 80, textAlign: 'center', color: '#86909C' }}>未找到该机械信息</View>
      </View>
    )
  }

  return (
    <ScrollView scrollY className={styles.page} enhanced showScrollbar={false}>
      {/* 机手信息卡 */}
      <View className={styles.operatorCard}>
        <View className={styles.operatorTop}>
          <View className={styles.operatorAvatar}>👨‍🌾</View>
          <View className={styles.operatorInfo}>
            <View className={styles.operatorName}>{machine.operatorName}</View>
            <View className={styles.operatorSub}>
              {machine.name} · {machine.plateNo}
            </View>
          </View>
          <View className={styles.operatorPhone} onClick={handleCallOperator}>
            📞 联系
          </View>
        </View>
        <View className={styles.operatorStats}>
          <View className={styles.statItem}>
            <View className={styles.statNum}>{dayTasks.length}</View>
            <View className={styles.statLabel}>任务数</View>
          </View>
          <View className={styles.statItem}>
            <View className={styles.statNum}>{formatMu(totalArea)}</View>
            <View className={styles.statLabel}>总面积</View>
          </View>
          <View className={styles.statItem}>
            <View className={styles.statNum}>
              {dayTasks.filter((t) => t.status === 'done' || t.status === 'settled').length}
            </View>
            <View className={styles.statLabel}>已完成</View>
          </View>
        </View>
      </View>

      {/* 迷你地图预览 */}
      <View className={styles.miniMapBox}>
        <Text className={styles.miniMapText}>
          🗺️ 今日路线预览 · {date}
        </Text>
      </View>

      {/* 路线总览 */}
      <View className={styles.routeBar}>
        <View className={styles.routeLabel}>
          🚜 预计总里程
        </View>
        <View className={styles.routeValue}>
          ~{(dayTasks.length * 2.3).toFixed(1)} 公里
        </View>
      </View>

      {/* 前后任务切换 */}
      {dayTasks.length > 1 && (
        <View className={styles.switchTaskBar}>
          <Button
            className={classnames(styles.switchBtn, { [styles.switchBtnActive]: currentIdx === 0 })}
            onClick={handlePrevTask}
            disabled={currentIdx === 0}
          >
            ◀ 上一单
          </Button>
          <Button
            className={styles.switchBtn}
            disabled
          >
            第 {currentIdx + 1} / {dayTasks.length} 单
          </Button>
          <Button
            className={classnames(styles.switchBtn, { [styles.switchBtnActive]: currentIdx === dayTasks.length - 1 })}
            onClick={handleNextTask}
            disabled={currentIdx === dayTasks.length - 1}
          >
            下一单 ▶
          </Button>
        </View>
      )}

      {/* 任务时间轴 */}
      <View className={styles.routeTimeline}>
        {dayTasks.length === 0 ? (
          <View style={{ padding: 80, textAlign: 'center', color: '#86909C' }}>
            今日无排单
          </View>
        ) : (
          dayTasks.map((task, idx) => {
            const isActive = idx === currentIdx
            const isDone = task.status === 'done' || task.status === 'settled'
            const isWorking = task.status === 'working'
            // 计算 ETA（当前在做的为"现在"，后面的按每单+2小时估算）
            let etaText = ''
            if (isWorking) etaText = '📍 正在进行'
            else if (isDone) etaText = '✅ 已完成'
            else if (idx <= currentIdx) etaText = '⏰ 已到访'
            else etaText = `预计 ${(idx - currentIdx) * 2} 小时后`

            return (
              <View
                key={task.id}
                className={styles.timelineItem}
                onClick={() => setCurrentIdx(idx)}
              >
                <View
                  className={classnames(styles.timelineDot, {
                    [styles.timelineDotDone]: isDone && !isWorking,
                    [styles.timelineDotActive]: isWorking || isActive
                  })}
                >
                  {isDone ? '✓' : idx + 1}
                </View>
                <View className={styles.timelineBody}>
                  <View className={styles.timelineTime}>
                    <Text className={styles.timeStart}>{task.startTime}</Text>
                    <Text className={styles.timeTilde}>~</Text>
                    <Text className={styles.timeEnd}>{task.endTime}</Text>
                    <Text className={styles.timelineETA}>{etaText}</Text>
                  </View>
                  <View
                    className={classnames(styles.timelineCard, {
                      [styles.timelineCardActive]: isActive || isWorking
                    })}
                  >
                    <View className={styles.taskTitle}>
                      <Text>{task.farmerName} · {formatMu(task.area)}</Text>
                      <Text
                        className={classnames(styles.taskBadge, {
                          [styles.taskBadgeActive]: isActive || isWorking
                        })}
                      >
                        {WorkTypeMap[task.workType]}
                      </Text>
                    </View>
                    <View className={styles.taskRow}>
                      <Text>📍</Text>
                      <Text className={styles.taskRowMain}>{task.address}</Text>
                    </View>
                    <View className={styles.taskRow}>
                      <Text>📞</Text>
                      <Text>电话：（点击顶部联系机手按钮可拨打）</Text>
                    </View>
                    <View className={styles.taskRow}>
                      <Text>🚜</Text>
                      <Text>机械：{task.machineName}</Text>
                    </View>
                    <View className={styles.taskRow}>
                      <Text>🕒</Text>
                      <Text>作业时段：{task.startTime} - {task.endTime}</Text>
                    </View>
                    {(isActive || isWorking) && task.status !== 'done' && task.status !== 'settled' && (
                      <View className={styles.taskStatusHint}>
                        {isWorking
                          ? '⏱️ 作业进行中，完成后可登记完工'
                          : '🎯 下一站，点击下方按钮导航或登记到场'}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )
          })
        )}
      </View>

      <View style={{ height: 160 }} />
    </ScrollView>

    {/* 底部操作栏：只有当有选中任务且未完成时显示 */}
    {dayTasks.length > 0 && (
      <View className={styles.bottomBar}>
        <Button className={styles.btnCall} onClick={handleCallOperator}>
          📞
        </Button>
        {(() => {
          const cur = dayTasks[currentIdx]
          if (!cur) return null
          if (cur.status === 'done' || cur.status === 'settled') {
            return (
              <Button className={styles.btnNav} disabled>
                ✅ 已完成
              </Button>
            )
          }
          if (cur.status === 'working') {
            return (
              <Button className={styles.btnNav} onClick={() => handleFinish(cur)}>
                ✅ 登记完工
              </Button>
            )
          }
          if (cur.status === 'dispatched' || cur.status === 'arrived') {
            return (
              <>
                <Button className={styles.btnNav} onClick={() => handleNavigate(cur)}>
                  🧭 导航到现场
                </Button>
                <Button
                  className={styles.btnNav}
                  style={{ background: 'linear-gradient(135deg, #1890FF 0%, #40A9FF 100%)' }}
                  onClick={() => handleArrive(cur)}
                >
                  📍 登记到场
                </Button>
              </>
            )
          }
          return (
            <Button className={styles.btnNav} onClick={() => handleNavigate(cur)}>
              🧭 导航到现场
            </Button>
          )
        })()}
      </View>
    )}
  )
}

export default OperatorRoutePage
