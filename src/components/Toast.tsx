import { Ionicons } from '@expo/vector-icons'
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, space } from '../theme'
import { AppText } from './ui'
import { useApp } from '../store'

export function Toast() {
  const { toast } = useApp()
  const insets = useSafeAreaInsets()
  if (!toast) return null
  return (
    <View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 88 }]}>
      <View style={styles.toast}><Ionicons name="sparkles" size={16} color={colors.lime} /><AppText style={styles.message}>{toast}</AppText></View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  toast: { maxWidth: '100%', minHeight: 44, paddingHorizontal: space.lg, paddingVertical: 11, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: '#2A2635', flexDirection: 'row', alignItems: 'center', gap: 9 },
  message: { flexShrink: 1, fontSize: 12, fontWeight: '600', color: colors.text },
})
