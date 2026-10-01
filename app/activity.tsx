import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppText, Avatar, IconButton, Surface, font } from '../src/components/ui'
import { conversations, feedPosts } from '../src/data'
import { useApp } from '../src/store'
import { colors, radius, space } from '../src/theme'

const items = [
  { id: 'match-maya', group: 'Matches & messages', title: 'Maya gets your “rainy bodega run” song.', detail: 'You both found your way to Men I Trust.', time: 'Just now', icon: 'musical-notes' as const, person: 'maya', target: '/chat/maya' },
  { id: 'feed-jules', group: 'Feed activity', title: 'Jules shared something for the group chat.', detail: 'The three-act playlist discourse continues.', time: '12 min', icon: 'happy-outline' as const, person: 'jules', target: '/' },
  { id: 'fingerprint', group: 'Fingerprint updates', title: 'Your humor profile is finding its shape.', detail: 'A few more laughs make the signal clearer.', time: 'Today', icon: 'finger-print-outline' as const, person: null, target: '/profile' },
]

export default function ActivityScreen() {
  const router = useRouter()
  const { state, dismissActivity } = useApp()
  const groups = ['Matches & messages', 'Feed activity', 'Fingerprint updates']
  const visible = items.filter((item) => !state.dismissedActivity.includes(item.id))
  const imageFor = (id: string) => conversations.find((person) => person.id === id)?.photo ?? feedPosts[0].photo
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View style={{ flex: 1 }}><AppText style={styles.eyebrow}>A GENTLE PING, NEVER A NUDGE</AppText><AppText style={styles.title}>Activity.</AppText></View><IconButton icon="close" label="Close activity" onPress={() => router.back()} /></View>
        <View style={styles.quietBanner}><Ionicons name="moon-outline" size={16} color={colors.lime} /><AppText style={styles.quietText}>Your corner’s quiet when you need it to be.</AppText></View>
        {groups.map((group) => {
          const section = visible.filter((item) => item.group === group)
          return (
            <View key={group} style={styles.section}><AppText style={styles.groupTitle}>{group}</AppText>
              {section.length ? section.map((item) => <Surface key={item.id} style={styles.activityCard}><Pressable onPress={() => router.push(item.target as never)} accessibilityRole="button" style={styles.activityMain}>{item.person ? <Avatar source={imageFor(item.person)} size={42} /> : <View style={styles.activityIcon}><Ionicons name={item.icon} size={18} color={colors.violet} /></View>}<View style={{ flex: 1 }}><AppText style={styles.activityTitle}>{item.title}</AppText><AppText style={styles.activityDetail}>{item.detail}</AppText><AppText style={styles.activityTime}>{item.time}</AppText></View></Pressable><Pressable onPress={() => dismissActivity(item.id)} accessibilityRole="button" accessibilityLabel="Dismiss activity" style={styles.dismiss}><Ionicons name="close" size={14} color={colors.textFaint} /></Pressable></Surface>) : <AppText style={styles.emptyText}>Nothing new here. Enjoy the quiet.</AppText>}
            </View>
          )
        })}
        <View style={styles.footer}><Ionicons name="heart-outline" size={14} color={colors.coral} /><AppText style={styles.footerText}>No countdowns. No guilt. Just the things you might want to see.</AppText></View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingTop: 7, paddingBottom: 35 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  eyebrow: { color: colors.lime, fontSize: 8, fontWeight: '800', letterSpacing: 1.4, marginBottom: 4 },
  title: { ...font.display, fontSize: 30 },
  quietBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, padding: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  quietText: { color: colors.textMuted, fontSize: 10 },
  section: { marginTop: 22 },
  groupTitle: { color: colors.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 9 },
  activityCard: { padding: 11, marginBottom: 8, borderRadius: 17, shadowOpacity: 0 },
  activityMain: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 22 },
  activityIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { fontSize: 11, fontWeight: '700', lineHeight: 16 },
  activityDetail: { color: colors.textMuted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  activityTime: { color: colors.textFaint, fontSize: 8, marginTop: 5 },
  dismiss: { position: 'absolute', right: 5, top: 5, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.textFaint, fontSize: 10, paddingVertical: 11 },
  footer: { flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  footerText: { color: colors.textFaint, fontSize: 9 },
})
