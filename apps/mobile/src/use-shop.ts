import { useGlobalSearchParams } from "expo-router";

/** The shop of the address (`/fr/app/<shop>/…`, as the web's): every call of the shop's space names it (D8). */
export function useShop(): string {
  const { shop } = useGlobalSearchParams<{ shop?: string }>();
  return typeof shop === "string" ? shop : "";
}
