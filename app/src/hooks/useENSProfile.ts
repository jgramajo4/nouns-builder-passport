import { useEnsName, useEnsAvatar } from 'wagmi'
import { normalize } from 'viem/ens'

// Resolves ENS name + avatar for any address.
// Falls back gracefully — name → shortened address, avatar → null.
export function useENSProfile(address: `0x${string}` | undefined) {
  const { data: ensName, isLoading: nameLoading } = useEnsName({
    address,
    chainId: 1,
    query: { enabled: !!address },
  })

  const { data: ensAvatar, isLoading: avatarLoading } = useEnsAvatar({
    name: ensName ? normalize(ensName) : undefined,
    chainId: 1,
    query: { enabled: !!ensName },
  })

  const displayName = ensName
    ?? (address ? address.slice(0, 6) + '...' + address.slice(-4) : '')

  return {
    ensName:     ensName ?? null,
    ensAvatar:   ensAvatar ?? null,
    displayName,
    isLoading:   nameLoading || avatarLoading,
  }
}
