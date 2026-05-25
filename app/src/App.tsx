import React, { useState } from "react";
import { useAccount } from "wagmi";
import { PassportCard } from "./components/PassportCard";
import { CDEChrome, type Tab } from "./components/CDEChrome";
import { PassportTab } from "./components/PassportTab";
import { FeedTab } from "./components/FeedTab";
import { AttestTab } from "./components/AttestTab";
import { PeerTab } from "./components/PeerTab";
import { BootstrapTab } from "./components/BootstrapTab";
import { ShareTab } from "./components/ShareTab";
import { usePassport, useMilestones } from "./hooks/usePassport";

export default function App() {
  const [tab, setTab] = useState<Tab>("passport");
  const { address } = useAccount();

  const { data: passport, isLoading: passportLoading } = usePassport(address);
  const { data: milestones = [], isLoading: msLoading } =
    useMilestones(address);

  const statusBar: React.CSSProperties = {
    background: "#1E1A0A",
    borderTop: "1px solid #3A3020",
    padding: "2px 8px",
    fontSize: 9,
    color: "#6A5A38",
    display: "flex",
    justifyContent: "space-between",
    fontFamily: "IBM Plex Mono, monospace",
  };

  return (
    <div
      style={{
        background: "#1A1610",
        minHeight: "100vh",
        fontFamily: "IBM Plex Mono, monospace",
      }}
    >
      {/* always-visible passport card */}
      <PassportCard passport={passport} isLoading={passportLoading} />

      {/* CDE panel */}
      <div
        style={{
          background: "#242018",
          border: "1px solid #3A3020",
          margin: "0",
        }}
      >
        <CDEChrome activeTab={tab} onTabChange={setTab} />

        <div style={{ background: "#1A1610", padding: 8 }}>
          {tab === "passport" && (
            <PassportTab
              milestones={milestones}
              isLoading={msLoading}
              passportVersion={passport ? Number(passport.passportVersion) : 0}
              passportUID={passport?.uid ?? ""}
            />
          )}
          {tab === "feed" && <FeedTab />}
          {tab === "attest" && <AttestTab />}
          {tab === "peer" && <PeerTab />}
          {tab === "bootstrap" && <BootstrapTab />}
          {tab === "share" && (
            <ShareTab passport={passport} milestones={milestones} />
          )}
        </div>

        <div style={statusBar}>
          <span>
            Schema 1 · Schema 2 · Schema 3 · NounsPassportResolver ·
            NounHolderResolver
          </span>
          <span>
            ⌐◨-◨ EAS Mainnet · Block #
            {typeof window !== "undefined" ? "…" : "—"}
          </span>
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #1A1610; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;700&family=Space+Grotesk:wght@400;500;700&display=swap');
      `}</style>
    </div>
  );
}
