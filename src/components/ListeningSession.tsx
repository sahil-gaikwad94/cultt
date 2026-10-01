import { Ionicons } from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { AnimatedWave } from './AnimatedWave'
import { AppText, Button, Chip, IconButton, font, hapticSelection } from './ui'
import { colors, radius, space } from '../theme'
import { useApp } from '../store'

const tracks = [
  { title: 'Show Me How', artist: 'Men I Trust', vibe: 'a little soft-focus' },
  { title: 'Friday Morning', artist: 'Khruangbin', vibe: 'slow-groove energy' },
  { title: 'Be Sweet', artist: 'Japanese Breakfast', vibe: 'the long way home' },
]
const moments = ['🫶', '✨', '🎧', '🥹']

function clock(seconds: number) {
  const min = Math.floor(seconds / 60).toString().padStart(2, '0')
  const sec = (seconds % 60).toString().padStart(2, '0')
  return `${min}:${sec}`
}

export function ListeningSession({ visible, partner, onClose }: { visible: boolean; partner: string; onClose: () => void }) {
  const { state, showToast } = useApp()
  const [trackIndex, setTrackIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [reactions, setReactions] = useState<{ emoji: string; at: number }[]>([])
  const track = tracks[trackIndex]

  useEffect(() => {
    if (!visible || !playing || elapsed >= 900) return
    const timer = setInterval(() => setElapsed((value) => Math.min(900, value + 1)), 1000)
    return () => clearInterval(timer)
  }, [visible, playing, elapsed])

  useEffect(() => {
    if (elapsed === 900 && visible) {
      setPlaying(false)
      showToast('Fifteen minutes, beautifully spent. The conversation is all yours.')
    }
  }, [elapsed, visible, showToast])

  const sendMoment = (emoji: string) => {
    setReactions((items) => [...items, { emoji, at: elapsed }])
    hapticSelection()
  }
  const close = () => { setPlaying(false); onClose() }

  return (
    <Modal visible={visible} transparent animationType={state.preferences.reducedMotion ? 'fade' : 'slide'} onRequestClose={close}>
      <View style={styles.root}><Pressable style={styles.scrim} onPress={close} /><View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.header}><View><AppText style={styles.eyebrow}>A LITTLE ROOM FOR TWO</AppText><AppText style={styles.title}>Listen together.</AppText></View><IconButton icon="close" label="End listening session" onPress={close} size={18} /></View>
        <View style={styles.sharedCard}><View style={styles.sharedIcon}><Ionicons name="headset" color={colors.lime} size={22} /></View><View style={{ flex: 1 }}><AppText style={styles.sharedTitle}>You and {partner}</AppText><AppText style={styles.sharedNote}>No perfect words needed. Just press play.</AppText></View><View style={styles.pulse}><View style={styles.pulseDot} /></View></View>
        <AppText style={styles.selectLabel}>PICK A SHARED TRACK</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackPills}>{tracks.map((item, index) => <Chip key={item.title} label={item.title} selected={trackIndex === index} onPress={() => { setTrackIndex(index); hapticSelection() }} compact />)}</ScrollView>
        <View style={styles.player}>
          <View style={styles.vinyl}><View style={styles.vinylGroove}><View style={styles.vinylLabel}><Ionicons name="musical-note" size={17} color={colors.background} /></View></View></View>
          <AppText style={styles.trackTitle}>{track.title}</AppText><AppText style={styles.artist}>{track.artist} · {track.vibe}</AppText>
          <View style={styles.waveWrap}><AnimatedWave playing={playing} reducedMotion={state.preferences.reducedMotion} bars={34} height={44} color={colors.violet} /></View>
          <View style={styles.timerRow}><AppText style={styles.timer}>{clock(elapsed)}</AppText><AppText style={styles.timerHint}>{elapsed >= 900 ? 'SESSION COMPLETE' : 'OF 15:00 · TAKE YOUR TIME'}</AppText><AppText style={styles.timer}>{clock(900 - elapsed)}</AppText></View>
          <Button label={playing ? 'Pause the moment' : elapsed >= 900 ? 'Play it again' : 'Start listening'} icon={playing ? 'pause' : 'play'} variant="lime" onPress={() => { if (elapsed >= 900) setElapsed(0); setPlaying((value) => !value) }} style={{ alignSelf: 'stretch', marginTop: 15 }} />
          <AppText style={styles.playerNote}>Visual session preview · connect music services for shared audio.</AppText>
        </View>
        <View style={styles.reactionHeading}><View><AppText style={styles.reactionTitle}>Send a little feeling</AppText><AppText style={styles.reactionCopy}>Your reactions land at the exact moment.</AppText></View><AppText style={styles.momentCount}>{reactions.length} {reactions.length === 1 ? 'moment' : 'moments'}</AppText></View>
        <View style={styles.emojiRow}>{moments.map((emoji) => <Pressable key={emoji} onPress={() => sendMoment(emoji)} accessibilityRole="button" accessibilityLabel={`Send ${emoji} reaction`} style={({ pressed }) => [styles.emojiButton, pressed && { transform: [{ scale: 0.9 }] }]}><AppText style={styles.emoji}>{emoji}</AppText></Pressable>)}</View>
        {reactions.length > 0 ? <AppText style={styles.latestReaction}>Latest {reactions[reactions.length - 1].emoji} at {clock(reactions[reactions.length - 1].at)}</AppText> : null}
        <Button label="Keep chatting instead" variant="secondary" onPress={close} style={{ alignSelf: 'stretch', marginTop: 13 }} />
      </View></View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  sheet: { maxHeight: '94%', backgroundColor: colors.backgroundRaised, borderTopLeftRadius: 29, borderTopRightRadius: 29, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 28, borderWidth: 1, borderColor: colors.borderStrong },
  grabber: { width: 40, height: 4, borderRadius: 4, backgroundColor: colors.textFaint, opacity: 0.55, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  eyebrow: { color: colors.lime, fontSize: 8, letterSpacing: 1.4, fontWeight: '800', marginBottom: 4 },
  title: { ...font.display, fontSize: 27 },
  sharedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 17, padding: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  sharedIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(213,244,118,0.12)', alignItems: 'center', justifyContent: 'center' },
  sharedTitle: { fontSize: 12, fontWeight: '700' },
  sharedNote: { color: colors.textFaint, fontSize: 9, marginTop: 3 },
  pulse: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(213,244,118,0.13)', alignItems: 'center', justifyContent: 'center' },
  pulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  selectLabel: { color: colors.textFaint, fontSize: 8, fontWeight: '800', letterSpacing: 1.2, marginTop: 17, marginBottom: 8 },
  trackPills: { gap: 8, paddingBottom: 3 },
  player: { alignItems: 'center', paddingTop: 15, paddingHorizontal: 14, borderRadius: 21, backgroundColor: '#1A1721', borderWidth: 1, borderColor: colors.border, marginTop: 12 },
  vinyl: { width: 65, height: 65, borderRadius: 33, backgroundColor: '#131119', borderWidth: 1, borderColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  vinylGroove: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#574A70', alignItems: 'center', justifyContent: 'center' },
  vinylLabel: { width: 25, height: 25, borderRadius: 13, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  trackTitle: { ...font.display, fontSize: 19, marginTop: 9 },
  artist: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  waveWrap: { alignSelf: 'stretch', marginTop: 10 },
  timerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  timer: { color: colors.textMuted, fontSize: 9, fontVariant: ['tabular-nums'] },
  timerHint: { color: colors.textFaint, fontSize: 8, letterSpacing: 0.6, fontWeight: '700' },
  playerNote: { color: colors.textFaint, fontSize: 8, marginTop: 8, marginBottom: 2 },
  reactionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 },
  reactionTitle: { fontSize: 12, fontWeight: '700' },
  reactionCopy: { color: colors.textFaint, fontSize: 9, marginTop: 3 },
  momentCount: { color: colors.textFaint, fontSize: 9 },
  emojiRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  emojiButton: { flex: 1, height: 41, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 19 },
  latestReaction: { color: colors.violet, fontSize: 9, marginTop: 7 },
})
