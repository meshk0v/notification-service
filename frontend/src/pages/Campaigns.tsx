import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, ListChecks, Megaphone, Pencil, Plus, Rocket, Search, BarChart3 } from 'lucide-react'
import { useCampaigns, useGroups } from '../hooks/queries'
import type { Campaign } from '../types/api'
import { formatDateTime } from '../utils/format'
import { campaignStatus, targetLabel } from '../utils/labels'
import { TopbarActions } from '../layouts/AppLayout'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { Input, Select } from '../components/ui/Form'
import { RowMenu } from '../components/ui/Menu'
import { Pagination, Table, TableSkeleton, Td, Th, Tr } from '../components/ui/Table'
import { CampaignPreviewModal, ChannelChips, EditCampaignModal, LaunchDialog, StatusBadge, canModify } from '../components/CampaignParts'

const PAGE_SIZE = 15

export default function Campaigns() {
  const navigate = useNavigate()
  const campaigns = useCampaigns()
  const groups = useGroups()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [edit, setEdit] = useState<Campaign | null>(null)
  const [preview, setPreview] = useState<Campaign | null>(null)
  const [launch, setLaunch] = useState<Campaign | null>(null)

  const groupName = (id: number | null) => groups.data?.find((g) => g.id === id)?.name
  const filtered = useMemo(() => (campaigns.data ?? []).filter((c) =>
    (!status || c.status === status) && (!search.trim() || c.title.toLowerCase().includes(search.trim().toLowerCase()))), [campaigns.data, search, status])
  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const open = (c: Campaign, hash = '') => navigate(`/campaigns/${c.id}${hash}`)

  return (
    <div className="space-y-4">
      <TopbarActions><Button variant="primary" onClick={() => navigate('/campaigns/new')}><Plus className="size-4" />Новая кампания</Button></TopbarActions>

      <div className="flex flex-wrap gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input className="pl-9" placeholder="Поиск по названию" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        </div>
        <Select className="w-52" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }} aria-label="Статус">
          <option value="">Все статусы</option>
          {Object.entries(campaignStatus).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      <Card>
        {campaigns.isPending ? <TableSkeleton cols={7} /> : campaigns.isError ? <ErrorState error={campaigns.error} onRetry={() => campaigns.refetch()} /> :
          filtered.length === 0 ? (
            <EmptyState icon={<Megaphone className="size-5" />} title={campaigns.data.length ? 'Ничего не найдено' : 'Кампаний пока нет'}
              description={campaigns.data.length ? 'Измените поиск или фильтр.' : 'Создайте первую рассылку по Telegram и Email.'}
              action={!campaigns.data.length && <Button variant="primary" onClick={() => navigate('/campaigns/new')}><Plus className="size-4" />Новая кампания</Button>} />
          ) : (
            <>
              <Table>
                <thead><tr><Th>Название</Th><Th>Статус</Th><Th>Аудитория</Th><Th>Каналы</Th><Th>Создана</Th><Th>Запланирована</Th><Th className="w-10" /></tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <Tr key={c.id} onClick={() => open(c)}>
                      <Td className="min-w-[200px]"><span className="font-medium">{c.title}</span><span className="ml-2 text-[12px] text-slate-400">#{c.id}</span></Td>
                      <Td><StatusBadge status={c.status} /></Td>
                      <Td className="text-slate-600">{targetLabel[c.target_type]}{c.target_type === 'group' && <span className="text-muted"> · {groupName(c.group_id) ?? 'удалена'}</span>}</Td>
                      <Td><ChannelChips channels={c.channels} /></Td>
                      <Td className="whitespace-nowrap text-slate-600">{formatDateTime(c.created_at)}</Td>
                      <Td className="whitespace-nowrap text-slate-600">{formatDateTime(c.scheduled_at)}</Td>
                      <Td>
                        <RowMenu items={[
                          { label: 'Подробности', icon: <Eye />, onClick: () => open(c) },
                          { label: 'Предпросмотр', icon: <Eye />, onClick: () => setPreview(c) },
                          { label: 'Редактировать', icon: <Pencil />, hidden: !canModify(c), onClick: () => setEdit(c) },
                          { label: 'Запустить', icon: <Rocket />, hidden: !canModify(c), onClick: () => setLaunch(c) },
                          { label: 'Статистика', icon: <BarChart3 />, onClick: () => open(c) },
                          { label: 'История доставок', icon: <ListChecks />, onClick: () => open(c, '#deliveries') },
                        ]} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
            </>
          )}
      </Card>

      {edit && <EditCampaignModal campaign={edit} onClose={() => setEdit(null)} />}
      {preview && <CampaignPreviewModal campaign={preview} onClose={() => setPreview(null)} />}
      {launch && <LaunchDialog campaign={launch} onClose={() => setLaunch(null)} />}
    </div>
  )
}
