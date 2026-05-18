import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from "@expo-google-fonts/space-mono";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/lib/auth-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { theme } from "@/constants/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 60_000,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk: SpaceGrotesk_400Regular,
    "SpaceGrotesk-Medium": SpaceGrotesk_500Medium,
    "SpaceGrotesk-SemiBold": SpaceGrotesk_600SemiBold,
    "SpaceGrotesk-Bold": SpaceGrotesk_700Bold,
    SpaceMono: SpaceMono_400Regular,
    "SpaceMono-Bold": SpaceMono_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                animation: "slide_from_right",
                contentStyle: { backgroundColor: theme.colors.background },
                headerShadowVisible: false,
                headerStyle: {
                  backgroundColor: theme.colors.backgroundElevated,
                },
                headerTintColor: theme.colors.accent,
                headerTitleStyle: {
                  ...theme.type.heading,
                  color: theme.colors.textPrimary,
                },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="venue/[id]" options={{ title: "Venue" }} />
              <Stack.Screen name="demo" options={{ title: "Demo" }} />
            </Stack>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
