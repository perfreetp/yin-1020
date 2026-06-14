import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import MachineCard from '@/components/MachineCard'
import useAppStore from '@/store'
import type { Order, Machine, WorkType } from '@/types'
import { WorkTypeMap } from '@/types'
import { formatDistance } from '@/utils/format'

const WORK_FILTERS: { key: WorkType | 'all'; label: string }[] = [
  { key: 'all', label: '全部类型' },
  { key: 'harvest', label: '收割' },
  { key: 'rotary', label: '旋地' },
  { key: 'plow', label: '耕地' },
  { key: 'sow', label: '播种' },
  { key: 'transplant', label: '插秧' }
]

const requiredMachineType: Record<WorkType, string[]> = {
  harvest: ['harvester'],
  rotary: ['rotavator', 'tractor'],
  plow: ['tractor'],
  sow: ['seeder', 'tractor'],
  transplant: ['transplanter'],
  other: ['tractor']
}

const MAP_MARKERS = [
  { id: 'o1', type: 'order', top: '25%', left: '35%' },
  { id: 'o2', type: 'order', top: '60%', left: '68%' },
  { id: 'o3', type: 'order', top: '70%', left: '28%' },
  { id: 'o4', type: 'order', top: '40%', left: '80%' },
  { id: 'm1', type: 'machine', top: '35%', left: '50%' },
  { id: 'm2', type: 'machine', top: '55%', left: '45%' },
  { id: 'm3', type: 'machine', top: '45%', left: '20%' },
  { id: 'm4', type: 'machine', top: '75%', left: '58%' }
]

const VILLAGE_LABELS = [
  { label: '🏘️ 李家村', top: '15%', left: '20%' },
  { label: '🏘️ 王家村', top: '20%', left: '72%' },
  { label: '🏘️ 张家村', top: '78%', left: '18%' },
  { label: '🏘️ 陈家村', top: '82%', left: '75%' }
]

const MapDispatchPage: React.FC = () => {
  const orders = useAppStore((s) => s.orders)
  const machines = useAppStore((s) => s.machines)
  const dispatchOrder = useAppStore((s) => s.dispatchOrder)

  const [filterType, setFilterType] = useState<WorkType | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [tick, setTick] = useState(0)

  useDidShow(() => {
    setTick((t) => t + 1)
  })

  const pendingOrders = useMemo(() => {
    let list = orders.filter((o) => o.status === 'pending' || o.status === 'rescheduled')
    if (filterType !== 'all') list = list.filter((o) => o.workType === filterType)
    return list
  }, [orders, filterType, tick])

  const recommendedMachines = useMemo((): { machine: Machine; reason: string }[] => {
    if (!selectedOrder) return []
    const needTypes = requiredMachineType[selectedOrder.workType] || []
    return machines
      .filter((m) => m.status === 'idle')
      .map((m) => {
        let reason = ''
        const typeMatch = needTypes.includes(m.type)
        if (typeMatch) reason += '机型匹配 '
        if ((m.distance || 99999) < 1500) reason += '· 距离近 '
        if ((m.workCapacity || 0) >= (selectedOrder.area || 0)) reason += '· 日产能充足'
        if (!reason) reason = '可用设备'
        const score = (typeMatch ? 1000 : 0) + (3000 - (m.distance || 3000))
        return { machine: m, reason: reason.trim() || '可用设备', score }
      })
      .sort((a, b) => b.score - a.score)
  }, [selectedOrder, machines])

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order.id === selectedOrder?.id ? null : order)
  }

  const handleDispatch = (m: Machine) => {
    if (!selectedOrder) return
    Taro.showModal({
      title: '确认派工',
      content: `将【${m.name}】派给【${selectedOrder.farmerName}】的${selectedOrder.area}亩${WorkTypeMap[selectedOrder.workType]}任务？\n作业日期：${selectedOrder.workDate}`,
      confirmText: '确认派工',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          dispatchOrder(selectedOrder.id, m.id)
          Taro.showToast({ title: '派工成功', icon: 'success' })
          setSelectedOrder(null)
          console.log('[MapDispatch] 派工成功:', { orderId: selectedOrder.id, machineId: m.id })
          setTimeout(() => {
            Taro.switchTab({ url: '/pages/schedule/index' })
          }, 800)
        }
      }
    })
  }

  return (
    <View className={styles.page}>
      <ScrollView scrollX className={styles.filterBar} enhanced showScrollbar={false}>
        {WORK_FILTERS.map((f) => (
          <Text
            key={f.key}
            className={classnames(styles.filterChip, {
              [styles.filterChipActive]: filterType === f.key
            })}
            onClick={() => setFilterType(f.key)}
          >
            {f.label}
          </Text>
        ))}
      </ScrollView>

      {/* 模拟地图 */}
      <View className={styles.mapArea}>
        <View className={styles.mapGrid} />
        <View className={styles.mapRoad} />
        <View className={styles.mapRoad2} />
        {VILLAGE_LABELS.map((v, i) => (
          <Text key={i} className={styles.villageLabel} style={{ top: v.top, left: v.left }}>
            {v.label}
          </Text>
        ))}
        {pendingOrders.slice(0, 4).map((order, idx) => {
          const m = MAP_MARKERS.find((x) => x.id === `o${idx + 1}`)
          if (!m) return null
          return (
            <View
              key={order.id}
              className={classnames(styles.mapMarker, {
                [styles.markerSelected]: selectedOrder?.id === order.id
              })}
              style={{ top: m.top, left: m.left }}
              onClick={() => handleOrderSelect(order)}
            >
              <View className={classnames(styles.markerPin, styles.markerOrder)}>
                👨‍🌾 {idx + 1}
              </View>
            </View>
          )
        })}
        {machines
          .filter((m) => m.status === 'idle')
          .slice(0, 4)
          .map((m, idx) => {
            const mk = MAP_MARKERS.find((x) => x.id === `m${idx + 1}`)
            if (!mk) return null
            return (
              <View
                key={m.id}
                className={styles.mapMarker}
                style={{ top: mk.top, left: mk.left }}
              >
                <View className={styles.markerPulse} />
                <View className={classnames(styles.markerPin, styles.markerMachine)}>
                  🚜 {formatDistance(m.distance)}
                </View>
              </View>
            )
          })}
      </View>

      {/* 待派工订单横向列表 */}
      <View className={styles.ordersSection}>
        <View className={styles.sectionTitle}>
          <Text>待派工订单</Text>
          <Text className={styles.titleBadge}>{pendingOrders.length} 单待处理</Text>
        </View>
        <ScrollView scrollX enhanced showScrollbar={false} className={styles.ordersScroller}>
          {pendingOrders.length === 0 ? (
            <View style={{ padding: 32, color: '#86909C', fontSize: 26 }}>🎉 当前筛选条件下无待派工订单</View>
          ) : (
            pendingOrders.map((order, idx) => (
              <View
                key={order.id}
                className={classnames(styles.orderChip, {
                  [styles.orderChipActive]: selectedOrder?.id === order.id
                })}
                onClick={() => handleOrderSelect(order)}
              >
                <View className={styles.chipTop}>
                  <View className={styles.chipFarmer}>
                    <Text>#{idx + 1}</Text>
                    <Text>{order.farmerName}</Text>
                    <Text
                      style={{
                        fontSize: 22,
                        padding: '2rpx 10rpx',
                        background: 'rgba(46,139,87,0.08)',
                        color: '#2E8B57',
                        borderRadius: 8
                      }}
                    >
                      {WorkTypeMap[order.workType]}
                    </Text>
                  </View>
                </View>
                <View className={styles.chipArea}>
                  作业面积：<Text className={styles.num}>{order.area}</Text>亩
                </View>
                <View className={styles.chipAddr}>
                  📍 {order.village} · {order.address}
                </View>
                {order.status === 'rescheduled' && (
                  <View style={{ color: '#FA8C16', fontSize: 22, marginTop: 4 }}>
                    ⚠️ 已改期 · {order.remark?.slice(0, 12)}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* 推荐机械区 */}
      <View className={styles.recommendSection}>
        <View className={styles.recommendHeader}>
          <Text className={styles.recommendTitle}>
            {selectedOrder ? '🎯 智能推荐设备' : '请先选择一个订单'}
            {selectedOrder && <Text className={styles.titleHint}>（按匹配度+距离排序）</Text>}
          </Text>
          {selectedOrder && (
            <Text className={styles.selectedHint}>
              已选：{selectedOrder.farmerName}·{selectedOrder.area}亩
            </Text>
          )}
        </View>

        {!selectedOrder ? (
          <View className={styles.emptyHint}>👆 点击上方订单卡片或地图上的红色标记选择待派工订单</View>
        ) : recommendedMachines.length === 0 ? (
          <View className={styles.emptyHint}>😅 暂无可用设备，请考虑维修中的机械或联系外部支援</View>
        ) : (
          <ScrollView scrollY enhanced showScrollbar={false}>
            {recommendedMachines.map(({ machine, reason }, idx) => (
              <MachineCard
                key={machine.id}
                machine={{ ...machine, distance: machine.distance }}
                showRecommend={idx < 3}
                recommendReason={reason}
                showActions
                onDispatch={handleDispatch}
              />
            ))}
            <View style={{ height: 48 }} />
          </ScrollView>
        )}
      </View>
    </View>
  )
}

export default MapDispatchPage
