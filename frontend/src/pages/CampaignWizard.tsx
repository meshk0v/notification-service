import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft, ArrowRight, Check, FileText, Globe, Layers, Mail, Pencil, Rocket, Save, Send, UserCheck } from 'lucide-react'
import { campaignsApi } from '../api/endpoints'
import { useCampaign, useGroups, useGroupUsers, useTemplates, useUsers } from '../hooks/queries'
import type { Channel, TargetType, User } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import { fromLocalInput } from '../utils/format'
import { channelLabel, targetLabel } from '../utils/labels'
import { PLACEHOLDERS, renderMessage } from '../utils/template'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ErrorState, Skeleton } from '../components/ui/Feedback'
import { Checkbox, Field, Input, Select, Textarea } from '../components/ui/Form'
import { useToast } from '../components/ui/Toast'
import { Highlighted, MessageBubble } from '../components/MessagePreview'
import { EditCampaignModal, LaunchDialog, PreviewContent, StatusBadge, ChannelChips } from '../components/CampaignParts'

const STEPS = ['Основное', 'Аудитория', 'Каналы', 'Сообщение', 'Предпросмотр', 'Запуск']

export default function CampaignWizard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const toast = useToast()
  const users = useUsers()
  const groups = useGroups()
  const templates = useTemplates()

  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [scheduled, setScheduled] = useState('')
  const [target, setTarget] = useState<TargetType>('all')
  const [groupId, setGroupId] = useState<number | null>(null)
  const [userIds, setUserIds] = useState<number[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [mode, setMode] = useState<'template' | 'custom'>('custom')
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [draftId, setDraftId] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [launching, setLaunching] = useState(false)

  const groupUsers = useGroupUsers(target === 'group' ? groupId : null)
  const draft = useCampaign(draftId ?? 0, draftId !== null)
  const locked = draftId !== null

  const sampleUser = useMemo(() => {
    if (target === 'individual') return users.data?.find((u) => userIds.includes(u.id))
    if (target === 'group') return groupUsers.data?.[0]
    return users.data?.[0]
  }, [target, users.data, userIds, groupUsers.data])

  const stepError = (s: number): string => {
    if (s === 0) return !title.trim() ? 'Укажите название кампании' : title.length > 150 ? 'Название — максимум 150 символов' : ''
    if (s === 1) return target === 'group' && groupId === null ? 'Выберите группу' : target === 'individual' && !userIds.length ? 'Выберите хотя бы одного пользователя' : ''
    if (s === 2) return channels.length ? '' : 'Выберите хотя бы один канал'
    if (s === 3) return message.trim() ? '' : 'Введите текст сообщения или выберите шаблон'
    return ''
  }
  const error = stepError(step)

  const create = useMutation({
    mutationFn: () => campaignsApi.create({
      title: title.trim(), message, template_id: mode === 'template' ? templateId : null,
      target_type: target, group_id: target === 'group' ? groupId : null,
      user_ids: target === 'individual' ? userIds : [], channels, scheduled_at: fromLocalInput(scheduled),
    }),
    onSuccess: (c) => { setDraftId(c.id); setStep(4); qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Черновик создан') },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const next = () => { if (!error) (step === 3 && !locked ? create.mutate() : setStep(step + 1)) }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Stepper step={step} locked={locked} onGo={(i) => !locked && i < step && setStep(i)} />

      <Card className="p-6">
        {step === 0 && (
          <div className="space-y-4">
            <Header title="Основная информация" text="Название видят только сотрудники." />
            <Field label="Название кампании" htmlFor="w-title"><Input id="w-title" autoFocus maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например, Весенняя акция" /></Field>
            <Field label="Запланированная дата (необязательно)" htmlFor="w-sched" hint="Это только отметка: автоматического запуска по дате в сервисе нет — запустите кампанию вручную.">
              <Input id="w-sched" type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Header title="Аудитория" text="Кому отправить кампанию." />
            <div className="grid gap-3 sm:grid-cols-3">
              {([['all', Globe, 'Все активные пользователи'], ['group', Layers, 'Пользователи с тегами группы'], ['individual', UserCheck, 'Выбрать вручную']] as const).map(([k, Icon, hint]) => (
                <OptionCard key={k} active={target === k} onClick={() => setTarget(k)} icon={<Icon className="size-4" />} title={targetLabel[k]} hint={hint} />
              ))}
            </div>
            {target === 'all' && <p className="rounded-lg bg-slate-50 p-3 text-[13px] text-muted">Будут охвачены все активные пользователи{users.data ? `: ${users.data.length}` : ''}.</p>}
            {target === 'group' && (
              <Field label="Группа" htmlFor="w-group">
                {groups.isError ? <ErrorState error={groups.error} onRetry={() => groups.refetch()} /> : (
                  <Select id="w-group" value={groupId ?? ''} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Выберите группу…</option>
                    {groups.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </Select>)}
                {groupId !== null && <p className="mt-1.5 text-[12px] text-muted">{groupUsers.isPending ? 'Считаем участников…' : `Участников: ${groupUsers.data?.length ?? 0}`}</p>}
              </Field>
            )}
            {target === 'individual' && <UserPicker users={users.data} loading={users.isPending} error={users.error} selected={userIds} onChange={setUserIds} />}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Header title="Каналы доставки" text="Сообщение уйдёт тем получателям, у кого канал помечен доступным." />
            <div className="grid gap-3 sm:grid-cols-2">
              {(['telegram', 'email'] as const).map((ch) => (
                <OptionCard key={ch} active={channels.includes(ch)} icon={ch === 'email' ? <Mail className="size-4" /> : <Send className="size-4" />} title={channelLabel[ch]}
                  hint={ch === 'email' ? 'Письмо на адрес пользователя' : 'Сообщение в Telegram-чат'}
                  onClick={() => setChannels((c) => c.includes(ch) ? c.filter((x) => x !== ch) : [...c, ch])} />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Header title="Сообщение" text={`Подстановки: ${PLACEHOLDERS.join(', ')}.`} />
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[13px] font-medium">
              {([['custom', 'Свой текст', Pencil], ['template', 'Из шаблона', FileText]] as const).map(([k, label, Icon]) => (
                <button key={k} onClick={() => { setMode(k); if (k === 'custom') setTemplateId(null) }}
                  className={clsx('flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors', mode === k ? 'bg-white shadow-sm' : 'text-muted hover:text-ink')}><Icon className="size-3.5" />{label}</button>
              ))}
            </div>
            {mode === 'template' && (
              <Field label="Шаблон" htmlFor="w-tpl" hint={templates.data?.length === 0 ? 'Шаблонов нет — создайте их в разделе «Шаблоны».' : 'Текст подставится в поле ниже, его можно отредактировать.'}>
                <Select id="w-tpl" value={templateId ?? ''} onChange={(e) => {
                  const id = e.target.value ? Number(e.target.value) : null
                  setTemplateId(id)
                  const t = templates.data?.find((x) => x.id === id)
                  if (t) setMessage(t.content)
                }}>
                  <option value="">Выберите шаблон…</option>
                  {templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Текст сообщения" htmlFor="w-msg">
              <div className="space-y-2">
                <div className="flex gap-1.5">{PLACEHOLDERS.map((p) => <button key={p} type="button" onClick={() => setMessage((m) => m + p)} className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-[12px] text-accent-700 transition-colors hover:bg-accent-100">+ {p}</button>)}</div>
                <Textarea id="w-msg" rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
            </Field>
            {message.trim() && (
              <div>
                <p className="mb-1.5 text-[12px] font-medium uppercase tracking-wide text-muted">Так увидит {sampleUser ? sampleUser.name : 'получатель'}</p>
                <MessageBubble>{sampleUser ? renderMessage(message, sampleUser as Pick<User, 'name' | 'email'>) : <Highlighted text={message} />}</MessageBubble>
              </div>
            )}
          </div>
        )}

        {step === 4 && draftId !== null && (
          <div className="space-y-4">
            <Header title="Предпросмотр" text="Расчёт выполнен сервером для сохранённого черновика." />
            <PreviewContent id={draftId} />
            <Button size="sm" onClick={() => setEditing(true)}><Pencil className="size-3.5" />Изменить название или текст</Button>
          </div>
        )}

        {step === 5 && draftId !== null && (
          <div className="space-y-4">
            <Header title="Подтверждение" text="Проверьте параметры и запустите рассылку." />
            {draft.isPending ? <Skeleton className="h-32" /> : draft.data && (
              <dl className="divide-y divide-line rounded-xl bg-slate-50 px-4 text-[13.5px]">
                {([['Название', draft.data.title], ['Статус', <StatusBadge status={draft.data.status} />], ['Аудитория', targetLabel[draft.data.target_type]], ['Каналы', <ChannelChips channels={draft.data.channels} />]] as [string, ReactNode][]).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2.5"><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>))}
              </dl>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setLaunching(true)} disabled={!draft.data}><Rocket className="size-4" />Запустить сейчас</Button>
              <Button onClick={() => navigate(`/campaigns/${draftId}`)}><Save className="size-4" />Оставить черновиком</Button>
            </div>
          </div>
        )}
      </Card>

      {step < 5 && (
        <div className="flex items-center justify-between">
          <Button onClick={() => step === 0 ? navigate('/campaigns') : setStep(step - 1)} disabled={locked && step <= 4}>
            <ArrowLeft className="size-4" />{step === 0 ? 'К списку' : 'Назад'}
          </Button>
          <div className="flex items-center gap-3">
            {error && <span className="text-[13px] text-red-600">{error}</span>}
            {locked && step === 4 && <span className="hidden text-[12px] text-muted sm:inline">Черновик уже создан</span>}
            <Button variant="primary" onClick={next} disabled={!!error} loading={create.isPending}>
              {step === 3 && !locked ? 'Создать черновик' : 'Далее'}<ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {editing && draft.data && <EditCampaignModal campaign={draft.data} onClose={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['campaigns', draftId, 'preview'] }) }} />}
      {launching && draft.data && <LaunchDialog campaign={draft.data} onClose={() => setLaunching(false)} onLaunched={() => navigate(`/campaigns/${draftId}`)} />}
    </div>
  )
}

const Header = ({ title, text }: { title: string; text: string }) => (
  <div><h2 className="text-[16px] font-semibold tracking-tight">{title}</h2><p className="text-[13px] text-muted">{text}</p></div>
)

function Stepper({ step, locked, onGo }: { step: number; locked: boolean; onGo: (i: number) => void }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1">
      {STEPS.map((label, i) => {
        const done = i < step
        return (
          <li key={label} className="flex items-center gap-1">
            <button onClick={() => onGo(i)} disabled={locked || !done}
              className={clsx('flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-1 text-[13px] font-medium transition-colors',
                i === step ? 'bg-accent-50 text-accent-700' : done ? 'text-ink hover:bg-slate-100' : 'text-muted')}>
              <span className={clsx('flex size-5 items-center justify-center rounded-full text-[11px]', i === step ? 'bg-accent-600 text-white' : done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500')}>
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={i === step ? '' : 'hidden'}>{label}</span>
            </button>
            {i < STEPS.length - 1 && <span className="h-px w-4 bg-line" />}
          </li>
        )
      })}
    </ol>
  )
}

function OptionCard({ active, onClick, icon, title, hint }: { active: boolean; onClick: () => void; icon: ReactNode; title: string; hint: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={clsx('rounded-xl p-4 text-left transition-all', active ? 'bg-accent-50 ring-2 ring-accent-500' : 'bg-white shadow-card hover:shadow-pop')}>
      <span className={clsx('mb-2 flex size-8 items-center justify-center rounded-lg', active ? 'bg-accent-600 text-white' : 'bg-slate-100 text-slate-500')}>{icon}</span>
      <p className="text-[14px] font-medium">{title}</p><p className="text-[12px] text-muted">{hint}</p>
    </button>
  )
}

function UserPicker({ users, loading, error, selected, onChange }: {
  users: User[] | undefined; loading: boolean; error: unknown; selected: number[]; onChange: (ids: number[]) => void
}) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (users ?? []).filter((u) => !s || u.name.toLowerCase().includes(s) || (u.email ?? '').toLowerCase().includes(s))
  }, [users, q])
  if (loading) return <Skeleton className="h-48" />
  if (error) return <ErrorState error={error} />
  const allShown = list.length > 0 && list.every((u) => selected.includes(u.id))
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input placeholder="Поиск пользователей" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => onChange(allShown ? selected.filter((id) => !list.some((u) => u.id === id)) : [...new Set([...selected, ...list.map((u) => u.id)])])}>{allShown ? 'Снять' : 'Выбрать все'}</Button>
      </div>
      <div className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl shadow-card">
        {list.length === 0 && <p className="p-4 text-center text-[13px] text-muted">Никого не найдено</p>}
        {list.map((u) => (
          <div key={u.id} className="px-3 py-2">
            <Checkbox checked={selected.includes(u.id)} onChange={(v) => onChange(v ? [...selected, u.id] : selected.filter((id) => id !== u.id))}
              label={<span className="flex items-center gap-2">{u.name}<span className="text-[12px] text-muted">{u.email}</span></span>} />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted"><Badge tone="accent">Выбрано: {selected.length}</Badge></div>
    </div>
  )
}
