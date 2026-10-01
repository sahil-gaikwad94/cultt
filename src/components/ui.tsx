import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import React from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type PressableProps, type TextProps, type ViewProps } from 'react-native'
import { colors, radius, shadow, space } from '../theme'

const serifFont = Platform.select({ ios: 'Georgia', default: 'serif' })
const systemFont = Platform.select({ ios: 'System', default: 'sans-serif' })

export const font = {
  display: { fontFamily: serifFont, fontWeight: '400' as const },
  italic: { fontFamily: serifFont, fontStyle: 'italic' as const, fontWeight: '400' as const },
  ui: { fontFamily: systemFont },
}

export function hapticSelection() {
  Haptics.selectionAsync().catch(() => undefined)
}
export function hapticImpact() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
}

export function AppText({ style, ...props }: TextProps) {
  return <Text allowFontScaling maxFontSizeMultiplier={1.3} style={[styles.text, style]} {...props} />
}

export function Screen({ children, style, ...props }: ViewProps) {
  return <View style={[styles.screen, style]} {...props}>{children}</View>
}

export function Surface({ children, style, ...props }: ViewProps) {
  return <View style={[styles.surface, style]} {...props}>{children}</View>
}

export function ScreenHeader({ eyebrow, title, action, actionLabel }: {
  eyebrow?: string
  title: string
  action?: () => void
  actionLabel?: string
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <AppText style={styles.eyebrow}>{eyebrow}</AppText> : null}
        <AppText style={styles.screenTitle}>{title}</AppText>
      </View>
      {action ? <IconButton icon="settings-outline" label={actionLabel ?? 'Open settings'} onPress={action} /> : null}
    </View>
  )
}

export function SectionHeading({ title, subtitle, action, onAction }: {
  title: string
  subtitle?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={{ flex: 1 }}>
        <AppText style={styles.sectionTitle}>{title}</AppText>
        {subtitle ? <AppText style={styles.subtle}>{subtitle}</AppText> : null}
      </View>
      {action && onAction ? <Pressable onPress={() => { hapticSelection(); onAction() }} accessibilityRole="button"><AppText style={styles.actionText}>{action}</AppText></Pressable> : null}
    </View>
  )
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, loading, style, ...props }: {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'quiet' | 'lime'
  icon?: keyof typeof Ionicons.glyphMap
  disabled?: boolean
  loading?: boolean
  style?: PressableProps['style']
} & Omit<PressableProps, 'onPress' | 'style'>) {
  const kind = variant === 'primary' ? styles.primaryButton : variant === 'lime' ? styles.limeButton : variant === 'quiet' ? styles.quietButton : styles.secondaryButton
  const textColor = variant === 'lime' ? colors.background : variant === 'quiet' ? colors.violet : colors.text
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={() => { hapticImpact(); onPress() }}
      style={(state) => [styles.button, kind, disabled ? { opacity: 0.45 } : null, typeof style === 'function' ? style(state) : style]}
      {...props}
    >
      {loading ? <ActivityIndicator color={textColor} size="small" /> : icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
      <AppText style={[styles.buttonLabel, { color: textColor }]}>{label}</AppText>
    </Pressable>
  )
}

export function IconButton({ icon, onPress, label, color = colors.text, size = 20, badge }: {
  icon: keyof typeof Ionicons.glyphMap
  onPress: () => void
  label: string
  color?: string
  size?: number
  badge?: boolean
}) {
  return (
    <Pressable onPress={() => { hapticSelection(); onPress() }} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.iconButton, pressed && { transform: [{ scale: 0.93 }] }]}>
      <Ionicons name={icon} size={size} color={color} />
      {badge ? <View style={styles.badgeDot} /> : null}
    </Pressable>
  )
}

export function Chip({ label, selected, onPress, color = colors.violet, compact = false }: {
  label: string
  selected?: boolean
  onPress?: () => void
  color?: string
  compact?: boolean
}) {
  const content = <AppText style={[styles.chipText, compact && { fontSize: 11 }, selected && { color: colors.background }]}>{label}</AppText>
  const chipStyle = [styles.chip, compact && { paddingVertical: 7, paddingHorizontal: 10 }, selected && { backgroundColor: color, borderColor: color }]
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected }} onPress={() => { hapticSelection(); onPress() }} style={({ pressed }) => [chipStyle, pressed && { opacity: 0.8 }]}>{content}</Pressable>
  ) : <View style={chipStyle}>{content}</View>
}

export function Avatar({ source, size = 44, online = false, ring = false }: {
  source: ImageSourcePropType
  size?: number
  online?: boolean
  ring?: boolean
}) {
  return (
    <View style={{ width: size, height: size }}>
      <Image source={source} contentFit="cover" style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, ring && { borderWidth: 2, borderColor: colors.violet }]} />
      {online ? <View style={[styles.onlineDot, { width: size * 0.23, height: size * 0.23, borderRadius: size * 0.12 }]} /> : null}
    </View>
  )
}

export function ProgressBar({ value, color = colors.violet, height = 5 }: { value: number; color?: string; height?: number }) {
  return <View style={[styles.progressTrack, { height }]}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(value, 100))}%`, backgroundColor: color }]} /></View>
}

export function Label({ children, style }: { children: React.ReactNode; style?: TextProps['style'] }) {
  return <AppText style={[styles.label, style]}>{children}</AppText>
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  surface: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: space.lg, ...shadow.card },
  text: { color: colors.text, fontSize: 14, fontFamily: systemFont },
  screenHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl },
  eyebrow: { color: colors.textFaint, textTransform: 'uppercase', letterSpacing: 1.7, fontSize: 10, fontWeight: '700', marginBottom: 5 },
  screenTitle: { ...font.display, color: colors.text, fontSize: 30, letterSpacing: -0.8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: space.xxl, marginBottom: space.md },
  sectionTitle: { ...font.display, color: colors.text, fontSize: 21 },
  subtle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  actionText: { color: colors.violet, fontWeight: '700', fontSize: 12 },
  button: { minHeight: 50, borderRadius: radius.pill, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  primaryButton: { backgroundColor: colors.violet },
  limeButton: { backgroundColor: colors.lime },
  secondaryButton: { backgroundColor: colors.surfaceHigh, borderColor: colors.borderStrong, borderWidth: 1 },
  quietButton: { backgroundColor: 'transparent' },
  buttonLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.1 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, top: 8, right: 8, backgroundColor: colors.coral, borderWidth: 1, borderColor: colors.background },
  chip: { minHeight: 34, paddingHorizontal: 13, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceHigh, borderColor: colors.border, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  avatar: { backgroundColor: colors.surfaceHigh },
  onlineDot: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.lime, borderWidth: 2, borderColor: colors.background },
  progressTrack: { backgroundColor: colors.surfaceHigh, borderRadius: 99, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 99 },
  label: { color: colors.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
})
