import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Textarea, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import OrderCard from '@/components/OrderCard'
import useAppStore from '@/store'
import type { Order } from '@/types'
import { WorkTypeMap } from '@/types'
import { formatDate } from '@/utils/format'

const REASON_TAGS = ['下雨', '大风', '高温', '地块太湿', '农户有事', '机械故障', '其他']

const gen7Days = () => {
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const now = new Date()
  const days: { date: string; day: number; month: number; week: string; label: string }[] = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(now.getTime() + i * 86400000)
    const m = d.getMonth() + 1
    const dd = d.getDate()
    const week = weekMap[d.getDay()]
    let label = ''
    if (i === 0) label = '今天'
    else if (i === 1) label = '明天'
    else if (i === 2) label = '后天'
    days.push({
      date: formatDate(d.toISOString()),
      day: dd,
      month: m,
      week,
      label
    })
  }
  return days
}

type TabType = 'pending' | 'dispatched'

const ReschedulePage: React.FC = () => {
  const orders = useAppStore((s) => s.orders)
  const rescheduleOrder = useAppStore((s) => s.rescheduleOrder)

  const [tab, setTab] = useState<TabType>('pending')
  const [showModal, setShowModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [newDate, setNewDate] = useState('')
  const [reasonTags, setReasonTags] = useState<string[]>([])
  const [reasonText, setReasonText] = useState('')

  const days14 = useMemo(() => gen7Days(), [])

  useDidShow(() => {
    // 页面显示时刷新
  })

  const list = useMemo(() => {
    if (tab === 'pending') {
      return orders.filter((o) => o.status === 'pending' || o.status === 'rescheduled')
    }
    return orders.filter((o) => o.status === 'dispatched')
  }, [orders, tab])

  const handleReschedule = (order: Order) => {
    setSelectedOrder(order)
    setNewDate('')
    setReasonTags([])
    setReasonText('')
    setShowModal(true)
  }

  const toggleReasonTag = (tag: string) => {
    setReasonTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = () => {
    if (!selectedOrder) return
    if (!newDate) {
      Taro.showToast({ title: '请选择新的作业日期', icon: 'none' })
      return
    }
    const reasons = [...reasonTags, reasonText.trim()].filter(Boolean).join('；')
    if (!reasons) {
      Taro.showToast({ title: '请填写改期原因', icon: 'none' })
      return
    }

    Taro.showModal({
      title: '确认改期',
      content: `将【${selectedOrder.farmerName}】的${WorkTypeMap[selectedOrder.workType]}任务\n从 ${selectedOrder.workDate} 改到 ${newDate}？\n改期原因：${reasons}`,
      confirmText: '确认改期',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          rescheduleOrder(selectedOrder.id, newDate, reasons)
          setShowModal(false)
          Taro.showToast({ title: '改期成功', icon: 'success' })
          console.log('[Reschedule] 改期成功:', selectedOrder.id, '→', newDate)
        }
      }
    })
  }

  return (
    <ScrollView scrollY className={styles.page} enhanced showScrollbar={false}>
      {/* Tab切换 */}
      <View className={styles.tabsBar}>
        <Text
          className={classnames(styles.tabItem, { [styles.tabItemActive]: tab === 'pending' })}
          onClick={() => setTab('pending')}
        >
          待派工（{orders.filter((o) => o.status === 'pending' || o.status === 'rescheduled').length}）
        </Text>
        <Text
          className={classnames(styles.tabItem, { [styles.tabItemActive]: tab === 'dispatched' })}
          onClick={() => setTab('dispatched')}
        >
          已派工（{orders.filter((o) => o.status === 'dispatched').length}）
        </Text>
      </View>

      {/* 列表 */}
      <View className={styles.listWrap}>
        {list.length === 0 ? (
          <View className={styles.emptyWrap}>
            <View className={styles.emptyIcon}>☀️</View>
            <View className={styles.emptyText}>
              当前{tab === 'pending' ? '暂无待派工订单' : '暂无已派工订单'}
            </View>
          </View>
        ) : (
          list.map((order) => (
            <View key={order.id} onClick={() => handleReschedule(order)}>
              <OrderCard order={order} />
              <View
                style={{
                  textAlign: 'center',
                  marginTop: -8,
                  marginBottom: 16,
                  fontSize: 24,
                  color: '#FA8C16'
                }}
              >
                点击改期 →
              </View>
            </View>
          ))
        )}
      </View>

      {/* 改期弹窗 */}
      {showModal && selectedOrder && (
        <View className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalTitle}>🌧️ 天气改期</View>

            {/* 订单信息 */}
            <View className={styles.orderInfoBox}>
              <View className={styles.infoLine}>
                <Text className={styles.infoLabel}>农户</Text>
                <Text className={styles.infoValue}>{selectedOrder.farmerName}</Text>
              </View>
              <View className={styles.infoLine}>
                <Text className={styles.infoLabel}>作业</Text>
                <Text className={styles.infoValue}>
                  {WorkTypeMap[selectedOrder.workType]} · {selectedOrder.area}亩
                </Text>
              </View>
              <View className={styles.infoLine}>
                <Text className={styles.infoLabel}>原日期</Text>
                <Text className={styles.infoValue}>
                  <Text className={styles.oldDate}>{selectedOrder.workDate}</Text>
                  <Text style={{ color: '#FA8C16' }}>→ 选择新日期</Text>
                </Text>
              </View>
              {selectedOrder.machineName && (
                <View className={styles.infoLine}>
                  <Text className={styles.infoLabel}>已派机械</Text>
                  <Text className={styles.infoValue}>{selectedOrder.machineName}</Text>
                </View>
              )}
            </View>

            {/* 新日期选择 */}
            <View className={styles.dateSection}>
              <View className={styles.sectionLabel}>
                <Text style={{ color: '#F5222D' }}>*</Text> 选择新的作业日期
              </View>
              <ScrollView scrollX enhanced showScrollbar={false} className={styles.dateScroller}>
                {days14.map((d) => (
                  <View
                    key={d.date}
                    className={classnames(styles.dateItem, {
                      [styles.dateItemActive]: newDate === d.date
                    })}
                    onClick={() => setNewDate(d.date)}
                  >
                    <Text className={styles.dateWeek}>{d.label || d.week}</Text>
                    <Text className={styles.dateDay}>{d.day}</Text>
                    <Text className={styles.dateMonth}>{d.month}月</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* 改期原因 */}
            <View className={styles.reasonSection}>
              <View className={styles.sectionLabel}>
                <Text style={{ color: '#F5222D' }}>*</Text> 改期原因
              </View>
              <View className={styles.reasonTags}>
                {REASON_TAGS.map((tag) => (
                  <Text
                    key={tag}
                    className={classnames(styles.reasonTag, {
                      [styles.reasonTagActive]: reasonTags.includes(tag)
                    })}
                    onClick={() => toggleReasonTag(tag)}
                  >
                    {tag}
                  </Text>
                ))}
              </View>
              <Textarea
                className={styles.reasonInput}
                placeholder="其他补充说明（选填）"
                placeholderClass="text-placeholder"
                value={reasonText}
                onInput={(e) => setReasonText(e.detail.value)}
                maxlength={100}
              />
            </View>

            {/* 底部按钮 */}
            <View className={styles.modalActions}>
              <Button className={classnames(styles.modalBtn, styles.btnCancel)} onClick={() => setShowModal(false)}>
                取消
              </Button>
              <Button className={classnames(styles.modalBtn, styles.btnConfirm)} onClick={handleSubmit}>
                确认改期
              </Button>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

export default ReschedulePage
