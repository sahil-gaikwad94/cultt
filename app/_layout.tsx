import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { OnboardingFlow } from '../src/components/OnboardingFlow'
import { Toast } from '../src/components/Toast'
import { AppProvider, useApp } from '../src/store'
import { colors } from '../src/theme'
import { AppText, font } from '../src/components/ui'

function AppRouter() {
  const { hydrated, state } = useApp()
  if (!hydrated) {
    return <View style={styles.loading}><View style={styles.mark}><AppText style={styles.markIcon}>◉</AppText></View><AppText style={styles.wordmark}>cultured.</AppText><ActivityIndicator color={colors.violet} style={{ marginTop: 22 }} /></View>
  }
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: state.preferences.reducedMotion ? 'none' : 'fade_from_bottom',
        gestureEnabled: true,
      }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ animation: state.preferences.reducedMotion ? 'none' : 'slide_from_right' }} />
        <Stack.Screen name="activity" options={{ presentation: 'modal', animation: state.preferences.reducedMotion ? 'none' : 'slide_from_bottom' }} />
        <Stack.Screen name="chat/[id]" options={{ animation: state.preferences.reducedMotion ? 'none' : 'slide_from_right' }} />
      </Stack>
      <OnboardingFlow visible={!state.hasOnboarded} />
      <Toast />
    </>
  )
}

export default function RootLayout() {
  return <SafeAreaProvider><AppProvider><AppRouter /></AppProvider></SafeAreaProvider>
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderColor: colors.violet, borderWidth: 1.5, backgroundColor: colors.surface },
  markIcon: { fontSize: 34, color: colors.lime, lineHeight: 40 },
  wordmark: { ...font.display, fontSize: 27, marginTop: 13, letterSpacing: -0.8 },
})
