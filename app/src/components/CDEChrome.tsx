import React from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useENSProfile } from '../hooks/useENSProfile'

export type Tab = 'passport' | 'attest' | 'peer' | 'bootstrap' | 'share'

interface Props {
  activeTab: Tab
  onTabChange: (t: Tab) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'passport',  label: '⌐◨-◨ Passport' },
  { id: 'attest',    label: '✦ Attest' },
  { id: 'peer',      label: '◉ Peer Verify' },
  { id: 'bootstrap', label: '↺ Bootstrap' },
  { id: 'share',     label: '↗ Share' },
]

const s = {
  titlebar: {
    background: '#3A2E10', color: '#FFD94A', fontWeight: 700, fontSize: 11,
    padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid #5A4A18', fontFamily: 'IBM Plex Mono, monospace',
  } as React.CSSProperties,
  wbtn: {
    width: 12, height: 12, background: '#4A3C18',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 7, cursor: 'pointer', border: '1px solid #6A5A28', color: '#FFD94A',
  } as React.CSSProperties,
  tabBar: {
    background: '#2A2410', display: 'flex', borderBottom: '1px solid #3A3020',
    overflowX: 'auto' as const,
  },
  tab: (active: boolean): React.CSSProperties => ({
    padding: '5px 12px', fontSize: 10, fontWeight: 700, cursor: 'pointer',
    color: active ? '#FFD94A' : '#8A7A58',
    borderRight: '1px solid #3A3020',
    borderBottom: active ? '2px solid #FFD94A' : '2px solid transparent',
    marginBottom: -1,
    letterSpacing: '0.3px', textTransform: 'uppercase',
    background: active ? '#242018' : 'transparent',
    fontFamily: 'IBM Plex Mono, monospace',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }),
  pathbar: {
    background: '#221E10', padding: '2px 8px', fontSize: 9,
    color: '#6A5A38', borderBottom: '1px solid #3A3020',
    display: 'flex', gap: 3, fontFamily: 'IBM Plex Mono, monospace',
  } as React.CSSProperties,
}

export function CDEChrome({ activeTab, onTabChange }: Props) {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { displayName } = useENSProfile(address)

  const handleConnect = () => {
    // prefer injected (MetaMask), fall back to first available
    const injected = connectors.find(c => c.id === 'injected') ?? connectors[0]
    if (injected) connect({ connector: injected })
  }

  const shortAddr = isConnected ? displayName : null

  return (
    <>
      {/* titlebar */}
      <div style={s.titlebar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, letterSpacing: -1 }}>⌐◨-◨</span>
          <span>Nouns Builder Passport — /{activeTab}/
            {address ? address.slice(0, 6) + '...' + address.slice(-4) : '—'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {['_', '□', '✕'].map(c => <div key={c} style={s.wbtn}>{c}</div>)}
        </div>
      </div>

      {/* tab bar + connect button */}
      <div style={s.tabBar}>
        {TABS.map(t => (
          <div key={t.id} style={s.tab(activeTab === t.id)} onClick={() => onTabChange(t.id)}>
            {t.label}
          </div>
        ))}
        <button
          onClick={isConnected ? () => disconnect() : handleConnect}
          style={{
            marginLeft: 'auto', fontSize: 9, padding: '4px 12px',
            background: isConnected ? '#0A1E0A' : '#1A1A0A',
            border: 'none', borderLeft: '1px solid #3A3020',
            color: isConnected ? '#6ACC70' : '#6A5A38',
            cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
            whiteSpace: 'nowrap',
          }}
        >
          {isConnected ? shortAddr : 'Connect Wallet'}
        </button>
      </div>

      {/* breadcrumb */}
      <div style={s.pathbar}>
        <span style={{ color: '#8A7A58', fontWeight: 700 }}>/</span>
        <span style={{ color: '#6A5A38' }}>›</span>
        <span style={{ color: '#8A7A58', fontWeight: 700 }}>nouns-passport.eth</span>
        <span style={{ color: '#6A5A38' }}>›</span>
        <span style={{ color: '#8A7A58', fontWeight: 700 }}>{activeTab}</span>
        {address && <>
          <span style={{ color: '#6A5A38' }}>›</span>
          <span style={{ color: '#6A5A38' }}>{address}</span>
        </>}
      </div>
    </>
  )
}
