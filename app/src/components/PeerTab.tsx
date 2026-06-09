import React, { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { BrowserProvider } from "ethers";
import { peerVerify, fetchMilestones } from "../lib/eas";
import { useNounBalance } from "../hooks/useNounBalance";
import type { MilestoneData } from "../lib/eas";

const mono = "IBM Plex Mono, monospace";
type TxState = { status: "idle" | "pending" | "ok" | "error"; msg: string };

const COLS = "20px 1fr 60px 46px 54px";

function FolderIcon({ done }: { done: boolean }) {
  const c = done ? "#4A9A50" : "#B89A10";
  return (
    <svg
      width="16"
      height="13"
      viewBox="0 0 16 13"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <rect
        x="0"
        y="3"
        width="16"
        height="10"
        fill={c}
        stroke="#1A1610"
        strokeWidth="1"
      />
      <rect
        x="0"
        y="2"
        width="7"
        height="3"
        fill={c}
        stroke="#1A1610"
        strokeWidth="1"
      />
      <rect x="0" y="3" width="16" height="2" fill="#FFF" opacity="0.15" />
    </svg>
  );
}

export function PeerTab() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { isEligible, isNounHolder, balance, votes } = useNounBalance(address);
  const [builderAddr, setBuilderAddr] = useState("");
  const [milestones, setMilestones] = useState<MilestoneData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [verified, setVerified] = useState<boolean>(true);
  const [comment, setComment] = useState<string>("");
  const [tx, setTx] = useState<TxState>({ status: "idle", msg: "" });

  const load = async () => {
    if (!builderAddr) return;
    setLoading(true);
    try {
      const ms = await fetchMilestones(builderAddr);
      setMilestones(ms);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (selected === null || !milestones[selected]) return;
    if (!walletClient || !address) return;
    const m = milestones[selected];
    try {
      setTx({ status: "pending", msg: "Submitting peer verification…" });
      const provider = new BrowserProvider(walletClient as any);
      const signer = await provider.getSigner();
      await peerVerify(signer, {
        milestoneUID: m.uid as `0x${string}`,
        builder: m.attester,
        propId: m.propId,
        verified,
        comment: comment.trim() === "" ? undefined : comment.trim(),
      });
      setTx({
        status: "ok",
        msg: "Peer verification attested. Builder passport will update.",
      });
      setSelected(null);
      setVerified(true);
      setComment("");
    } catch (e: any) {
      setTx({
        status: "error",
        msg: e?.message?.slice(0, 80) ?? "Transaction failed",
      });
    }
  };

  const noticeStyle = (ok: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 8px",
    fontSize: 9,
    marginBottom: 6,
    border: `1px solid ${ok ? "#3A6A3A" : "#6A5010"}`,
    background: ok ? "#0A1E0A" : "#1A1600",
    color: ok ? "#6ACC70" : "#C8A830",
    fontFamily: mono,
  });

  return (
    <div>
      {isConnected && isEligible ? (
        <div style={noticeStyle(true)}>
          ✓ Wallet connected —{" "}
          {isNounHolder
            ? `${String(balance)} Nouns`
            : `delegated voting power: ${String(votes)}`}
          . Eligible to verify.
        </div>
      ) : (
        <div style={noticeStyle(false)}>
          ⚠ Must hold or be delegated ≥1 Noun to peer verify.{" "}
          {!isConnected ? "Connect wallet first." : ""}
        </div>
      )}

      {/* builder lookup */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "86px 1fr",
          gap: 6,
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: "#8A7A58",
            textAlign: "right",
            textTransform: "uppercase",
            letterSpacing: "0.3px",
            fontFamily: mono,
          }}
        >
          Builder
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            style={{
              flex: 1,
              background: "#1A1610",
              border: "1px solid #4A4030",
              fontFamily: mono,
              fontSize: 10,
              padding: "3px 6px",
              color: "#F8F4E8",
              outline: "none",
            }}
            type="text"
            placeholder="0x… or name.eth"
            value={builderAddr}
            onChange={(e) => setBuilderAddr(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button
            onClick={load}
            style={{
              fontFamily: mono,
              fontSize: 9,
              padding: "2px 8px",
              cursor: "pointer",
              background: "#2E2820",
              border: "1px solid #4A4030",
              color: "#F8F4E8",
            }}
          >
            Load ↓
          </button>
        </div>
      </div>

      {/* milestone list */}
      <div
        style={{
          background: "#242018",
          border: "1px solid #3A3020",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            background: "#2A2410",
            borderBottom: "1px solid #3A3020",
            padding: "3px 8px",
            display: "grid",
            gridTemplateColumns: COLS,
            gap: 6,
            fontSize: 8,
            fontWeight: 700,
            color: "#6A5A38",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontFamily: mono,
          }}
        >
          <span />
          <span>Milestone</span>
          <span>Date</span>
          <span>Status</span>
          <span>Peers</span>
        </div>
        {loading && (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              fontSize: 10,
              color: "#6A5A38",
              fontFamily: mono,
            }}
          >
            Loading…
          </div>
        )}
        {!loading && milestones.length === 0 && (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              fontSize: 10,
              color: "#6A5A38",
              fontFamily: mono,
            }}
          >
            Enter a builder address above and click Load
          </div>
        )}
        {milestones.map((m, i) => {
          const date = new Date(Number(m.time) * 1000)
            .toISOString()
            .slice(0, 10);
          const isSel = selected === i;
          return (
            <div
              key={m.uid}
              onClick={() => setSelected(isSel ? null : i)}
              style={{
                padding: "5px 8px",
                display: "grid",
                gridTemplateColumns: COLS,
                gap: 6,
                alignItems: "center",
                borderBottom:
                  i < milestones.length - 1 ? "1px solid #3A3020" : "none",
                cursor: "pointer",
                background: isSel ? "#1A2A10" : "transparent",
                fontFamily: mono,
              }}
            >
              <FolderIcon done={m.isFinal} />
              <div style={{ overflow: "hidden" }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 10,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    color: isSel ? "#FFD94A" : "#F8F4E8",
                  }}
                >
                  #{String(m.propId)} — {m.milestoneTitle}
                </div>
              </div>
              <div style={{ fontSize: 9, color: "#8A7A58" }}>{date}</div>
              <div>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: 8,
                    fontWeight: 700,
                    padding: "2px 6px",
                    ...(m.isFinal
                      ? {
                          background: "#0A2A0A",
                          border: "1px solid #3A6A3A",
                          color: "#6ACC70",
                        }
                      : {
                          background: "#1A1600",
                          border: "1px solid #6A5010",
                          color: "#C8A830",
                        }),
                  }}
                >
                  {m.isFinal ? "Done" : "WIP"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700 }}>
                  {m.peerCount ?? 0}/5
                </span>
                <div style={{ width: 36, height: 3, background: "#4A4030" }}>
                  <div
                    style={{
                      width: `${Math.round(((m.peerCount ?? 0) / 5) * 100)}%`,
                      height: "100%",
                      background: "#4A9A50",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* verify panel */}
      {selected !== null && milestones[selected] ? (
        <div
          style={{
            background: "#242018",
            border: "1px solid #3A3020",
            padding: "8px 10px",
          }}
        >
          {/* header */}
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#FFD94A",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              borderBottom: "1px solid #3A3020",
              paddingBottom: 4,
              marginBottom: 6,
              fontFamily: mono,
            }}
          >
            ◉ Verify: #{String(milestones[selected].propId)} —{" "}
            {milestones[selected].milestoneTitle}
          </div>

          {/* evidence link */}
          {milestones[selected].evidenceURI && (
            <div style={{ marginBottom: 6 }}>
              <a
                href={milestones[selected].evidenceURI}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 9,
                  color: "#8A7A58",
                  textDecoration: "underline",
                  fontFamily: mono,
                }}
              >
                ↗ View Evidence
              </a>
            </div>
          )}

          {/* info */}
          <div
            style={{
              fontSize: 9,
              color: "#8A7A58",
              lineHeight: 1.6,
              marginBottom: 6,
              borderLeft: "2px solid #B89A10",
              paddingLeft: 6,
              fontFamily: mono,
            }}
          >
            Anchored to your Noun balance or delegated votes at this block. One
            verification per holder per milestone (NounHolderResolver).
          </div>

          {/* verified toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 9, color: "#8A7A58", fontFamily: mono }}>
              Verified complete?
            </span>
            {([true, false] as const).map((v) => (
              <button
                key={String(v)}
                onClick={() => setVerified(v)}
                style={{
                  fontFamily: mono,
                  fontSize: 9,
                  padding: "2px 10px",
                  cursor: "pointer",
                  background:
                    verified === v
                      ? v
                        ? "#0A2A0A"
                        : "#2A0A0A"
                      : "transparent",
                  border: `1px solid ${v ? "#3A6A3A" : "#6A2020"}`,
                  color:
                    verified === v ? (v ? "#6ACC70" : "#C06060") : "#6A5A38",
                  fontWeight: 700,
                }}
              >
                {v ? "Yes" : "Dispute"}
              </button>
            ))}
          </div>

          {/* optional comment */}
          <textarea
            placeholder="Add context (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{
              width: "100%",
              minHeight: 60,
              resize: "vertical",
              background: "#1A1610",
              color: "#F8F4E8",
              border: "1px solid #4A4030",
              fontFamily: mono,
              fontSize: 10,
              padding: 6,
              marginBottom: 6,
            }}
          />

          {/* submit */}
          <button
            onClick={submit}
            disabled={!isEligible}
            style={{
              fontFamily: mono,
              fontSize: 10,
              padding: "4px 10px",
              cursor: "pointer",
              background: "#FFD94A",
              border: "1px solid #B89A10",
              color: "#1A1610",
              fontWeight: 700,
            }}
          >
            ◉ Submit Peer Verification
          </button>
          {!isEligible && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 9,
                color: "#6A5A38",
                fontFamily: mono,
              }}
            >
              Requires ≥1 Noun held or delegated
            </span>
          )}
          {tx.status !== "idle" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 8px",
                fontSize: 9,
                marginTop: 5,
                border: `1px solid ${tx.status === "ok" ? "#3A6A3A" : tx.status === "error" ? "#6A2020" : "#6A5010"}`,
                background:
                  tx.status === "ok"
                    ? "#0A1E0A"
                    : tx.status === "error"
                      ? "#2A0A0A"
                      : "#1A1600",
                color:
                  tx.status === "ok"
                    ? "#6ACC70"
                    : tx.status === "error"
                      ? "#C06060"
                      : "#C8A830",
                fontFamily: mono,
              }}
            >
              {tx.msg}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            fontSize: 10,
            color: "#6A5A38",
            textAlign: "center",
            padding: 10,
            border: "1px dashed #3A3020",
            fontFamily: mono,
          }}
        >
          [select a milestone above to verify]
        </div>
      )}
    </div>
  );
}
