import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock, Eye, Pencil, Send, XCircle } from 'lucide-react'
import { useCampaign, useCampaignStats, useDeliveries, useGroups } from '../hooks/queries'
import type { Campaign } from '../types/api'
import { formatDateTime, formatNumber } from '../utils/format'
import { channelLabel, deliveryOf, deliveryStatus, targetLabel } from '../utils/labels'
import { TopbarActions } from '../layouts/AppLayout'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, StatCard } from '../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Select } from '../components/ui/Form'
import { Pagination, Table, TableSkeleton, Td, Th, Tr } from '../components/ui/Table'
import { Highlighted, MessageBubble } from '../components/MessagePreview'
import { CampaignPreviewModal, ChannelChips, ChannelIcon, EditCampaignModal, LaunchButton, StatusBadge, canModify } from '../components/CampaignParts'

const PAGE_SIZE = 20

export default function CampaignDetails() {
  const id = Number(useParams().id)
  const campaign = useCampaign(id)
  const [edit, setEdit] = useState(false)
  const [preview, setPreview] = useState(false)
  const live = campaign.data?.status === 'processing'

  if (Number.isNaN(id)) return <Card><ErrorState error={new Error('Некорректный идентификатор кампании')} /></Card>
  if (campaign.isPending) return <DetailsSkeleton />
  if (campaign.isError) return <Card><ErrorState error={campaign.error} onRetry={() => campaign.refetch()} /></Card>
  const c = campaign.data

  return (
    <div className="space-y-6">
      <TopbarActions>
        <Button onClick={() => setPreview(true)}><Eye className="size-4" />Предпросмотр</Button>
        {canModify(c) && <><Button onClick={() => setEdit(true)}><Pencil className="size-4" />Редактировать</Button><LaunchButton campaign={c} /></>}
      </TopbarActions>

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-[22px] font-semibold tracking-tight">{c.title}</h2>
        <StatusBadge status={c.status} />
        {live && <span className="text-[12px] text-muted">обновляется автоматически…</span>}
      </div>

      <StatsSection id={id} live={live} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Сообщение" />
          <div className="p-5"><MessageBubble><Highlighted text={c.message} /></MessageBubble></div>
        </Card>
        <InfoCard campaign={c} />
      </div>

      <DeliveriesSection id={id} live={live} />

      {edit && <EditCampaignModal campaign={c} onClose={() => setEdit(false)} />}
      {preview && <CampaignPreviewModal campaign={c} onClose={() => setPreview(false)} />}
    </div>
  )
}

function InfoCard({ campaign: c }: { campaign: Campaign }) {
  const groups = useGroups()
  const rows: [string, React.ReactNode][] = [
    ['Аудитория', <>{targetLabel[c.target_type]}{c.target_type === 'group' && <span className="text-muted"> · {groups.data?.find((g) => g.id === c.group_id)?.name ?? 'группа удалена'}</span>}</>],
    ['Каналы', <ChannelChips channels={c.channels} />],
    ['Создана', formatDateTime(c.created_at)],
    ['Запланирована', formatDateTime(c.scheduled_at)],
    ['Запущена', formatDateTime(c.started_at)],
  ]
  return (
    <Card>
      <CardHeader title="Параметры" />
      <dl className="divide-y divide-line px-5">
        {rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-4 py-2.5 text-[13.5px]"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
      </dl>
    </Card>
  )
}

function StatsSection({ id, live }: { id: number; live: boolean }) {
  const stats = useCampaignStats(id, live)
  if (stats.isPending) return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[116px]" />)}</div>
  if (stats.isError) return <Card><ErrorState error={stats.error} onRetry={() => stats.refetch()} /></Card>
  const s = stats.data
  const waiting = s.queued + s.in_progress
  const done = s.total ? Math.round(((s.total - waiting) / s.total) * 100) : 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Всего доставок" value={formatNumber(s.total)} icon={<Send />} tone="neutral" />
        <StatCard label="Отправлено" value={formatNumber(s.sent)} icon={<CheckCircle2 />} tone="success" />
        <StatCard label="Ошибки" value={formatNumber(s.failed)} icon={<XCircle />} tone="danger" />
        <StatCard label="Ожидают" value={formatNumber(waiting)} icon={<Clock />} tone="accent" hint={s.in_progress ? `в обработке: ${s.in_progress}` : undefined} />
      </div>
      {s.total > 0 && (
        <Card className="px-5 py-4">
          <div className="mb-2 flex justify-between text-[12px] text-muted"><span>Обработано {done}%</span>
            <span>{Object.entries(s.channels).map(([ch, n]) => `${channelLabel[ch as keyof typeof channelLabel] ?? ch}: ${n}`).join(' · ')}</span></div>
          <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-emerald-500 transition-all" style={{ width: `${(s.sent / s.total) * 100}%` }} />
            <div className="bg-red-500 transition-all" style={{ width: `${(s.failed / s.total) * 100}%` }} />
          </div>
        </Card>
      )}
    </div>
  )
}

function DeliveriesSection({ id, live }: { id: number; live: boolean }) {
  const [status, setStatus] = useState('')
  const [channel, setChannel] = useState('')
  const [page, setPage] = useState(0)
  const { hash } = useLocation()
  const q = useDeliveries(id, { limit: PAGE_SIZE, offset: page * PAGE_SIZE, status: status || undefined, channel: channel || undefined }, live)

  useEffect(() => { if (hash === '#deliveries') setTimeout(() => document.getElementById('deliveries')?.scrollIntoView({ behavior: 'smooth' }), 100) }, [hash])

  return (
    <Card>
      <div id="deliveries" className="scroll-mt-20" />
      <CardHeader title="История доставок" description={q.data ? `${formatNumber(q.data.total)} записей` : undefined}
        action={<div className="flex gap-2">
          <Select className="w-40" aria-label="Статус" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
            <option value="">Все статусы</option>
            {Object.entries(deliveryStatus).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
          <Select className="w-36" aria-label="Канал" value={channel} onChange={(e) => { setChannel(e.target.value); setPage(0) }}>
            <option value="">Все каналы</option>
            <option value="telegram">Telegram</option><option value="email">Email</option>
          </Select>
        </div>} />
      {q.isPending ? <TableSkeleton cols={7} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
        q.data.deliveries.length === 0 ? (
          <EmptyState icon={<AlertTriangle className="size-5" />} title={status || channel ? 'Нет доставок с такими фильтрами' : 'Доставок пока нет'}
            description={status || channel ? undefined : 'Доставки появятся после запуска кампании (и только для получателей с доступным каналом).'} />
        ) : (
          <div className={q.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <Table>
              <thead><tr><Th>Получатель</Th><Th>Email</Th><Th>Канал</Th><Th>Статус</Th><Th>Попытки</Th><Th>Ошибка</Th><Th>Отправлено</Th></tr></thead>
              <tbody>
                {q.data.deliveries.map((d) => {
                  const s = deliveryOf(d.status)
                  return (
                    <Tr key={d.notification_id}>
                      <Td className="font-medium">{d.user_name}</Td>
                      <Td className="text-slate-600">{d.user_email ?? '—'}</Td>
                      <Td><span className="inline-flex items-center gap-1.5 text-slate-600"><ChannelIcon channel={d.channel} />{channelLabel[d.channel] ?? d.channel}</span></Td>
                      <Td><Badge tone={s.tone} dot>{s.label}</Badge></Td>
                      <Td className="tabular-nums text-slate-600">{d.attempts}</Td>
                      <Td className="max-w-[280px]">{d.error_message ? <span title={d.error_message} className="line-clamp-2 text-[12.5px] text-red-600">{d.error_message}</span> : <span className="text-slate-300">—</span>}</Td>
                      <Td className="whitespace-nowrap text-slate-600">{formatDateTime(d.sent_at)}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
            <Pagination page={page} pageSize={PAGE_SIZE} total={q.data.total} onChange={setPage} />
          </div>
        )}
    </Card>
  )
}

function DetailsSkeleton() {
  return <div className="space-y-6"><Skeleton className="h-8 w-72" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[116px]" />)}</div><Skeleton className="h-48" /></div>
}
