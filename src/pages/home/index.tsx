import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import styles from './index.module.scss'
import StatCard from '@/components/StatCard'
import QuickEntry from '@/components/QuickEntry'
import type { QuickEntryItem } from '@/components/QuickEntry'
import TaskTimeline from '@/components/TaskTimeline'
import OrderCard from '@/components/OrderCard'
import { mockDashboardStats } from '@/data/mockSettlements'
import { mockOrders } from '@/data/mockOrders'
import { mockMachines } from '@/data/mockMachines'
import { mockTasks, getTasksByDate } from '@/data/mockTasks'
import type { Order, Task } from '@/types'
import { formatMu, formatMoney, formatDate } from '@/utils/format'

const quickEntries: QuickEntryItem[] = [
  { icon: '📝', label: '农户下单', colorType: 'green', path: '/pages/order/index' },
  { icon: '🗺️', label: '地图派工', colorType: 'blue', path: '/pages/map-dispatch/index' },
  { icon: '📅', label: '机械日程', colorType: 'orange', path: '/pages/schedule/index' },
  { icon: '🔧', label: '维修保养', colorType: 'red', path: '/pages/maintenance/index' },
  { icon: '💰', label: '结算中心', colorType: 'yellow', path: '/pages/settlement/index' },
  { icon: '⛽', label: '油耗统计', colorType: 'green', onClick: () => Taro.showToast({ title: '油耗统计开发中', icon: 'none' }) },
  { icon: '📊', label: '经营汇总', colorType: 'blue', onClick: () => Taro.showToast({ title: '经营汇总开发中', icon: 'none' }) },
  { icon: '🌧️', label: '改期处理', colorType: 'orange', onClick: () => Taro.showToast({ title: '改期处理开发中', icon: 'none' }) }
]

const getGreeting = (): string => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

const getDateStr = (): string => {
  const d = new Date()
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
}

const HomePage: React.FC = () => {
  const today = formatDate(new Date().toISOString())
  const stats = mockDashboardStats
  const [tasks, setTasks] = useState<Task[]>(getTasksByDate(today, 'M003').concat(getTasksByDate(today, 'M001')))
  const [pendingOrders, setPendingOrders] = useState<Order[]>(mockOrders.filter(o => o.status === 'pending'))

  useDidShow(() => {
    // 页面显示时刷新数据
    setTasks(getTasksByDate(today, 'M003').concat(getTasksByDate(today, 'M001')))
    setPendingOrders(mockOrders.filter(o => o.status === 'pending'))
  })

  const repairMachine = useMemo(() => mockMachines.find(m => m.status === 'repair'), [])

  const handleStartTask = (task: Task) => {
    Taro.showModal({
      title: '确认到场',
      content: `确认到达【${task.farmerName}】的地块开始作业？`,
      confirmText: '确认到场',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'working' } : t))
          Taro.showToast({ title: '已记录到场', icon: 'success' })
          console.log('[Home] 到场记录:', task.id, new Date().toISOString())
        }
      }
    })
  }

  const handleFinishTask = (task: Task) => {
    Taro.showModal({
      title: '确认完工',
      content: `确认【${task.farmerName}】的作业完成？完工后将进入结算流程。`,
      confirmText: '确认完工',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'done' } : t))
          Taro.showToast({ title: '已记录完工', icon: 'success' })
          console.log('[Home] 完工记录:', task.id, new Date().toISOString())
        }
      }
    })
  }

  const handleDispatch = (order: Order) => {
    Taro.navigateTo({ url: '/pages/map-dispatch/index' }).catch(err => {
      console.error('[Home] 跳转派工失败:', err)
    })
  }

  return (
    <ScrollView scrollY className={styles.page} enhanced showScrollbar={false}>
      {/* 顶部头部 */}
      <View className={styles.header}>
        <Text className={styles.greeting}>{getGreeting()}，合作社管理员</Text>
        <View className={styles.coopName}>丰收农机合作社</View>
        <Text className={styles.dateText}>{getDateStr()} · 农忙三夏抢收季</Text>
      </View>

      {/* 统计卡片 */}
      <View className={styles.statsRow}>
        <StatCard value={stats.todayOrders} label="今日订单" variant="primary" />
        <StatCard value={stats.pendingDispatch} label="待派工" variant="warning" />
        <StatCard value={stats.inProgress} label="作业中" variant="accent" />
        <StatCard value={stats.pendingSettlement} label="待结算" variant="info" />
      </View>

      {/* 维修提醒 */}
      {repairMachine && (
        <View
          className={styles.reminderCard}
          style={{ marginTop: 32 }}
          onClick={() => Taro.navigateTo({ url: '/pages/maintenance/index' })}
        >
          <View className={styles.reminderIcon}>⚠️</View>
          <View className={styles.reminderContent}>
            <Text className={styles.reminderTitle}>机械故障提醒</Text>
            <Text className={styles.reminderText}>
              {repairMachine.name}维修中，请及时安排替换设备
            </Text>
          </View>
        </View>
      )}

      {/* 快速入口 */}
      <View className={styles.sectionTitle}>
        <Text className={styles.titleText}>快速操作</Text>
      </View>
      <View className={styles.quickEntryWrap}>
        <QuickEntry items={quickEntries} />
      </View>

      {/* 今日任务 */}
      <View className={styles.sectionTitle}>
        <Text className={styles.titleText}>📋 今日任务</Text>
        <Text
          className={styles.titleAction}
          onClick={() => Taro.switchTab({ url: '/pages/schedule/index' })}
        >
          查看全部
        </Text>
      </View>
      <View className={styles.timelineWrap}>
        <View className={styles.taskSectionCard}>
          <TaskTimeline
            tasks={tasks}
            showActions
            onStart={handleStartTask}
            onFinish={handleFinishTask}
          />
        </View>
      </View>

      {/* 待派工订单 */}
      <View className={styles.sectionTitle}>
        <Text className={styles.titleText}>📨 待派工订单</Text>
        <Text
          className={styles.titleAction}
          onClick={() => Taro.switchTab({ url: '/pages/order/index' })}
        >
          全部订单
        </Text>
      </View>
      <View className={styles.ordersSection}>
        {pendingOrders.length === 0 ? (
          <View className={styles.emptyHint}>🎉 暂无待派工订单</View>
        ) : (
          pendingOrders.slice(0, 3).map(order => (
            <OrderCard
              key={order.id}
              order={order}
              showActions
              onDispatch={handleDispatch}
            />
          ))
        )}
      </View>

      {/* 今日概况 */}
      <View className={styles.sectionTitle}>
        <Text className={styles.titleText}>📈 今日作业概况</Text>
      </View>
      <View className={styles.overviewCard}>
        <View className={styles.overviewGrid}>
          <View className={styles.overviewItem}>
            <View className={styles.overviewNum}>{formatMu(stats.todayArea)}</View>
            <View className={styles.overviewLabel}>作业面积(亩)</View>
          </View>
          <View className={styles.overviewItem}>
            <View className={styles.overviewNum + ' ' + styles.orange}>{formatMu(stats.todayFuel)}</View>
            <View className={styles.overviewLabel}>油耗(升)</View>
          </View>
          <View className={styles.overviewItem}>
            <View className={styles.overviewNum + ' ' + styles.blue}>¥{formatMoney(stats.todayIncome)}</View>
            <View className={styles.overviewLabel}>今日收入</View>
          </View>
        </View>
      </View>

      <View style={{ height: 64 }} />
    </ScrollView>
  )
}

export default HomePage
