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
  {
    name: 'getCurrentVotes',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint96' }],
  },
] as const

export function useNounBalance(address: `0x${string}` | undefined) {
  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: CONTRACTS.NOUNS_TOKEN,
    abi:     NOUNS_ABI,
    functionName: 'balanceOf',
    args:    address ? [address] : undefined,
    query:   { enabled: !!address },
  })

  // Delegated voting power. The NounHolderResolver gate (Schema 2) lets a
  // delegate participate even with zero balance, so eligibility must mirror
  // that: balanceOf > 0 OR getCurrentVotes > 0. Live read, no snapshot —
  // matching the resolver's on-chain check.
  const { data: votes, isLoading: votesLoading } = useReadContract({
    address: CONTRACTS.NOUNS_TOKEN,
    abi:     NOUNS_ABI,
    functionName: 'getCurrentVotes',
    args:    address ? [address] : undefined,
    query:   { enabled: !!address },
  })

  const bal = balance ?? 0n
  const vts = BigInt(votes ?? 0n)

  return {
    balance:      bal,
    votes:        vts,
    // true only when the wallet actually owns tokens
    isNounHolder: bal > 0n,
    // matches NounHolderResolver: owns tokens OR has delegated voting power
    isEligible:   bal > 0n || vts > 0n,
    isLoading:    balanceLoading || votesLoading,
  }
}
