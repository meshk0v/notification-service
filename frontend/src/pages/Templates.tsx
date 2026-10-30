import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { templatesApi } from '../api/endpoints'
import { useTemplates } from '../hooks/queries'
import type { Template } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import { formatDateTime } from '../utils/format'
import { PLACEHOLDERS } from '../utils/template'
import { TopbarActions } from '../layouts/AppLayout'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback'
import { Field, Input, Textarea } from '../components/ui/Form'
import { ConfirmDialog, Modal } from '../components/ui/Modal'
import { RowMenu } from '../components/ui/Menu'
import { useToast } from '../components/ui/Toast'
import { Highlighted, MessageBubble } from '../components/MessagePreview'

export default function Templates() {
  const templates = useTemplates()
  const [editing, setEditing] = useState<Template | 'new' | null>(null)
  const [viewing, setViewing] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState<Template | null>(null)
  const qc = useQueryClient()
  const toast = useToast()

  const remove = useMutation({
    mutationFn: (t: Template) => templatesApi.remove(t.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Шаблон удалён'); setDeleting(null) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <div className="space-y-4">
      <TopbarActions><Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" />Новый шаблон</Button></TopbarActions>

      {templates.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Card key={i} className="space-y-3 p-5"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-16" /></Card>)}</div>
      ) : templates.isError ? <Card><ErrorState error={templates.error} onRetry={() => templates.refetch()} /></Card> :
        templates.data.length === 0 ? (
          <Card><EmptyState icon={<FileText className="size-5" />} title="Шаблонов пока нет" description={`Сохраните текст сообщения и используйте его в кампаниях. Доступны подстановки ${PLACEHOLDERS.join(' и ')}.`}
            action={<Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" />Новый шаблон</Button>} /></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {templates.data.map((t) => (
              <Card key={t.id} className="group flex cursor-pointer flex-col p-5 transition-shadow hover:shadow-pop" >
                <div className="flex items-start justify-between gap-2" onClick={() => setViewing(t)}>
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold tracking-tight">{t.name}</h3>
                    <p className="truncate text-[12px] text-muted">{t.description || `Обновлён ${formatDateTime(t.updated_at)}`}</p>
                  </div>
                  <RowMenu items={[
                    { label: 'Редактировать', icon: <Pencil />, onClick: () => setEditing(t) },
                    { label: 'Удалить', icon: <Trash2 />, danger: true, onClick: () => setDeleting(t) },
                  ]} />
                </div>
                <p onClick={() => setViewing(t)} className="mt-3 line-clamp-4 flex-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[13px] text-slate-600">{t.content}</p>
              </Card>
            ))}
          </div>
        )}

      {editing && <TemplateFormModal template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name ?? ''} description={viewing?.description ?? undefined}
        footer={<><Button onClick={() => setViewing(null)}>Закрыть</Button><Button variant="primary" onClick={() => { setEditing(viewing); setViewing(null) }}><Pencil className="size-4" />Редактировать</Button></>}>
        {viewing && <div className="space-y-3"><MessageBubble><Highlighted text={viewing.content} /></MessageBubble>
          <p className="text-[12px] text-muted">Создан {formatDateTime(viewing.created_at)} · обновлён {formatDateTime(viewing.updated_at)}</p></div>}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} danger confirmLabel="Удалить" loading={remove.isPending}
        title="Удалить шаблон?" onConfirm={() => deleting && remove.mutate(deleting)}
        description={<>Шаблон <b>{deleting?.name}</b> будет удалён. Существующие кампании сохранят свой текст.</>} />
    </div>
  )
}

function TemplateFormModal({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [name, setName] = useState(template?.name ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [content, setContent] = useState(template?.content ?? '')
  const [touched, setTouched] = useState(false)
  const errors = {
    name: !name.trim() ? 'Укажите название' : name.length > 100 ? 'Максимум 100 символов' : '',
    content: !content.trim() ? 'Текст не может быть пустым' : '',
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), description: description.trim() || null, content }
      return template ? templatesApi.update(template.id, body) : templatesApi.create(body)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success(template ? 'Шаблон сохранён' : 'Шаблон создан'); onClose() },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const submit = (e?: FormEvent) => { e?.preventDefault(); setTouched(true); if (!errors.name && !errors.content) save.mutate() }

  return (
    <Modal open onClose={onClose} size="lg" title={template ? 'Редактировать шаблон' : 'Новый шаблон'}
      footer={<><Button onClick={onClose} disabled={save.isPending}>Отмена</Button><Button variant="primary" loading={save.isPending} onClick={() => submit()}>{template ? 'Сохранить' : 'Создать'}</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Название" htmlFor="t-name" error={touched ? errors.name : ''}><Input id="t-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} invalid={touched && !!errors.name} /></Field>
        <Field label="Описание" htmlFor="t-desc"><Input id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Текст сообщения" htmlFor="t-content" error={touched ? errors.content : ''}>
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {PLACEHOLDERS.map((p) => (
                <button key={p} type="button" onClick={() => setContent((c) => c + p)} className="rounded-md bg-accent-50 px-2 py-0.5 font-mono text-[12px] text-accent-700 transition-colors hover:bg-accent-100">+ {p}</button>
              ))}
            </div>
            <Textarea id="t-content" rows={6} value={content} onChange={(e) => setContent(e.target.value)} invalid={touched && !!errors.content} />
          </div>
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
