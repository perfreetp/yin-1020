import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import StatCard from '@/components/StatCard'
import StatusTag from '@/components/StatusTag'
import useAppStore from '@/store'
import type { Settlement } from '@/types'
import { WorkTypeMap } from '@/types'
import { formatMoney, formatMu } from '@/utils/format'

type TabType = 'pending' | 'paid' | 'all'

const TABS: { key: TabType; label: string }[] = [
  { key: 'pending', label: '待结算' },
  { key: 'paid', label: '已结算' },
  { key: 'all', label: '全部' }
]

const SettlementPage: React.FC = () => {
  const settlements = useAppStore((s) => s.settlements)
  const markPaid = useAppStore((s) => s.markPaid)
  const markAdvance = useAppStore((s) => s.markAdvance)
  const cancelAdvance = useAppStore((s) => s.cancelAdvance)
  const recordFarmerRepayment = useAppStore((s) => s.recordFarmerRepayment)

  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [tick, setTick] = useState(0)

  useDidShow(() => {
    setTick((t) => t + 1)
  })

  const summaryStats = useMemo(() => {
    const all = settlements
    const monthIncome = all.reduce((s, x) => s + (x.totalAmount || 0), 0)
    const unpaid = all
      .filter((x) => x.status === 'pending' || x.status === 'partial' || x.status === 'advanced')
      .reduce((s, x) => s + (x.unpaidAmount || x.totalAmount || 0), 0)
    const paid = all.reduce((s, x) => s + (x.paidAmount || 0), 0)
    const profit = all.reduce((s, x) => s + (x.profit || 0), 0)
    return { monthIncome, pending: unpaid, paid, profit }
  }, [settlements, tick])

  const filteredList = useMemo(() => {
    if (activeTab === 'pending')
      return settlements.filter((s) => s.status !== 'paid')
    if (activeTab === 'paid') return settlements.filter((s) => s.status === 'paid')
    return settlements
  }, [settlements, activeTab, tick])

  const tabCount = (key: TabType) => {
    if (key === 'pending') return settlements.filter((s) => s.status !== 'paid').length
    if (key === 'paid') return settlements.filter((s) => s.status === 'paid').length
    return settlements.length
  }

  const toggleExpand = (id: string) => {
    const s = new Set(expandedIds)
    s.has(id) ? s.delete(id) : s.add(id)
    setExpandedIds(s)
  }

  const handleMarkPaid = (item: Settlement) => {
    const unpaid = item.unpaidAmount || item.totalAmount || 0
    // 先给个金额输入框
    Taro.showModal({
      editable: true,
      title: '登记收款',
      content: `应收：¥${formatMoney(unpaid)}，输入本次收款金额`,
      placeholderText: unpaid.toString(),
      confirmText: '确认收款',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          const input = parseFloat(res.content || '')
          const amount = isNaN(input) || input <= 0 ? unpaid : Math.min(input, unpaid)
          markPaid(item.id, amount)
          Taro.showToast({ title: `已登记收款 ¥${formatMoney(amount)}`, icon: 'success' })
          console.log('[Settlement] 收款登记:', item.id, '¥' + formatMoney(amount))
        }
      }
    })
  }

  const handleAdvance = (item: Settlement) => {
    if (item.status === 'advanced') {
      Taro.showModal({
        title: '取消垫付',
        content: `确认取消 ${item.farmerName} 的合作社垫付？`,
        confirmText: '确认取消',
        confirmColor: '#F5222D',
        success: (res) => {
          if (res.confirm) {
            cancelAdvance(item.id)
            Taro.showToast({ title: '已取消垫付', icon: 'success' })
            console.log('[Settlement] 取消垫付:', item.id)
          }
        }
      })
    } else {
      const unpaid = item.unpaidAmount || item.totalAmount || 0
      Taro.showModal({
        editable: true,
        title: '合作社垫付',
        content: `待垫付：¥${formatMoney(unpaid)}，输入垫付金额`,
        placeholderText: unpaid.toString(),
        confirmText: '确认垫付',
        confirmColor: '#FA8C16',
        success: (res) => {
          if (res.confirm) {
            const input = parseFloat(res.content || '')
            const amount = isNaN(input) || input <= 0 ? unpaid : Math.min(input, unpaid)
            markAdvance(item.id, amount)
            Taro.showToast({ title: `已垫付 ¥${formatMoney(amount)}`, icon: 'success' })
            console.log('[Settlement] 合作社垫付:', item.id, '¥' + formatMoney(amount))
          }
        }
      })
    }
  }

  const handleFarmerRepay = (item: Settlement) => {
    const toRepay = item.advanceAmount || 0
    if (toRepay <= 0) {
      Taro.showToast({ title: '该订单无需还垫付', icon: 'none' })
      return
    }
    Taro.showModal({
      editable: true,
      title: '登记农户回款',
      content: `农户欠合作社：¥${formatMoney(toRepay)}，输入本次回款金额`,
      placeholderText: toRepay.toString(),
      confirmText: '确认回款',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          const input = parseFloat(res.content || '')
          const amount = isNaN(input) || input <= 0 ? toRepay : Math.min(input, toRepay)
          recordFarmerRepayment(item.id, amount)
          Taro.showToast({ title: `已登记回款 ¥${formatMoney(amount)}`, icon: 'success' })
          console.log('[Settlement] 农户回款:', item.id, '¥' + formatMoney(amount))
        }
      }
    })
  }

  // 季节汇总（从settlements动态计算）
  const seasonSummary = useMemo(() => {
    const all = settlements
    const totalOrders = all.length
    const totalArea = all.reduce((s, x) => s + (x.actualArea || x.area || 0), 0)
    const totalIncome = all.reduce((s, x) => s + (x.totalAmount || 0), 0)
    const totalProfit = all.reduce((s, x) => s + (x.profit || 0), 0)
    const totalFuel = all.reduce((s, x) => s + (x.fuelCost || 0), 0)
    const avgPrice = totalArea > 0 ? Math.round((totalIncome / totalArea) * 10) / 10 : 0

    // 按作业类型统计
    const typeMap: Record<string, { count: number; area: number }> = {}
    all.forEach((s) => {
      const t = s.workType
      if (!typeMap[t]) typeMap[t] = { count: 0, area: 0 }
      typeMap[t].count++
      typeMap[t].area += s.actualArea || s.area || 0
    })
    const topWorkType = Object.entries(typeMap)
      .map(([type, v]) => ({
        type: WorkTypeMap[type as keyof typeof WorkTypeMap] || type,
        count: v.count,
        area: v.area
      }))
      .sort((a, b) => b.area - a.area)
      .slice(0, 4)

    return {
      totalOrders,
      totalArea,
      totalIncome,
      totalProfit,
      totalFuelCost: totalFuel,
      avgPricePerMu: avgPrice,
      topWorkType
    }
  }, [settlements, tick])

  const maxArea = Math.max(...seasonSummary.topWorkType.map((x) => x.area), 1)

  return (
    <ScrollView scrollY className={styles.page} enhanced showScrollbar={false}>
      {/* 顶部头部 */}
      <View className={styles.header}>
        <Text className={styles.headerTitle}>累计营业总收入</Text>
        <View className={styles.headerAmount}>
          <Text className={styles.yuan}>¥</Text>
          {formatMoney(seasonSummary.totalIncome)}
        </View>
        <Text className={styles.headerSub}>
          共 {seasonSummary.totalOrders} 单 · {formatMu(seasonSummary.totalArea)} 亩 · 净利润 ¥
          {formatMoney(seasonSummary.totalProfit)}
        </Text>
      </View>

      {/* 汇总卡片 */}
      <View className={styles.summaryRow}>
        <StatCard value={formatMoney(summaryStats.monthIncome)} label="总收入" variant="primary" />
        <StatCard value={formatMoney(summaryStats.pending)} label="待收款" variant="warning" />
        <StatCard value={formatMoney(summaryStats.paid)} label="已收款" variant="info" />
        <StatCard value={formatMoney(summaryStats.profit)} label="净利润" variant="accent" />
      </View>

      {/* Tab切换 */}
      <View className={styles.tabsBar}>
        {TABS.map((t) => (
          <Text
            key={t.key}
            className={classnames(styles.tabItem, {
              [styles.tabItemActive]: activeTab === t.key
            })}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}（{tabCount(t.key)}）
          </Text>
        ))}
      </View>

      {/* 结算列表 */}
      <View className={styles.listWrap}>
        {filteredList.length === 0 ? (
          <View className={styles.emptyWrap}>
            <View className={styles.emptyIcon}>💰</View>
            <View className={styles.emptyText}>
              暂无{activeTab === 'pending' ? '待结算' : activeTab === 'paid' ? '已结算' : ''}订单
            </View>
          </View>
        ) : (
          filteredList.map((item) => {
            const expanded = expandedIds.has(item.id)
            return (
              <View key={item.id} className={styles.settleCard}>
                <View onClick={() => toggleExpand(item.id)}>
                  <View className={styles.cardTop}>
                    <View className={styles.farmerInfo}>
                      <View className={styles.farmerAvatar}>👨‍🌾</View>
                      <Text className={styles.farmerName}>{item.farmerName}</Text>
                      <Text className={styles.workBadge}>{WorkTypeMap[item.workType]}</Text>
                    </View>
                    <StatusTag
                      type={
                        item.status === 'advanced'
                          ? 'partial'
                          : (item.status as any)
                      }
                      text={
                        item.status === 'paid'
                          ? '已付清'
                          : item.status === 'partial'
                          ? '部分付'
                          : item.status === 'advanced'
                          ? '已垫付'
                          : '待结算'
                      }
                    />
                  </View>

                  <View className={styles.cardMid}>
                    <Text className={styles.areaInfo}>
                      <Text className={styles.num}>
                        {formatMu(item.actualArea || item.area || 0)}
                      </Text>
                      亩
                      {item.unitType === 'mu'
                        ? ` × ¥${item.unitPrice}/亩`
                        : ` × ¥${item.unitPrice}/时`}
                    </Text>
                    <Text className={styles.priceInfo}>
                      <Text className={styles.num}>{formatMoney(item.totalAmount || 0)}</Text>
                      元
                    </Text>
                  </View>

                  {((item.paidAmount || 0) > 0 || (item.advanceAmount || 0) > 0 || (item.unpaidAmount || 0) > 0) && (
                    <View
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 4,
                        fontSize: 24,
                        padding: '8rpx 0',
                        color: '#4E5969',
                        gap: 16
                      }}
                    >
                      {(item.paidAmount || 0) > 0 && (
                        <Text>已收：<Text style={{ color: '#2E8B57', fontWeight: 600 }}>¥{formatMoney(item.paidAmount || 0)}</Text></Text>
                      )}
                      {(item.advanceAmount || 0) > 0 && (
                        <Text>垫付：<Text style={{ color: '#FA8C16', fontWeight: 600 }}>¥{formatMoney(item.advanceAmount || 0)}</Text></Text>
                      )}
                      {(item.unpaidAmount || 0) > 0 && (
                        <Text>待收：<Text style={{ color: '#F5222D', fontWeight: 600 }}>¥{formatMoney(item.unpaidAmount || 0)}</Text></Text>
                      )}
                    </View>
                  )}

                  <View className={styles.orderNoRow}>
                    <Text>订单号：{item.orderNo}</Text>
                    <Text>{item.settleDate}</Text>
                  </View>
                </View>

                {/* 展开的费用明细 */}
                {expanded && (
                  <View className={styles.detailArea}>
                    <View className={styles.detailTitle}>📋 费用明细</View>
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>作业量</Text>
                      <Text className={styles.detailValue}>
                        {item.unitType === 'mu'
                          ? `${formatMu(item.actualArea || item.area || 0)} 亩`
                          : `${item.actualHours} 小时`}
                      </Text>
                    </View>
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>单价</Text>
                      <Text className={styles.detailValue}>
                        ¥{item.unitPrice}/{item.unitType === 'mu' ? '亩' : '时'}
                      </Text>
                    </View>
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>作业总金额</Text>
                      <Text className={styles.detailValue}>
                        ¥{formatMoney(item.totalAmount || 0)}
                      </Text>
                    </View>
                    {item.subsidy ? (
                      <View className={styles.detailRow}>
                        <Text className={styles.detailLabel}>政府补贴</Text>
                        <Text className={classnames(styles.detailValue, styles.success)}>
                          -¥{formatMoney(item.subsidy)}
                        </Text>
                      </View>
                    ) : null}
                    <View className={styles.detailDivider} />
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>油耗成本</Text>
                      <Text className={classnames(styles.detailValue, styles.error)}>
                        ¥{formatMoney(item.fuelCost || 0)}
                      </Text>
                    </View>
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>机手费用</Text>
                      <Text className={classnames(styles.detailValue, styles.error)}>
                        ¥{formatMoney(item.operatorFee || 0)}
                      </Text>
                    </View>
                    <View className={styles.detailProfit}>
                      <Text className={styles.label}>📈 本单净利润</Text>
                      <Text className={styles.value}>¥{formatMoney(item.profit || 0)}</Text>
                    </View>

                    {/* 资金流水 */}
                    {(item.paymentLogs?.length || 0) > 0 && (
                      <>
                        <View className={styles.detailDivider} />
                        <View className={styles.detailTitle}>💸 资金流水</View>
                        {item.paymentLogs!.map((log) => {
                          const isOut = log.type === 'cancel_advance'
                          const isIn = log.type === 'farmer_pay'
                          const isAdvance = log.type === 'advance'
                          const typeLabel =
                            log.type === 'farmer_pay'
                              ? '农户付款'
                              : log.type === 'advance'
                              ? '合作社垫付'
                              : log.type === 'cancel_advance'
                              ? '取消垫付'
                              : log.remark || '操作'
                          return (
                            <View key={log.id} className={styles.detailRow}>
                              <Text className={styles.detailLabel}>
                                {new Date(log.time).toLocaleDateString()} {typeLabel}
                              </Text>
                              <Text
                                className={classnames(styles.detailValue, {
                                  [styles.success]: isIn,
                                  [styles.error]: isOut,
                                  [styles.orange]: isAdvance
                                })}
                              >
                                {isIn ? '+' : isOut ? '-' : isAdvance ? '垫付 ' : ''}
                                ¥{formatMoney(log.amount)}
                              </Text>
                            </View>
                          )
                        })}
                      </>
                    )}
                  </View>
                )}

                {/* 操作按钮 */}
                {item.status !== 'paid' && (
                  <View className={styles.cardActions}>
                    {/* 有垫付额 → 先提供 登记农户回款 */}
                    {(item.advanceAmount || 0) > 0 && (
                      <Button
                        className={classnames(styles.actionBtn, styles.btnGreenOutline)}
                        onClick={() => handleFarmerRepay(item)}
                      >
                        农户还垫付
                      </Button>
                    )}
                    {item.status === 'advanced' || (item.status === 'partial' && (item.advanceAmount || 0) > 0) ? (
                      <Button
                        className={classnames(styles.actionBtn, styles.btnOutline)}
                        onClick={() => handleAdvance(item)}
                      >
                        取消垫付
                      </Button>
                    ) : null}
                    {(item.status !== 'advanced' && (item.unpaidAmount || 0) > 0) && (
                      <Button
                        className={classnames(styles.actionBtn, styles.btnOrange)}
                        onClick={() => handleAdvance(item)}
                      >
                        合作社垫付
                      </Button>
                    )}
                    {(item.unpaidAmount || 0) > 0 && (
                      <Button
                        className={classnames(styles.actionBtn, styles.btnPrimary)}
                        onClick={() => handleMarkPaid(item)}
                      >
                        {item.status === 'partial' ? '收取余款' : '登记收款'}
                      </Button>
                    )}
                  </View>
                )}

                {/* 已结清：但可能还有欠款（农户没还垫付） */}
                {item.status === 'paid' && (item.advanceAmount || 0) > 0 && (
                  <View className={styles.cardActions}>
                    <Button
                      className={classnames(styles.actionBtn, styles.btnGreenOutline)}
                      onClick={() => handleFarmerRepay(item)}
                    >
                      农户还垫付（还欠 ¥{formatMoney(item.advanceAmount || 0)}）
                    </Button>
                  </View>
                )}
              </View>
            )
          })
        )}
      </View>

      {/* 季节经营汇总 */}
      <View className={styles.seasonCard}>
        <View className={styles.seasonTitle}>🌾 经营汇总</View>
        <View className={styles.seasonGrid}>
          <View className={styles.seasonItem}>
            <View className={styles.label}>总订单数</View>
            <View className={styles.value}>{seasonSummary.totalOrders} 单</View>
          </View>
          <View className={styles.seasonItem}>
            <View className={styles.label}>作业总面积</View>
            <View className={styles.value}>{formatMu(seasonSummary.totalArea)} 亩</View>
          </View>
          <View className={styles.seasonItem}>
            <View className={styles.label}>平均单价</View>
            <View className={styles.value}>¥{seasonSummary.avgPricePerMu}/亩</View>
          </View>
          <View className={styles.seasonItem}>
            <View className={styles.label}>油耗成本</View>
            <View className={styles.value}>¥{formatMoney(seasonSummary.totalFuelCost)}</View>
          </View>
        </View>
      </View>

      {/* 作业类型分布 */}
      {seasonSummary.topWorkType.length > 0 && (
        <View className={styles.distributionCard}>
          <View className={styles.cardTitleRow}>
            <Text className={styles.cardTitle}>📊 作业类型分布</Text>
          </View>
          {seasonSummary.topWorkType.map((wt, idx) => (
            <View key={idx} className={styles.distributionItem}>
              <View className={styles.distributionHead}>
                <Text className={styles.distributionName}>{wt.type}</Text>
                <Text className={styles.distributionNum}>
                  {wt.count}单 · {formatMu(wt.area)}亩
                </Text>
              </View>
              <View className={styles.barBg}>
                <View
                  className={styles.barFill}
                  style={{
                    width: `${(wt.area / maxArea) * 100}%`,
                    background:
                      idx === 0
                        ? 'linear-gradient(90deg, #2E8B57, #52C41A)'
                        : idx === 1
                        ? 'linear-gradient(90deg, #FA8C16, #FAAD14)'
                        : idx === 2
                        ? 'linear-gradient(90deg, #1890FF, #40A9FF)'
                        : 'linear-gradient(90deg, #722ED1, #9254DE)'
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 64 }} />
    </ScrollView>
  )
}

export default SettlementPage
