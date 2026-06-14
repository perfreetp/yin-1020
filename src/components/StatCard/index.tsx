import React from 'react'
import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

export interface StatCardProps {
  value: string | number
  label: string
  variant?: 'primary' | 'warning' | 'accent' | 'info'
  suffix?: string
  onClick?: () => void
}

const StatCard: React.FC<StatCardProps> = ({ value, label, variant = 'primary', suffix, onClick }) => {
  return (
    <View
      className={classnames(styles.statCard, {
        [styles.statWarning]: variant === 'warning',
        [styles.statAccent]: variant === 'accent',
        [styles.statInfo]: variant === 'info'
      })}
      onClick={onClick}
    >
      <Text className={styles.statValue}>
        {value}{suffix && <Text style={{ fontSize: 24, fontWeight: 500 }}>{suffix}</Text>}
      </Text>
      <Text className={styles.statLabel}>{label}</Text>
    </View>
  )
}

export default StatCard
