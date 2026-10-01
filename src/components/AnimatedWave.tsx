import React, { useEffect, useMemo, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import { colors } from '../theme'

export function AnimatedWave({ playing, reducedMotion = false, color = colors.violet, height = 28, bars = 24 }: {
  playing: boolean
  reducedMotion?: boolean
  color?: string
  height?: number
  bars?: number
}) {
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0.14))).current
  const sequences = useMemo(() => values.map((value, index) => Animated.loop(Animated.sequence([
    Animated.timing(value, { toValue: 0.22 + ((index * 7) % 11) / 11 * 0.76, duration: 260 + (index % 6) * 75, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    Animated.timing(value, { toValue: 0.12 + ((index * 3) % 6) / 22, duration: 300 + (index % 5) * 60, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
  ]))), [values])

  useEffect(() => {
    if (playing && !reducedMotion) sequences.forEach((animation) => animation.start())
    else {
      sequences.forEach((animation) => animation.stop())
      values.forEach((value) => value.setValue(0.14))
    }
    return () => sequences.forEach((animation) => animation.stop())
  }, [playing, reducedMotion, sequences, values])

  return (
    <View accessible accessibilityLabel={playing ? 'Animated music waveform, playing' : 'Music waveform paused'} style={[styles.wave, { height }]}>
      {values.map((value, index) => <Animated.View key={index} style={[styles.bar, { height: height * 0.9, backgroundColor: color, opacity: playing && !reducedMotion ? 0.95 : 0.52, transform: [{ scaleY: value }] }]} />)}
    </View>
  )
}

const styles = StyleSheet.create({ wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 2, overflow: 'hidden' }, bar: { flex: 1, maxWidth: 4, minWidth: 2, borderRadius: 10 } })
