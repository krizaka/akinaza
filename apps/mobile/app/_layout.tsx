import { brands } from "@krizaka/tokens/native";
import { ThemeProvider } from "@krizaka/ui/native";
import { Stack } from "expo-router";

/** The app's root: the Krizaka native theme in Akinaza's colours (forest green and copper), dark and light. */
export default function RootLayout() {
  return (
    <ThemeProvider overrides={brands.akinaza}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
