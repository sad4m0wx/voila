import 'react-native-gesture-handler';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { AuthNavigator } from '@/components/auth';
import AppProviders from '@/components/AppProviders';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, isFullyOnboarded, onboardingStep } = useAuth();

  // Only show auth navigator if user is authenticated AND has an active onboarding step
  // This ensures non-authenticated users and authenticated users who haven't started onboarding
  // both go to the main app
  if (user && onboardingStep && onboardingStep !== 'complete' && !isFullyOnboarded) {
    return <AuthNavigator />;
  }

  // Show main app navigation for all other cases
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="groups/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="groups/[id]/settings" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <AppProviders>
      <RootLayoutNav />
    </AppProviders>
  );
}
