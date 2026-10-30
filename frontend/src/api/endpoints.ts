import { api, tokenStorage } from './client'
import type * as T from '../types/api'

export const authApi = {
  // /auth/login принимает OAuth2 form-data (application/x-www-form-urlencoded)
  async login(username: string, password: string) {
    const body = new URLSearchParams({ username, password })
    const { data } = await api.post<T.TokenResponse>('/auth/login', body)
    tokenStorage.set(data.access_token)
    return data
  },
  me: () => api.get<T.Employee>('/auth/me').then((r) => r.data),
}

const USERS_PAGE = 500

export const usersApi = {
  /** API не отдаёт total, поэтому выгружаем страницами по максимуму (500) до неполной страницы. */
  async list() {
    const all: T.User[] = []
    for (let skip = 0; ; skip += USERS_PAGE) {
      const { data } = await api.get<T.User[]>('/users/', { params: { skip, limit: USERS_PAGE } })
      all.push(...data)
      if (data.length < USERS_PAGE) return all
    }
  },
  create: (b: T.UserCreate) => api.post<T.User>('/users/', b).then((r) => r.data),
  update: (id: number, b: T.UserUpdate) => api.patch<T.User>(`/users/${id}`, b).then((r) => r.data),
  remove: (id: number) => api.delete(`/users/${id}`),
}

export const tagsApi = {
  list: () => api.get<T.Tag[]>('/tags/').then((r) => r.data),
  create: (name: string) => api.post<T.Tag>('/tags/', { name }).then((r) => r.data),
  assign: (tagId: number, userId: number) => api.post(`/tags/${tagId}/users/${userId}`),
  unassign: (tagId: number, userId: number) => api.delete(`/tags/${tagId}/users/${userId}`),
}

export const groupsApi = {
  list: () => api.get<T.Group[]>('/groups/').then((r) => r.data),
  create: (b: T.GroupInput) => api.post<T.Group>('/groups/', b).then((r) => r.data),
  update: (id: number, b: Partial<T.GroupInput>) => api.patch<T.Group>(`/groups/${id}`, b).then((r) => r.data),
  remove: (id: number) => api.delete(`/groups/${id}`),
  users: (id: number) => api.get<T.GroupUser[]>(`/groups/${id}/users`).then((r) => r.data),
}

export const templatesApi = {
  list: () => api.get<T.Template[]>('/templates/').then((r) => r.data),
  create: (b: T.TemplateInput) => api.post<T.Template>('/templates/', b).then((r) => r.data),
  update: (id: number, b: Partial<T.TemplateInput>) => api.patch<T.Template>(`/templates/${id}`, b).then((r) => r.data),
  remove: (id: number) => api.delete(`/templates/${id}`),
}

export const campaignsApi = {
  list: () => api.get<T.Campaign[]>('/campaigns/').then((r) => r.data),
  get: (id: number) => api.get<T.Campaign>(`/campaigns/${id}`).then((r) => r.data),
  create: (b: T.CampaignCreate) => api.post<T.Campaign>('/campaigns/', b).then((r) => r.data),
  update: (id: number, b: T.CampaignUpdate) => api.patch<T.Campaign>(`/campaigns/${id}`, b).then((r) => r.data),
  preview: (id: number) => api.get<T.CampaignPreview>(`/campaigns/${id}/preview`).then((r) => r.data),
  launch: (id: number) => api.post<T.LaunchResult>(`/campaigns/${id}/launch`).then((r) => r.data),
  stats: (id: number) => api.get<T.CampaignStats>(`/campaigns/${id}/stats`).then((r) => r.data),
  deliveries: (id: number, p: { limit: number; offset: number; status?: string; channel?: string }) =>
    api.get<T.DeliveriesPage>(`/campaigns/${id}/deliveries`, { params: p }).then((r) => r.data),
}

export const statsApi = {
  overview: (days = 14) => api.get<T.Overview>('/stats/overview', { params: { days } }).then((r) => r.data),
}
