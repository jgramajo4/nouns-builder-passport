import React, { useEffect, useRef, useState } from "react";
import { useConnect, type Connector } from "wagmi";

/**
 * Friendly, human-readable label for each connector. WalletConnect is the
 * one that opens the QR modal (so users can scan with a phone wallet), so we
 * call it out explicitly.
 */
function connectorLabel(c: Connector): string {
  switch (c.id) {
    case "walletConnect":
      return "WalletConnect · Scan QR";
    case "coinbaseWalletSDK":
    case "coinbaseWallet":
      return "Coinbase Wallet";
    case "injected":
      if (
        typeof window !== "undefined" &&
        (window as any).ethereum?.isMetaMask
      )
        return "MetaMask";
      return "Browser Wallet";
    default:
      return c.name;
  }
}

interface Props {
  label?: string;
  disabled?: boolean;
  /** Style applied to the trigger button. */
  buttonStyle?: React.CSSProperties;
  /** Style applied to the wrapping element (handy for flex alignment). */
  wrapperStyle?: React.CSSProperties;
}

const defaultButtonStyle: React.CSSProperties = {
  background: "#FFD94A",
  color: "#000",
  fontWeight: 700,
  border: "2px solid #000",
  padding: "6px 12px",
  cursor: "pointer",
  fontFamily: "IBM Plex Mono, monospace",
};

/**
 * Connect button that lets the user pick which wallet to use. Previously the
 * app always forced the `injected` connector, so the WalletConnect QR modal
 * never appeared for users without a browser-extension wallet. Presenting the
 * connector choice ensures WalletConnect (and its QR popup) is reachable.
 */
export function ConnectButton({
  label = "Connect Wallet",
  disabled,
  buttonStyle,
  wrapperStyle,
}: Props) {
  const { connect, connectors, isPending } = useConnect();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close the menu when clicking outside of it.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Hide the injected option when there's no browser wallet to connect to —
  // otherwise selecting it silently fails.
  const hasInjected =
    typeof window !== "undefined" && Boolean((window as any).ethereum);
  const options = connectors.filter((c) => c.id !== "injected" || hasInjected);

  // If only one real option exists, connect directly instead of showing a menu.
  const handleTrigger = () => {
    if (options.length === 1) {
      connect({ connector: options[0] });
      return;
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={ref} style={{ position: "relative", ...wrapperStyle }}>
      <button
        onClick={handleTrigger}
        disabled={disabled || isPending}
        style={buttonStyle ?? defaultButtonStyle}
      >
        {isPending ? "Connecting…" : label}
      </button>

      {open && options.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 180,
            background: "#242018",
            border: "1px solid #3A3020",
            zIndex: 1000,
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            fontFamily: "IBM Plex Mono, monospace",
          }}
        >
          {options.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                setOpen(false);
                connect({ connector: c });
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #2E2818",
                color: "#F8F4E8",
                padding: "8px 12px",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "IBM Plex Mono, monospace",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#2E2818";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              {connectorLabel(c)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
