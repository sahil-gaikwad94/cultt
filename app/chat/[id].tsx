import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import React, { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListeningSession } from '../../src/components/ListeningSession'
import { AppText, Avatar, IconButton, Surface, font, hapticSelection } from '../../src/components/ui'
import { conversations } from '../../src/data'
import { useApp } from '../../src/store'
import { colors, radius, space } from '../../src/theme'

const starters = ['What song always gets you?', 'Tell me the story behind that playlist.', 'Best tiny venue in the city?']

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { state, getMessages, sendMessage, markChatRead, showToast } = useApp()
  const person = conversations.find((item) => item.id === id) ?? conversations[0]
  const messages = getMessages(person.id)
  const [draft, setDraft] = useState('')
  const [listening, setListening] = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const lastMessage = messages[messages.length - 1]

  useEffect(() => { markChatRead(person.id) }, [person.id, markChatRead])
  useEffect(() => { const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80); return () => clearTimeout(timer) }, [messages.length])

  const send = (text = draft) => {
    const clean = text.trim()
    if (!clean) return
    sendMessage(person.id, clean)
    setDraft('')
    hapticSelection()
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back to people" onPress={() => router.back()} />
          <View style={styles.personHead}><Avatar source={person.photo} size={39} online={person.online} /><View><AppText style={styles.personName}>{person.name}</AppText><AppText style={styles.status}>{person.online ? 'Around now' : 'In their own little universe'}</AppText></View></View>
          <Pressable onPress={() => setListening(true)} accessibilityRole="button" accessibilityLabel="Listen together" style={({ pressed }) => [styles.listenButton, pressed && { transform: [{ scale: 0.93 }] }]}><Ionicons name="headset-outline" size={19} color={colors.lime} /></Pressable>
        </View>

        <ScrollView ref={scrollRef} style={styles.flex} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.datePill}><AppText style={styles.dateText}>YOU FOUND A SHARED FREQUENCY</AppText></View>
          <Surface style={styles.contextCard}>
            <View style={styles.contextIcon}><Ionicons name="musical-notes" size={16} color={colors.lime} /></View>
            <View style={{ flex: 1 }}><AppText style={styles.contextLine}>{person.matchLine}</AppText><AppText style={styles.contextTrack}>{person.matchTrack}</AppText></View>
            <Ionicons name="sparkles" size={15} color={colors.violet} />
          </Surface>
          <View style={styles.dateSeparator}><View style={styles.separatorLine} /><AppText style={styles.dateText}>TODAY</AppText><View style={styles.separatorLine} /></View>
          {messages.map((message) => (
            <View key={message.id} style={[styles.messageRow, message.from === 'me' ? styles.myRow : styles.theirRow]}>
              {message.from === 'them' ? <Avatar source={person.photo} size={27} /> : null}
              <View style={[styles.bubble, message.from === 'me' ? styles.myBubble : styles.theirBubble]}>
                {message.shared ? <View style={styles.sharedBadge}><Ionicons name="musical-note" size={11} color={colors.lime} /><AppText style={styles.sharedBadgeText}>PLAYLIST SHARE</AppText></View> : null}
                <AppText style={styles.messageText}>{message.text}</AppText>
                <AppText style={[styles.messageTime, message.from === 'me' && { textAlign: 'right' }]}>{message.time}</AppText>
              </View>
            </View>
          ))}
          <View style={styles.endSpacer} />
        </ScrollView>

        <View style={[styles.composerArea, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {messages.length < 5 && lastMessage?.from === 'them' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starters}>{starters.map((item) => <Pressable key={item} onPress={() => send(item)} style={styles.starter}><AppText style={styles.starterText}>{item}</AppText></Pressable>)}</ScrollView> : null}
          <View style={styles.composer}>
            <Pressable onPress={() => showToast('Voice notes will appear here once microphone access is connected.')} accessibilityRole="button" accessibilityLabel="Voice note" style={styles.voiceButton}><Ionicons name="mic-outline" size={19} color={colors.violet} /></Pressable>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Say something about our shared taste…" placeholderTextColor={colors.textFaint} style={styles.input} multiline maxLength={500} accessibilityLabel="Write a message" returnKeyType="send" onSubmitEditing={() => send()} />
            <Pressable onPress={() => send()} accessibilityRole="button" accessibilityLabel="Send message" style={[styles.sendButton, !draft.trim() && { opacity: 0.4 }]}><Ionicons name="arrow-up" size={18} color={colors.background} /></Pressable>
          </View>
          <View style={styles.composerNote}><Ionicons name="lock-closed-outline" size={10} color={colors.textFaint} /><AppText style={styles.composerNoteText}>No pressure. Your first hello is always free.</AppText></View>
        </View>
      </KeyboardAvoidingView>
      <ListeningSession visible={listening} partner={person.name} onClose={() => setListening(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: { minHeight: 67, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  personHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  personName: { fontSize: 13, fontWeight: '700' },
  status: { color: colors.textFaint, fontSize: 9, marginTop: 2 },
  listenButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(213,244,118,0.38)', backgroundColor: 'rgba(213,244,118,0.10)' },
  thread: { paddingHorizontal: 17, paddingTop: 17, paddingBottom: 13 },
  datePill: { alignSelf: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceHigh },
  dateText: { color: colors.textFaint, fontSize: 8, fontWeight: '800', letterSpacing: 0.9 },
  contextCard: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 11, marginTop: 14, borderRadius: 16, shadowOpacity: 0 },
  contextIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(213,244,118,0.12)', alignItems: 'center', justifyContent: 'center' },
  contextLine: { fontSize: 10, fontWeight: '700' },
  contextTrack: { color: colors.textFaint, fontSize: 9, marginTop: 3 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 20, marginBottom: 14 },
  separatorLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginBottom: 11, maxWidth: '91%' },
  myRow: { alignSelf: 'flex-end' },
  theirRow: { alignSelf: 'flex-start' },
  bubble: { paddingHorizontal: 13, paddingTop: 10, paddingBottom: 7, borderRadius: 18, maxWidth: '100%' },
  myBubble: { backgroundColor: '#342D48', borderBottomRightRadius: 5 },
  theirBubble: { backgroundColor: colors.surfaceHigh, borderBottomLeftRadius: 5 },
  messageText: { fontSize: 12, lineHeight: 18, color: colors.text },
  messageTime: { fontSize: 8, color: colors.textFaint, marginTop: 5 },
  sharedBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', marginBottom: 6 },
  sharedBadgeText: { color: colors.lime, fontSize: 7, fontWeight: '800', letterSpacing: 0.8 },
  endSpacer: { height: 8 },
  composerArea: { backgroundColor: colors.backgroundRaised, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9, paddingHorizontal: 13 },
  starters: { gap: 7, paddingBottom: 9 },
  starter: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  starterText: { color: colors.textMuted, fontSize: 9, fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, minHeight: 47, padding: 5, borderRadius: 25, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  voiceButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, maxHeight: 90, minHeight: 34, paddingTop: 9, paddingBottom: 8, fontSize: 12, color: colors.text },
  sendButton: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  composerNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingTop: 6 },
  composerNoteText: { color: colors.textFaint, fontSize: 8 },
})
