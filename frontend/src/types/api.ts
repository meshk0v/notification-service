// Типы соответствуют Pydantic-схемам backend (см. OpenAPI).

export type Channel = 'telegram' | 'email'
export type TargetType = 'all' | 'group' | 'individual'

export interface Employee { id: number; username: string; is_active: boolean }
export interface TokenResponse { access_token: string; token_type: string }

export interface Tag { id: number; name: string; created_at: string }
export interface TagBrief { id: number; name: string }

export interface User {
  id: number
  name: string
  email: string | null
  telegram_id: number | null
  email_available: boolean
  telegram_available: boolean
  is_active: boolean
  created_at: string
  tags: TagBrief[]
}
export interface UserCreate { name: string; email?: string | null; telegram_id?: number | null }
export interface UserUpdate extends Partial<UserCreate> {
  email_available?: boolean
  telegram_available?: boolean
  is_active?: boolean
}

export interface Group { id: number; name: string; description: string | null; tags: TagBrief[] }
export interface GroupInput { name: string; description?: string | null; tag_ids: number[] }
export interface GroupUser { id: number; name: string; email: string | null; telegram_id: number | null }

export interface Template {
  id: number
  name: string
  description: string | null
  content: string
  created_at: string
  updated_at: string
}
export interface TemplateInput { name: string; description?: string | null; content: string }

export type CampaignStatus =
  | 'draft' | 'scheduled' | 'processing' | 'completed'
  | 'partially_completed' | 'failed' | 'no_recipients'

export interface Campaign {
  id: number
  title: string
  message: string
  template_id: number | null
  target_type: TargetType
  group_id: number | null
  channels: Channel[]
  status: CampaignStatus
  scheduled_at: string | null
  started_at: string | null
  created_at: string
  updated_at: string
}
export interface CampaignCreate {
  title: string
  message?: string | null
  template_id?: number | null
  target_type: TargetType
  group_id?: number | null
  user_ids?: number[]
  channels: Channel[]
  scheduled_at?: string | null
}
export interface CampaignUpdate {
  title?: string
  message?: string
  template_id?: number | null
  scheduled_at?: string | null
}
export interface CampaignPreview {
  campaign_id: number
  total_recipients: number
  telegram_recipients: number
  email_recipients: number
  unavailable_recipients: number
  sample_message: string | null
}
export interface CampaignStats {
  campaign_id: number
  campaign_status: CampaignStatus
  total: number
  queued: number
  in_progress: number
  sent: number
  failed: number
  canceled: number
  channels: Record<string, number>
}
export interface LaunchResult {
  campaign_id: number
  status: CampaignStatus
  recipients_found: number
  deliveries_created: number
  outbox_events_created: number
}

export type DeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'canceled' | 'cancelled'
export interface Delivery {
  notification_id: number
  user_id: number
  user_name: string
  user_email: string | null
  channel: Channel
  status: DeliveryStatus
  attempts: number
  error_message: string | null
  sent_at: string | null
  created_at: string
}
export interface DeliveriesPage {
  campaign_id: number
  total: number
  limit: number
  offset: number
  deliveries: Delivery[]
}

export interface Overview {
  total_users: number
  total_campaigns: number
  deliveries: { total: number; sent: number; failed: number; pending: number }
  by_channel: Record<string, Record<string, number>>
  daily_sent: { date: string; channel: Channel; sent: number }[]
  recent_errors: {
    notification_id: number
    campaign_id: number
    campaign_title: string
    user_name: string
    channel: Channel
    attempts: number
    error_message: string | null
    updated_at: string
  }[]
}
