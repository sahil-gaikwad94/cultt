import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useMemo, useRef, useState } from 'react'
import { Animated, Dimensions, Modal, PanResponder, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppText, Avatar, Button, Chip, IconButton, Surface, font, hapticImpact, hapticSelection } from '../../src/components/ui'
import { candidates, humorSignals } from '../../src/data'
import { useApp } from '../../src/store'
import { colors, radius, space } from '../../src/theme'

const SWIPE_TRIGGER = Math.min(Dimensions.get('window').width * 0.24, 96)

export default function DiscoverScreen() {
  const router = useRouter()
  const { state, setMode, decideCandidate, rewindCandidate, showToast } = useApp()
  const [detail, setDetail] = useState(false)
  const cardOffset = useRef(new Animated.ValueXY()).current
  const candidate = candidates[state.candidateIndex]
  const rotation = cardOffset.x.interpolate({ inputRange: [-260, 0, 260], outputRange: ['-13deg', '0deg', '13deg'], extrapolate: 'clamp' })
  const resonateOpacity = cardOffset.x.interpolate({ inputRange: [0, 80, 170], outputRange: [0, 0.7, 1], extrapolate: 'clamp' })
  const passOpacity = cardOffset.x.interpolate({ inputRange: [-170, -80, 0], outputRange: [1, 0.7, 0], extrapolate: 'clamp' })

  const fling = (decision: 'pass' | 'resonate') => {
    const sign = decision === 'resonate' ? 1 : -1
    Animated.timing(cardOffset, { toValue: { x: sign * 520, y: 15 }, duration: state.preferences.reducedMotion ? 70 : 190, useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return
      const accepted = decideCandidate(decision)
      cardOffset.setValue({ x: 0, y: 0 })
      if (accepted && decision === 'resonate') showToast('Resonance sent. A good hello is on its way.')
      if (accepted) hapticImpact()
    })
  }
  const returnCard = () => {
    if (state.preferences.reducedMotion) { cardOffset.setValue({ x: 0, y: 0 }); return }
    Animated.spring(cardOffset, { toValue: { x: 0, y: 0 }, useNativeDriver: false, stiffness: 300, damping: 28 }).start()
  }

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 9 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: Animated.event([null, { dx: cardOffset.x, dy: cardOffset.y }], { useNativeDriver: false }),
    onPanResponderRelease: (_, gesture) => {
      const direction = gesture.dx > 0 ? 'resonate' : 'pass'
      if (Math.abs(gesture.dx) > SWIPE_TRIGGER || Math.abs(gesture.vx) > 0.65) fling(direction)
      else returnCard()
    },
    onPanResponderTerminate: returnCard,
  }), [cardOffset, decideCandidate, returnCard, state.candidateIndex, state.resonancesLeft])

  const shareCandidate = async () => {
    if (!candidate) return
    await Share.share({ message: `${candidate.name} and I are ${candidate.score}% Taste Twins on cultured.` })
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View style={{ flex: 1 }}><AppText style={styles.eyebrow}>THE MATCH MATRIX</AppText><AppText style={styles.title}>Find your <AppText style={styles.titleAccent}>frequency.</AppText></AppText></View>
          <IconButton icon="notifications-outline" label="Open activity" badge onPress={() => router.push('/activity')} />
        </View>
        <View style={styles.modeRow}>
          <View style={styles.modeSwitch}>
            {(['dating', 'friends'] as const).map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: state.mode === option }} onPress={() => setMode(option)} style={[styles.modeOption, state.mode === option && styles.modeOptionActive]}><AppText style={[styles.modeText, state.mode === option && styles.modeTextActive]}>{option === 'dating' ? 'Dating' : 'Friends'}</AppText></Pressable>)}
          </View>
          <Pressable onPress={() => showToast(`${state.resonancesLeft} Resonances left today`)} style={styles.limitChip} accessibilityRole="button"><Ionicons name="sparkles" size={13} color={colors.lime} /><AppText style={styles.limitText}>{state.resonancesLeft} left</AppText></Pressable>
        </View>
        <View style={styles.introRow}><View><AppText style={styles.introTitle}>A little more signal.</AppText><AppText style={styles.introCopy}>The score is about your taste, not your looks.</AppText></View><View style={styles.livePill}><View style={styles.liveDot} /><AppText style={styles.liveText}>NEAR YOU</AppText></View></View>

        {candidate ? (
          <>
            <View style={styles.cardStack}>
              <View style={[styles.peekCard, styles.peekFar]} />
              <View style={[styles.peekCard, styles.peekNear]} />
              <Animated.View {...panResponder.panHandlers} style={[styles.candidateCard, { transform: [...cardOffset.getTranslateTransform(), { rotate: state.preferences.reducedMotion ? '0deg' : rotation }] }]}>
                <Image source={candidate.photo} contentFit="cover" style={StyleSheet.absoluteFill} />
                <LinearGradient colors={['rgba(8,7,12,0.02)', 'rgba(8,7,12,0.05)', 'rgba(8,7,12,0.94)']} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
                <Animated.View pointerEvents="none" style={[styles.stamp, styles.resonateStamp, { opacity: resonateOpacity, transform: [{ rotate: '-12deg' }] }]}><AppText style={[styles.stampText, { color: colors.lime }]}>RESONATE</AppText></Animated.View>
                <Animated.View pointerEvents="none" style={[styles.stamp, styles.passStamp, { opacity: passOpacity, transform: [{ rotate: '12deg' }] }]}><AppText style={[styles.stampText, { color: colors.coral }]}>NEXT</AppText></Animated.View>
                <View style={styles.scoreBadge}><Ionicons name="sparkles" color={colors.lime} size={13} /><AppText style={styles.scoreValue}>{candidate.score}%</AppText><AppText style={styles.scoreLabel}>TASTE TWINS</AppText></View>
                <Pressable onPress={shareCandidate} accessibilityRole="button" accessibilityLabel={`Share ${candidate.name}'s profile`} style={styles.shareButton}><Ionicons name="share-outline" size={17} color={colors.text} /></Pressable>
                <View style={styles.cardBottom}>
                  <View style={styles.locationLine}><Ionicons name="location-outline" size={13} color={colors.textMuted} /><AppText style={styles.location}>{candidate.city} · {candidate.distance}</AppText></View>
                  <AppText style={styles.candidateName}>{candidate.name}<AppText style={styles.candidateAge}>, {candidate.age}</AppText></AppText>
                  <AppText style={styles.bio}>{candidate.bio}</AppText>
                  <View style={styles.signalRow}><View style={styles.signal}><Ionicons name="musical-notes" size={12} color={colors.lime} /><AppText style={styles.signalText}>{candidate.sharedArtist}</AppText></View><View style={styles.signal}><Ionicons name="happy-outline" size={12} color={colors.violet} /><AppText style={styles.signalText}>{candidate.sharedMeme}</AppText></View></View>
                  <Pressable accessibilityRole="button" onPress={() => setDetail(true)} style={styles.prompt}><Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.violet} /><AppText style={styles.promptText}>{candidate.prompt}</AppText><Ionicons name="arrow-forward" size={14} color={colors.textFaint} /></Pressable>
                </View>
              </Animated.View>
            </View>
            <View style={styles.cardHint}><Ionicons name="swap-horizontal" size={14} color={colors.textFaint} /><AppText style={styles.hintText}>Swipe right to resonate · left to pass</AppText></View>
            <View style={styles.actionRow}>
              <RoundAction label="Rewind" icon="arrow-undo" tone="muted" disabled={state.decisionHistory.length === 0} onPress={() => { rewindCandidate(); cardOffset.setValue({ x: 0, y: 0 }); hapticSelection() }} />
              <RoundAction label="Pass" icon="close" tone="coral" onPress={() => fling('pass')} />
              <Pressable accessibilityRole="button" accessibilityLabel="Resonate with this person" onPress={() => fling('resonate')} style={({ pressed }) => [styles.resonateButton, pressed && { transform: [{ scale: 0.94 }] }]}><Ionicons name="sparkles" size={22} color={colors.background} /></Pressable>
              <RoundAction label="Fingerprint" icon="finger-print" tone="violet" onPress={() => setDetail(true)} />
            </View>
          </>
        ) : (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIcon}><Ionicons name="radio-outline" size={33} color={colors.violet} /></View>
            <AppText style={styles.emptyTitle}>You’ve found everyone in this mix.</AppText>
            <AppText style={styles.emptyCopy}>Your Fingerprint grows as you listen and laugh. Head back to the Feed, or widen your radius and we’ll bring in a new signal.</AppText>
            <Button label="Back to your Feed" icon="sparkles" onPress={() => router.navigate('/')} style={{ alignSelf: 'stretch', marginTop: 22 }} />
            <Pressable onPress={() => { router.push('/settings'); hapticSelection() }}><AppText style={styles.emptyLink}>Adjust your discovery distance</AppText></Pressable>
          </View>
        )}
      </ScrollView>
      <FingerprintSheet candidate={candidate ?? candidates.at(-1)!} visible={detail} onClose={() => setDetail(false)} />
    </SafeAreaView>
  )
}

function RoundAction({ label, icon, tone, onPress, disabled }: { label: string; icon: keyof typeof Ionicons.glyphMap; tone: 'muted' | 'coral' | 'violet'; onPress: () => void; disabled?: boolean }) {
  const color = tone === 'coral' ? colors.coral : tone === 'violet' ? colors.violet : colors.textMuted
  return <Pressable disabled={disabled} onPress={() => { hapticSelection(); onPress() }} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.roundAction, disabled && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.92 }] }]}><Ionicons name={icon} size={20} color={color} /><AppText style={[styles.roundLabel, { color }]}>{label}</AppText></Pressable>
}

function FingerprintSheet({ candidate, visible, onClose }: { candidate: (typeof candidates)[number]; visible: boolean; onClose: () => void }) {
  const signals = candidate.humor.map((value, index) => ({ ...humorSignals[index], value }))
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}><Pressable style={styles.scrim} onPress={onClose} /><View style={styles.detailSheet}>
        <View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View style={{ flex: 1 }}><AppText style={styles.detailEyebrow}>A LITTLE MORE THAN A FIRST IMPRESSION</AppText><AppText style={styles.detailTitle}>{candidate.name}’s Fingerprint</AppText></View><IconButton icon="close" label="Close Fingerprint" onPress={onClose} size={18} /></View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 25 }}>
          <Surface style={styles.tasteCard}><View style={styles.tasteScore}><AppText style={styles.tasteNumber}>{candidate.score}%</AppText><AppText style={styles.tasteLabel}>TASTE TWINS</AppText></View><View style={{ flex: 1 }}><AppText style={styles.tasteStatement}>You hear the world in a similar key.</AppText><AppText style={styles.tasteSmall}>Strongest overlap: {candidate.sharedArtist} + {candidate.sharedMeme}.</AppText></View></Surface>
          <AppText style={styles.detailSection}>Humor rhythm</AppText>
          {signals.map((signal) => <View key={signal.label} style={styles.humorRow}><AppText style={styles.humorLabel}>{signal.label}</AppText><View style={styles.humorTrack}><View style={[styles.humorFill, { width: `${signal.value}%`, backgroundColor: signal.color }]} /></View><AppText style={styles.humorValue}>{signal.value}</AppText></View>)}
          <AppText style={styles.detailSection}>On repeat</AppText><View style={styles.artistRow}><View style={styles.artistDisc}><Ionicons name="musical-note" color={colors.lime} size={18} /></View><View style={{ flex: 1 }}><AppText style={styles.artistName}>{candidate.artist}</AppText><AppText style={styles.tasteSmall}>{candidate.track} · the shared track</AppText></View><Ionicons name="checkmark-circle" size={18} color={colors.lime} /></View>
          <AppText style={styles.detailSection}>A conversation starter</AppText><View style={styles.promptCard}><Ionicons name="chatbubbles-outline" size={18} color={colors.violet} /><AppText style={styles.promptQuote}>{candidate.prompt}</AppText></View>
        </ScrollView>
        <Button label="Close and keep exploring" variant="secondary" onPress={onClose} />
      </View></View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.lg, paddingBottom: 132 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6 },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 6 },
  title: { ...font.display, color: colors.text, fontSize: 28, letterSpacing: -0.9 },
  titleAccent: { ...font.italic, color: colors.violet },
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 19 },
  modeSwitch: { padding: 4, borderRadius: radius.pill, flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  modeOption: { minWidth: 88, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  modeOptionActive: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.borderStrong },
  modeText: { color: colors.textFaint, fontSize: 11, fontWeight: '700' },
  modeTextActive: { color: colors.text },
  limitChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  limitText: { color: colors.lime, fontSize: 10, fontWeight: '700' },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 11 },
  introTitle: { ...font.display, fontSize: 18 },
  introCopy: { color: colors.textFaint, fontSize: 10, marginTop: 3 },
  livePill: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime },
  liveText: { color: colors.textMuted, fontSize: 7, fontWeight: '800', letterSpacing: 0.6 },
  cardStack: { height: 445, marginTop: 1 },
  peekCard: { position: 'absolute', left: 9, right: 9, height: '100%', borderRadius: 25, backgroundColor: colors.surfaceHigh, borderWidth: 1, borderColor: colors.border },
  peekFar: { top: 11, transform: [{ scale: 0.95 }], opacity: 0.45 },
  peekNear: { top: 6, transform: [{ scale: 0.975 }], opacity: 0.72 },
  candidateCard: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 25, overflow: 'hidden', backgroundColor: colors.surfaceHigh, ...StyleSheet.flatten({ elevation: 7 }) },
  scoreBadge: { position: 'absolute', top: 14, left: 14, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(213,244,118,0.4)', backgroundColor: 'rgba(19,18,26,0.84)', paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  scoreValue: { color: colors.lime, fontSize: 13, fontWeight: '800' },
  scoreLabel: { color: colors.textMuted, fontSize: 7, letterSpacing: 0.6, fontWeight: '800' },
  shareButton: { position: 'absolute', top: 13, right: 13, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(17,16,24,0.66)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong },
  stamp: { position: 'absolute', top: 75, borderWidth: 3, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  resonateStamp: { left: 18, borderColor: colors.lime },
  passStamp: { right: 18, borderColor: colors.coral },
  stampText: { fontWeight: '900', fontSize: 19, letterSpacing: 1 },
  cardBottom: { position: 'absolute', left: 16, right: 16, bottom: 13 },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  location: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  candidateName: { ...font.display, color: colors.text, fontSize: 31, letterSpacing: -0.8 },
  candidateAge: { ...font.ui, fontSize: 17, fontWeight: '500', color: colors.textMuted },
  bio: { color: '#E1DBE8', fontSize: 11, lineHeight: 16, marginTop: 3 },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 15, backgroundColor: 'rgba(17,16,24,0.72)', borderWidth: 1, borderColor: colors.borderStrong },
  signalText: { color: colors.text, fontSize: 9, fontWeight: '600' },
  prompt: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: 'rgba(17,16,24,0.77)' },
  promptText: { flex: 1, color: colors.text, fontSize: 10, lineHeight: 14 },
  cardHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  hintText: { color: colors.textFaint, fontSize: 10 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: 13, paddingBottom: 2 },
  roundAction: { minWidth: 58, alignItems: 'center', justifyContent: 'center', gap: 4 },
  roundLabel: { fontSize: 8, fontWeight: '700' },
  resonateButton: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center', shadowColor: colors.lime, shadowOpacity: 0.2, shadowRadius: 16, elevation: 5 },
  emptyWrap: { flex: 1, minHeight: 430, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong },
  emptyTitle: { ...font.display, fontSize: 26, textAlign: 'center', marginTop: 18 },
  emptyCopy: { color: colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 9 },
  emptyLink: { color: colors.violet, fontSize: 12, fontWeight: '700', marginTop: 17 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  detailSheet: { maxHeight: '86%', backgroundColor: colors.backgroundRaised, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 },
  sheetHandle: { width: 40, height: 4, borderRadius: 4, backgroundColor: colors.textFaint, alignSelf: 'center', opacity: 0.6, marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  detailEyebrow: { color: colors.lime, fontSize: 8, fontWeight: '800', letterSpacing: 1.3, marginBottom: 4 },
  detailTitle: { ...font.display, fontSize: 24 },
  tasteCard: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 14 },
  tasteScore: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(213,244,118,0.12)', borderWidth: 1, borderColor: 'rgba(213,244,118,0.42)', alignItems: 'center', justifyContent: 'center' },
  tasteNumber: { color: colors.lime, fontSize: 22, fontWeight: '800' },
  tasteLabel: { color: colors.textFaint, fontSize: 6, fontWeight: '800', letterSpacing: 0.5 },
  tasteStatement: { ...font.display, fontSize: 17, lineHeight: 21 },
  tasteSmall: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  detailSection: { ...font.display, fontSize: 19, marginTop: 20, marginBottom: 11 },
  humorRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 11 },
  humorLabel: { width: 102, color: colors.textMuted, fontSize: 10 },
  humorTrack: { flex: 1, height: 6, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  humorFill: { height: 6, borderRadius: 4 },
  humorValue: { width: 25, textAlign: 'right', color: colors.text, fontSize: 10, fontWeight: '700' },
  artistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, padding: 11, backgroundColor: colors.surface },
  artistDisc: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#302744', alignItems: 'center', justifyContent: 'center' },
  artistName: { fontSize: 13, fontWeight: '700' },
  promptCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.surface },
  promptQuote: { ...font.italic, flex: 1, fontSize: 15, lineHeight: 20, color: colors.text },
})
