import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { campaignsApi, groupsApi, statsApi, tagsApi, templatesApi, usersApi } from '../api/endpoints'

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: usersApi.list })
export const useTags = () => useQuery({ queryKey: ['tags'], queryFn: tagsApi.list })
export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: groupsApi.list })
export const useGroupUsers = (id: number | null) =>
  useQuery({ queryKey: ['groups', id, 'users'], queryFn: () => groupsApi.users(id!), enabled: id !== null })
export const useTemplates = () => useQuery({ queryKey: ['templates'], queryFn: templatesApi.list })
export const useCampaigns = () => useQuery({ queryKey: ['campaigns'], queryFn: campaignsApi.list })
export const useCampaign = (id: number, enabled = true) =>
  useQuery({ queryKey: ['campaigns', id], queryFn: () => campaignsApi.get(id), enabled })
export const useCampaignPreview = (id: number, enabled = true) =>
  useQuery({ queryKey: ['campaigns', id, 'preview'], queryFn: () => campaignsApi.preview(id), enabled })

// Пока кампания в обработке — опрашиваем статистику.
export const useCampaignStats = (id: number, live: boolean) =>
  useQuery({
    queryKey: ['campaigns', id, 'stats'],
    queryFn: () => campaignsApi.stats(id),
    refetchInterval: live ? 3000 : false,
  })

export const useDeliveries = (
  id: number,
  p: { limit: number; offset: number; status?: string; channel?: string },
  live: boolean,
) =>
  useQuery({
    queryKey: ['campaigns', id, 'deliveries', p],
    queryFn: () => campaignsApi.deliveries(id, p),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 3000 : false,
  })

export const useOverview = () =>
  useQuery({ queryKey: ['overview'], queryFn: () => statsApi.overview(14), refetchInterval: 15000 })
