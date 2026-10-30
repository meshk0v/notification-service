import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, Pencil, Plus, Tags, Trash2, Users as UsersIcon } from 'lucide-react'
import { groupsApi } from '../api/endpoints'
import { useGroups, useGroupUsers, useTags } from '../hooks/queries'
import type { Group } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import { TopbarActions } from '../layouts/AppLayout'
import { Button } from '../components/ui/Button'
import { Avatar, TagPill } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Field, Input, Textarea } from '../components/ui/Form'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { RowMenu } from '../components/ui/Menu'
import { useToast } from '../components/ui/Toast'
import { TagPicker } from '../components/TagPicker'
import { TagCreator } from '../components/TagCreator'

export default function Groups() {
  const groups = useGroups()
  const [editing, setEditing] = useState<Group | 'new' | null>(null)
  const [members, setMembers] = useState<Group | null>(null)
  const [deleting, setDeleting] = useState<Group | null>(null)
  const qc = useQueryClient()
  const toast = useToast()

  const remove = useMutation({
    mutationFn: (g: Group) => groupsApi.remove(g.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); toast.success('Группа удалена'); setDeleting(null) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-4">
      <TopbarActions><Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" />Новая группа</Button></TopbarActions>

      <div className="flex items-start gap-2.5 rounded-xl bg-accent-50 px-4 py-3 text-[13px] text-accent-700">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>Пользователь входит в группу, если у него есть <b>хотя бы один</b> из тегов группы (логика ИЛИ).</p>
      </div>

      {groups.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Card key={i} className="space-y-3 p-5"><Skeleton className="h-5 w-1/3" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-6 w-1/2" /></Card>)}</div>
      ) : groups.isError ? <Card><ErrorState error={groups.error} onRetry={() => groups.refetch()} /></Card> :
        groups.data.length === 0 ? (
          <Card><EmptyState icon={<Tags className="size-5" />} title="Групп пока нет" description="Группа объединяет пользователей по тегам и используется как аудитория кампании."
            action={<Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" />Новая группа</Button>} /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.data.map((g) => (
              <Card key={g.id} className="flex flex-col p-5 transition-shadow hover:shadow-pop">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold tracking-tight">{g.name}</h3>
                    <p className="mt-0.5 line-clamp-2 min-h-5 text-[13px] text-muted">{g.description || 'Без описания'}</p>
                  </div>
                  <RowMenu items={[
                    { label: 'Редактировать', icon: <Pencil />, onClick: () => setEditing(g) },
                    { label: 'Удалить', icon: <Trash2 />, danger: true, onClick: () => setDeleting(g) },
                  ]} />
                </div>
                <div className="mt-3 flex flex-1 flex-wrap content-start gap-1.5">
                  {g.tags.length ? g.tags.map((t) => <TagPill key={t.id}>{t.name}</TagPill>) : <span className="text-[12px] text-muted">Нет тегов — в группе никого нет</span>}
                </div>
                <Button size="sm" className="mt-4 self-start" onClick={() => setMembers(g)}><UsersIcon className="size-3.5" />Участники</Button>
              </Card>
            ))}
          </div>
        )}

      {editing && <GroupFormModal group={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {members && <MembersModal group={members} onClose={() => setMembers(null)} />}
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger confirmLabel="Удалить" loading={remove.isPending}
        title="Удалить группу?" onConfirm={() => deleting && remove.mutate(deleting)}
        description={<>Группа <b>{deleting?.name}</b> будет удалена. Кампании, которые на неё ссылались, потеряют привязку к группе.</>} />
    </div>
  )
}

function MembersModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const q = useGroupUsers(group.id)
  return (
    <Modal open onClose={onClose} title={`Участники: ${group.name}`} description={q.data ? `${q.data.length} активных пользователей` : undefined}
      footer={<Button onClick={onClose}>Закрыть</Button>}>
      {q.isPending ? <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div> :
        q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          q.data.length === 0 ? <EmptyState title="Участников нет" description="Ни у одного активного пользователя нет тегов этой группы." /> : (
            <ul className="divide-y divide-line">
              {q.data.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <Avatar name={u.name} />
                  <div className="min-w-0"><p className="truncate font-medium">{u.name}</p><p className="truncate text-[12px] text-muted">{[u.email, u.telegram_id].filter(Boolean).join(' · ') || 'Нет контактов'}</p></div>
                </li>
              ))}
            </ul>
          )}
    </Modal>
  )
}

function GroupFormModal({ group, onClose }: { group: Group | null; onClose: () => void }) {
  const tags = useTags()
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(group?.name ?? '')
  const [description, setDescription] = useState(group?.description ?? '')
  const [tagIds, setTagIds] = useState<number[]>(group?.tags.map((t) => t.id) ?? [])
  const [touched, setTouched] = useState(false)
  const nameError = !name.trim() ? 'Укажите название' : name.length > 100 ? 'Максимум 100 символов' : ''

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim() || null, tag_ids: tagIds }
      return group ? groupsApi.update(group.id, body) : groupsApi.create(body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      toast.success(group ? 'Группа обновлена' : 'Группа создана')
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const submit = (e?: FormEvent) => { e?.preventDefault(); setTouched(true); if (!nameError) save.mutate() }

  return (
    <Modal open onClose={onClose} title={group ? 'Редактировать группу' : 'Новая группа'}
      footer={<><Button onClick={onClose} disabled={save.isPending}>Отмена</Button><Button variant="primary" loading={save.isPending} onClick={() => submit()}>{group ? 'Сохранить' : 'Создать'}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Название" htmlFor="g-name" error={touched ? nameError : ''}>
          <Input id="g-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} invalid={touched && !!nameError} />
        </Field>
        <Field label="Описание" htmlFor="g-desc"><Textarea id="g-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Теги группы" hint="Участник — любой пользователь хотя бы с одним из выбранных тегов">
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
