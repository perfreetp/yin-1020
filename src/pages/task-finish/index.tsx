import React, { useState, useMemo } from 'react'
import { View, Text, Input, Textarea, Button, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import useAppStore from '@/store'
import { WorkTypeMap } from '@/types'
import { formatMu, formatMoney, calcOrderPrice, formatHours } from '@/utils/format'

const page: React.FC = () => {
  const router = useRouter()
  const taskId = router.params.taskId || ''

  const tasks = useAppStore((s) => s.tasks)
  const orders = useAppStore((s) => s.orders)
  const finishTask = useAppStore((s) => s.finishTask)

  const task = tasks.find((t) => t.id === taskId)
  const order = orders.find((o) => o.id === task?.orderId)

  // 计费方式：按亩/按小时
  const [chargeType, setChargeType] = useState<'mu' | 'hour'>('mu')
  const [actualVal, setActualVal] = useState<string>(order?.area?.toString() || '')
  const [beforePhotos, setBeforePhotos] = useState<string[]>([])
  const [afterPhotos, setAfterPhotos] = useState<string[]>([])
  const [remark, setRemark] = useState('')

  const estimatedPrice = useMemo(() => {
    const val = parseFloat(actualVal) || 0
    if (chargeType === 'mu') {
      return calcOrderPrice(val, order?.pricePerMu)
    } else {
      return calcOrderPrice(0, 0, val, order?.pricePerHour || 50)
    }
  }, [actualVal, chargeType, order])

  if (!task || !order) {
    return (
      <View className={styles.page}>
        <View style={{ padding: 80, textAlign: 'center', color: '#86909C' }}>
          任务不存在或已删除
        </View>
      </View>
    )
  }

  const handleChooseImage = (type: 'before' | 'after') => {
    Taro.chooseImage({
      count: 3,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const paths = res.tempFilePaths
        if (type === 'before') {
          setBeforePhotos((prev) => [...prev, ...paths].slice(0, 3))
        } else {
          setAfterPhotos((prev) => [...prev, ...paths].slice(0, 3))
        }
      },
      fail: (err) => {
        console.error('[TaskFinish] 选择图片失败:', err)
        // 降级：用占位图
        const placeholder = `https://picsum.photos/id/${200 + Math.floor(Math.random() * 50)}/400/300`
        if (type === 'before') {
          setBeforePhotos((prev) => [...prev, placeholder].slice(0, 3))
        } else {
          setAfterPhotos((prev) => [...prev, placeholder].slice(0, 3))
        }
      }
    })
  }

  const handleDelPhoto = (type: 'before' | 'after', idx: number) => {
    if (type === 'before') {
      setBeforePhotos((prev) => prev.filter((_, i) => i !== idx))
    } else {
      setAfterPhotos((prev) => prev.filter((_, i) => i !== idx))
    }
  }

  const handleQuickVal = (val: number) => {
    setActualVal(val.toString())
  }

  const handleSubmit = () => {
    const val = parseFloat(actualVal)
    if (!val || val <= 0) {
      Taro.showToast({ title: `请填写实际${chargeType === 'mu' ? '亩数' : '工时'}`, icon: 'none' })
      return
    }

    Taro.showModal({
      title: '确认完工',
      content: `确认作业完成？\n实际${chargeType === 'mu' ? `亩数：${val}亩` : `工时：${val}小时`}\n预估费用：¥${formatMoney(estimatedPrice)}`,
      confirmText: '确认完工',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          const actualArea = chargeType === 'mu' ? val : undefined
          const actualHours = chargeType === 'hour' ? val : undefined
          const settlement = finishTask(task.id, actualArea, actualHours, beforePhotos, afterPhotos)
          Taro.showToast({ title: '完工已登记', icon: 'success' })
          console.log('[TaskFinish] 完工提交:', { taskId: task.id, actualArea, actualHours, price: estimatedPrice, settleId: settlement?.id })
          // 写入高亮结算单ID，方便结算中心定位
          if (settlement) {
            try {
              Taro.setStorageSync('highlightSettleId', settlement.id)
            } catch (e) {}
          }
          setTimeout(() => {
            Taro.switchTab({ url: '/pages/settlement/index' })
          }, 1000)
        }
      }
    })
  }

  return (
    <View className={styles.page}>
      {/* 任务信息 */}
      <View className={styles.infoCard}>
        <View className={styles.cardTitle}>📋 任务信息</View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>农户姓名</Text>
          <Text className={styles.infoValue}>{task.farmerName}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>作业类型</Text>
          <Text className={styles.infoValue}>{WorkTypeMap[task.workType]}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>地块地址</Text>
          <Text className={styles.infoValue}>{task.address}</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>预约面积</Text>
          <Text className={styles.infoValue}>{formatMu(task.area)} 亩</Text>
        </View>
        <View className={styles.infoRow}>
          <Text className={styles.infoLabel}>作业机械</Text>
          <Text className={styles.infoValue}>{task.machineName}</Text>
        </View>
      </View>

      {/* 实际工作量 */}
      <View className={styles.formCard}>
        <View className={styles.formGroup}>
          <View className={styles.formLabel}>
            <Text className={styles.required}>*</Text>
            实际工作量
            <Text className={styles.formHint}>（完工后如实填写，按实际结算）</Text>
          </View>

          <View className={styles.typeSwitch}>
            <Text
              className={classnames(styles.switchItem, {
                [styles.switchItemActive]: chargeType === 'mu'
              })}
              onClick={() => {
                setChargeType('mu')
                setActualVal(order.area?.toString() || '')
              }}
            >
              按亩结算
            </Text>
            <Text
              className={classnames(styles.switchItem, {
                [styles.switchItemActive]: chargeType === 'hour'
              })}
              onClick={() => {
                setChargeType('hour')
                setActualVal('')
              }}
            >
              按时结算
            </Text>
          </View>

          <View className={styles.bigInput}>
            <Input
              type="digit"
              value={actualVal}
              onInput={(e) => setActualVal(e.detail.value)}
              placeholder="0"
              placeholderClass="text-placeholder"
              style={{
                flex: 1,
                fontSize: 48,
                fontWeight: 'bold',
                color: '#2E8B57',
                textAlign: 'center'
              }}
            />
            <Text className={styles.bigInputUnit}>
              {chargeType === 'mu' ? '亩' : '小时'}
            </Text>
          </View>

          <View className={styles.quickVals}>
            {chargeType === 'mu'
              ? [task.area * 0.9, task.area, task.area * 1.1].map((v, i) => (
                  <Text
                    key={i}
                    className={styles.quickVal}
                    onClick={() => handleQuickVal(Math.round(v * 10) / 10)}
                  >
                    {Math.round(v * 10) / 10} 亩
                  </Text>
                ))
              : [2, 3, 4, 5].map((v) => (
                  <Text key={v} className={styles.quickVal} onClick={() => handleQuickVal(v)}>
                    {v} 小时
                  </Text>
                ))}
          </View>
        </View>

        {/* 费用预估 */}
        <View className={styles.estimateBox}>
          <Text className={styles.estimateLabel}>预估结算费用</Text>
          <View className={styles.estimatePrice}>
            ¥{formatMoney(estimatedPrice)}
            <Text className={styles.yuan}>元</Text>
          </View>
        </View>
      </View>

      {/* 作业照片 */}
      <View className={styles.formCard}>
        <View className={styles.formGroup}>
          <View className={styles.formLabel}>📸 作业照片</View>

          <View className={styles.photoSection}>
            <View className={styles.photoLabel}>🌱 作业前照片（可选）</View>
            <View className={styles.photoList}>
              {beforePhotos.map((p, i) => (
                <View key={i} className={styles.photoItem}>
                  <Image className={styles.photoImg} src={p} mode="aspectFill" />
                  <View className={styles.photoDel} onClick={() => handleDelPhoto('before', i)}>
                    ×
                  </View>
                </View>
              ))}
              {beforePhotos.length < 3 && (
                <View className={styles.photoItem} onClick={() => handleChooseImage('before')}>
                  <Text className={styles.photoAdd}>➕</Text>
                </View>
              )}
            </View>
          </View>

          <View className={styles.photoSection}>
            <View className={styles.photoLabel}>🌾 作业后照片（可选）</View>
            <View className={styles.photoList}>
              {afterPhotos.map((p, i) => (
                <View key={i} className={styles.photoItem}>
                  <Image className={styles.photoImg} src={p} mode="aspectFill" />
                  <View className={styles.photoDel} onClick={() => handleDelPhoto('after', i)}>
                    ×
                  </View>
                </View>
              ))}
              {afterPhotos.length < 3 && (
                <View className={styles.photoItem} onClick={() => handleChooseImage('after')}>
                  <Text className={styles.photoAdd}>➕</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* 备注 */}
      <View className={styles.formCard}>
        <View className={styles.formGroup}>
          <View className={styles.formLabel}>📝 备注（选填）</View>
          <Textarea
            className={styles.remarkInput}
            placeholder="特殊情况说明，如天气影响、地块问题等"
            placeholderClass="text-placeholder"
            value={remark}
            onInput={(e) => setRemark(e.detail.value)}
            maxlength={200}
          />
        </View>
      </View>

      {/* 底部按钮 */}
      <View className={styles.bottomBar}>
        <Button className={styles.btnCancel} onClick={() => Taro.navigateBack()}>
          取消
        </Button>
        <Button className={styles.btnSubmit} onClick={handleSubmit}>
          确认完工
        </Button>
      </View>
    </View>
  )
}

export default page
