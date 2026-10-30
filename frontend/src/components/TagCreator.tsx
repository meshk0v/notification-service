import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { tagsApi } from '../api/endpoints'
import type { Tag } from '../types/api'
import { getErrorMessage } from '../utils/errors'
import { Button } from './ui/Button'
import { Input } from './ui/Form'
import { useToast } from './ui/Toast'

/** Создание нового тега (API хранит имя в нижнем регистре). */
export function TagCreator({ onCreated }: { onCreated: (tag: Tag) => void }) {
  const [name, setName] = useState('')
  const qc = useQueryClient()
  const toast = useToast()
  const create = useMutation({
    mutationFn: () => tagsApi.create(name.trim()),
    onSuccess: (tag) => { qc.invalidateQueries({ queryKey: ['tags'] }); setName(''); onCreated(tag); toast.success(`Тег «${tag.name}» создан`) },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const submit = () => name.trim() && create.mutate()
  return (
    <div className="flex gap-2">
      <Input placeholder="Новый тег" maxLength={50} value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }} />
      <Button onClick={submit} loading={create.isPending} disabled={!name.trim()}><Plus className="size-4" />Добавить</Button>
    </div>
  )
}
