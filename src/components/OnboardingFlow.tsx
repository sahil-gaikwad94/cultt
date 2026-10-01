import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { useEffect, useRef, useState } from 'react'
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { genres } from '../data'
import { useApp } from '../store'
import { colors, radius, space } from '../theme'
import { AppText, Button, Chip, font, hapticImpact, ProgressBar } from './ui'

export function OnboardingFlow({ visible }: { visible: boolean }) {
  const insets = useSafeAreaInsets()
  const { state, completeOnboarding, showToast } = useApp()
  const [step, setStep] = useState(0)
  const [mode, setMode] = useState<'dating' | 'friends'>(state.mode)
  const [selected, setSelected] = useState<string[]>(state.interests)
  const [ageConfirmed, setAgeConfirmed] = useState(state.ageConfirmed)
  const reveal = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (state.preferences.reducedMotion) {
      reveal.setValue(1)
      return
    }
    reveal.setValue(0)
    Animated.timing(reveal, { toValue: 1, duration: 420, useNativeDriver: true }).start()
  }, [step, reveal, state.preferences.reducedMotion])
  if (!visible) return null

  const next = () => {
    hapticImpact()
    if (step < 2) setStep((value) => value + 1)
    else {
      completeOnboarding(ageConfirmed, mode, selected)
      showToast('Your little universe is ready.')
    }
  }
  const toggleGenre = (genre: string) => setSelected((list) => list.includes(genre) ? list.filter((item) => item !== genre) : [...list, genre])
  const translateY = reveal.interpolate({ inputRange: [0, 1], outputRange: [14, 0] })

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => undefined}>
      <View style={[styles.screen, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 18) + 16 }]}>
        <LinearGradient colors={['rgba(125,98,198,0.16)', 'rgba(17,16,24,0.02)', 'transparent']} locations={[0, 0.58, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.topline}>
          <View style={styles.brand}><View style={styles.brandDisc}><View style={styles.brandHole} /></View><AppText style={styles.brandName}>cultured.</AppText></View>
          <AppText style={styles.stepCount}>0{step + 1} <AppText style={{ color: colors.textFaint }}>— 03</AppText></AppText>
        </View>
        <ProgressBar value={(step + 1) * 33.33} color={colors.lime} height={3} />

        <Animated.View style={[styles.body, { opacity: reveal, transform: [{ translateY }] }]}>
          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {step === 0 ? (
              <View style={styles.welcome}>
                <View style={styles.artOrb}>
                  <LinearGradient colors={['#302744', '#1C1926']} style={styles.artOrbFill}>
                    <View style={styles.record}><View style={styles.recordGroove} /><View style={styles.recordLabel}><View style={styles.recordDot} /></View></View>
                    <View style={styles.floatChip}><Ionicons name="musical-note" size={14} color={colors.lime} /><AppText style={styles.floatChipText}>same frequency</AppText></View>
                    <View style={[styles.floatChip, styles.floatChipBottom]}><Ionicons name="happy-outline" size={15} color={colors.coral} /><AppText style={styles.floatChipText}>your kind of funny</AppText></View>
                  </LinearGradient>
                </View>
                <AppText style={styles.kicker}>CULTURE FIRST. CHEMISTRY ALWAYS.</AppText>
                <AppText style={styles.heroTitle}>Meet on your{'\n'}own <AppText style={[styles.heroTitle, styles.heroItalic]}>frequency.</AppText></AppText>
                <AppText style={styles.bodyCopy}>The songs you save. The jokes you send your group chat. Start with what already makes you, you.</AppText>
                <View style={styles.promise}><Ionicons name="lock-closed-outline" color={colors.lime} size={16} /><AppText style={styles.promiseText}>Your culture stays yours to share.</AppText></View>
              </View>
            ) : step === 1 ? (
              <View style={styles.stepContent}>
                <AppText style={styles.kicker}>FIRST, YOUR KIND OF CONNECTION</AppText>
                <AppText style={styles.stepTitle}>Who are you hoping to meet?</AppText>
                <AppText style={styles.bodyCopy}>You can change this whenever you like. No labels locked in.</AppText>
                <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === 'dating' }} onPress={() => setMode('dating')} style={[styles.choiceCard, mode === 'dating' && styles.choiceSelected]}>
                  <View style={[styles.choiceIcon, { backgroundColor: 'rgba(177,156,255,0.16)' }]}><Ionicons name="heart-outline" color={colors.violet} size={21} /></View>
                  <View style={styles.choiceCopy}><AppText style={styles.choiceTitle}>Dating</AppText><AppText style={styles.choiceText}>A little spark, a lot of shared taste.</AppText></View>
                  <Ionicons name={mode === 'dating' ? 'radio-button-on' : 'radio-button-off'} color={mode === 'dating' ? colors.violet : colors.textFaint} size={21} />
                </Pressable>
                <Pressable accessibilityRole="radio" accessibilityState={{ selected: mode === 'friends' }} onPress={() => setMode('friends')} style={[styles.choiceCard, mode === 'friends' && styles.choiceSelected]}>
                  <View style={[styles.choiceIcon, { backgroundColor: 'rgba(213,244,118,0.13)' }]}><Ionicons name="people-outline" color={colors.lime} size={21} /></View>
                  <View style={styles.choiceCopy}><AppText style={styles.choiceTitle}>Friends</AppText><AppText style={styles.choiceText}>Your next favorite person to do nothing with.</AppText></View>
                  <Ionicons name={mode === 'friends' ? 'radio-button-on' : 'radio-button-off'} color={mode === 'friends' ? colors.violet : colors.textFaint} size={21} />
                </Pressable>
                <View style={styles.note}><Ionicons name="swap-horizontal-outline" size={15} color={colors.textFaint} /><AppText style={styles.noteText}>Dating and Friends have separate discovery. Your feed stays yours.</AppText></View>
              </View>
            ) : (
              <View style={styles.stepContent}>
                <AppText style={styles.kicker}>TUNE YOUR FIRST FREQUENCY</AppText>
                <AppText style={styles.stepTitle}>What’s in your rotation?</AppText>
                <AppText style={styles.bodyCopy}>Pick a few. These are a starting point, not a box.</AppText>
                <View style={styles.genreWrap}>{genres.map((genre) => <Chip key={genre} label={genre} selected={selected.includes(genre)} color={colors.lime} onPress={() => toggleGenre(genre)} />)}</View>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: ageConfirmed }} onPress={() => setAgeConfirmed((value) => !value)} style={styles.ageRow}>
                  <View style={[styles.check, ageConfirmed && styles.checkOn]}>{ageConfirmed ? <Ionicons name="checkmark" size={14} color={colors.background} /> : null}</View>
                  <AppText style={styles.ageCopy}>I confirm that I’m 18 or older.</AppText>
                </Pressable>
                <AppText style={styles.privacyNote}>Your likes, laughs and messages stay on this device until you connect a verified account.</AppText>
              </View>
            )}
          </ScrollView>
        </Animated.View>

        <View style={styles.footer}>
          <Button label={step === 2 ? 'Enter your world' : 'Continue'} icon={step === 2 ? 'arrow-forward' : undefined} variant={step === 2 ? 'lime' : 'primary'} onPress={next} disabled={step === 2 && (!ageConfirmed || selected.length === 0)} />
          {step > 0 ? <Pressable onPress={() => setStep((value) => Math.max(0, value - 1))} accessibilityRole="button" style={styles.backButton}><AppText style={styles.backText}>Back</AppText></Pressable> : <AppText style={styles.footerHint}>A better first hello starts here.</AppText>}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: space.xl },
  topline: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandDisc: { height: 26, width: 26, borderRadius: 13, borderWidth: 1.5, borderColor: colors.violet, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  brandHole: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  brandName: { ...font.display, fontSize: 22, letterSpacing: -0.7 },
  stepCount: { color: colors.lime, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  body: { flex: 1 },
  scrollBody: { flexGrow: 1, paddingBottom: 12 },
  welcome: { flex: 1, justifyContent: 'center', paddingTop: 10 },
  artOrb: { alignSelf: 'center', width: 250, height: 248, borderRadius: 122, marginBottom: 32, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderStrong },
  artOrbFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  record: { width: 156, height: 156, borderRadius: 78, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1721', borderColor: '#60537B', borderWidth: 1.5 },
  recordGroove: { width: 122, height: 122, borderRadius: 61, borderWidth: 1, borderColor: '#534968', position: 'absolute' },
  recordLabel: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  recordDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.lime },
  floatChip: { position: 'absolute', left: 5, top: 46, backgroundColor: '#24212E', borderRadius: 30, borderWidth: 1, borderColor: colors.borderStrong, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 10 },
  floatChipBottom: { top: undefined, left: undefined, right: 3, bottom: 38 },
  floatChipText: { color: colors.text, fontSize: 10, fontWeight: '600' },
  kicker: { color: colors.lime, fontSize: 10, fontWeight: '800', letterSpacing: 1.7, marginBottom: 13 },
  heroTitle: { ...font.display, fontSize: 43, lineHeight: 48, letterSpacing: -1.6, color: colors.text },
  heroItalic: { ...font.italic, color: colors.violet },
  bodyCopy: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 13 },
  promise: { alignSelf: 'flex-start', marginTop: 23, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 8 },
  promiseText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  stepContent: { paddingTop: 34 },
  stepTitle: { ...font.display, fontSize: 34, lineHeight: 39, letterSpacing: -1, marginTop: 4 },
  choiceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, padding: 15, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginTop: 13 },
  choiceSelected: { backgroundColor: '#221F2D', borderColor: colors.violet },
  choiceIcon: { width: 43, height: 43, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  choiceCopy: { flex: 1 },
  choiceTitle: { fontSize: 16, fontWeight: '700' },
  choiceText: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 17 },
  noteText: { color: colors.textFaint, fontSize: 11, lineHeight: 17, flex: 1 },
  genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 22 },
  ageRow: { flexDirection: 'row', gap: 11, alignItems: 'center', marginTop: 24, paddingVertical: 5 },
  check: { width: 23, height: 23, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.lime, borderColor: colors.lime },
  ageCopy: { fontSize: 13, color: colors.text, fontWeight: '600' },
  privacyNote: { color: colors.textFaint, fontSize: 10, lineHeight: 16, marginTop: 17 },
  footer: { paddingTop: 10, gap: 11 },
  backButton: { minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  footerHint: { color: colors.textFaint, textAlign: 'center', fontSize: 11, paddingVertical: 8 },
})
