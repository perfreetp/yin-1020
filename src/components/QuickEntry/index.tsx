import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'

export interface QuickEntryItem {
  icon: string
  label: string
  colorType: 'green' | 'orange' | 'blue' | 'yellow' | 'red'
  path?: string
  onClick?: () => void
}

export interface QuickEntryProps {
  items: QuickEntryItem[]
}

const QuickEntry: React.FC<QuickEntryProps> = ({ items }) => {
  const handleClick = (item: QuickEntryItem) => {
    if (item.onClick) {
      item.onClick()
    } else if (item.path) {
      Taro.navigateTo({ url: item.path }).catch(err => {
        console.error('[QuickEntry] 跳转失败:', err)
      })
    }
  }

  return (
    <View className={styles.quickEntry}>
      <View className={styles.entryGrid}>
        {items.map((item, idx) => (
          <View
            key={idx}
            className={styles.entryItem}
            onClick={() => handleClick(item)}
          >
            <View
              className={classnames(styles.entryIcon, {
                [styles.iconGreen]: item.colorType === 'green',
                [styles.iconOrange]: item.colorType === 'orange',
                [styles.iconBlue]: item.colorType === 'blue',
                [styles.iconYellow]: item.colorType === 'yellow',
                [styles.iconRed]: item.colorType === 'red'
              })}
            >
              <Text>{item.icon}</Text>
            </View>
            <Text className={styles.entryLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default QuickEntry
