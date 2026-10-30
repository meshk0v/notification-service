import type { CampaignStatus, Channel, DeliveryStatus, TargetType } from '../types/api'

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'

export const campaignStatus: Record<CampaignStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Черновик', tone: 'neutral' },
  scheduled: { label: 'Запланирована', tone: 'accent' },
  processing: { label: 'Отправляется', tone: 'warning' },
  completed: { label: 'Завершена', tone: 'success' },
  partially_completed: { label: 'Частично', tone: 'warning' },
  failed: { label: 'Ошибка', tone: 'danger' },
  no_recipients: { label: 'Нет получателей', tone: 'neutral' },
}

export const deliveryStatus: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  pending: { label: 'В очереди', tone: 'neutral' },
  processing: { label: 'Отправка', tone: 'warning' },
  sent: { label: 'Отправлено', tone: 'success' },
  failed: { label: 'Ошибка', tone: 'danger' },
  canceled: { label: 'Отменено', tone: 'neutral' },
  // в БД встречается и британское написание
  cancelled: { label: 'Отменено', tone: 'neutral' },
}

export const channelLabel: Record<Channel, string> = { telegram: 'Telegram', email: 'Email' }
export const targetLabel: Record<TargetType, string> = {
  all: 'Все пользователи',
  group: 'Группа',
  individual: 'Выбранные пользователи',
}
export const statusOf = (s: string) => campaignStatus[s as CampaignStatus] ?? { label: s, tone: 'neutral' as Tone }
export const deliveryOf = (s: string) => deliveryStatus[s as DeliveryStatus] ?? { label: s, tone: 'neutral' as Tone }
