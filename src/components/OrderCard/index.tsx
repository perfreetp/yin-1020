import React from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import StatusTag from '@/components/StatusTag'
import type { Order } from '@/types'
import { WorkTypeMap } from '@/types'
import { formatMu, formatMoney, formatDate } from '@/utils/format'

export interface OrderCardProps {
  order: Order
  showActions?: boolean
  onDispatch?: (order: Order) => void
  onDetail?: (order: Order) => void
}

const OrderCard: React.FC<OrderCardProps> = ({ order, showActions = false, onDispatch, onDetail }) => {
  const handleCall = () => {
    Taro.makePhoneCall({ phoneNumber: order.farmerPhone }).catch(err => {
      console.error('[OrderCard] 拨号失败:', err)
    })
  }

  return (
    <View className={styles.orderCard} onClick={() => onDetail && onDetail(order)}>
      <View className={styles.cardHeader}>
        <Text className={styles.orderNo}>单号：{order.orderNo}</Text>
        <StatusTag type={order.status} />
      </View>

      <View className={styles.farmerRow}>
        <View className={styles.farmerIcon}>👨‍🌾</View>
        <View className={styles.farmerInfo}>
          <Text className={styles.farmerName}>{order.farmerName}</Text>
          <Text className={styles.workTypeBadge}>{WorkTypeMap[order.workType]}</Text>
        </View>
      </View>

      <View className={styles.infoRow}>
        <Text className={styles.infoIcon}>📍</Text>
        <Text className={styles.infoText}>{order.village} · {order.address}</Text>
      </View>

      <View className={styles.infoRow}>
        <Text className={styles.infoIcon}>📅</Text>
        <Text className={styles.infoText}>
          {formatDate(order.workDate)}
          {order.timeSlot && `（${order.timeSlot}）`}
          {order.cropType && ` · ${order.cropType}`}
        </Text>
      </View>

      {order.remark && (
        <View className={styles.infoRow}>
          <Text className={styles.infoIcon}>📝</Text>
          <Text className={styles.infoText}>{order.remark}</Text>
        </View>
      )}

      <View className={styles.divider} />

      <View className={styles.cardFooter}>
        <View className={styles.areaPrice}>
          <Text className={styles.areaText}>
            <Text className={styles.num}>{formatMu(order.area)}</Text>亩
          </Text>
          {order.totalPrice && (
            <Text className={styles.priceText}>
              ¥<Text className={styles.num}>{formatMoney(order.totalPrice)}</Text>
            </Text>
          )}
        </View>

        {showActions && (
          <View className={styles.actionArea}>
            <Button
              className={classnames(styles.btn, styles.btnOutline)}
              onClick={(e) => { e.stopPropagation(); handleCall() }}
            >
              联系
            </Button>
            {order.status === 'pending' && (
              <Button
                className={classnames(styles.btn, styles.btnPrimary)}
                onClick={(e) => { e.stopPropagation(); onDispatch && onDispatch(order) }}
              >
                去派工
              </Button>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

export default OrderCard
