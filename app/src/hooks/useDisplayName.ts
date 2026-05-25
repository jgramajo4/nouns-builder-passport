import { useEnsName } from "wagmi";
import { useEffect, useState } from "react";

const cache = new Map<string, string>();

/**
 * Resolves an Ethereum address to an ENS name if possible.
 * Returns the ENS or a truncated 0x address (0x1234…abcd).
 * Results are cached in-memory for the session.
 */
export function useDisplayName(address?: string): string {
  const [name, setName] = useState<string>(() => {
    if (!address) return "";
    return cache.get(address.toLowerCase()) ?? truncate(address);
  });

  const { data: ens } = useEnsName({ address: address as `0x${string}` }, {
    enabled: !!address && !cache.has(address.toLowerCase()),
  });

  useEffect(() => {
    if (!address) return;
    const lower = address.toLowerCase();
    if (ens) {
      cache.set(lower, ens);
      setName(ens);
    } else if (!cache.has(lower)) {
      cache.set(lower, truncate(address));
    }
  }, [address, ens]);

  return name;
}

function truncate(addr: string, chars = 4) {
  return addr.slice(0, 2 + chars) + "…" + addr.slice(-chars);
}
