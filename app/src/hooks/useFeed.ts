import { useQuery } from "@tanstack/react-query";
import { fetchFeed } from "../lib/eas";

export function useFeed(take: number, skip: number) {
  return useQuery({
    queryKey: ["feed", take, skip],
    queryFn: () => fetchFeed(take, skip),
    refetchInterval: 30_000,
  });
}
