import { useQuery } from '@tanstack/react-query'
import { fetchPassport, fetchMilestones } from '../lib/eas'

export function usePassport(address: string | undefined) {
  return useQuery({
    queryKey:  ['passport', address],
    queryFn:   () => fetchPassport(address!),
    enabled:   !!address,
    staleTime: 30_000,
  })
}

export function useMilestones(address: string | undefined) {
  return useQuery({
    queryKey:  ['milestones', address],
    queryFn:   () => fetchMilestones(address!),
    enabled:   !!address,
    staleTime: 30_000,
  })
}
