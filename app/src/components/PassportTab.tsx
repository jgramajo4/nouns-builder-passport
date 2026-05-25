import React from "react";
import type { MilestoneData } from "../lib/eas";

interface Props {
  milestones: MilestoneData[];
  isLoading: boolean;
  passportVersion: number;
  passportUID: string;
}

const COLS = "20px 1fr 72px 72px 36px";

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

function Pill({ type, label }: { type: "done" | "wip"; label: string }) {
  const styles: Record<string, React.CSSProperties> = {
    done: {
      background: "#0A2A0A",
      border: "1px solid #3A6A3A",
      color: "#6ACC70",
    },
    wip: {
      background: "#1A1600",
      border: "1px solid #6A5010",
      color: "#C8A830",
    },
  };
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 8,
        fontWeight: 700,
        padding: "2px 6px",
        whiteSpace: "nowrap",
        fontFamily: "IBM Plex Mono, monospace",
        ...styles[type],
      }}
    >
      {label}
    </span>
  );
}

export function PassportTab({
  milestones,
  isLoading,
  passportVersion,
  passportUID,
}: Props) {
  const [selected, setSelected] = React.useState<number | null>(null);

  const fmtDate = (time: bigint) =>
    new Date(Number(time) * 1000).toISOString().slice(0, 10);

  const completedProps = new Set(
    milestones.filter((m) => m.isFinal).map((m) => String(m.propId)),
  ).size;
  const totalProps = new Set(milestones.map((m) => String(m.propId))).size;

  return (
    <div>
      {/* list */}
      <div
        style={{
          background: "#242018",
          border: "1px solid #3A3020",
          marginBottom: 6,
        }}
      >
        {/* header */}
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
            fontFamily: "IBM Plex Mono, monospace",
          }}
        >
          <span />
          <span>Milestone</span>
          <span>Date</span>
          <span>Status</span>
          <span style={{ textAlign: "right" }}>Peers</span>
        </div>

        {isLoading && (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              fontSize: 10,
              color: "#6A5A38",
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            Loading milestones…
          </div>
        )}

        {!isLoading && milestones.length === 0 && (
          <div
            style={{
              padding: "20px",
              textAlign: "center",
              fontSize: 10,
              color: "#6A5A38",
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            No milestones found. Attest your first prop above.
          </div>
        )}

        {milestones.map((m, i) => (
          <div
            key={m.uid}
            onClick={() => setSelected(selected === i ? null : i)}
            style={{
              padding: "5px 8px",
              display: "grid",
              gridTemplateColumns: COLS,
              gap: 6,
              alignItems: "center",
              borderBottom:
                i < milestones.length - 1 ? "1px solid #3A3020" : "none",
              cursor: "pointer",
              background: selected === i ? "#1A2A10" : "transparent",
              transition: "background 0.1s",
              fontFamily: "IBM Plex Mono, monospace",
            }}
            onMouseEnter={(e) => {
              if (selected !== i)
                (e.currentTarget as HTMLDivElement).style.background =
                  "#2A2410";
            }}
            onMouseLeave={(e) => {
              if (selected !== i)
                (e.currentTarget as HTMLDivElement).style.background =
                  "transparent";
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
                  color: selected === i ? "#FFD94A" : "#F8F4E8",
                }}
              >
                #{String(m.propId)} — {m.milestoneTitle}
              </div>
              <div style={{ fontSize: 8, color: "#6A5A38" }}>
                uid: {m.uid.slice(0, 18)}…
              </div>
            </div>
            <div style={{ fontSize: 9, color: "#8A7A58" }}>
              {fmtDate(m.time)}
            </div>
            <div>
              <Pill
                type={m.isFinal ? "done" : "wip"}
                label={m.isFinal ? "Completed" : "In Progress"}
              />
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 10,
                textAlign: "right",
                color: "#8A7A58",
              }}
            >
              {m.peerCount ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* status bar */}
      <div
        style={{
          background: "#1E1A0A",
          borderTop: "1px solid #3A3020",
          padding: "2px 8px",
          fontSize: 9,
          color: "#6A5A38",
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        <span>
          {milestones.length} milestones · {completedProps} completed props · v
          {passportVersion}
        </span>
        <span>
          EAS UID: {passportUID ? passportUID.slice(0, 14) + "…" : "—"}
        </span>
      </div>
    </div>
  );
}
