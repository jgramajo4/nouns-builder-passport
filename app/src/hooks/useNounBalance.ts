import { useReadContract } from 'wagmi'
import { CONTRACTS } from '../lib/config'

const NOUNS_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const

export function useNounBalance(address: `0x${string}` | undefined) {
  const { data: balance, isLoading } = useReadContract({
    address: CONTRACTS.NOUNS_TOKEN,
    abi:     NOUNS_ABI,
    functionName: 'balanceOf',
    args:    address ? [address] : undefined,
    query:   { enabled: !!address },
  })

  return {
    balance:     balance ?? 0n,
    isNounHolder: (balance ?? 0n) > 0n,
    isLoading,
  }
}
