import React, { useState, useMemo } from 'react'
import { View, Text, ScrollView, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import StatusTag from '@/components/StatusTag'
import { mockRepairRecords, mockMaintenanceRecords } from '@/data/mockSettlements'
import { mockMachines } from '@/data/mockMachines'
import type { RepairRecord, MaintenanceRecord } from '@/types'

type TabType = 'repair' | 'maintenance'

const MaintenancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('repair')
  const [repairs, setRepairs] = useState<RepairRecord[]>(mockRepairRecords)
  const [showAddModal, setShowAddModal] = useState(false)

  // 表单状态
  const [formMachineId, setFormMachineId] = useState('')
  const [formMachineName, setFormMachineName] = useState('')
  const [formFaultDesc, setFormFaultDesc] = useState('')
  const [formUrgency, setFormUrgency] = useState<'normal' | 'high' | 'urgent'>('normal')

  const repairStats = useMemo(() => ({
    pending: repairs.filter(r => r.status === 'reported').length,
    repairing: repairs.filter(r => r.status === 'repairing').length,
    done: repairs.filter(r => r.status === 'done').length
  }), [repairs])

  const pendingList = repairs.filter(r => r.status === 'reported')
  const repairingList = repairs.filter(r => r.status === 'repairing')
  const doneList = repairs.filter(r => r.status === 'done')

  // 推荐替换设备（同类型的空闲机械）
  const getReplacements = (record: RepairRecord) => {
    const faultyMachine = mockMachines.find(m => m.id === record.machineId)
    if (!faultyMachine) return []
    return mockMachines.filter(m =>
      m.id !== record.machineId &&
      m.status === 'idle' &&
      m.type === faultyMachine.type
    ).slice(0, 2)
  }

  const handleSelectMachine = () => {
    const items = mockMachines.map(m => `${m.name}（${m.plateNo}）`)
    Taro.showActionSheet({
      itemList: items,
      success: (res) => {
        setFormMachineId(mockMachines[res.tapIndex].id)
        setFormMachineName(mockMachines[res.tapIndex].name)
      }
    })
  }

  const handleSubmitFault = () => {
    if (!formMachineId) {
      Taro.showToast({ title: '请选择故障机械', icon: 'none' })
      return
    }
    if (!formFaultDesc.trim()) {
      Taro.showToast({ title: '请描述故障情况', icon: 'none' })
      return
    }
    const newRecord: RepairRecord = {
      id: 'R' + Date.now(),
      machineId: formMachineId,
      machineName: formMachineName,
      faultDesc: formFaultDesc,
      reportTime: new Date().toISOString(),
      status: 'reported',
      remark: formUrgency === 'urgent' ? '加急处理' : formUrgency === 'high' ? '优先处理' : ''
    }
    setRepairs(prev => [newRecord, ...prev])
    console.log('[Maintenance] 故障登记:', newRecord)
    setShowAddModal(false)
    setFormMachineId('')
    setFormMachineName('')
    setFormFaultDesc('')
    setFormUrgency('normal')
    Taro.showToast({ title: '故障已登记', icon: 'success' })
  }

  const handleStartRepair = (r: RepairRecord) => {
    Taro.showModal({
      title: '开始维修',
      content: `确认【${r.machineName}】已进入维修流程？`,
      confirmText: '开始维修',
      confirmColor: '#FA8C16',
      success: (res) => {
        if (res.confirm) {
          setRepairs(prev => prev.map(x => x.id === r.id
            ? { ...x, status: 'repairing' as const, repairTime: new Date().toISOString() }
            : x
          ))
          Taro.showToast({ title: '维修已开始', icon: 'success' })
        }
      }
    })
  }

  const handleFinishRepair = (r: RepairRecord) => {
    Taro.showModal({
      title: '维修完成',
      content: `确认【${r.machineName}】已修复并可投入使用？`,
      confirmText: '确认修复',
      confirmColor: '#2E8B57',
      success: (res) => {
        if (res.confirm) {
          setRepairs(prev => prev.map(x => x.id === r.id
            ? { ...x, status: 'done' as const, finishTime: new Date().toISOString() }
            : x
          ))
          Taro.showToast({ title: '修复完成', icon: 'success' })
        }
      }
    })
  }

  const handleAssignReplacement = (r: RepairRecord, replaceMachine: any) => {
    Taro.showModal({
      title: '指派替换设备',
      content: `使用【${replaceMachine.name}】临时接替【${r.machineName}】的工作？`,
      confirmText: '确认指派',
      confirmColor: '#FA8C16',
      success: (res) => {
        if (res.confirm) {
          setRepairs(prev => prev.map(x => x.id === r.id
            ? { ...x, replacementMachineId: replaceMachine.id, replacementMachineName: replaceMachine.name }
            : x
          ))
          Taro.showToast({ title: '替换设备已指派', icon: 'success' })
        }
      }
    })
  }

  const renderRepairCard = (r: RepairRecord) => {
    const replaceMachines = getReplacements(r)
    const statusClass = r.status === 'reported' ? styles.repairPending
      : r.status === 'repairing' ? styles.repairRepairing
      : styles.repairDone
    return (
      <View key={r.id} className={classnames(styles.repairCard, statusClass)}>
        <View className={styles.repairHeader}>
          <View className={styles.machineInfo}>
            <View className={styles.machineIcon}>🔧</View>
            <Text className={styles.machineName}>{r.machineName}</Text>
          </View>
          <StatusTag
            type={r.status === 'reported' ? 'reported' : r.status === 'repairing' ? 'repairing' : 'done' as any}
            text={r.status === 'reported' ? '待维修' : r.status === 'repairing' ? '维修中' : '已修复'}
          />
        </View>
        <View className={styles.faultDesc}>⚠️ {r.faultDesc}</View>
        <View className={styles.infoRow}>
          <Text className={styles.infoIcon}>🕐</Text>
          <Text>报修时间：{r.reportTime.replace('T', ' ').slice(0, 16)}</Text>
        </View>
        {r.cost && (
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>💰</Text>
            <Text>维修费用：¥{r.cost}</Text>
          </View>
        )}
        {r.replacementMachineName && (
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>🔄</Text>
            <Text>替换设备：{r.replacementMachineName}</Text>
          </View>
        )}
        {r.remark && (
          <View className={styles.infoRow}>
            <Text className={styles.infoIcon}>📝</Text>
            <Text>备注：{r.remark}</Text>
          </View>
        )}

        {r.status !== 'done' && replaceMachines.length > 0 && (
          <View className={styles.replaceBox}>
            <View className={styles.replaceTitle}>🔄 推荐替换设备</View>
            {replaceMachines.map(m => (
              <View key={m.id} className={styles.replaceItem}>
                <Text className={styles.replaceName}>
                  {m.name}（{m.operatorName}）· 距离{m.distance && m.distance < 1000 ? `${m.distance}米` : `${(m.distance! / 1000).toFixed(1)}公里`}
                </Text>
                <Text
                  style={{ fontSize: 24, color: '#FA8C16', fontWeight: 600 }}
                  onClick={() => handleAssignReplacement(r, m)}
                >
                  指派 →
                </Text>
              </View>
            ))}
          </View>
        )}

        {r.status === 'reported' && (
          <View className={styles.cardActions}>
            <Button className={classnames(styles.actionBtn, styles.btnOutline)} onClick={() => Taro.makePhoneCall({ phoneNumber: '13800000000' }).catch(()=>{})}>
              联系维修员
            </Button>
            <Button className={classnames(styles.actionBtn, styles.btnOrange)} onClick={() => handleStartRepair(r)}>
              开始维修
            </Button>
          </View>
        )}
        {r.status === 'repairing' && (
          <View className={styles.cardActions}>
            <Button className={classnames(styles.actionBtn, styles.btnOutline)} onClick={() => Taro.showToast({ title: '查看维修记录开发中', icon: 'none' })}>
              维修详情
            </Button>
            <Button className={classnames(styles.actionBtn, styles.btnPrimary)} onClick={() => handleFinishRepair(r)}>
              标记修复
            </Button>
          </View>
        )}
      </View>
    )
  }

  return (
    <ScrollView scrollY className={styles.page} enhanced showScrollbar={false}>
      {/* Tab */}
      <View className={styles.tabsBar}>
        <Text
          className={classnames(styles.tabItem, { [styles.tabItemActive]: activeTab === 'repair' })}
          onClick={() => setActiveTab('repair')}
        >
          故障登记（{repairs.length}）
        </Text>
        <Text
          className={classnames(styles.tabItem, { [styles.tabItemActive]: activeTab === 'maintenance' })}
          onClick={() => setActiveTab('maintenance')}
        >
          保养记录（{mockMaintenanceRecords.length}）
        </Text>
      </View>

      {activeTab === 'repair' ? (
        <>
          {/* 故障统计 */}
          <View className={styles.statsBar}>
            <View className={styles.statBox}>
              <View className={styles.statNum} style={{ color: '#F5222D' }}>{repairStats.pending}</View>
              <View className={styles.statLabel}>待维修</View>
            </View>
            <View className={styles.statBox}>
              <View className={styles.statNum} style={{ color: '#FA8C16' }}>{repairStats.repairing}</View>
              <View className={styles.statLabel}>维修中</View>
            </View>
            <View className={styles.statBox}>
              <View className={styles.statNum} style={{ color: '#52C41A' }}>{repairStats.done}</View>
              <View className={styles.statLabel}>已修复</View>
            </View>
          </View>

          {pendingList.length > 0 && (
            <>
              <View className={styles.groupTitle}>
                <Text className={styles.groupLabel}>🚨 待维修</Text>
                <Text className={styles.groupCount}>{pendingList.length}台</Text>
              </View>
              {pendingList.map(renderRepairCard)}
            </>
          )}

          {repairingList.length > 0 && (
            <>
              <View className={styles.groupTitle}>
                <Text className={styles.groupLabel}>🔧 维修中</Text>
                <Text className={styles.groupCount}>{repairingList.length}台</Text>
              </View>
              {repairingList.map(renderRepairCard)}
            </>
          )}

          {doneList.length > 0 && (
            <>
              <View className={styles.groupTitle}>
                <Text className={styles.groupLabel}>✅ 已修复</Text>
                <Text className={styles.groupCount}>{doneList.length}台</Text>
              </View>
              {doneList.map(renderRepairCard)}
            </>
          )}
        </>
      ) : (
        <>
          {/* 保养提醒 */}
          {mockMaintenanceRecords.filter(m => {
            if (!m.nextDate) return false
            const next = new Date(m.nextDate).getTime()
            const now = Date.now()
            return next - now < 15 * 86400000
          }).length > 0 && (
              <View className={styles.reminderCard}>
                <View className={styles.reminderIcon}>⏰</View>
                <View className={styles.reminderInfo}>
                  <View className={styles.reminderTitle}>保养即将到期</View>
                  <View className={styles.reminderText}>
                    有 {mockMaintenanceRecords.filter(m => m.nextDate).length} 台设备需在15天内保养，请及时安排
                  </View>
                </View>
              </View>
            )}

          {/* 保养时间轴 */}
          <View className={styles.maintenanceTimeline}>
            {mockMaintenanceRecords.map((m: MaintenanceRecord & { isWarning?: boolean }, idx) => {
              const isWarning = m.nextDate && new Date(m.nextDate).getTime() - Date.now() < 15 * 86400000
              return (
                <View key={m.id} className={styles.timelineItem}>
                  <View className={styles.timelineLeft}>
                    <View className={styles.timelineDate}>{m.date.slice(5)}</View>
                    {m.nextDate && (
                      <View className={styles.timelineNext}>
                        下次：{m.nextDate.slice(5)}
                      </View>
                    )}
                  </View>
                  <View className={styles.timelineMiddle}>
                    <View className={classnames(styles.timelineDot, {
                      [styles.timelineDotWarning]: isWarning
                    })} />
                    {idx < mockMaintenanceRecords.length - 1 && <View className={styles.timelineLine} />}
                  </View>
                  <View className={styles.timelineRight}>
                    <View className={styles.maintCard}>
                      <View className={styles.maintType}>
                        🛠️ {m.type}
                        {isWarning && <Text style={{
                          fontSize: 20, padding: '2rpx 10rpx', background: '#FFF7E6',
                          color: '#FA8C16', borderRadius: 8
                        }}>即将到期</Text>}
                      </View>
                      <View className={styles.maintMachine}>{m.machineName} · 里程{m.mileage}小时</View>
                      {m.remark && <View className={styles.maintDetail}>{m.remark}</View>}
                      <View className={styles.maintCost}>
                        <Text>保养费用</Text>
                        <Text className={styles.amount}>¥{m.cost}</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* 浮动按钮 */}
      {activeTab === 'repair' && (
        <View className={styles.fab} onClick={() => setShowAddModal(true)}>
          <Text className={styles.fabIcon}>➕</Text>
          <Text className={styles.fabText}>报故障</Text>
        </View>
      )}

      {/* 登记故障弹窗 */}
      {showAddModal && (
        <View className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalTitle}>🚨 登记故障</View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>
                <Text className={styles.required}>*</Text>故障机械
              </Text>
              <View className={styles.formSelect} onClick={handleSelectMachine}>
                <Text style={{ color: formMachineName ? '#1D2129' : '#C9CDD4' }}>
                  {formMachineName || '请选择出故障的机械'}
                </Text>
                <Text style={{ color: '#86909C' }}>▼</Text>
              </View>
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>
                <Text className={styles.required}>*</Text>故障描述
              </Text>
              <Textarea
                className={styles.formTextarea}
                placeholder="请描述故障现象，如：启动困难、作业异响、漏油等..."
                placeholderClass="text-placeholder"
                value={formFaultDesc}
                onInput={(e) => setFormFaultDesc(e.detail.value)}
                maxlength={200}
              />
            </View>

            <View className={styles.formGroup}>
              <Text className={styles.formLabel}>紧急程度</Text>
              <View className={styles.urgencyRow}>
                <Text
                  className={classnames(styles.urgencyBtn, styles.urgencyNormal, {
                    [styles.urgencyActive]: formUrgency === 'normal'
                  })}
                  onClick={() => setFormUrgency('normal')}
                >
                  一般
                </Text>
                <Text
                  className={classnames(styles.urgencyBtn, styles.urgencyHigh, {
                    [styles.urgencyActive]: formUrgency === 'high'
                  })}
                  onClick={() => setFormUrgency('high')}
                >
                  优先
                </Text>
                <Text
                  className={classnames(styles.urgencyBtn, styles.urgencyUrgent, {
                    [styles.urgencyActive]: formUrgency === 'urgent'
                  })}
                  onClick={() => setFormUrgency('urgent')}
                >
                  加急
                </Text>
              </View>
            </View>

            <View className={styles.modalActions}>
              <Button
                className={classnames(styles.modalBtn, styles.btnOutline)}
                style={{ borderColor: '#86909C', color: '#86909C' }}
                onClick={() => setShowAddModal(false)}
              >
                取消
              </Button>
              <Button
                className={classnames(styles.modalBtn, styles.btnRed)}
                onClick={handleSubmitFault}
              >
                提交报修
              </Button>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  )
}

export default MaintenancePage
