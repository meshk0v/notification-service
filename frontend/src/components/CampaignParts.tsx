import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Rocket, Send } from 'lucide-react'
import { campaignsApi } from '../api/endpoints'
import { useCampaignPreview, useTemplates } from '../hooks/queries'
import type { Campaign, Channel, LaunchResult } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import { fromLocalInput, formatNumber, toLocalInput } from '../utils/format'
import { channelLabel, statusOf } from '../utils/labels'
import { PLACEHOLDERS } from '../utils/template'
import { Badge } from './ui/Badge'
import { Button } from './ui/Button'
import { ErrorState, Skeleton } from './ui/Feedback'
import { Field, Input, Select, Textarea } from './ui/Form'
import { ConfirmDialog, Modal } from './ui/Modal'
import { useToast } from './ui/Toast'
import { Highlighted, MessageBubble } from './MessagePreview'

export const StatusBadge = ({ status }: { status: string }) => {
  const s = statusOf(status)
  return <Badge tone={s.tone} dot>{s.label}</Badge>
}

export const ChannelIcon = ({ channel }: { channel: Channel | string }) =>
  channel === 'email' ? <Mail className="size-3.5" /> : <Send className="size-3.5" />

export const ChannelChips = ({ channels }: { channels: string[] }) => (
  <div className="flex gap-1.5">
    {channels.map((c) => (
      <span key={c} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[12px] font-medium text-slate-600">
        <ChannelIcon channel={c} />{channelLabel[c as Channel] ?? c}
      </span>
    ))}
  </div>
)

export const canModify = (c: Campaign) => c.status === 'draft' || c.status === 'scheduled'

export function PreviewContent({ id }: { id: number }) {
  const q = useCampaignPreview(id)
  if (q.isPending) return <div className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-24" /></div>
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const p = q.data
  const stat = (label: string, value: number, tone = '') => (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[12px] text-muted">{label}</p><p className={`text-[20px] font-semibold tabular-nums ${tone}`}>{formatNumber(value)}</p>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat('Получателей', p.total_recipients)}
        {stat('Telegram', p.telegram_recipients)}
        {stat('Email', p.email_recipients)}
        {stat('Недоступны', p.unavailable_recipients, p.unavailable_recipients ? 'text-amber-600' : '')}
      </div>
      <div>
        <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-muted">Пример сообщения</p>
        {p.sample_message ? <MessageBubble>{p.sample_message}</MessageBubble>
          : <p className="rounded-xl bg-slate-50 p-3 text-[13px] text-muted">В аудитории нет получателей — подставить данные не в кого.</p>}
        <p className="mt-1.5 text-[12px] text-muted">Подстановка выполнена для первого получателя аудитории.</p>
      </div>
    </div>
  )
}

export function CampaignPreviewModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} size="lg" title="Предпросмотр" description={campaign.title} footer={<Button onClick={onClose}>Закрыть</Button>}>
      <PreviewContent id={campaign.id} />
    </Modal>
  )
}

/** Запуск с подтверждением: показывает число получателей из /preview. */
export function LaunchDialog({ campaign, onClose, onLaunched }: {
  campaign: Campaign; onClose: () => void; onLaunched?: (r: LaunchResult) => void
}) {
  const preview = useCampaignPreview(campaign.id)
  const qc = useQueryClient()
  const toast = useToast()
  const launch = useMutation({
    mutationFn: () => campaignsApi.launch(campaign.id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] }); qc.invalidateQueries({ queryKey: ['overview'] })
      toast.success(r.deliveries_created ? `Кампания запущена: создано доставок — ${r.deliveries_created}` : 'Кампания запущена, но доставок не создано: нет доступных получателей')
      onLaunched?.(r); onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const p = preview.data
  return (
    <ConfirmDialog open onClose={onClose} onConfirm={() => launch.mutate()} loading={launch.isPending}
      title="Запустить кампанию?" confirmLabel="Запустить"
      description={<div className="space-y-2">
        <p>Кампания <b>{campaign.title}</b> будет отправлена сразу. Остановить запуск после подтверждения нельзя.</p>
        {preview.isPending ? <Skeleton className="h-5 w-48" /> : p ? (
          <p className="text-[13px] text-muted">Получателей: <b className="text-ink">{p.total_recipients}</b> · Telegram: <b className="text-ink">{p.telegram_recipients}</b> · Email: <b className="text-ink">{p.email_recipients}</b></p>
        ) : null}
        {p && p.total_recipients > 0 && p.telegram_recipients + p.email_recipients === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-700">Ни у кого из аудитории нет доступных выбранных каналов — ничего не будет отправлено.</p>
        )}
      </div>} />
  )
}

export function LaunchButton({ campaign, onLaunched }: { campaign: Campaign; onLaunched?: (r: LaunchResult) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}><Rocket className="size-4" />Запустить</Button>
      {open && <LaunchDialog campaign={campaign} onClose={() => setOpen(false)} onLaunched={onLaunched} />}
    </>
  )
}

/** Редактирование черновика: backend позволяет менять title, message, template_id, scheduled_at. */
export function EditCampaignModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const templates = useTemplates()
  const qc = useQueryClient()
  const toast = useToast()
  const [title, setTitle] = useState(campaign.title)
  const [message, setMessage] = useState(campaign.message)
  const [templateId, setTemplateId] = useState<number | null>(campaign.template_id)
  const [scheduled, setScheduled] = useState(toLocalInput(campaign.scheduled_at))
  const [touched, setTouched] = useState(false)
  const errors = {
    title: !title.trim() ? 'Укажите название' : title.length > 150 ? 'Максимум 150 символов' : '',
    message: !message.trim() ? 'Текст не может быть пустым' : '',
  }

  const save = useMutation({
    mutationFn: () => campaignsApi.update(campaign.id, {
      title: title.trim(), message, template_id: templateId, scheduled_at: fromLocalInput(scheduled),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Кампания обновлена'); onClose() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <Modal open onClose={onClose} size="lg" title="Редактировать кампанию" description="Аудиторию и каналы после создания изменить нельзя."
      footer={<><Button onClick={onClose} disabled={save.isPending}>Отмена</Button>
        <Button variant="primary" loading={save.isPending} onClick={() => { setTouched(true); if (!errors.title && !errors.message) save.mutate() }}>Сохранить</Button></>}>
      <div className="space-y-4">
        <Field label="Название" htmlFor="e-title" error={touched ? errors.title : ''}><Input id="e-title" value={title} onChange={(e) => setTitle(e.target.value)} invalid={touched && !!errors.title} /></Field>
        <Field label="Шаблон" htmlFor="e-tpl">
          <Select id="e-tpl" value={templateId ?? ''} onChange={(e) => {
            const id = e.target.value ? Number(e.target.value) : null
            setTemplateId(id)
            const t = templates.data?.find((x) => x.id === id)
            if (t) setMessage(t.content)
          }}>
            <option value="">Без шаблона</option>
            {templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Текст сообщения" htmlFor="e-msg" error={touched ? errors.message : ''} hint={`Подстановки: ${PLACEHOLDERS.join(', ')}`}>
          <Textarea id="e-msg" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} invalid={touched && !!errors.message} />
        </Field>
        {message && <MessageBubble><Highlighted text={message} /></MessageBubble>}
        <Field label="Запланированная дата" htmlFor="e-sched" hint="Только отметка: автоматического запуска по дате в сервисе нет — кампанию запускает сотрудник.">
          <Input id="e-sched" type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
