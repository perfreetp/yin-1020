import React, { useState, useMemo } from 'react'
import { View, Text, Input, Textarea, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import type { WorkType } from '@/types'
import { WorkTypeMap } from '@/types'
import { calcOrderPrice, formatMoney } from '@/utils/format'
import useAppStore from '@/store'

const WORK_TYPES: { type: WorkType; icon: string; price: number }[] = [
  { type: 'plow', icon: '🚜', price: 60 },
  { type: 'rotary', icon: '🔄', price: 50 },
  { type: 'sow', icon: '🌱', price: 30 },
  { type: 'transplant', icon: '🌾', price: 120 },
  { type: 'harvest', icon: '🌽', price: 80 },
  { type: 'other', icon: '📋', price: 0 }
]

const TIME_SLOTS = [
  { key: 'morning', label: '上午' },
  { key: 'afternoon', label: '下午' },
  { key: 'fullday', label: '全天' }
]

const CROPS = ['小麦', '玉米', '水稻', '大豆', '花生', '其他']

const VILLAGES = ['李家村', '王家村', '张家村', '陈家村', '刘家村', '赵家村']

interface Farmer {
  id: string
  name: string
  icon: string
}

const COMMON_FARMERS: Farmer[] = [
  { id: 'F001', name: '张大爷', icon: '👨‍🌾' },
  { id: 'F002', name: '李婶', icon: '👩‍🌾' },
  { id: 'F003', name: '刘大叔', icon: '👴' },
  { id: 'F004', name: '王大姐', icon: '👩' }
]

const gen7Days = () => {
  const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const days: { date: string; day: number; month: number; week: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getTime() + i * 86400000)
    const m = d.getMonth() + 1
    const day = d.getDate()
    const week = weekMap[d.getDay()]
    let label = ''
    if (i === 0) label = '今天'
    else if (i === 1) label = '明天'
    else if (i === 2) label = '后天'
    days.push({
      date: `${d.getFullYear()}-${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
      day, month: m, week, label
    })
  }
  return days
}

const OrderPage: React.FC = () => {
  const days7 = useMemo(() => gen7Days(), [])
  const addOrder = useAppStore((s) => s.addOrder)

  const [workType, setWorkType] = useState<WorkType | ''>('harvest')
  const [workTypePrice, setWorkTypePrice] = useState<number>(80)
  const [farmerId, setFarmerId] = useState<string>('')
  const [farmerName, setFarmerName] = useState<string>('')
  const [farmerPhone, setFarmerPhone] = useState<string>('')
  const [area, setArea] = useState<string>('')
  const [crop, setCrop] = useState<string>('小麦')
  const [selectedDate, setSelectedDate] = useState<string>(days7[0].date)
  const [timeSlot, setTimeSlot] = useState<string>('morning')
  const [village, setVillage] = useState<string>('')
  const [address, setAddress] = useState<string>('')
  const [remark, setRemark] = useState<string>('')
  const [showSuccess, setShowSuccess] = useState(false)
  const [newOrderNo, setNewOrderNo] = useState('')
  const [newOrderId, setNewOrderId] = useState('')

  const estimatedPrice = useMemo(() => {
    const a = parseFloat(area) || 0
    return calcOrderPrice(a, workTypePrice)
  }, [area, workTypePrice])

  const handleWorkTypeSelect = (item: { type: WorkType; price: number }) => {
    setWorkType(item.type)
    setWorkTypePrice(item.price)
  }

  const handleFarmerSelect = (f: Farmer) => {
    setFarmerId(f.id)
    setFarmerName(f.name)
  }

  const validateForm = (): string => {
    if (!workType) return '请选择作业类型'
    if (!farmerName.trim()) return '请填写农户姓名'
    if (!area || parseFloat(area) <= 0) return '请填写地块面积'
    if (!selectedDate) return '请选择作业日期'
    if (!village) return '请选择所属村组'
    if (!address.trim()) return '请填写详细地址'
    return ''
  }

  const handleSubmit = () => {
    const err = validateForm()
    if (err) {
      Taro.showToast({ title: err, icon: 'none' })
      return
    }
    if (!workType) return
    const areaNum = parseFloat(area) || 0
    const timeSlotMap: Record<string, string> = {
      morning: '上午',
      afternoon: '下午',
      fullday: '全天'
    }
    const newOrder = addOrder({
      farmerId: farmerId || 'new_' + Date.now(),
      farmerName: farmerName.trim(),
      farmerPhone,
      village,
      address: address.trim(),
      workType,
      cropType: (workType === 'sow' || workType === 'transplant' || workType === 'harvest') ? crop : undefined,
      area: areaNum,
      workDate: selectedDate,
      timeSlot: timeSlotMap[timeSlot],
      pricePerMu: workTypePrice || undefined,
      totalPrice: estimatedPrice || undefined,
      remark: remark.trim() || undefined
    })
    setNewOrderNo(newOrder.orderNo)
    setNewOrderId(newOrder.id)
    setShowSuccess(true)
    console.log('[Order] 下单成功:', newOrder.orderNo, newOrder.id)
  }

  const resetForm = () => {
    setWorkType('')
    setWorkTypePrice(0)
    setFarmerId('')
    setFarmerName('')
    setFarmerPhone('')
    setArea('')
    setCrop('')
    setSelectedDate(days7[0].date)
    setTimeSlot('morning')
    setVillage('')
    setAddress('')
    setRemark('')
  }

  const handleContinue = () => {
    setShowSuccess(false)
    resetForm()
    Taro.showToast({ title: '继续下单', icon: 'none' })
  }

  const handleGoDispatch = () => {
    setShowSuccess(false)
    resetForm()
    Taro.switchTab({
      url: '/pages/map-dispatch/index',
      success: () => {
        // 延时触发 tabBar 页面内的高亮逻辑（用 storage 传）
        try {
          Taro.setStorageSync('highlightOrderId', newOrderId)
        } catch (e) {}
      }
    })
  }

  const handleSelectVillage = () => {
    Taro.showActionSheet({
      itemList: VILLAGES,
      success: (res) => setVillage(VILLAGES[res.tapIndex])
    })
  }

  return (
    <ScrollView scrollY className={styles.page} enhanced showScrollbar={false}>
      {/* 作业类型 */}
      <View className={styles.formCard}>
        <View className={styles.cardTitle}>
          <Text className={styles.required}>*</Text>选择作业类型
        </View>
        <View className={styles.workTypeGrid}>
          {WORK_TYPES.map(item => (
            <View
              key={item.type}
              className={classnames(styles.workTypeItem, {
                [styles.workTypeActive]: workType === item.type
              })}
              onClick={() => handleWorkTypeSelect(item)}
            >
              {workType === item.type && <View className={styles.checkBadge}>✓</View>}
              <Text className={styles.workTypeIcon}>{item.icon}</Text>
              <Text className={styles.workTypeLabel}>{WorkTypeMap[item.type]}</Text>
              {item.price > 0 && (
                <Text className={styles.workTypePrice}>¥{item.price}/亩</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      {/* 农户信息 */}
      <View className={styles.formCard}>
        <View className={styles.cardTitle}>
          <Text className={styles.required}>*</Text>农户信息
        </View>
        <ScrollView scrollX className={styles.farmerRow} enhanced showScrollbar={false}>
          {COMMON_FARMERS.map(f => (
            <View
              key={f.id}
              className={classnames(styles.farmerAvatar, {
                [styles.farmerAvatarActive]: farmerId === f.id
              })}
              onClick={() => handleFarmerSelect(f)}
            >
              <Text>{f.icon}</Text>
            </View>
          ))}
          <View
            className={styles.farmerAddBtn}
            onClick={() => Taro.showToast({ title: '新增农户开发中', icon: 'none' })}
          >
            <Text>➕</Text>
          </View>
        </ScrollView>

        <View className={styles.inputRow}>
          <Text className={styles.inputLabel}>
            <Text className={styles.required}>*</Text>农户姓名
          </Text>
          <Input
            className={styles.inputField}
            placeholder="请输入农户姓名"
            placeholderClass="text-placeholder"
            value={farmerName}
            onInput={(e) => { setFarmerName(e.detail.value); setFarmerId('') }}
          />
        </View>
        <View className={styles.inputRow}>
          <Text className={styles.inputLabel}>联系电话</Text>
          <Input
            className={styles.inputField}
            type="number"
            placeholder="选填，方便联系"
            placeholderClass="text-placeholder"
            value={farmerPhone}
            onInput={(e) => setFarmerPhone(e.detail.value)}
          />
        </View>
      </View>

      {/* 作业信息 */}
      <View className={styles.formCard}>
        <View className={styles.cardTitle}>
          <Text className={styles.required}>*</Text>作业信息
        </View>
        <View className={styles.inputRow}>
          <Text className={styles.inputLabel}>
            <Text className={styles.required}>*</Text>地块面积
          </Text>
          <View className={styles.areaInputWrap}>
            <Input
              className={styles.areaInput}
              type="digit"
              placeholder="0"
              placeholderClass="text-placeholder"
              value={area}
              onInput={(e) => setArea(e.detail.value)}
            />
            <Text className={styles.areaUnit}>亩</Text>
          </View>
        </View>

        {(workType === 'sow' || workType === 'transplant' || workType === 'harvest') && (
          <View className={styles.inputRow}>
            <Text className={styles.inputLabel}>作物类型</Text>
            <View style={{ flex: 1 }}>
              <View className={styles.cropRow}>
                {CROPS.map(c => (
                  <Text
                    key={c}
                    className={classnames(styles.cropTag, {
                      [styles.cropTagActive]: crop === c
                    })}
                    onClick={() => setCrop(c)}
                  >
                    {c}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}

        <View className={styles.inputRow} style={{ flexDirection: 'column', alignItems: 'flex-start', paddingBottom: 8 }}>
          <Text className={styles.inputLabel} style={{ marginBottom: 16 }}>
            <Text className={styles.required}>*</Text>作业日期
          </Text>
          <ScrollView scrollX enhanced showScrollbar={false} className={styles.dateScroller}>
            {days7.map(d => (
              <View
                key={d.date}
                className={classnames(styles.dateItem, {
                  [styles.dateItemActive]: selectedDate === d.date
                })}
                onClick={() => setSelectedDate(d.date)}
              >
                <Text className={styles.dateWeek}>{d.label || d.week}</Text>
                <Text className={styles.dateDay}>{d.day}</Text>
                <Text className={styles.dateMonth}>{d.month}月</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        <View className={styles.inputRow} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <Text className={styles.inputLabel} style={{ marginBottom: 16 }}>作业时段</Text>
          <View className={styles.slotRow} style={{ width: '100%' }}>
            {TIME_SLOTS.map(s => (
              <Text
                key={s.key}
                className={classnames(styles.slotBtn, {
                  [styles.slotBtnActive]: timeSlot === s.key
                })}
                onClick={() => setTimeSlot(s.key)}
              >
                {s.label}
              </Text>
            ))}
          </View>
        </View>
      </View>

      {/* 地块位置 */}
      <View className={styles.formCard}>
        <View className={styles.cardTitle}>
          <Text className={styles.required}>*</Text>地块位置
        </View>
        <View className={styles.inputRow} onClick={handleSelectVillage}>
          <Text className={styles.inputLabel}>
            <Text className={styles.required}>*</Text>所属村组
          </Text>
          <Text className={styles.inputField} style={{ color: village ? '#1D2129' : '#C9CDD4' }}>
            {village || '请选择村组'}
          </Text>
        </View>
        <View className={styles.inputRow}>
          <Text className={styles.inputLabel}>
            <Text className={styles.required}>*</Text>详细地址
          </Text>
          <Input
            className={styles.inputField}
            placeholder="如：3组东头地块"
            placeholderClass="text-placeholder"
            value={address}
            onInput={(e) => setAddress(e.detail.value)}
          />
        </View>
        <View className={styles.inputRow} style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <Text
            className={styles.inputLabel}
            style={{ color: '#1890FF' }}
            onClick={() => Taro.showToast({ title: '定位功能开发中', icon: 'none' })}
          >
            📍 一键定位
          </Text>
        </View>
      </View>

      {/* 特殊要求 */}
      <View className={styles.formCard}>
        <View className={styles.cardTitle}>特殊要求（选填）</View>
        <Textarea
          className={styles.textAreaField}
          placeholder="如：地块不平整注意慢行、下雨就改期等"
          placeholderClass="text-placeholder"
          value={remark}
          onInput={(e) => setRemark(e.detail.value)}
          maxlength={200}
        />
      </View>

      <View style={{ height: 32 }} />

      {/* 底部固定栏 */}
      <View className={styles.bottomBar}>
        <View className={styles.estimateBox}>
          <Text className={styles.estimateLabel}>预估费用</Text>
          <View className={styles.estimatePrice}>
            ¥{formatMoney(estimatedPrice)}
            <Text className={styles.yuan}>元</Text>
          </View>
        </View>
        <Button className={styles.submitBtn} onClick={handleSubmit}>
          提交下单
        </Button>
      </View>

      {/* 成功弹窗 */}
      {showSuccess && (
        <View className={styles.successOverlay}>
          <View className={styles.successModal}>
            <View className={styles.successIcon}>✅</View>
            <View className={styles.successTitle}>下单成功</View>
            <View className={styles.successSubtitle}>调度员会尽快安排机械</View>
            <View className={styles.successOrderNo}>订单号：{newOrderNo}</View>
            <View className={styles.successActions}>
              <Button className={classnames(styles.successBtn, styles.btnOutline)} onClick={handleContinue}>
                继续下单
              </Button>
              <Button className={classnames(styles.successBtn, styles.btnPrimary)} onClick={handleGoDispatch}>
                🚜 立即派工
              </Button>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

export default OrderPage
