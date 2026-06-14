import React from 'react'
import { View, Text, Button } from '@tarojs/components'
import styles from './index.module.scss'
import StatusTag from '@/components/StatusTag'
import type { Machine } from '@/types'
import { MachineTypeMap } from '@/types'
import { formatDistance, formatMu } from '@/utils/format'

const typeIcons: Record<string, string> = {
  tractor: '🚜',
  rotavator: '🔧',
  seeder: '🌱',
  transplanter: '🌾',
  harvester: '🌽',
  truck: '🚚'
}

export interface MachineCardProps {
  machine: Machine
  showRecommend?: boolean
  recommendReason?: string
  showActions?: boolean
  onSelect?: (machine: Machine) => void
  onDispatch?: (machine: Machine) => void
}

const MachineCard: React.FC<MachineCardProps> = ({
  machine,
  showRecommend = false,
  recommendReason,
  showActions = false,
  onSelect,
  onDispatch
}) => {
  return (
    <View
      className={styles.machineCard}
      onClick={() => onSelect && onSelect(machine)}
    >
      <View className={styles.machineHeader}>
        <View className={styles.machineIcon}>
          {typeIcons[machine.type] || '🚜'}
        </View>
        <View className={styles.machineInfo}>
          <View style={{ display: 'flex', alignItems: 'center' }}>
            <Text className={styles.machineName}>{machine.name}</Text>
            {showRecommend && <Text className={styles.recommendBadge}>⭐ 推荐</Text>}
          </View>
          <Text className={styles.machineModel}>
            {MachineTypeMap[machine.type]} · {machine.model} · {machine.plateNo}
          </Text>
        </View>
        <StatusTag type={machine.status} />
      </View>

      <View className={styles.machineSpec}>
        <View className={styles.specItem}>
          <Text className={styles.specLabel}>机手：</Text>
          <Text className={styles.specValue}>{machine.operatorName}</Text>
        </View>
        <View className={styles.specItem}>
          <Text className={styles.specLabel}>日产能：</Text>
          <Text className={styles.specValue}>{formatMu(machine.workCapacity)}亩</Text>
        </View>
        {machine.distance !== undefined && (
          <View className={styles.specItem}>
            <Text className={styles.specLabel}>距离：</Text>
            <Text className={styles.specValue}>{formatDistance(machine.distance)}</Text>
          </View>
        )}
        <View className={styles.specItem}>
          <Text className={styles.specLabel}>车龄：</Text>
          <Text className={styles.specValue}>{new Date().getFullYear() - machine.year}年</Text>
        </View>
      </View>

      {showRecommend && recommendReason && (
        <View style={{ marginBottom: 16, padding: 16, background: 'rgba(250,140,22,0.06)', borderRadius: 12 }}>
          <Text style={{ fontSize: 24, color: '#FA8C16' }}>💡 {recommendReason}</Text>
        </View>
      )}

      {showActions && machine.status === 'idle' && (
        <View className={styles.cardFooter}>
          <View className={styles.operatorInfo}>
            <View className={styles.operatorAvatar}>👷</View>
            <Text className={styles.operatorName}>{machine.operatorName}</Text>
          </View>
          <Button
            className={styles.actionBtn}
            onClick={(e) => { e.stopPropagation(); onDispatch && onDispatch(machine) }}
          >
            派工
          </Button>
        </View>
      )}
    </View>
  )
}

export default MachineCard
