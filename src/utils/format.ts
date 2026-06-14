// 格式化金额
export const formatMoney = (num?: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0.00'
  return num.toFixed(2)
}

// 格式化亩数
export const formatMu = (num?: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0'
  return num.toFixed(1)
}

// 格式化工时
export const formatHours = (num?: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0'
  return num.toFixed(1)
}

// 格式化日期
export const formatDate = (dateStr?: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

// 格式化日期时间
export const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const h = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}

// 仅格式化时间
export const formatTime = (dateStr?: string): string => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const h = d.getHours().toString().padStart(2, '0')
  const min = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${min}`
}

// 计算订单金额
export const calcOrderPrice = (
  area?: number,
  pricePerMu?: number,
  hours?: number,
  pricePerHour?: number
): number => {
  let total = 0
  if (area && pricePerMu) total += area * pricePerMu
  if (hours && pricePerHour) total += hours * pricePerHour
  return Math.round(total * 100) / 100
}

// 生成订单号
export const genOrderNo = (): string => {
  const d = new Date()
  const y = d.getFullYear().toString().slice(-2)
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000 + 1000)
  return `NJ${y}${m}${day}${rand}`
}

// 格式化距离（米转公里）
export const formatDistance = (meters?: number): string => {
  if (!meters) return '-'
  if (meters < 1000) return `${meters}米`
  return `${(meters / 1000).toFixed(1)}公里`
}
