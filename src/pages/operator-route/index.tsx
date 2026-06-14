import React, { useMemo, useState, useEffect } from 'react'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import useAppStore from '@/store'
import type { Task, Machine } from '@/types'
import { WorkTypeMap } from '@/types'
import { formatMu } from '@/utils/format'

const OperatorRoutePage: React.FC = () => {
  const router = useRouter()
  const machineId = router.params.machineId || ''
  const date = router.params.date || new Date().toISOString().slice(0, 10)
  const initTaskIdxStr = router.params.taskIdx
  const initTaskId = router.params.taskId || ''

  const tasks = useAppStore((s) => s.tasks)
  const machines = useAppStore((s) => s.machines)
  const arriveTask = useAppStore((s) => s.arriveTask)
  const finishTask = useAppStore((s) => s.finishTask)

  const [currentIdx, setCurrentIdx] = useState<number>(0)
  const [scrollIntoId, setScrollIntoId] = useState<string>('')
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

  // 初始化 currentIdx：优先用 taskId 参数，其次 taskIdx，最后自动定位到第一个未完成任务
  useEffect(() => {
    if (dayTasks.length === 0) return
    let idx = -1
    if (initTaskId) {
      idx = dayTasks.findIndex((t) => t.id === initTaskId)
    }
    if (idx < 0 && initTaskIdxStr) {
      idx = parseInt(initTaskIdxStr, 10)
      if (idx < 0 || idx >= dayTasks.length) idx = -1
    }
    if (idx < 0) {
      // 找到第一个 working 或 未完成的
      idx = dayTasks.findIndex((t) => t.status === 'working')
      if (idx < 0) idx = dayTasks.findIndex((t) => t.status !== 'done' && t.status !== 'settled')
      if (idx < 0) idx = 0
    }
    setCurrentIdx(idx)
    // 延迟滚动到当前任务
    setTimeout(() => {
      if (dayTasks[idx]) {
        setScrollIntoId('task-item-' + dayTasks[idx].id)
        setTimeout(() => setScrollIntoId(''), 300)
      }
    }, 200)
  }, [dayTasks.length, machineId])

  const currentTask = dayTasks[currentIdx]

  const handlePrevTask = () => {
    if (currentIdx <= 0) return
    const nextIdx = currentIdx - 1
    setCurrentIdx(nextIdx)
    if (dayTasks[nextIdx]) {
      setScrollIntoId('task-item-' + dayTasks[nextIdx].id)
      setTimeout(() => setScrollIntoId(''), 300)
    }
  }

  const handleNextTask = () => {
    if (currentIdx >= dayTasks.length - 1) return
    const nextIdx = currentIdx + 1
    setCurrentIdx(nextIdx)
    if (dayTasks[nextIdx]) {
      setScrollIntoId('task-item-' + dayTasks[nextIdx].id)
      setTimeout(() => setScrollIntoId(''), 300)
    }
  }

  const handleCallOperator = () => {
    if (!machine?.operatorPhone) {
      Taro.showToast({ title: '暂无机手电话', icon: 'none' })
      return
    }
    Taro.makePhoneCall({
      phoneNumber: machine.operatorPhone,
      fail: () => {
        // 失败就展示号码
        Taro.showModal({
          title: '机手电话',
          content: machine.operatorPhone,
          showCancel: false,
          confirmText: '知道了'
        })
      }
    })
  }

  const handleNavigate = (task: Task) => {
    if (task.lat && task.lng) {
      Taro.openLocation({
        latitude: task.lat,
        longitude: task.lng,
        name: task.farmerName + '的地块',
        address: task.address,
        scale: 16
      })
    } else {
      // 用机械当前位置作为兜底，或者给个提示
      const fallbackLat = machine?.lat || 34.26
      const fallbackLng = machine?.lng || 108.94
      Taro.showModal({
        title: '导航到作业现场',
        content: `${task.farmerName}\n地址：${task.address}\n\n【提示】暂无精确坐标，将打开地图请手动搜索。`,
        confirmText: '打开地图',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            try {
              Taro.openLocation({
                latitude: fallbackLat,
                longitude: fallbackLng,
                name: task.farmerName + ' - ' + task.address,
                address: task.address,
                scale: 14
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
      content: `确认已到达【${task.farmerName}】的地块？\n地址：${task.address}`,
      confirmText: '确认到场',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          arriveTask(task.id)
          Taro.showToast({ title: '已登记到场', icon: 'success' })
          console.log('[OperatorRoute] 到场登记:', task.id)
          // 稍微延迟后触发刷新
          setTimeout(() => setTick((t) => t + 1), 300)
        }
      }
    })
  }

  const handleFinish = (task: Task) => {
    // 跳到完工确认页（可以填亩数/工时/照片）
    Taro.navigateTo({
      url: `/pages/task-finish/index?taskId=${task.id}`
    })
  }

  const handleTaskClick = (idx: number) => {
    setCurrentIdx(idx)
    if (dayTasks[idx]) {
      setScrollIntoId('task-item-' + dayTasks[idx].id)
      setTimeout(() => setScrollIntoId(''), 300)
    }
  }

  if (!machine) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 80, textAlign: 'center', color: '#86909C' }}>未找到该机械信息</View>
      </View>
    )
  }

  // 计算底部按钮
  const renderBottomBar = () => {
    if (!currentTask) return null
    const status = currentTask.status

    if (status === 'done' || status === 'settled') {
      return (
        <Button className={styles.btnNav} disabled>
          ✅ 本单已完成
        </Button>
      )
    }

    if (status === 'working') {
      return (
        <Button
          className={styles.btnNav}
          style={{ background: 'linear-gradient(135deg, #52C41A 0%, #2E8B57 100%)' }}
          onClick={() => handleFinish(currentTask)}
        >
          ✅ 登记完工
        </Button>
      )
    }

    // dispatched / arrived / rescheduled 等可到场状态
    return (
      <>
        <Button
          className={styles.btnNav}
          style={{ flex: 1, background: 'linear-gradient(135deg, #1890FF 0%, #40A9FF 100%)' }}
          onClick={() => handleNavigate(currentTask)}
        >
          🧭 导航
        </Button>
        <Button
          className={styles.btnNav}
          style={{ flex: 1.2 }}
          onClick={() => handleArrive(currentTask)}
        >
          📍 登记到场
        </Button>
      </>
    )
  }

  return (
    <View style={{ minHeight: '100vh', background: '#F5F7FA' }}>
      <ScrollView
        scrollY
        className={styles.page}
        enhanced
        showScrollbar={false}
        scroll-into-view={scrollIntoId}
        scroll-with-animation
      >
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
        <View className={styles.miniMapBox} onClick={() => currentTask && handleNavigate(currentTask)}>
          <Text className={styles.miniMapText}>
            🗺️ 今日路线 · 点击查看当前任务位置
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
              className={classnames(styles.switchBtn, { [styles.switchBtnDisabled]: currentIdx === 0 })}
              onClick={handlePrevTask}
              disabled={currentIdx === 0}
            >
              ◀ 上一单
            </Button>
            <View className={styles.switchInfo}>
              第 <Text style={{ fontWeight: 700, color: '#2E8B57' }}>{currentIdx + 1}</Text> / {dayTasks.length} 单
            </View>
            <Button
              className={classnames(styles.switchBtn, { [styles.switchBtnDisabled]: currentIdx === dayTasks.length - 1 })}
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

              // 计算 ETA
              let etaText = ''
              if (isWorking) etaText = '📍 正在进行'
              else if (isDone) etaText = '✅ 已完成'
              else if (idx < currentIdx) etaText = '✓ 已到访'
              else if (idx === currentIdx) etaText = '🎯 当前任务'
              else etaText = `预计 ${(idx - currentIdx) * 2} 小时后`

              return (
                <View
                  key={task.id}
                  id={'task-item-' + task.id}
                  className={styles.timelineItem}
                  onClick={() => handleTaskClick(idx)}
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
                        <Text>机手：{machine.operatorName}（{machine.operatorPhone || '暂无电话'}）</Text>
                      </View>
                      <View className={styles.taskRow}>
                        <Text>🚜</Text>
                        <Text>机械：{task.machineName}</Text>
                      </View>

                      {/* 快捷操作：当前任务显示 */}
                      {isActive && !isDone && (
                        <View style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
                          <Button
                            size="mini"
                            style={{
                              fontSize: 22,
                              padding: '6rpx 20rpx',
                              height: 52,
                              lineHeight: '52rpx',
                              borderRadius: 26,
                              background: 'linear-gradient(135deg, #1890FF, #40A9FF)',
                              color: '#fff',
                              border: 'none'
                            }}
                            onClick={(e) => { e.stopPropagation?.(); handleNavigate(task) }}
                          >
                            🧭 导航
                          </Button>
                          {task.status !== 'working' && (
                            <Button
                              size="mini"
                              style={{
                                fontSize: 22,
                                padding: '6rpx 20rpx',
                                height: 52,
                                lineHeight: '52rpx',
                                borderRadius: 26,
                                background: 'linear-gradient(135deg, #2E8B57, #52C41A)',
                                color: '#fff',
                                border: 'none'
                              }}
                              onClick={(e) => { e.stopPropagation?.(); handleArrive(task) }}
                            >
                              � 到场
                            </Button>
                          )}
                          {(task.status === 'working' || task.status === 'arrived') && (
                            <Button
                              size="mini"
                              style={{
                                fontSize: 22,
                                padding: '6rpx 20rpx',
                                height: 52,
                                lineHeight: '52rpx',
                                borderRadius: 26,
                                background: 'linear-gradient(135deg, #FA8C16, #FAAD14)',
                                color: '#fff',
                                border: 'none'
                              }}
                              onClick={(e) => { e.stopPropagation?.(); handleFinish(task) }}
                            >
                              ✅ 完工
                            </Button>
                          )}
                          <Button
                            size="mini"
                            style={{
                              fontSize: 22,
                              padding: '6rpx 20rpx',
                              height: 52,
                              lineHeight: '52rpx',
                              borderRadius: 26,
                              background: 'rgba(46, 139, 87, 0.08)',
                              color: '#2E8B57',
                              border: '2rpx solid #2E8B57'
                            }}
                            onClick={(e) => { e.stopPropagation?.(); handleCallOperator() }}
                          >
                            � 联系机手
                          </Button>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )
            })
          )}
        </View>

        <View style={{ height: 180 }} />
      </ScrollView>

      {/* 底部操作栏 */}
      {dayTasks.length > 0 && (
        <View className={styles.bottomBar}>
          <Button className={styles.btnCall} onClick={handleCallOperator}>
            📞
          </Button>
          {renderBottomBar()}
        </View>
      )}
    </View>
  )
}

export default OperatorRoutePage
