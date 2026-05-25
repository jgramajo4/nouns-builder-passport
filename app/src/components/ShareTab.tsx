import React from 'react'
import { useAccount } from 'wagmi'
import { useENSProfile } from '../hooks/useENSProfile'
import type { PassportData, MilestoneData } from '../lib/eas'

const mono = 'IBM Plex Mono, monospace'
const sans = 'Space Grotesk, sans-serif'

interface Props {
  passport: PassportData | null | undefined
  milestones: MilestoneData[]
}

// mock leaderboard — replace with EAS subgraph query in production
const LEADERBOARD = [
  { display: 'slobo.eth',     props: 7,  done: 5,  peers: 12, isYou: true  },
  { display: 'cdt.eth',       props: 12, done: 9,  peers: 24, isYou: false },
  { display: '0x5678…ef01',   props: 5,  done: 5,  peers: 8,  isYou: false },
  { display: '0x9abc…2345',   props: 3,  done: 2,  peers: 3,  isYou: false },
]

export function ShareTab({ passport, milestones }: Props) {
  const { address } = useAccount()
  const { displayName } = useENSProfile(address)

  const url = address ? `https://nouns-passport.eth.limo/builder/${address}` : ''
  const completedPropIds = [...new Set(milestones.filter(m => m.isFinal).map(m => String(m.propId)))]

  const copyLink = () => {
    if (url) navigator.clipboard.writeText(url).catch(() => {})
    alert(`Copied: ${url}`)
  }

  const castFarcaster = () => {
    if (!passport) return
    const text = `Nouns Builder ⌐◨-◨\n${Number(passport.totalProps)} props · ${Number(passport.completedProps)} completed · ${Number(passport.totalMilestones)} milestones · ${Number(passport.peerVerifications)} peer verifs\n${url}`
    window.open('https://warpcast.com/~/compose?text=' + encodeURIComponent(text), '_blank')
  }

  const lbCols = '18px 1fr 26px 26px 28px'

  return (
    <div>
      {/* share card */}
      <div style={{ background: '#111', border: '1px solid #4A4030', padding: '14px 16px', marginBottom: 6, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #2A2010 1px, transparent 1px)', backgroundSize: '16px 16px', opacity: 0.4, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ color: '#FFD94A', fontFamily: sans, fontWeight: 700, fontSize: 15, letterSpacing: 2 }}>BUILDER PASSPORT</div>
              <div style={{ color: '#888', fontSize: 11, marginTop: 3, fontFamily: sans, fontWeight: 500 }}>{displayName}</div>
              <div style={{ color: '#6A5A38', fontSize: 9, fontFamily: mono }}>{address?.slice(0, 10)}…</div>
            </div>
            <svg viewBox="0 0 36 18" width="40" height="20" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="5" width="36" height="3" fill="#FFD94A"/>
              <rect x="0" y="0" width="15" height="18" rx="2" fill="#D44" stroke="#FFD94A" strokeWidth="1.5"/>
              <rect x="21" y="0" width="15" height="18" rx="2" fill="#222" stroke="#FFD94A" strokeWidth="1.5"/>
              <rect x="2" y="2" width="11" height="14" rx="1" fill="#F88" opacity="0.3"/>
              <rect x="23" y="2" width="11" height="14" rx="1" fill="#88F" opacity="0.25"/>
            </svg>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, margin: '8px 0' }}>
            {[
              ['Props',      passport ? Number(passport.totalProps) : '—'],
              ['Done',       passport ? Number(passport.completedProps) : '—'],
              ['Milestones', passport ? Number(passport.totalMilestones) : '—'],
              ['Peers',      passport ? Number(passport.peerVerifications) : '—'],
            ].map(([l, v]) => (
              <div key={String(l)} style={{ border: '1px solid #333', padding: 5, textAlign: 'center' }}>
                <div style={{ fontFamily: sans, fontSize: 20, fontWeight: 700, color: '#FFD94A', lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: mono }}>{l}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
            {completedPropIds.map(id => (
              <span key={id} style={{ background: '#0A2010', border: '1px solid #3A6A30', color: '#6ACC60', fontSize: 8, padding: '2px 6px', fontFamily: mono }}>
                #{id} ✓
              </span>
            ))}
          </div>

          <div style={{ fontSize: 8, color: '#444', fontFamily: mono }}>
            v{passport ? Number(passport.passportVersion) : '—'} · nouns-passport.eth · EAS Mainnet · attested on-chain
          </div>
        </div>
      </div>

      {/* url + actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 9, color: '#8A7A58', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: mono }}>Share URL</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input readOnly value={url} style={{ flex: 1, background: '#111', border: '1px solid #4A4030', fontFamily: mono, fontSize: 9, padding: '3px 6px', color: '#8A7A58', outline: 'none' }} />
          <button onClick={copyLink} style={{ fontFamily: mono, fontSize: 9, padding: '2px 8px', cursor: 'pointer', background: '#2E2820', border: '1px solid #4A4030', color: '#F8F4E8' }}>Copy</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        <button onClick={castFarcaster} disabled={!passport} style={{ fontFamily: mono, fontSize: 10, padding: '4px 10px', cursor: 'pointer', background: '#FFD94A', border: '1px solid #B89A10', color: '#1A1610', fontWeight: 700 }}>
          Cast on Farcaster ↗
        </button>
        <button onClick={() => window.open(`https://easscan.org/attestation/view/${passport?.uid}`, '_blank')} style={{ fontFamily: mono, fontSize: 10, padding: '4px 10px', cursor: 'pointer', background: '#2E2820', border: '1px solid #4A4030', color: '#F8F4E8' }}>
          EASScan ↗
        </button>
      </div>

      {/* leaderboard */}
      <div style={{ fontSize: 8, fontWeight: 700, color: '#6A5A38', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '8px 0 4px', paddingBottom: 2, borderBottom: '1px solid #3A3020', fontFamily: mono }}>
        Builder Leaderboard
      </div>
      <div style={{ background: '#242018', border: '1px solid #3A3020' }}>
        <div style={{ background: '#2A2410', borderBottom: '1px solid #3A3020', padding: '3px 8px', display: 'grid', gridTemplateColumns: lbCols, gap: 6, fontSize: 8, fontWeight: 700, color: '#6A5A38', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: mono }}>
          <span>#</span><span>Builder</span><span>Pr</span><span>✓</span><span>Peers</span>
        </div>
        {LEADERBOARD.map(({ display, props, done, peers, isYou }, i) => (
          <div key={display} style={{ padding: '5px 8px', display: 'grid', gridTemplateColumns: lbCols, gap: 6, alignItems: 'center', borderBottom: i < LEADERBOARD.length - 1 ? '1px solid #3A3020' : 'none', background: isYou ? '#1A2A10' : 'transparent', fontFamily: mono }}>
            <div style={{ fontWeight: 700, color: '#6A5A38' }}>{i + 1}</div>
            <div style={{ fontSize: 10, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: isYou ? '#FFD94A' : '#F8F4E8' }}>
              {isYou ? displayName : display}{isYou ? ' ◀' : ''}
            </div>
            <div style={{ fontWeight: 700 }}>{props}</div>
            <div style={{ fontWeight: 700, color: '#4A9A50' }}>{done}</div>
            <div style={{ color: '#8A7A58' }}>{peers}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
