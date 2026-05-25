import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet } from "wagmi/connectors";

// Replace with your WalletConnect project ID from https://cloud.walletconnect.com
const WC_PROJECT_ID =
  import.meta.env.VITE_WC_PROJECT_ID ?? "YOUR_WC_PROJECT_ID";

export const config = createConfig({
  chains: [mainnet],
  connectors: [
    injected(),
    walletConnect({ projectId: WC_PROJECT_ID }),
    coinbaseWallet({ appName: "Nouns Builder Passport" }),
  ],
  transports: {
    [mainnet.id]: http(
      import.meta.env.VITE_RPC_URL ?? "https://eth.llamarpc.com",
    ),
  },
});

// ── Contract addresses (fill after deployment) ──
export const CONTRACTS = {
  EAS: "0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587" as `0x${string}`,
  SCHEMA_REGISTRY:
    "0xA7b39296258348C78294F95B872b282326A97BDF" as `0x${string}`,
  NOUNS_PASSPORT_RESOLVER:
    "0xc73b1fe64638fe415db2985a4a3b1f0bebaafd33" as `0x${string}`,
  NOUN_HOLDER_RESOLVER:
    "0xc0edb7b49409936385da7bb623ca3c50482cfdf0" as `0x${string}`,
  PROP_UPDATE_RESOLVER:
    "0x4960e774ad4290eab05df6dea277fef0c1a26125" as `0x${string}`, // ← deployed resolver addresses
  NOUNS_TOKEN: "0x9C8fF314C9Bc7F6e59A9d9225Fb22946427eDC03" as `0x${string}`,
  PROPDATES: "0x6b0D6bBA3dFB9a9E01f4f43CfBBe01fc05d5B7F2" as `0x${string}`,
} as const;

// ── Schema UIDs (fill after deployment) ──
export const SCHEMAS = {
  SCHEMA_1_UID:
    "0x306cb07aebf437bd0d500ab1872353ca22eb3b731a6e7a7d18a3c6fd81a324e7" as `0x${string}`, // ← full UID from easscan
  SCHEMA_2_UID:
    "0xe0eb78e32ac8f42aeac4290e57ce179fd73c7508b283d08d39b42f974afac7c7" as `0x${string}`,
  SCHEMA_3_UID:
    "0x13abe245db2dfdb78676907992b5f6bf17a476ad97d265a1f095d739f5bd7c61" as `0x${string}`,
} as const;

// ── EAS Schema strings ──
export const SCHEMA_STRINGS = {
  // Schema 1: builder attests a prop milestone
  SCHEMA_1:
    "uint256 propId,string milestoneTitle,string evidenceURI,bool isFinal,bytes32 propdateTxHash",
  // Schema 2: Noun holder peer-verifies a milestone
  SCHEMA_2: "bytes32 milestoneUID,uint256 propId,bool verified,string comment",
  // Schema 3: builder passport (issued by resolver)
  SCHEMA_3:
    "address builder,uint256 totalProps,uint256 completedProps,uint256 totalMilestones,uint256 peerVerifications,uint256 avgDaysBetweenUpdates,uint256 passportVersion",
} as const;
