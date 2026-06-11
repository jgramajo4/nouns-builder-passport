import React, { useState } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { attestMilestone, fetchMilestoneByUID, peerVerify } from '../lib/eas'
import { useNounBalance } from '../hooks/useNounBalance'

type TxState = { status: 'idle' | 'pending' | 'ok' | 'error'; msg: string }

const mono = 'IBM Plex Mono, monospace'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: 6, alignItems: 'center', marginBottom: 4 }}>
      <div style={{ fontSize: 9, color: '#8A7A58', textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: mono }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: '#1A1610', border: '1px solid #4A4030',
  fontFamily: mono, fontSize: 10, padding: '3px 6px',
  color: '#F8F4E8', outline: 'none', width: '100%',
}

function TxStrip({ state }: { state: TxState }) {
  if (state.status === 'idle') return null
  const styles = {
    pending: { background: '#1A1600', border: '1px solid #6A5010', color: '#C8A830' },
    ok:      { background: '#0A1E0A', border: '1px solid #3A6A3A', color: '#6ACC70' },
    error:   { background: '#2A0A0A', border: '1px solid #6A2020', color: '#C06060' },
  }
  return (
    <div style={{ ...styles[state.status], display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', fontSize: 9, marginTop: 5, fontFamily: mono }}>
      {state.status === 'pending' && <span style={{ display: 'inline-block', animation: 'spin 0.7s linear infinite' }}>↻</span>}
      {state.status === 'ok' && '✓'}
      {state.status === 'error' && '✕'}
      {state.msg}
    </div>
  )
}

export function AttestTab() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()
  const { isEligible } = useNounBalance(address)

  const [form, setForm] = useState({ propId: '', title: '', evidenceURI: '', txHash: '', isFinal: false })
  const [challenge, setChallenge] = useState({ milestoneUID: '', evidence: '' })
  const [tx, setTx]   = useState<TxState>({ status: 'idle', msg: '' })
  const [cTx, setCTx] = useState<TxState>({ status: 'idle', msg: '' })

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const setC = (k: keyof typeof challenge) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setChallenge(c => ({ ...c, [k]: e.target.value }))

  const submit = async () => {
    if (!form.propId) return alert('Enter a Prop ID')
    if (!walletClient || !isConnected) return alert('Connect wallet first')
    try {
      setTx({ status: 'pending', msg: 'Awaiting wallet signature…' })
      // wrap wagmi walletClient in ethers signer
      const provider = new BrowserProvider(walletClient as any)
      const signer = await provider.getSigner()
      setTx({ status: 'pending', msg: 'Transaction submitted, waiting for block…' })
      const uid = await attestMilestone(signer, {
        propId:      BigInt(form.propId),
        title:       form.title,
        evidenceURI: form.evidenceURI,
        isFinal:     form.isFinal,
        txHash:      (form.txHash || '0x' + '0'.repeat(64)) as `0x${string}`,
      })
      setTx({ status: 'ok', msg: `Attestation confirmed. UID: ${String(uid).slice(0, 18)}…` })
      setForm({ propId: '', title: '', evidenceURI: '', txHash: '', isFinal: false })
    } catch (e: any) {
      setTx({ status: 'error', msg: e?.message?.slice(0, 80) ?? 'Transaction failed' })
    }
  }

  const submitChallenge = async () => {
    const uid = challenge.milestoneUID.trim()
    if (!/^0x[0-9a-fA-F]{64}$/.test(uid)) return alert('Enter the Schema 1 (isFinal) attestation UID')
    if (!walletClient || !isConnected) return alert('Connect wallet first')
    if (!isEligible) return alert('Requires ≥1 Noun held or delegated')
    try {
      // A challenge is a Schema 2 peer verification with verified=false,
      // ref'd to the milestone. We only have the UID, so fetch the milestone
      // to recover the builder (attester) and propId for the payload.
      setCTx({ status: 'pending', msg: 'Looking up milestone…' })
      const milestone = await fetchMilestoneByUID(uid)
      if (!milestone) throw new Error('No milestone found for that UID')

      const provider = new BrowserProvider(walletClient as any)
      const signer = await provider.getSigner()
      setCTx({ status: 'pending', msg: 'Awaiting wallet signature…' })
      const cUid = await peerVerify(signer, {
        milestoneUID: uid as `0x${string}`,
        builder:      milestone.attester,
        propId:       milestone.propId,
        verified:     false,
        comment:      challenge.evidence.trim() === '' ? undefined : challenge.evidence.trim(),
      })
      setCTx({ status: 'ok', msg: `Challenge attested. UID: ${String(cUid).slice(0, 18)}…` })
      setChallenge({ milestoneUID: '', evidence: '' })
    } catch (e: any) {
      setCTx({ status: 'error', msg: e?.message?.slice(0, 80) ?? 'Transaction failed' })
    }
  }

  const fp: React.CSSProperties = { background: '#242018', border: '1px solid #3A3020', padding: '8px 10px', marginBottom: 6 }
  const ftStyle: React.CSSProperties = { fontSize: 9, fontWeight: 700, color: '#FFD94A', textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid #3A3020', paddingBottom: 4, marginBottom: 6, fontFamily: mono }
  const btn = (primary?: boolean, danger?: boolean): React.CSSProperties => ({
    fontFamily: mono, fontSize: 10, padding: '4px 10px', cursor: 'pointer',
    background: primary ? '#FFD94A' : danger ? '#2A0A0A' : '#2E2820',
    border: `1px solid ${primary ? '#B89A10' : danger ? '#6A2020' : '#4A4030'}`,
    color: primary ? '#1A1610' : danger ? '#C06060' : '#F8F4E8',
    fontWeight: primary ? 700 : 400,
  })

  return (
    <div>
      <div style={fp}>
        <div style={ftStyle}>✦ Attest Milestone — Schema 1</div>
        <Field label="Prop ID">
          <input style={{ ...inputStyle, width: 90 }} type="number" placeholder="e.g. 42" value={form.propId} onChange={set('propId')} />
        </Field>
        <Field label="Title">
          <input style={inputStyle} type="text" placeholder="Milestone title" value={form.title} onChange={set('title')} />
        </Field>
        <Field label="Evidence URI">
          <input style={inputStyle} type="text" placeholder="ipfs://Qm… or https://…" value={form.evidenceURI} onChange={set('evidenceURI')} />
        </Field>
        <Field label="Propdates TX">
          <input style={inputStyle} type="text" placeholder="0x…" value={form.txHash} onChange={set('txHash')} />
        </Field>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, paddingLeft: 92, fontSize: 9, color: '#8A7A58', fontFamily: mono }}>
          <input type="checkbox" id="isFinal" checked={form.isFinal} onChange={set('isFinal')} style={{ accentColor: '#FFD94A', cursor: 'pointer' }} />
          <label htmlFor="isFinal" style={{ cursor: 'pointer' }}>isFinal — triggers passport auto-mint / refresh</label>
        </div>
        {form.isFinal && (
          <div style={{ background: '#1A1600', border: '1px solid #6A5010', color: '#C8A830', padding: '5px 8px', fontSize: 9, marginBottom: 6, fontFamily: mono }}>
            ⚠ Resolver will verify propdates.isCompleted on-chain before accepting
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button style={btn(true)} onClick={submit} disabled={!isConnected}>✦ Submit Attestation</button>
          {!isConnected && <span style={{ fontSize: 9, color: '#6A5A38', fontFamily: mono, alignSelf: 'center' }}>Connect wallet first</span>}
        </div>
        <TxStrip state={tx} />
      </div>

      {/* EAS data preview */}
      <div style={{ fontSize: 8, fontWeight: 700, color: '#6A5A38', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '8px 0 4px', paddingBottom: 2, borderBottom: '1px solid #3A3020', fontFamily: mono }}>
        EAS Schema 1 — data preview
      </div>
      <div style={{ background: '#111', border: '1px solid #3A3020', padding: '6px 8px', fontSize: 9, lineHeight: 1.8, color: '#8A7A58', marginBottom: 6, fontFamily: mono }}>
        <span style={{ color: '#FFD94A' }}>abi.encode(</span><br/>
        &nbsp;&nbsp;propId:&nbsp;<span style={{ color: '#F8F4E8' }}>{form.propId || '—'}</span>,<br/>
        &nbsp;&nbsp;title:&nbsp;&nbsp;"<span style={{ color: '#F8F4E8' }}>{form.title || '—'}</span>",<br/>
        &nbsp;&nbsp;uri:&nbsp;&nbsp;&nbsp;&nbsp;"<span style={{ color: '#F8F4E8' }}>{form.evidenceURI || '—'}</span>",<br/>
        &nbsp;&nbsp;isFinal:&nbsp;<span style={{ color: form.isFinal ? '#6ACC70' : '#C04040', fontWeight: 700 }}>{String(form.isFinal)}</span>,<br/>
        &nbsp;&nbsp;txHash:&nbsp;<span style={{ color: '#F8F4E8' }}>{form.txHash || '0x…'}</span><br/>
        <span style={{ color: '#FFD94A' }}>)</span>
      </div>

      {/* challenge */}
      <div style={{ fontSize: 8, fontWeight: 700, color: '#6A5A38', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '8px 0 4px', paddingBottom: 2, borderBottom: '1px solid #3A3020', fontFamily: mono }}>
        Challenge completion — Noun holders & delegates only
      </div>
      <div style={fp}>
        <Field label="Schema 1 UID">
          <input style={inputStyle} type="text" placeholder="0x… (the isFinal attestation)" value={challenge.milestoneUID} onChange={setC('milestoneUID')} />
        </Field>
        <Field label="Evidence">
          <input style={inputStyle} type="text" placeholder="Link to missing deliverable" value={challenge.evidence} onChange={setC('evidence')} />
        </Field>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button style={btn(false, true)} onClick={submitChallenge} disabled={!isEligible}>⚑ Submit Challenge</button>
          {!isEligible && <span style={{ fontSize: 9, color: '#6A5A38', fontFamily: mono }}>Requires ≥1 Noun held or delegated</span>}
        </div>
        <TxStrip state={cTx} />
      </div>
    </div>
  )
}
