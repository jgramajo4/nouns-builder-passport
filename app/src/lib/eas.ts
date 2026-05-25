import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import type { BrowserProvider, Signer } from "ethers";
import { CONTRACTS, SCHEMAS, SCHEMA_STRINGS } from "./config";

// ── EAS client (singleton, re-connected per signer) ──
let _eas: EAS | null = null;

export function getEAS(signer: Signer): EAS {
  if (!_eas) _eas = new EAS(CONTRACTS.EAS);
  _eas.connect(signer);
  return _eas;
}

// ── Schema 1: attest a prop milestone ──
export interface MilestoneAttestation {
  propId: bigint;
  milestoneTitle: string;
  evidenceURI: string;
  isFinal: boolean;
  propdateTxHash: `0x${string}`;
}

export async function attestMilestone(
  signer: Signer,
  data: MilestoneAttestation,
) {
  const eas = getEAS(signer);
  const encoder = new SchemaEncoder(SCHEMA_STRINGS.SCHEMA_1);

  const encoded = encoder.encodeData([
    { name: "propId", value: data.propId, type: "uint256" },
    { name: "milestoneTitle", value: data.milestoneTitle, type: "string" },
    { name: "evidenceURI", value: data.evidenceURI, type: "string" },
    { name: "isFinal", value: data.isFinal, type: "bool" },
    { name: "propdateTxHash", value: data.propdateTxHash, type: "bytes32" },
  ]);

  const tx = await eas.attest({
    schema: SCHEMAS.SCHEMA_1_UID,
    data: {
      recipient: "0x0000000000000000000000000000000000000000",
      expirationTime: 0n,
      revocable: false,
      refUID:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      data: encoded,
      value: 0n,
    },
  });

  const uid = await tx.wait();
  return uid;
}

// ── Schema 2: peer verify a milestone ──
export interface PeerVerification {
  milestoneUID: `0x${string}`;
  builder: `0x${string}`;
  propId: bigint;
  verified: boolean;
  comment?: string;
}

export async function peerVerify(signer: Signer, data: PeerVerification) {
  const eas = getEAS(signer);
  const encoder = new SchemaEncoder(SCHEMA_STRINGS.SCHEMA_2);

  const encoded = encoder.encodeData([
    { name: "milestoneUID", value: data.milestoneUID, type: "bytes32" },
    { name: "propId", value: data.propId, type: "uint256" },
    { name: "verified", value: data.verified, type: "bool" },
    {
      name: "comment",
      value: data.comment ?? "",
      type: "string",
    },
  ]);

  const tx = await eas.attest({
    schema: SCHEMAS.SCHEMA_2_UID,
    data: {
      recipient: data.builder,
      expirationTime: 0n,
      revocable: true,
      refUID: data.milestoneUID,
      data: encoded,
      value: 0n,
    },
  });

  const uid = await tx.wait();
  return uid;
}

// ── Fetch passport attestation (Schema 3) by builder address ──
export interface PassportData {
  uid: string;
  builder: `0x${string}`;
  totalProps: bigint;
  completedProps: bigint;
  totalMilestones: bigint;
  peerVerifications: bigint;
  avgDaysBetweenUpdates: bigint;
  passportVersion: bigint;
}

// ── Fetch milestone attestations (Schema 1) for a builder ──
export interface MilestoneData {
  uid: string;
  propId: bigint;
  milestoneTitle: string;
  evidenceURI: string;
  isFinal: boolean;
  propdateTxHash: string;
  attester: `0x${string}`;
  time: bigint;
  peerCount?: number;
}

// GraphQL query against EAS indexer
const EAS_GRAPHQL = "https://easscan.org/graphql";

export async function fetchPassport(
  builderAddress: string,
): Promise<PassportData | null> {
  const query = `
    query PassportAttestation($schema: String!, $recipient: String!) {
      attestations(
        where: {
          schemaId: { equals: $schema }
          recipient: { equals: $recipient }
          revoked: { equals: false }
        }
        orderBy: { time: desc }
        take: 1
      ) {
        id
        data
        attester
        time
      }
    }
  `;
  const resp = await fetch(EAS_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { schema: SCHEMAS.SCHEMA_3_UID, recipient: builderAddress },
    }),
  });
  const json = await resp.json();
  const att = json?.data?.attestations?.[0];
  if (!att) return null;

  const decoder = new SchemaEncoder(SCHEMA_STRINGS.SCHEMA_3);
  const decoded = decoder.decodeData(att.data);
  const get = (name: string) =>
    decoded.find((d) => d.name === name)?.value.value;

  return {
    uid: att.id,
    builder: get("builder") as `0x${string}`,
    totalProps: get("totalProps") as bigint,
    completedProps: get("completedProps") as bigint,
    totalMilestones: get("totalMilestones") as bigint,
    peerVerifications: get("peerVerifications") as bigint,
    avgDaysBetweenUpdates: get("avgDaysBetweenUpdates") as bigint,
    passportVersion: get("passportVersion") as bigint,
  };
}

// ── Feed: latest attestations across schemas ──
export interface FeedAttestation {
  id: string;
  attester: string;
  recipient: string;
  refUID: string;
  schemaId: string;
  time: number; // seconds unix
  decoded: DecodedField[];
}

export async function fetchFeed(
  take = 25,
  skip = 0,
): Promise<FeedAttestation[]> {
  const query = `\n    query FeedAttestations($schema1: String!, $schema2: String!, $schema3: String!, $take: Int!, $skip: Int!) {\n      attestations(\n        where: {\n          schemaId: { in: [$schema1, $schema2, $schema3] }\n          revoked: { equals: false }\n        }\n        orderBy: { time: desc }\n        take: $take\n        skip: $skip\n      ) {\n        id\n        attester\n        recipient\n        refUID\n        schemaId\n        time\n        decodedDataJson\n      }\n    }\n  `;
  const resp = await fetch(EAS_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: {
        schema1: SCHEMAS.SCHEMA_1_UID,
        schema2: SCHEMAS.SCHEMA_2_UID,
        schema3: SCHEMAS.SCHEMA_3_UID,
        take,
        skip,
      },
    }),
  });
  const json = await resp.json();
  const atts: any[] = json?.data?.attestations ?? [];

  return atts.map((att) => ({
    id: att.id,
    attester: att.attester,
    recipient: att.recipient,
    refUID: att.refUID,
    schemaId: att.schemaId,
    time: Number(att.time),
    decoded: safeParse(att.decodedDataJson) as DecodedField[],
  }));
}

interface DecodedField {
  name: string;
  type: string;
  value: any;
}

function safeParse(str: string): DecodedField[] {
  try {
    const parsed = JSON.parse(str ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

export async function fetchMilestones(
  builderAddress: string,
): Promise<MilestoneData[]> {
  const query = `
    query BuilderMilestones($schema: String!, $attester: String!) {
      attestations(
        where: {
          schemaId: { equals: $schema }
          attester: { equals: $attester }
          revoked: { equals: false }
        }
        orderBy: { time: desc }
      ) {
        id
        data
        attester
        time
      }
    }
  `;
  const resp = await fetch(EAS_GRAPHQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      variables: { schema: SCHEMAS.SCHEMA_1_UID, attester: builderAddress },
    }),
  });
  const json = await resp.json();
  const atts: any[] = json?.data?.attestations ?? [];
  const decoder = new SchemaEncoder(SCHEMA_STRINGS.SCHEMA_1);

  return atts.map((att) => {
    const decoded = decoder.decodeData(att.data);
    const get = (name: string) =>
      decoded.find((d) => d.name === name)?.value.value;
    return {
      uid: att.id,
      propId: get("propId") as bigint,
      milestoneTitle: get("milestoneTitle") as string,
      evidenceURI: get("evidenceURI") as string,
      isFinal: get("isFinal") as boolean,
      propdateTxHash: get("propdateTxHash") as string,
      attester: att.attester as `0x${string}`,
      time: BigInt(att.time),
    };
  });
}
