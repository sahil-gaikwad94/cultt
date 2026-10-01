import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import React, { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Avatar, AppText, Chip, IconButton, SectionHeading, Surface, font, hapticSelection } from '../../src/components/ui'
import { conversations } from '../../src/data'
import { useApp } from '../../src/store'
import { colors, radius, space } from '../../src/theme'

export default function PeopleScreen() {
  const router = useRouter()
  const { state } = useApp()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const inbox = useMemo(() => conversations.filter((item) => filter === 'all' || ((item.unread ?? 0) > 0 && !state.readChats.includes(item.id))), [filter, state.readChats])
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><AppText style={styles.eyebrow}>THE GOOD PART</AppText><AppText style={styles.title}>Your people.</AppText></View>
          <IconButton icon="settings-outline" label="Open settings" onPress={() => router.push('/settings')} />
        </View>
        <View style={styles.intro}><View style={styles.introIcon}><Ionicons name="headset-outline" size={20} color={colors.lime} /></View><View style={{ flex: 1 }}><AppText style={styles.introTitle}>A shared song makes an easy hello.</AppText><AppText style={styles.introCopy}>Pick up where the good taste left off.</AppText></View><Ionicons name="sparkles" color={colors.violet} size={15} /></View>

        <View style={styles.filterRow}><Chip label={`All ${conversations.length}`} selected={filter === 'all'} onPress={() => setFilter('all')} compact /><Chip label="Unread" selected={filter === 'unread'} onPress={() => setFilter('unread')} compact /><View style={{ flex: 1 }} /><AppText style={styles.count}>{inbox.length} in your corner</AppText></View>
        <SectionHeading title="Conversations" subtitle="No pressure to reply fast. Real life comes first." />
        <View style={styles.list}>{inbox.map((person, index) => {
          const messages = state.messages[person.id] ?? person.messages
          const lastMessage = messages[messages.length - 1]
          const unread = (person.unread ?? 0) > 0 && !state.readChats.includes(person.id)
          return (
            <Pressable key={person.id} accessibilityRole="button" accessibilityLabel={`Open chat with ${person.name}`} onPress={() => { hapticSelection(); router.push(`/chat/${person.id}`) }} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceHigh }]}>
              <Avatar source={person.photo} size={54} online={person.online} ring={unread} />
              <View style={styles.personCopy}>
                <View style={styles.personTop}><AppText style={[styles.personName, unread && { color: colors.text }]}>{person.name}</AppText><AppText style={styles.personTime}>{lastMessage?.time ?? person.time}</AppText></View>
                <AppText style={styles.personPreview} numberOfLines={1}>{lastMessage?.text ?? person.preview}</AppText>
                <View style={styles.sharedLine}><Ionicons name="musical-note" size={11} color={colors.violet} /><AppText style={styles.sharedText} numberOfLines={1}>{person.matchTrack}</AppText></View>
              </View>
              {unread ? <View style={styles.unreadBadge}><AppText style={styles.unreadText}>{person.unread}</AppText></View> : <Ionicons name="chevron-forward" size={15} color={colors.textFaint} />}
              {index < inbox.length - 1 ? <View style={styles.separator} /> : null}
            </Pressable>
          )
        })}</View>

        {inbox.length === 0 ? <Surface style={styles.empty}><View style={styles.emptyIcon}><Ionicons name="checkmark-done-outline" size={23} color={colors.lime} /></View><AppText style={styles.emptyTitle}>All caught up.</AppText><AppText style={styles.emptyCopy}>Your unread chats are right where you left them.</AppText></Surface> : null}
        <Surface style={styles.promise}><View style={styles.promiseIcon}><Ionicons name="heart-outline" size={19} color={colors.coral} /></View><View style={{ flex: 1 }}><AppText style={styles.promiseTitle}>Good things start with a little “same.”</AppText><AppText style={styles.promiseCopy}>No likes to unlock. No first messages to pay for. Just people who get it.</AppText></View></Surface>
        <View style={styles.footer}><Ionicons name="shield-checkmark-outline" color={colors.textFaint} size={14} /><AppText style={styles.footerText}>Take your time. You’re in control of your corner.</AppText></View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingTop: 10, paddingBottom: 122 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 19 },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginBottom: 5 },
  title: { ...font.display, fontSize: 31, letterSpacing: -0.8 },
  intro: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, backgroundColor: '#1A1721', borderRadius: 19, borderWidth: 1, borderColor: colors.border },
  introIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(213,244,118,0.12)', alignItems: 'center', justifyContent: 'center' },
  introTitle: { fontSize: 12, fontWeight: '700' },
  introCopy: { color: colors.textFaint, fontSize: 10, marginTop: 3 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 21 },
  count: { color: colors.textFaint, fontSize: 9 },
  list: { borderRadius: 21, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: 84, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 11 },
  personCopy: { flex: 1, justifyContent: 'center' },
  personTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  personName: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  personTime: { color: colors.textFaint, fontSize: 9 },
  personPreview: { color: colors.textMuted, fontSize: 10, marginTop: 4, maxWidth: 235 },
  sharedLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  sharedText: { color: colors.textFaint, fontSize: 9, flexShrink: 1 },
  unreadBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: colors.background, fontSize: 9, fontWeight: '800' },
  separator: { position: 'absolute', bottom: 0, left: 77, right: 12, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  empty: { alignItems: 'center', paddingVertical: 25, marginTop: 18 },
  emptyIcon: { width: 45, height: 45, borderRadius: 23, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...font.display, fontSize: 20, marginTop: 10 },
  emptyCopy: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 14, marginTop: 20, borderColor: 'rgba(255,154,125,0.18)' },
  promiseIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,154,125,0.10)', alignItems: 'center', justifyContent: 'center' },
  promiseTitle: { fontSize: 11, fontWeight: '700' },
  promiseCopy: { color: colors.textFaint, fontSize: 9, lineHeight: 14, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 17 },
  footerText: { color: colors.textFaint, fontSize: 9 },
})
