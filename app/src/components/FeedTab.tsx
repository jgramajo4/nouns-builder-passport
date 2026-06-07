import React, { useState, useEffect, useRef } from "react";
import { useFeed } from "../hooks/useFeed";
import { SCHEMAS } from "../lib/config";
import { FeedAttestation, attestMilestone, peerVerify } from "../lib/eas";
import { useDisplayName } from "../hooks/useDisplayName";
import { useAccount } from "wagmi";
import { BrowserProvider } from "ethers";
import { ConnectButton } from "./ConnectButton";

export function FeedTab() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [filter, setFilter] = useState<
    "all" | "milestone" | "peer" | "passport"
  >("all");
  const { data = [], isLoading, isFetching } = useFeed(25, skip);

  // Track newest timestamp to flag freshly polled items
  const latestTimeRef = useRef<number>(0);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  // store local peer verify outcome per milestone UID
  const [peerStatusMap, setPeerStatusMap] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    if (!data.length) return;
    const newest = data[0].time;
    if (latestTimeRef.current === 0) {
      latestTimeRef.current = newest;
      return;
    }
    if (newest > latestTimeRef.current) {
      const newOnes = data
        .filter((d) => d.time > latestTimeRef.current)
        .map((d) => d.id);
      setFreshIds(new Set(newOnes));
      latestTimeRef.current = newest;
      // clear flags after animation duration
      setTimeout(() => setFreshIds(new Set()), 400);
    }
  }, [data]);

  const loadMore = () => setSkip((s) => s + 25);

  const filtered = data.filter((att) => {
    if (filter === "all") return true;
    if (filter === "milestone") return att.schemaId === SCHEMAS.SCHEMA_1_UID;
    if (filter === "peer") return att.schemaId === SCHEMAS.SCHEMA_2_UID;
    if (filter === "passport") return att.schemaId === SCHEMAS.SCHEMA_3_UID;
    return true;
  });

  const Pill = ({ id, label }: { id: typeof filter; label: string }) => (
    <button
      onClick={() => setFilter(id)}
      style={{
        padding: "4px 10px",
        border: "none",
        cursor: "pointer",
        background: filter === id ? "#FFD94A" : "#2E2820",
        color: filter === id ? "#000" : "#8A7A58",
        fontWeight: filter === id ? 700 : 400,
      }}
    >
      {label}
    </button>
  );

  // inject keyframes once
  useEffect(() => {
    if (document.getElementById("slideInStyle")) return;
    const style = document.createElement("style");
    style.id = "slideInStyle";
    style.innerHTML = `@keyframes slideIn { 0% { opacity: 0; transform: translateY(-8px); } 100% { opacity: 1; transform: translateY(0); } }`;
    document.head.appendChild(style);
  }, []);

  return (
    <div style={{ fontFamily: "IBM Plex Mono, monospace", color: "#F8F4E8" }}>
      {/* filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Pill id="all" label="All" />
        <Pill id="milestone" label="Milestones" />
        <Pill id="peer" label="Peer Verifies" />
        <Pill id="passport" label="Passports" />
      </div>

      {isLoading && <div>Loading feed…</div>}
      {filtered.length === 0 && !isLoading && (
        <div style={{ color: "#6A5A38", fontSize: 12 }}>
          {filter === "milestone" &&
            "No milestone attestations yet — attest your first prop above"}
          {filter === "peer" &&
            "No peer verifications yet — verify a builder's milestone"}
          {filter === "passport" && "No passports issued yet"}
          {filter === "all" && "No attestations yet — be the first to attest"}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((att) => (
          <FeedCard
            key={att.id}
            att={att}
            openId={openId}
            setOpenId={setOpenId}
            isFresh={freshIds.has(att.id)}
            peerStatusMap={peerStatusMap}
            setPeerStatusMap={setPeerStatusMap}
          />
        ))}
      </div>

      {data.length >= 25 && (
        <button
          onClick={loadMore}
          style={{
            marginTop: 12,
            background: "#FFD94A",
            border: "1px solid #4A4030",
            padding: "6px 12px",
            cursor: "pointer",
            fontFamily: "IBM Plex Mono, monospace",
            fontWeight: 700,
            color: "#000",
          }}
        >
          {isFetching ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

interface AttestationItem extends FeedAttestation {}

function FeedCard({
  att,
  openId,
  setOpenId,
  isFresh,
  peerStatusMap,
  setPeerStatusMap,
}: {
  att: AttestationItem;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  isFresh: boolean;
  peerStatusMap: Record<string, boolean>;
  setPeerStatusMap: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
}) {
  // helper – unwraps nested `.value` and decodes BigNumber hex
  const getValue = (name: string) => {
    const field = att.decoded?.find((f) => f.name === name);
    let val: any = field?.value;
    // handle nested .value (older eas-sdk versions)
    if (val && typeof val === "object" && "value" in val) val = val.value;
    // handle BigNumber objects { type: "BigNumber", hex: "0x.." }
    if (val && typeof val === "object" && "hex" in val) {
      try {
        return parseInt((val as any).hex, 16).toString();
      } catch {
        return null;
      }
    }
    return val ?? null;
  };
  const displayAttester = useDisplayName(att.attester);
  const displayRecipient = useDisplayName(att.recipient);
  const relTime = relativeTime(att.time);

  let textNode: React.ReactNode = null;
  let extra: React.ReactNode = null;

  if (att.schemaId === SCHEMAS.SCHEMA_1_UID) {
    const propId = getValue("propId");
    const milestoneTitle = getValue("milestoneTitle");
    const evidenceURI = getValue("evidenceURI") as string | undefined;

    textNode = (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div>
          🏁 {displayAttester} attested milestone '{milestoneTitle}' for{" "}
          <a
            href={`https://nouns.wtf/vote/${propId}`}
            target="_blank"
            rel="noreferrer"
            style={{ color: "#FFD94A" }}
          >
            Prop #{propId} ↗
          </a>
        </div>
        {evidenceURI && (
          <a
            href={evidenceURI}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 10,
              color: "#8A7A58",
              textDecoration: "none",
            }}
          >
            ↗ View Evidence
          </a>
        )}
      </div>
    );
    const status = peerStatusMap[att.id];
    const badge = status !== undefined && (
      <span
        style={{
          background: status ? "#0A1E0A" : "#2A0A0A",
          border: `1px solid ${status ? "#3A6A3A" : "#6A2020"}`,
          color: status ? "#6ACC70" : "#C06060",
          fontSize: 9,
          padding: "2px 6px",
          fontWeight: 700,
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        {status ? "Verified ✓" : "Disputed ✗"}
      </span>
    );

    extra = (
      <div style={{ display: "flex", gap: 6 }}>
        {badge}
        <button
          onClick={() => setOpenId(openId === att.id ? null : att.id)}
          style={{
            background: "#FFD94A",
            border: "1px solid #4A4030",
            padding: "2px 6px",
            fontSize: 10,
            cursor: "pointer",
            fontWeight: 700,
            color: "#000",
          }}
        >
          Peer Verify
        </button>
      </div>
    );
  } else if (att.schemaId === SCHEMAS.SCHEMA_2_UID) {
    const comment = getValue("comment");
    const verified = getValue("verified");
    const badgeStyle: React.CSSProperties = {
      background: verified ? "#0A1E0A" : "#2A0A0A",
      border: `1px solid ${verified ? "#3A6A3A" : "#6A2020"}`,
      color: verified ? "#6ACC70" : "#C06060",
      fontSize: 10,
      padding: "2px 8px",
      fontWeight: 700,
      fontFamily: "IBM Plex Mono, monospace",
      display: "inline-block",
    };
    textNode = (
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={badgeStyle}>
          {verified ? "Confirmed ✓" : "Disputed ✗"}
        </span>
        {comment && (
          <blockquote
            style={{
              margin: 0,
              paddingLeft: 8,
              borderLeft: "3px solid #FFD94A",
              color: "#8A7A58",
              fontSize: 11,
              fontStyle: "italic",
            }}
          >
            {comment}
          </blockquote>
        )}
      </div>
    );
    extra = null;
  } else if (att.schemaId === SCHEMAS.SCHEMA_3_UID) {
    const passportVersion = getValue("passportVersion");
    const totalProps = getValue("totalProps");
    textNode = `🪪 ${displayRecipient} passport updated to v${passportVersion} — ${totalProps} props`;
    extra = (
      <button
        onClick={() => setOpenId(openId === att.id ? null : att.id)}
        style={{
          background: "#FFD94A",
          border: "1px solid #4A4030",
          padding: "2px 6px",
          fontSize: 10,
          cursor: "pointer",
          fontWeight: 700,
          color: "#000",
        }}
      >
        Attest Milestone
      </button>
    );
  }

  const linkAddr =
    att.schemaId === SCHEMAS.SCHEMA_1_UID ? att.attester : att.recipient;

  const card = (
    <div
      style={{
        background: "#2E2820",
        border: "1px solid #4A4030",
        padding: 8,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        animation: isFresh ? "slideIn 0.3s ease-out" : undefined,
      }}
    >
      <div
        onClick={() => (window.location.href = `/passport/${linkAddr}`)}
        style={{ cursor: "pointer", flex: 1 }}
      >
        <div style={{ fontSize: 12 }}>{textNode}</div>
        <div style={{ fontSize: 9, color: "#8A7A58", marginTop: 2 }}>
          {relTime}
        </div>
      </div>
      {extra}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {card}
      {openId === att.id && (
        <ActionPanel
          att={att}
          close={() => setOpenId(null)}
          setPeerStatusMap={setPeerStatusMap}
        />
      )}
    </div>
  );
}

function relativeTime(unixSecs: number): string {
  const diff = Date.now() / 1000 - unixSecs;
  const sec = Math.floor(diff);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hrs ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ───────────────────────────────
// Inline Action Panel Component
// ───────────────────────────────

interface ActionProps {
  att: AttestationItem;
  close: () => void;
  setPeerStatusMap: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
}

function ActionPanel({ att, close, setPeerStatusMap }: ActionProps) {
  const { address } = useAccount();
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedFlag, setVerifiedFlag] = useState<boolean>(true);
  const isMilestone = att.schemaId === SCHEMAS.SCHEMA_1_UID;
  const isPassport = att.schemaId === SCHEMAS.SCHEMA_3_UID;

  // ── Wallet not connected – show prompt that triggers wagmi connect ──
  if (!address) {
    return (
      <div
        style={{
          background: "#1A1610",
          border: "1px solid #4A4030",
          padding: 12,
          color: "#F8F4E8",
        }}
      >
        <ConnectButton />
      </div>
    );
  }

  // Only implement peer verify form for this phase
  if (isMilestone) {
    const verified = verifiedFlag;
    const milestoneUID = att.id as `0x${string}`;
    // use helper from above for consistency
    const propIdVal: any = (() => {
      let v: any = att.decoded?.find((f) => f.name === "propId")?.value;
      if (v && typeof v === "object" && "value" in v) v = v.value;
      if (v && typeof v === "object" && "hex" in v) {
        try {
          return parseInt(v.hex, 16);
        } catch {
          return 0;
        }
      }
      return v ?? 0;
    })();
    const propId = Number(propIdVal);
    const builder = att.attester as `0x${string}`;

    const submit = async () => {
      try {
        setLoading(true);
        const provider = new BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        await peerVerify(signer, {
          milestoneUID,
          builder,
          propId: BigInt(propId),
          verified,
          comment,
        });
        // reflect locally
        setPeerStatusMap((m) => ({ ...m, [att.id]: verified }));
        close();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div
        style={{
          background: "#1A1610",
          border: "1px solid #4A4030",
          padding: 12,
          color: "#F8F4E8",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {/* verified/dispute toggle */}
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => setVerifiedFlag(true)}
            style={{
              flex: 1,
              background: verifiedFlag ? "#0A1E0A" : "#2E2820",
              border: verifiedFlag ? "2px solid #3A6A3A" : "1px solid #4A4030",
              color: verifiedFlag ? "#6ACC70" : "#8A7A58",
              fontWeight: 700,
              fontFamily: "IBM Plex Mono, monospace",
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            ✓ Confirm
          </button>
          <button
            onClick={() => setVerifiedFlag(false)}
            style={{
              flex: 1,
              background: !verifiedFlag ? "#2A0A0A" : "#2E2820",
              border: !verifiedFlag ? "2px solid #6A2020" : "1px solid #4A4030",
              color: !verifiedFlag ? "#C06060" : "#8A7A58",
              fontWeight: 700,
              fontFamily: "IBM Plex Mono, monospace",
              cursor: "pointer",
              padding: "4px 0",
            }}
          >
            ✗ Dispute
          </button>
        </div>

        <textarea
          placeholder="Optional comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{
            width: "100%",
            background: "#242018",
            border: "1px solid #4A4030",
            color: "#F8F4E8",
            padding: 6,
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              background: "#FFD94A",
              color: "#000",
              fontWeight: 700,
              border: "1px solid #4A4030",
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            {loading ? "Submitting…" : "Confirm"}
          </button>
          <button
            onClick={close}
            style={{
              background: "transparent",
              color: "#8A7A58",
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Attest milestone inline form on passport card ──
  if (isPassport) {
    const [form, setForm] = useState({
      propId: "",
      title: "",
      evidenceURI: "",
      isFinal: false,
    });
    const [txState, setTxState] = useState<
      | { status: "idle" }
      | { status: "pending" }
      | { status: "ok" }
      | { status: "error"; msg: string }
    >({ status: "idle" });

    const set =
      (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({
          ...f,
          [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
        }));

    const submit = async () => {
      if (!address) return;
      try {
        setTxState({ status: "pending" });
        const provider = new BrowserProvider((window as any).ethereum);
        const signer = await provider.getSigner();
        await attestMilestone(signer, {
          propId: BigInt(form.propId || 0),
          milestoneTitle: form.title,
          evidenceURI: form.evidenceURI,
          isFinal: form.isFinal,
          propdateTxHash: ("0x" + "0".repeat(64)) as `0x${string}`,
        });
        setTxState({ status: "ok" });
        // collapse after 2s
        setTimeout(() => {
          close();
        }, 2000);
      } catch (e: any) {
        setTxState({ status: "error", msg: e?.message ?? "Tx failed" });
      }
    };

    if (!address) {
      // same connect prompt reuse
      return (
        <div
          style={{
            background: "#1A1610",
            border: "1px solid #4A4030",
            padding: 12,
            color: "#F8F4E8",
          }}
        >
          <ConnectButton />
        </div>
      );
    }

    const inputStyle: React.CSSProperties = {
      background: "#1A1610",
      border: "1px solid #4A4030",
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: 10,
      padding: "3px 6px",
      color: "#F8F4E8",
      outline: "none",
      width: "100%",
    };

    return (
      <div
        style={{
          background: "#1A1610",
          border: "1px solid #4A4030",
          padding: 12,
          color: "#F8F4E8",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <input
          style={inputStyle}
          type="number"
          placeholder="Prop ID"
          value={form.propId}
          onChange={set("propId")}
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="Milestone Title"
          value={form.title}
          onChange={set("title")}
        />
        <input
          style={inputStyle}
          type="text"
          placeholder="https://… evidence URI"
          value={form.evidenceURI}
          onChange={set("evidenceURI")}
        />
        <label style={{ fontSize: 10 }}>
          <input
            type="checkbox"
            checked={form.isFinal}
            onChange={set("isFinal")}
            style={{ accentColor: "#FFD94A", marginRight: 4 }}
          />
          Mark as final milestone?
        </label>
        <button
          onClick={submit}
          disabled={txState.status === "pending"}
          style={{
            background: "#FFD94A",
            color: "#000",
            fontWeight: 700,
            border: "1px solid #4A4030",
            padding: "6px 12px",
            cursor: "pointer",
          }}
        >
          {txState.status === "pending" ? "Submitting…" : "Submit"}
        </button>
        {txState.status === "ok" && (
          <div style={{ color: "#6ACC70", fontSize: 10 }}>
            Milestone attested ✓
          </div>
        )}
        {txState.status === "error" && (
          <div style={{ color: "#C06060", fontSize: 10 }}>{txState.msg}</div>
        )}
      </div>
    );
  }

  return null;
}
