import React from 'react'
import { useAccount } from 'wagmi'
import { useENSProfile } from '../hooks/useENSProfile'
import type { PassportData } from '../lib/eas'

interface Props {
  passport: PassportData | null | undefined
  isLoading: boolean
}

export function PassportCard({ passport, isLoading }: Props) {
  const { address } = useAccount()
  const { displayName, ensAvatar, isLoading: ensLoading } = useENSProfile(address)

  const stats = [
    { label: 'Props',        value: passport ? Number(passport.totalProps)        : '—' },
    { label: 'Completed',    value: passport ? Number(passport.completedProps)     : '—' },
    { label: 'Milestones',   value: passport ? Number(passport.totalMilestones)    : '—' },
    { label: 'Peer Verif.',  value: passport ? Number(passport.peerVerifications)  : '—' },
    { label: 'Avg Update',   value: passport ? Number(passport.avgDaysBetweenUpdates) + 'd' : '—' },
    { label: 'Completion',   value: passport
        ? Math.round(Number(passport.completedProps) / Math.max(Number(passport.totalProps), 1) * 100) + '%'
        : '—'
    },
  ]

  const shortAddr = address
    ? address.slice(0, 6) + '...' + address.slice(-4)
    : null

  return (
    <div style={{ background: '#1A1610', borderBottom: '1px solid #3A3020' }}>

      {/* dot-grid top section */}
      <div style={{
        background: '#111',
        padding: '14px 16px 0',
        borderBottom: '1px solid #3A3020',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* dot texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, #3A3020 1px, transparent 1px)',
          backgroundSize: '14px 14px',
          opacity: 0.4,
          pointerEvents: 'none',
        }} />

        {/* version badge */}
        {passport && (
          <div style={{
            position: 'absolute', top: 10, right: 12,
            background: '#2E2820', border: '1px solid #4A4030',
            fontSize: 10, color: '#8A7A58', padding: '3px 8px',
            fontFamily: 'IBM Plex Mono, monospace',
            zIndex: 1,
          }}>
            v{Number(passport.passportVersion)}
          </div>
        )}

        {/* profile row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, position: 'relative', zIndex: 1 }}>
          {/* avatar */}
          <div style={{
            width: 54, height: 54,
            border: '2px solid #4A4030',
            overflow: 'hidden', flexShrink: 0,
            background: '#2A2010',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {ensAvatar ? (
              <img src={ensAvatar} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              /* default pixel noggle */
              <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" fill="#2A1A08"/>
                <rect x="4"  y="10" width="14" height="18" rx="1" fill="#E04040"/>
                <rect x="22" y="10" width="14" height="18" rx="1" fill="#1A1A2A"/>
                <rect x="6"  y="12" width="10" height="14" rx="1" fill="#F07070" opacity="0.4"/>
                <rect x="24" y="12" width="10" height="14" rx="1" fill="#7070F0" opacity="0.35"/>
                <rect x="0"  y="18" width="40" height="4"  fill="#FFD94A"/>
                <rect x="16" y="15" width="8"  height="10" fill="#FFD94A"/>
              </svg>
            )}
          </div>

          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 19, fontWeight: 700, color: '#F8F4E8', lineHeight: 1 }}>
              {ensLoading ? '…' : displayName}
            </div>
            {shortAddr && (
              <div style={{ fontSize: 10, color: '#8A7A58', marginTop: 3, fontFamily: 'IBM Plex Mono, monospace' }}>
                {shortAddr}
              </div>
            )}
            {passport && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: '#1A3A1A', border: '1px solid #3A6A3A',
                color: '#6ACC70', fontSize: 9, padding: '2px 7px', marginTop: 5,
                fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace',
              }}>
                ✓ Verified Builder
              </div>
            )}
            {!address && (
              <div style={{ fontSize: 10, color: '#6A5A38', marginTop: 4, fontFamily: 'IBM Plex Mono, monospace' }}>
                Connect wallet to load passport
              </div>
            )}
          </div>
        </div>
      </div>

      {/* stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 1, background: '#3A3020' }}>
        {stats.map(({ label, value }) => (
          <div key={label} style={{ background: '#242018', padding: '10px 10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: '#8A7A58', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3, fontFamily: 'IBM Plex Mono, monospace' }}>
              {label}
            </div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 22, fontWeight: 700, color: '#F8F4E8', lineHeight: 1 }}>
              {isLoading ? '…' : value}
            </div>
          </div>
        ))}
      </div>

      {/* uid bar */}
      <div style={{
        background: '#111', padding: '5px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid #3A3020',
      }}>
        <span style={{ fontSize: 9, color: '#6A5A38', fontFamily: 'IBM Plex Mono, monospace' }}>
          uid: <span style={{ color: '#8A7A58' }}>{passport?.uid?.slice(0, 18) + '…' ?? '—'}</span>
          {' · '}Schema 3
        </span>
        <a
          href={passport ? `https://easscan.org/attestation/view/${passport.uid}` : 'https://easscan.org'}
          target="_blank" rel="noreferrer"
          style={{ fontSize: 9, color: '#8A7A58', fontFamily: 'IBM Plex Mono, monospace', textDecoration: 'none' }}
        >
          view on easscan ↗
        </a>
      </div>
    </div>
  )
}
