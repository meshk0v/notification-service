import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Pencil, Plus, Search, Send, Trash2, Users as UsersIcon } from 'lucide-react'
import { tagsApi, usersApi } from '../api/endpoints'
import { useTags, useUsers } from '../hooks/queries'
import type { User } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import { formatDateTime } from '../utils/format'
import { TopbarActions } from '../layouts/AppLayout'
import { Button } from '../components/ui/Button'
import { Badge, Avatar, TagPill } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState } from '../components/ui/Feedback'
import { Field, Input, Switch } from '../components/ui/Form'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { RowMenu } from '../components/ui/Menu'
import { Pagination, Table, TableSkeleton, Td, Th, Tr } from '../components/ui/Table'
import { useToast } from '../components/ui/Toast'
import { TagPicker } from '../components/TagPicker'
import { TagCreator } from '../components/TagCreator'

const PAGE_SIZE = 15
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Users() {
  const users = useUsers()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [viewing, setViewing] = useState<User | null>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const qc = useQueryClient()
  const toast = useToast()

  const remove = useMutation({
    mutationFn: (u: User) => usersApi.remove(u.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['overview'] }); toast.success('Пользователь деактивирован'); setDeleting(null) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users.data ?? []
    return (users.data ?? []).filter((u) =>
      [u.name, u.email ?? '', String(u.telegram_id ?? ''), ...u.tags.map((t) => t.name)].some((v) => v.toLowerCase().includes(q)))
  }, [users.data, search])

  const rows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <TopbarActions><Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" />Новый пользователь</Button></TopbarActions>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
        <Input className="pl-9" placeholder="Поиск по имени, email, Telegram ID, тегу" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
      </div>

      <Card>
        {users.isPending ? <TableSkeleton cols={7} /> : users.isError ? <ErrorState error={users.error} onRetry={() => users.refetch()} /> :
          filtered.length === 0 ? (
            <EmptyState icon={<UsersIcon className="size-5" />} title={search ? 'Ничего не найдено' : 'Пользователей пока нет'}
              description={search ? 'Попробуйте изменить запрос.' : 'Добавьте первого получателя рассылок.'}
              action={!search && <Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" />Новый пользователь</Button>} />
          ) : (
            <>
              <Table>
                <thead><tr><Th>Имя</Th><Th>Email</Th><Th>Telegram ID</Th><Th>Каналы</Th><Th>Статус</Th><Th>Теги</Th><Th className="w-10" /></tr></thead>
                <tbody>
                  {rows.map((u) => (
                    <Tr key={u.id} onClick={() => setViewing(u)}>
                      <Td><div className="flex items-center gap-2.5"><Avatar name={u.name} /><span className="font-medium">{u.name}</span></div></Td>
                      <Td className="text-slate-600">{u.email ?? <span className="text-slate-300">—</span>}</Td>
                      <Td className="font-mono text-[13px] text-slate-600">{u.telegram_id ?? <span className="text-slate-300">—</span>}</Td>
                      <Td>
                        <div className="flex gap-1.5">
                          <Badge tone={u.email_available ? 'success' : 'neutral'}>Email</Badge>
                          <Badge tone={u.telegram_available ? 'success' : 'neutral'}>Telegram</Badge>
                        </div>
                      </Td>
                      <Td><Badge tone={u.is_active ? 'success' : 'neutral'} dot>{u.is_active ? 'Активен' : 'Неактивен'}</Badge></Td>
                      <Td>{u.tags.length ? <div className="flex max-w-[200px] flex-wrap gap-1">{u.tags.map((t) => <TagPill key={t.id}>{t.name}</TagPill>)}</div> : <span className="text-slate-300">—</span>}</Td>
                      <Td>
                        <RowMenu items={[
                          { label: 'Редактировать', icon: <Pencil />, onClick: () => setEditing(u) },
                          { label: 'Деактивировать', icon: <Trash2 />, danger: true, onClick: () => setDeleting(u) },
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

      {editing && <UserFormModal user={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? ''} description={viewing ? `Создан ${formatDateTime(viewing.created_at)}` : undefined}
        footer={<><Button onClick={() => setViewing(null)}>Закрыть</Button><Button variant="primary" onClick={() => { setEditing(viewing); setViewing(null) }}><Pencil className="size-4" />Редактировать</Button></>}>
        {viewing && (
          <dl className="space-y-3 text-[14px]">
            <Row label="Email" value={viewing.email ?? '—'} extra={<Badge tone={viewing.email_available ? 'success' : 'neutral'}>{viewing.email_available ? 'Доступен' : 'Недоступен'}</Badge>} />
            <Row label="Telegram ID" value={viewing.telegram_id?.toString() ?? '—'} extra={<Badge tone={viewing.telegram_available ? 'success' : 'neutral'}>{viewing.telegram_available ? 'Доступен' : 'Недоступен'}</Badge>} />
            <Row label="Статус" value={viewing.is_active ? 'Активен' : 'Неактивен'} />
            <div className="flex items-start justify-between gap-4">
              <dt className="text-muted">Теги</dt>
              <dd className="flex flex-wrap justify-end gap-1">{viewing.tags.length ? viewing.tags.map((t) => <TagPill key={t.id}>{t.name}</TagPill>) : '—'}</dd>
            </div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger confirmLabel="Деактивировать" loading={remove.isPending}
        title="Деактивировать пользователя?" onConfirm={() => deleting && remove.mutate(deleting)}
        description={<>Пользователь <b>{deleting?.name}</b> исчезнет из списков и аудиторий рассылок. История доставок сохранится.</>} />
    </div>
  )
}

function Row({ label, value, extra }: { label: string; value: string; extra?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4"><dt className="text-muted">{label}</dt><dd className="flex items-center gap-2 text-right font-medium">{value}{extra}</dd></div>
}

function UserFormModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const tags = useTags()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [tg, setTg] = useState(user?.telegram_id?.toString() ?? '')
  const [emailOn, setEmailOn] = useState(user?.email_available ?? false)
  const [tgOn, setTgOn] = useState(user?.telegram_available ?? false)
  const [tagIds, setTagIds] = useState<number[]>(user?.tags.map((t) => t.id) ?? [])
  const [touched, setTouched] = useState(false)

  const errors = {
    name: name.trim() ? (name.length > 100 ? 'Максимум 100 символов' : '') : 'Укажите имя',
    email: email.trim() && !EMAIL_RE.test(email.trim()) ? 'Некорректный email' : '',
    tg: tg.trim() && !/^-?\d+$/.test(tg.trim()) ? 'Только цифры' : '',
  }
  const valid = !errors.name && !errors.email && !errors.tg

  const save = useMutation({
    mutationFn: async () => {
      const emailVal = email.trim() || null
      const tgVal = tg.trim() ? Number(tg.trim()) : null
      const flags = { email_available: emailOn && !!emailVal, telegram_available: tgOn && tgVal !== null }
      let saved: User
      if (user) {
        saved = await usersApi.update(user.id, { name: name.trim(), email: emailVal, telegram_id: tgVal, ...flags })
      } else {
        // POST принимает только name/email/telegram_id; доступность каналов выставляем отдельным PATCH
        saved = await usersApi.create({ name: name.trim(), email: emailVal, telegram_id: tgVal })
        if (flags.email_available || flags.telegram_available) await usersApi.update(saved.id, flags)
      }
      const before = new Set(user?.tags.map((t) => t.id) ?? [])
      const after = new Set(tagIds)
      await Promise.all([
        ...[...after].filter((id) => !before.has(id)).map((id) => tagsApi.assign(id, saved.id)),
        ...[...before].filter((id) => !after.has(id)).map((id) => tagsApi.unassign(id, saved.id)),
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['overview'] })
      toast.success(user ? 'Изменения сохранены' : 'Пользователь создан')
      onClose()
    },
    onError: (e) => { toast.error(getErrorMessage(e)); qc.invalidateQueries({ queryKey: ['users'] }) },
  })

  const submit = (e: FormEvent) => { e.preventDefault(); setTouched(true); if (valid) save.mutate() }

  return (
    <Modal open onClose={onClose} title={user ? 'Редактировать пользователя' : 'Новый пользователь'} size="lg"
      footer={<><Button onClick={onClose} disabled={save.isPending}>Отмена</Button><Button variant="primary" loading={save.isPending} onClick={submit}>{user ? 'Сохранить' : 'Создать'}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Имя" htmlFor="u-name" error={touched ? errors.name : ''}>
          <Input id="u-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} invalid={touched && !!errors.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="u-email" error={touched ? errors.email : ''}>
            <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} invalid={touched && !!errors.email} />
          </Field>
          <Field label="Telegram ID" htmlFor="u-tg" error={touched ? errors.tg : ''} hint="Числовой ID чата">
            <Input id="u-tg" inputMode="numeric" value={tg} onChange={(e) => setTg(e.target.value)} invalid={touched && !!errors.tg} />
          </Field>
        </div>
        <div className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-3 text-[13px]"><span className="flex items-center gap-2"><Mail className="size-4 text-muted" />Email доступен</span>
            <Switch label="Email доступен" checked={emailOn && !!email.trim()} onChange={setEmailOn} /></label>
          <label className="flex items-center justify-between gap-3 text-[13px]"><span className="flex items-center gap-2"><Send className="size-4 text-muted" />Telegram доступен</span>
            <Switch label="Telegram доступен" checked={tgOn && !!tg.trim()} onChange={setTgOn} /></label>
          <p className="text-[12px] text-muted sm:col-span-2">Рассылка идёт только по каналам, отмеченным доступными (и при заполненном контакте).</p>
        </div>
        <Field label="Теги">
          <div className="space-y-3">
            <TagPicker tags={tags.data ?? []} selected={tagIds} onChange={setTagIds} />
            <TagCreator onCreated={(t) => setTagIds((ids) => [...ids, t.id])} />
          </div>
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
