import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import StatCard from '@/components/StatCard'
import StatusTag from '@/components/StatusTag'
import { mockSettlements, mockSeasonSummary } from '@/data/mockSettlements'
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
  const [activeTab, setActiveTab] = useState<TabType>('pending')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['S002']))

  const summaryStats = useMemo(() => {
    const all = mockSettlements
    return {
      monthIncome: all.reduce((s, x) => s + (x.totalAmount || 0), 0),
      pending: all.filter(x => x.status === 'pending' || x.status === 'partial').reduce((s, x) => s + (x.unpaidAmount || 0), 0),
      paid: all.reduce((s, x) => s + (x.paidAmount || 0), 0),
      profit: all.reduce((s, x) => s + (x.profit || 0), 0)
    }
  }, [])

  const filteredList = useMemo(() => {
    if (activeTab === 'pending') return mockSettlements.filter(s => s.status !== 'paid')
    if (activeTab === 'paid') return mockSettlements.filter(s => s.status === 'paid')
    return mockSettlements
  }, [activeTab])

  const season = mockSeasonSummary

  const toggleExpand = (id: string) => {
    const s = new Set(expandedIds)
    s.has(id) ? s.delete(id) : s.add(id)
    setExpandedIds(s)
  }

  const handleMarkPaid = (item: Settlement) => {
    Taro.showModal({
      title: '确认收款',
      content: `确认收到 ${item.farmerName} 的 ¥${formatMoney(item.unpaidAmount || item.totalAmount)} 款项？`,
      confirmText: '确认收款',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '收款已登记', icon: 'success' })
          console.log('[Settlement] 收款登记:', item.id, new Date().toISOString())
        }
      }
    })
  }

  const handleAdvance = (item: Settlement) => {
    Taro.showModal({
      title: '合作社垫付',
      content: `为 ${item.farmerName} 的订单垫付 ¥${formatMoney(item.unpaidAmount || item.totalAmount)}？`,
      confirmText: '确认垫付',
      confirmColor: '#FA8C16',
      success: (res) => {
        if (res.confirm) {
          Taro.showToast({ title: '已标记垫付', icon: 'success' })
          console.log('[Settlement] 合作社垫付:', item.id, new Date().toISOString())
        }
      }
    })
  }

  const maxArea = Math.max(...season.topWorkType.map(x => x.area), 1)
  const maxIncome = Math.max(...season.monthlyData.map(x => x.income), 1)

  return (
    <ScrollView scrollY className={styles.page} enhanced showScrollbar={false}>
      {/* 顶部头部 */}
      <View className={styles.header}>
        <Text className={styles.headerTitle}>累计营业总收入</Text>
        <View className={styles.headerAmount}>
          <Text className={styles.yuan}>¥</Text>
          {formatMoney(season.totalIncome)}
        </View>
        <Text className={styles.headerSub}>
          本季共 {season.totalOrders} 单 · {formatMu(season.totalArea)} 亩 · 净利润 ¥{formatMoney(season.totalProfit)}
        </Text>
      </View>

      {/* 汇总卡片 */}
      <View className={styles.summaryRow}>
        <StatCard value={formatMoney(summaryStats.monthIncome)} label="本月收入" variant="primary" />
        <StatCard value={formatMoney(summaryStats.pending)} label="待收款" variant="warning" />
        <StatCard value={formatMoney(summaryStats.paid)} label="已收款" variant="info" />
        <StatCard value={formatMoney(summaryStats.profit)} label="净利润" variant="accent" />
      </View>

      {/* Tab切换 */}
      <View className={styles.tabsBar}>
        {TABS.map(t => (
          <Text
            key={t.key}
            className={classnames(styles.tabItem, {
              [styles.tabItemActive]: activeTab === t.key
            })}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}（{
              t.key === 'pending' ? mockSettlements.filter(s => s.status !== 'paid').length
              : t.key === 'paid' ? mockSettlements.filter(s => s.status === 'paid').length
              : mockSettlements.length
            }）
          </Text>
        ))}
      </View>

      {/* 结算列表 */}
      <View className={styles.listWrap}>
        {filteredList.length === 0 ? (
          <View className={styles.emptyWrap}>
            <View className={styles.emptyIcon}>💰</View>
            <View className={styles.emptyText}>暂无{activeTab === 'pending' ? '待结算' : activeTab === 'paid' ? '已结算' : ''}订单</View>
          </View>
        ) : (
          filteredList.map(item => {
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
                    <StatusTag type={item.status === 'pending' ? 'pending' : item.status as any}
                      text={item.status === 'paid' ? '已付清' : item.status === 'partial' ? '部分付' : '待结算'}
                    />
                  </View>

                  <View className={styles.cardMid}>
                    <Text className={styles.areaInfo}>
                      <Text className={styles.num}>{formatMu(item.actualArea || item.area)}</Text>亩
                      {item.unitType === 'mu' ? ` × ¥${item.unitPrice}/亩` : ` × ¥${item.unitPrice}/时`}
                    </Text>
                    <Text className={styles.priceInfo}>
                      <Text className={styles.num}>{formatMoney(item.totalAmount)}</Text>元
                    </Text>
                  </View>

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
                        {item.unitType === 'mu' ? `${formatMu(item.actualArea || item.area)} 亩` : `${item.actualHours} 小时`}
                      </Text>
                    </View>
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>单价</Text>
                      <Text className={styles.detailValue}>¥{item.unitPrice}/{item.unitType === 'mu' ? '亩' : '时'}</Text>
                    </View>
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>作业总金额</Text>
                      <Text className={styles.detailValue}>¥{formatMoney(item.totalAmount)}</Text>
                    </View>
                    {item.subsidy ? (
                      <View className={styles.detailRow}>
                        <Text className={styles.detailLabel}>政府补贴</Text>
                        <Text className={classnames(styles.detailValue, styles.success)}>-¥{formatMoney(item.subsidy)}</Text>
                      </View>
                    ) : null}
                    <View className={styles.detailDivider} />
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>油耗成本</Text>
                      <Text className={classnames(styles.detailValue, styles.error)}>¥{formatMoney(item.fuelCost)}</Text>
                    </View>
                    <View className={styles.detailRow}>
                      <Text className={styles.detailLabel}>机手费用</Text>
                      <Text className={classnames(styles.detailValue, styles.error)}>¥{formatMoney(item.operatorFee)}</Text>
                    </View>
                    <View className={styles.detailProfit}>
                      <Text className={styles.label}>📈 本单净利润</Text>
                      <Text className={styles.value}>¥{formatMoney(item.profit)}</Text>
                    </View>
                  </View>
                )}

                {/* 操作按钮 */}
                {item.status !== 'paid' && (
                  <View className={styles.cardActions}>
                    {item.status === 'partial' ? (
                      <Button className={classnames(styles.actionBtn, styles.btnOutline)} onClick={() => handleAdvance(item)}>
                        合作社垫付
                      </Button>
                    ) : (
                      <Button className={classnames(styles.actionBtn, styles.btnOrange)} onClick={() => handleAdvance(item)}>
                        合作社垫付
                      </Button>
                    )}
                    <Button className={classnames(styles.actionBtn, styles.btnPrimary)} onClick={() => handleMarkPaid(item)}>
                      {item.status === 'partial' ? '收取余款' : '标记已收'}
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
        <View className={styles.seasonTitle}>🌾 本季（2024夏收）经营汇总</View>
        <View className={styles.seasonGrid}>
          <View className={styles.seasonItem}>
            <View className={styles.label}>总订单数</View>
            <View className={styles.value}>{season.totalOrders} 单</View>
          </View>
          <View className={styles.seasonItem}>
            <View className={styles.label}>作业总面积</View>
            <View className={styles.value}>{formatMu(season.totalArea)} 亩</View>
          </View>
          <View className={styles.seasonItem}>
            <View className={styles.label}>平均单价</View>
            <View className={styles.value}>¥{season.avgPricePerMu}/亩</View>
          </View>
          <View className={styles.seasonItem}>
            <View className={styles.label}>油耗成本</View>
            <View className={styles.value}>¥{formatMoney(season.totalFuelCost)}</View>
          </View>
        </View>
      </View>

      {/* 作业类型分布 */}
      <View className={styles.distributionCard}>
        <View className={styles.cardTitleRow}>
          <Text className={styles.cardTitle}>📊 作业类型分布</Text>
        </View>
        {season.topWorkType.map((wt, idx) => (
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
                  background: idx === 0
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

      {/* 月度趋势 */}
      <View className={styles.trendCard}>
        <View className={styles.cardTitleRow}>
          <Text className={styles.cardTitle}>📈 月度收入趋势</Text>
        </View>
        <View className={styles.trendChart}>
          {season.monthlyData.map((m, idx) => {
            const h = (m.income / maxIncome) * 160 + 8
            return (
              <View key={idx} className={styles.trendBar}>
                <View className={styles.barInner} style={{ height: `${h}rpx` }}>
                  <Text className={styles.barValue}>{(m.income / 1000).toFixed(0)}k</Text>
                </View>
                <Text className={styles.barLabel}>{m.month}</Text>
              </View>
            )
          })}
        </View>
      </View>

      <View style={{ height: 64 }} />
    </ScrollView>
  )
}

export default SettlementPage
