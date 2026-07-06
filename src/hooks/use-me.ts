import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export interface MeData {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  locale: string | null;
  createdAt: string;
  /** First-run onboarding 門閂（ISO string）；null = 尚未 onboard。 */
  onboardedAt: string | null;
  entitlement: unknown;
  paywall: unknown;
}

export function useMe() {
  const { data, error, isLoading, mutate } = useSWR<MeData>("/api/me", fetcher);
  return { me: data, error, isLoading, mutate };
}
