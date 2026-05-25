import React, { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { attestMilestone } from '../lib/eas'

const mono = 'IBM Plex Mono, monospace'
type Status = 'queued' | 'attesting' | 'done' | 'skipped'

interface BSProp {
  propId: string
  title: string
  evidenceURI: string
  txHash: string
  status: Status
}

export function BootstrapTab() {
  const { isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [props, setProps]   = useState<BSProp[]>([
    { propId: '12', title: 'Nouns Mural NYC',              evidenceURI: '', txHash: '', status: 'queued' },
    { propId: '23', title: 'Education Initiative Report',  evidenceURI: '', txHash: '', status: 'queued' },
    { propId: '31', title: 'Skatepark Build Handoff',      evidenceURI: '', txHash: '', status: 'queued' },
  ])
  const [newPid, setNewPid]   = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [running, setRunning] = useState(false)
  const [doneMsg, setDoneMsg] = useState('')

  const add = () => {
    if (!newPid) return
    setProps(p => [...p, { propId: newPid, title: newTitle || 'Untitled', evidenceURI: '', txHash: '', status: 'queued' }])
    setNewPid(''); setNewTitle('')
  }

  const remove = (i: number) => setProps(p => p.filter((_, j) => j !== i))

  const run = async () => {
    if (running || !walletClient) return
    setRunning(true)
    setDoneMsg('')
    let doneCount = 0

    const provider = new BrowserProvider(walletClient as any)
    const signer = await provider.getSigner()

    for (let i = 0; i < props.length; i++) {
      if (props[i].status !== 'queued') continue
      setProps(p => { const n = [...p]; n[i] = { ...n[i], status: 'attesting' }; return n })
      try {
        await attestMilestone(signer, {
          propId:      BigInt(props[i].propId),
          title:       props[i].title,
          evidenceURI: props[i].evidenceURI || '',
          isFinal:     true,
          txHash:      (props[i].txHash || '0x' + '0'.repeat(64)) as `0x${string}`,
        })
        setProps(p => { const n = [...p]; n[i] = { ...n[i], status: 'done' }; return n })
        doneCount++
      } catch {
        setProps(p => { const n = [...p]; n[i] = { ...n[i], status: 'skipped' }; return n })
      }
    }
    setRunning(false)
    setDoneMsg(`Done — ${doneCount} props attested.`)
  }

  const rowBg = (s: Status) =>
    s === 'attesting' ? '#1A1600' : s === 'done' ? '#0A1A0A' : s === 'skipped' ? '#1A0A0A' : 'transparent'

  const pillStyle = (s: Status): React.CSSProperties => ({
    display: 'inline-block', fontSize: 8, fontWeight: 700, padding: '2px 6px', fontFamily: mono,
    ...(s === 'done'      ? { background: '#0A2A0A', border: '1px solid #3A6A3A', color: '#6ACC70' }
      : s === 'skipped'   ? { background: '#2A0A0A', border: '1px solid #6A2020', color: '#C06060' }
      : s === 'attesting' ? { background: '#1A1600', border: '1px solid #6A5010', color: '#C8A830' }
      :                     { background: '#242018', border: '1px solid #4A4030', color: '#8A7A58' }),
  })

  const inputSt: React.CSSProperties = { background: '#1A1610', border: '1px solid #4A4030', fontFamily: mono, fontSize: 10, padding: '3px 6px', color: '#F8F4E8', outline: 'none' }

  return (
    <div>
      <div style={{ background: '#242018', border: '1px solid #3A3020', padding: '8px 10px', marginBottom: 6 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#FFD94A', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #3A3020', paddingBottom: 4, marginBottom: 6, fontFamily: mono }}>
          ↺ Bootstrap Historical Props
        </div>
        <div style={{ fontSize: 9, color: '#8A7A58', lineHeight: 1.6, marginBottom: 8, borderLeft: '2px solid #B89A10', paddingLeft: 6, fontFamily: mono }}>
          Retroactively attest completed Propdates that predate this system. Each prop verified against live contract — non-admins auto-skipped.
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <input style={{ ...inputSt, width: 80 }} type="number" placeholder="Prop ID" value={newPid} onChange={e => setNewPid(e.target.value)} />
          <input style={{ ...inputSt, flex: 1, minWidth: 140 }} type="text" placeholder="Milestone title" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
          <button onClick={add} style={{ fontFamily: mono, fontSize: 9, padding: '2px 8px', cursor: 'pointer', background: '#2E2820', border: '1px solid #4A4030', color: '#F8F4E8' }}>+ Add</button>
        </div>
      </div>

      <div style={{ background: '#242018', border: '1px solid #3A3020', marginBottom: 6 }}>
        <div style={{ background: '#2A2410', borderBottom: '1px solid #3A3020', padding: '3px 8px', display: 'grid', gridTemplateColumns: '40px 1fr 120px 24px', gap: 6, fontSize: 8, fontWeight: 700, color: '#6A5A38', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: mono }}>
          <span>Prop</span><span>Title</span><span>Status</span><span/>
        </div>
        {props.map((p, i) => (
          <div key={i} style={{ padding: '5px 8px', display: 'grid', gridTemplateColumns: '40px 1fr 120px 24px', gap: 6, alignItems: 'center', borderBottom: i < props.length - 1 ? '1px solid #3A3020' : 'none', background: rowBg(p.status), fontFamily: mono }}>
            <div style={{ fontWeight: 700, color: '#FFD94A' }}>#{p.propId}</div>
            <div style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {p.status === 'attesting' && <span style={{ display: 'inline-block', animation: 'spin 0.7s linear infinite', color: '#FFD94A' }}>↻</span>}
              <span style={pillStyle(p.status)}>
                {p.status === 'queued' ? 'Queued' : p.status === 'attesting' ? 'Attesting…' : p.status === 'done' ? '✓ Attested' : 'Skipped'}
              </span>
            </div>
            <div>
              {p.status === 'queued' && (
                <button onClick={() => remove(i)} style={{ fontFamily: mono, fontSize: 9, padding: '1px 4px', cursor: 'pointer', background: '#2E2820', border: '1px solid #4A4030', color: '#8A7A58' }}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={run}
          disabled={!isConnected || running}
          style={{ fontFamily: mono, fontSize: 10, padding: '4px 10px', cursor: 'pointer', background: '#FFD94A', border: '1px solid #B89A10', color: '#1A1610', fontWeight: 700, opacity: (!isConnected || running) ? 0.4 : 1 }}
        >
          {running ? '↻ Running…' : '↺ Run Bootstrap'}
        </button>
        <span style={{ fontSize: 9, color: '#6A5A38', fontFamily: mono }}>~120k gas/prop · mainnet</span>
      </div>

      {doneMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', fontSize: 9, marginTop: 5, border: '1px solid #3A6A3A', background: '#0A1E0A', color: '#6ACC70', fontFamily: mono }}>
          ✓ {doneMsg}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
