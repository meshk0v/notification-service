import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Megaphone, Plus, Users, XCircle } from 'lucide-react'
import { useCampaigns, useOverview } from '../hooks/queries'
import type { Channel, Overview } from '../types/api'
import { formatDateTime, formatNumber, formatShortDate } from '../utils/format'
import { channelLabel } from '../utils/labels'
import { TopbarActions } from '../layouts/AppLayout'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, StatCard } from '../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Table, TableSkeleton, Td, Th, Tr } from '../components/ui/Table'
import { ChannelChips, ChannelIcon, StatusBadge } from '../components/CampaignParts'

const COLORS: Record<Channel, string> = { telegram: 'bg-accent-600', email: 'bg-sky-400' }

export default function Dashboard() {
  const navigate = useNavigate()
  const overview = useOverview()
  const campaigns = useCampaigns()

  return (
    <div className="space-y-6">
      <TopbarActions><Button variant="primary" onClick={() => navigate('/campaigns/new')}><Plus className="size-4" />Новая кампания</Button></TopbarActions>

      {overview.isError ? <Card><ErrorState error={overview.error} onRetry={() => overview.refetch()} /></Card> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {overview.isPending ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[116px]" />) : <>
              <StatCard label="Всего пользователей" value={formatNumber(overview.data.total_users)} icon={<Users />} />
              <StatCard label="Всего кампаний" value={formatNumber(overview.data.total_campaigns)} icon={<Megaphone />} tone="neutral" />
              <StatCard label="Отправлено" value={formatNumber(overview.data.deliveries.sent)} icon={<CheckCircle2 />} tone="success"
                hint={overview.data.deliveries.pending ? `в очереди: ${formatNumber(overview.data.deliveries.pending)}` : undefined} />
              <StatCard label="Ошибки доставки" value={formatNumber(overview.data.deliveries.failed)} icon={<XCircle />} tone="danger" />
            </>}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Отправки" description="Успешные доставки за последние 14 дней" />
              <div className="p-5">{overview.isPending ? <Skeleton className="h-52" /> : <SendsChart data={overview.data.daily_sent} />}</div>
            </Card>
            <Card>
              <CardHeader title="Каналы" description="Все доставки по каналам" />
              <div className="space-y-5 p-5">{overview.isPending ? <Skeleton className="h-40" /> : <ChannelSplit data={overview.data.by_channel} />}</div>
            </Card>
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Последние кампании" action={<Link to="/campaigns" className="text-[13px] font-medium text-accent-600 hover:text-accent-700">Все</Link>} />
          {campaigns.isPending ? <TableSkeleton cols={3} rows={4} /> : campaigns.isError ? <ErrorState error={campaigns.error} onRetry={() => campaigns.refetch()} /> :
            campaigns.data.length === 0 ? <EmptyState icon={<Megaphone className="size-5" />} title="Кампаний пока нет" description="Создайте первую рассылку." /> : (
              <Table compact>
                <thead><tr><Th>Название</Th><Th>Статус</Th><Th>Каналы</Th></tr></thead>
                <tbody>{campaigns.data.slice(0, 5).map((c) => (
                  <Tr key={c.id} onClick={() => navigate(`/campaigns/${c.id}`)}>
                    <Td><p className="font-medium">{c.title}</p><p className="text-[12px] text-muted">{formatDateTime(c.created_at)}</p></Td>
                    <Td><StatusBadge status={c.status} /></Td><Td><ChannelChips channels={c.channels} /></Td>
                  </Tr>))}</tbody>
              </Table>
            )}
        </Card>

        <Card>
          <CardHeader title="Последние ошибки доставки" />
          {overview.isPending ? <TableSkeleton cols={3} rows={4} /> : overview.isError ? <ErrorState error={overview.error} onRetry={() => overview.refetch()} /> :
            <Errors errors={overview.data.recent_errors} />}
        </Card>
      </div>
    </div>
  )
}

function SendsChart({ data }: { data: Overview['daily_sent'] }) {
  const days = useMemo(() => {
    const map = new Map<string, Record<Channel, number>>()
    // непрерывная шкала дат: 14 дней, заканчивая сегодня (дни без отправок = 0)
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      map.set(d.toISOString().slice(0, 10), { telegram: 0, email: 0 })
    }
    for (const r of data) { const e = map.get(r.date); if (e) e[r.channel] += r.sent }
    return [...map.entries()]
  }, [data])
  const max = Math.max(1, ...days.map(([, v]) => v.telegram + v.email))
  const total = days.reduce((s, [, v]) => s + v.telegram + v.email, 0)

  if (total === 0) return <EmptyState icon={<AlertTriangle className="size-5" />} title="Нет отправок за период" description="Данные появятся после первой успешной доставки." />
  return (
    <div>
      <div className="flex h-52 items-end gap-1.5 border-b border-line">
        {days.map(([date, v]) => {
          const sum = v.telegram + v.email
          return (
            <div key={date} className="group relative flex h-full flex-1 flex-col justify-end" aria-label={`${date}: ${sum}`}>
              <div className="pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[12px] text-white shadow-pop group-hover:block">
                <b>{formatShortDate(date)}</b> · Telegram {v.telegram} · Email {v.email}
              </div>
              <div className="flex flex-col overflow-hidden rounded-t transition-opacity group-hover:opacity-80" style={{ height: `${(sum / max) * 100}%` }}>
                <div className={COLORS.email} style={{ flex: v.email }} />
                <div className={COLORS.telegram} style={{ flex: v.telegram }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted"><span>{formatShortDate(days[0][0])}</span><span>{formatShortDate(days[days.length - 1][0])}</span></div>
      <div className="mt-3 flex gap-4 text-[12px] text-muted">
        {(['telegram', 'email'] as const).map((c) => <span key={c} className="flex items-center gap-1.5"><span className={`size-2 rounded-sm ${COLORS[c]}`} />{channelLabel[c]}</span>)}
      </div>
    </div>
  )
}

function ChannelSplit({ data }: { data: Overview['by_channel'] }) {
  const entries = Object.entries(data)
  if (!entries.length) return <EmptyState title="Нет данных" description="Доставок ещё не было." />
  return <>{entries.map(([ch, st]) => {
    const total = Object.values(st).reduce((a, b) => a + b, 0)
    const sent = st.sent ?? 0, failed = st.failed ?? 0
    return (
      <div key={ch}>
        <div className="mb-1.5 flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1.5 font-medium"><ChannelIcon channel={ch} />{channelLabel[ch as Channel] ?? ch}</span>
          <span className="tabular-nums text-muted">{formatNumber(total)}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="bg-emerald-500" style={{ width: `${(sent / total) * 100}%` }} /><div className="bg-red-500" style={{ width: `${(failed / total) * 100}%` }} />
        </div>
        <p className="mt-1 text-[12px] text-muted">Отправлено {sent} · ошибок {failed}</p>
      </div>
    )
  })}</>
}

function Errors({ errors }: { errors: Overview['recent_errors'] }) {
  if (!errors.length) return <EmptyState icon={<CheckCircle2 className="size-5" />} title="Ошибок нет" description="Все доставки проходят успешно." />
  return (
    <ul className="divide-y divide-line">
      {errors.slice(0, 6).map((e) => (
        <li key={e.notification_id}>
          <Link to={`/campaigns/${e.campaign_id}#deliveries`} className="block px-5 py-3 transition-colors hover:bg-slate-50/70">
            <div className="flex items-center justify-between gap-3 text-[13.5px]">
              <span className="truncate font-medium">{e.user_name} <span className="font-normal text-muted">· {e.campaign_title}</span></span>
              <span className="shrink-0 text-[12px] text-muted">{formatDateTime(e.updated_at)}</span>
            </div>
            <p className="mt-0.5 line-clamp-1 text-[12.5px] text-red-600">{channelLabel[e.channel]}: {e.error_message ?? 'без описания'}</p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
