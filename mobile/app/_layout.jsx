import { Slot } from "expo-router";
import { ClerkProvider } from '@clerk/clerk-expo'
import { tokenCache } from '@clerk/clerk-expo/token-cache'
import SafeScreen from "@/components/SafeScreen";
import { StatusBar } from "expo-status-bar";

// Hardcoded for Release builds (env vars don't load properly in standalone builds)
const CLERK_PUBLISHABLE_KEY = "pk_test_cGxlYXNlZC1jdWItNC5jbGVyay5hY2NvdW50cy5kZXYk";

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <SafeScreen>
        <Slot />
      </SafeScreen>
      <StatusBar style="dark" />
    </ClerkProvider>
  )
}
