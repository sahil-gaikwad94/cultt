import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { Modal, Pressable, ScrollView, Share, StyleSheet, Switch, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppText, Avatar, Button, Chip, IconButton, Surface, font, hapticSelection } from '../../src/components/ui'
import { artists, feedPosts, humorSignals } from '../../src/data'
import { useApp } from '../../src/store'
import { colors, radius, space } from '../../src/theme'

type ProfileTab = 'Fingerprint' | 'Photos' | 'Prompts'

export default function ProfileScreen() {
  const router = useRouter()
  const { state, togglePreference, setUserProfile, setProfilePhotos, showToast } = useApp()
  const [tab, setTab] = useState<ProfileTab>('Fingerprint')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.userName)
  const [bio, setBio] = useState(state.userBio)

  const shareProfile = async () => {
    const result = await Share.share({ message: `Meet ${state.userName} on cultured. We find our people through the music and humor we share.` })
    if (result.action === Share.sharedAction) showToast('Your Fingerprint is out in the world.')
  }
  const saveProfile = () => { if (!name.trim()) return; setUserProfile(name.trim(), bio.trim()); setEditing(false); showToast('Your Fingerprint is looking very you.') }
  const addPhotos = async () => {
    const remaining = 6 - state.profilePhotos.length
    if (remaining <= 0) { showToast('Your six photo slots are full. Remove one to make room.'); return }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: remaining, quality: 0.9 })
      if (!result.canceled && result.assets?.length) {
        setProfilePhotos([...state.profilePhotos, ...result.assets.map((asset) => asset.uri)])
        showToast('A little more of your world, in the mix.')
      }
    } catch {
      showToast('Your photo library could not open just now.')
    }
  }
  const removePhoto = (uri: string) => {
    setProfilePhotos(state.profilePhotos.filter((item) => item !== uri))
    showToast('Photo removed from your Fingerprint.')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><View style={{ flex: 1 }}><AppText style={styles.eyebrow}>YOUR LITTLE UNIVERSE</AppText><AppText style={styles.title}>Fingerprint.</AppText></View><IconButton icon="share-outline" label="Share your Fingerprint" onPress={shareProfile} /><IconButton icon="settings-outline" label="Open settings" onPress={() => router.push('/settings')} /></View>
        <View style={styles.cover}>
          <Image source={state.profilePhotos[0] ? { uri: state.profilePhotos[0] } : require('../../assets/icon.png')} contentFit="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(12,11,17,0.02)', 'rgba(12,11,17,0.12)', 'rgba(12,11,17,0.90)']} locations={[0, 0.38, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.coverTop}><View style={styles.profileBadge}><Ionicons name="shield-checkmark" color={colors.lime} size={13} /><AppText style={styles.profileBadgeText}>YOUR WORLD</AppText></View><Pressable onPress={() => { setName(state.userName); setBio(state.userBio); setEditing(true) }} accessibilityRole="button" style={styles.editButton}><Ionicons name="create-outline" size={15} color={colors.text} /><AppText style={styles.editText}>Edit</AppText></Pressable></View>
          <View style={styles.coverBottom}><AppText style={styles.name}>{state.userName}<AppText style={styles.age}> · 27</AppText></AppText><View style={styles.location}><Ionicons name="location-outline" size={12} color={colors.textMuted} /><AppText style={styles.locationText}>Brooklyn, NY · {state.mode === 'dating' ? 'Dating' : 'Friends'}</AppText></View><AppText style={styles.bio}>{state.userBio}</AppText></View>
        </View>

        <View style={styles.tabRow}>{(['Fingerprint', 'Photos', 'Prompts'] as const).map((item) => <Pressable key={item} onPress={() => { setTab(item); hapticSelection() }} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} style={[styles.tab, tab === item && styles.activeTab]}><AppText style={[styles.tabText, tab === item && styles.activeTabText]}>{item}</AppText></Pressable>)}</View>

        {tab === 'Fingerprint' ? (
          <>
            <Surface style={styles.visibilityCard}>
              <View style={styles.visibilityIcon}><Ionicons name="eye-outline" color={colors.violet} size={18} /></View>
              <View style={{ flex: 1 }}><AppText style={styles.visibilityTitle}>Show my Fingerprint before matching</AppText><AppText style={styles.visibilityCopy}>{state.preferences.showFingerprintBeforeMatch ? 'People can get a feel for your culture first.' : 'Visible to people after you match.'}</AppText></View>
              <Switch value={state.preferences.showFingerprintBeforeMatch} onValueChange={() => togglePreference('showFingerprintBeforeMatch')} trackColor={{ false: colors.surfaceSoft, true: colors.violetDeep }} thumbColor={state.preferences.showFingerprintBeforeMatch ? colors.violet : colors.textMuted} accessibilityLabel="Show my Fingerprint before matching" />
            </Surface>
            <View style={styles.sectionHeader}><View><AppText style={styles.sectionTitle}>Your humor has a rhythm.</AppText><AppText style={styles.sectionCopy}>A little snapshot of what makes you, you.</AppText></View><Ionicons name="happy-outline" size={19} color={colors.violet} /></View>
            <Surface style={styles.humorCard}>{humorSignals.map((signal) => <View key={signal.label} style={styles.humorRow}><View style={styles.humorHeader}><AppText style={styles.humorLabel}>{signal.label}</AppText><AppText style={styles.humorValue}>{signal.value}%</AppText></View><View style={styles.humorTrack}><View style={[styles.humorFill, { width: `${signal.value}%`, backgroundColor: signal.color }]} /></View></View>)}<AppText style={styles.humorSummary}>leans <AppText style={{ color: colors.violet }}>affiliative</AppText> and self-enhancing</AppText></Surface>
            <View style={styles.sectionHeader}><View><AppText style={styles.sectionTitle}>Your five, on repeat.</AppText><AppText style={styles.sectionCopy}>Artists that keep showing up.</AppText></View><Pressable onPress={() => showToast('Your artist list is synced to your music taste.')}><AppText style={styles.editLink}>Edit</AppText></Pressable></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.artistRow}>{artists.map((artist, index) => <View key={artist.name} style={styles.artist}><View style={[styles.artistArt, { backgroundColor: artist.color }]}><Ionicons name={index % 2 ? 'musical-notes' : 'musical-note'} size={22} color={colors.background} /></View><AppText style={styles.artistName} numberOfLines={1}>{artist.name}</AppText><AppText style={styles.artistTag}>{artist.tag}</AppText></View>)}</ScrollView>
            <View style={styles.sectionHeader}><View><AppText style={styles.sectionTitle}>Playlists with a point of view.</AppText><AppText style={styles.sectionCopy}>Three tiny worlds you made.</AppText></View><Ionicons name="albums-outline" size={18} color={colors.lime} /></View>
            {[['the walk home, but slower', '18 tracks · 57 min', colors.violet], ['songs for soft launches', '12 tracks · 41 min', colors.lime], ['the kitchen dance break', '22 tracks · 1 hr 14', colors.coral]].map(([title, subtitle, hue], index) => <Pressable key={String(title)} onPress={() => showToast('Playlist preview opens when your music account is linked.')} style={styles.playlist}><View style={[styles.playlistArt, { backgroundColor: String(hue) }]}><Ionicons name={index === 1 ? 'heart' : 'musical-notes'} size={17} color={colors.background} /></View><View style={{ flex: 1 }}><AppText style={styles.playlistTitle}>{title}</AppText><AppText style={styles.playlistMeta}>{subtitle}</AppText></View><Ionicons name="play-circle-outline" size={23} color={colors.textMuted} /></Pressable>)}
            <View style={styles.sectionHeader}><View><AppText style={styles.sectionTitle}>Recently vibed.</AppText><AppText style={styles.sectionCopy}>The things you laughed at and kept.</AppText></View><Chip label={`${state.savedPosts.length} saved`} compact /></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>{(state.savedPosts.length ? feedPosts.filter((post) => state.savedPosts.includes(post.id)) : feedPosts.slice(0, 2)).map((post) => <Pressable key={post.id} onPress={() => showToast('This little moment is part of your Fingerprint.')} style={styles.savedCard}><Image source={post.art ?? post.photo} contentFit="cover" style={StyleSheet.absoluteFill} /><LinearGradient colors={['transparent', 'rgba(10,9,14,0.85)']} style={StyleSheet.absoluteFill} /><AppText style={styles.savedCaption} numberOfLines={2}>{post.caption}</AppText></Pressable>)}</ScrollView>
          </>
        ) : tab === 'Photos' ? (
          <>
            <View style={styles.sectionHeader}><View><AppText style={styles.sectionTitle}>A few more sides of you.</AppText><AppText style={styles.sectionCopy}>{state.profilePhotos.length} of 6 photos · only share what feels right.</AppText></View><Pressable onPress={addPhotos} accessibilityRole="button" accessibilityLabel="Add photos from your library"><Ionicons name="add-circle-outline" size={23} color={colors.violet} /></Pressable></View>
            <View style={styles.photoGrid}>
              {state.profilePhotos.map((uri, index) => <View key={`${uri}-${index}`} style={styles.photoTile}><Image source={{ uri }} contentFit="cover" style={StyleSheet.absoluteFill} /><Pressable onPress={() => removePhoto(uri)} accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} style={styles.removePhoto}><Ionicons name="close-circle" size={22} color={colors.text} /></Pressable>{index === 0 ? <View style={styles.photoMain}><Ionicons name="star" size={11} color={colors.background} /><AppText style={styles.photoMainText}>COVER</AppText></View> : null}</View>)}
              {Array.from({ length: Math.max(0, 6 - state.profilePhotos.length) }, (_, index) => <Pressable key={`empty-${index}`} onPress={addPhotos} accessibilityRole="button" accessibilityLabel="Add a photo from your library" style={[styles.photoTile, styles.addPhotoTile]}><Ionicons name="add" size={24} color={colors.violet} /><AppText style={styles.addPhotoText}>Add a moment</AppText></Pressable>)}
            </View>
            <Surface style={styles.photoNote}><Ionicons name="lock-closed-outline" size={17} color={colors.lime} /><AppText style={styles.photoNoteText}>You control who sees your photos. Your Fingerprint can do the talking first.</AppText></Surface>
          </>
        ) : (
          <>
            <View style={styles.sectionHeader}><View><AppText style={styles.sectionTitle}>Conversation starters.</AppText><AppText style={styles.sectionCopy}>A little window into your world.</AppText></View><Pressable onPress={() => showToast('Prompt editing is ready to connect to your profile service.')}><AppText style={styles.editLink}>Edit</AppText></Pressable></View>
            {[
              ['A tiny hill I will die on…', 'There is always time for one more song.'],
              ['My ideal Sunday has…', 'A farmers market, a long walk, and absolutely no plans after.'],
              ['The way to my heart is…', 'Make me a playlist for a very specific mood.'],
            ].map(([prompt, answer], index) => <Surface key={prompt} style={styles.promptCard}><View style={styles.promptTop}><View style={[styles.promptIcon, { backgroundColor: index === 1 ? 'rgba(213,244,118,0.12)' : 'rgba(177,156,255,0.14)' }]}><Ionicons name={index === 1 ? 'sunny-outline' : 'chatbubble-ellipses-outline'} size={15} color={index === 1 ? colors.lime : colors.violet} /></View><AppText style={styles.promptLabel}>{prompt}</AppText></View><AppText style={styles.promptAnswer}>{answer}</AppText></Surface>)}
          </>
        )}
        <View style={styles.bottomNote}><Ionicons name="heart-outline" size={13} color={colors.textFaint} /><AppText style={styles.bottomText}>Not just a pretty face. Your taste is the first hello.</AppText></View>
      </ScrollView>
      <EditProfile visible={editing} name={name} bio={bio} setName={setName} setBio={setBio} onClose={() => setEditing(false)} onSave={saveProfile} />
    </SafeAreaView>
  )
}

function EditProfile({ visible, name, bio, setName, setBio, onClose, onSave }: { visible: boolean; name: string; bio: string; setName: (value: string) => void; setBio: (value: string) => void; onClose: () => void; onSave: () => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalRoot}><Pressable style={styles.scrim} onPress={onClose} /><View style={styles.editSheet}><View style={styles.handle} /><View style={styles.editHeader}><View><AppText style={styles.editTitle}>Make it feel like you.</AppText><AppText style={styles.sectionCopy}>A few words are enough.</AppText></View><IconButton icon="close" label="Close edit profile" size={18} onPress={onClose} /></View><AppText style={styles.fieldLabel}>NAME</AppText><TextInput value={name} onChangeText={setName} maxLength={24} style={styles.editInput} placeholder="Your name" placeholderTextColor={colors.textFaint} accessibilityLabel="Profile name" /><AppText style={styles.fieldLabel}>YOUR LITTLE INTRO</AppText><TextInput value={bio} onChangeText={setBio} maxLength={140} multiline style={[styles.editInput, styles.bioInput]} placeholder="Something that sounds like you…" placeholderTextColor={colors.textFaint} accessibilityLabel="Profile bio" /><AppText style={styles.charCount}>{bio.length}/140</AppText><Button label="Save my Fingerprint" icon="checkmark" onPress={onSave} style={{ marginTop: 14 }} /></View></View></Modal>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.lg, paddingBottom: 125 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 5, paddingHorizontal: 2, marginBottom: 15 },
  eyebrow: { color: colors.lime, fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginBottom: 4 },
  title: { ...font.display, fontSize: 29, letterSpacing: -0.8 },
  cover: { height: 255, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  coverTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  profileBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(17,16,24,0.75)', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 15 },
  profileBadgeText: { color: colors.text, fontSize: 8, fontWeight: '800', letterSpacing: 0.6 },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(17,16,24,0.78)', borderRadius: 15, paddingHorizontal: 9, paddingVertical: 7 },
  editText: { color: colors.text, fontSize: 10, fontWeight: '700' },
  coverBottom: { position: 'absolute', bottom: 13, left: 15, right: 15 },
  name: { ...font.display, fontSize: 28, letterSpacing: -0.7 },
  age: { ...font.ui, color: colors.textMuted, fontSize: 15 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  locationText: { color: colors.textMuted, fontSize: 10 },
  bio: { color: '#E2DDE8', fontSize: 11, lineHeight: 16, marginTop: 7 },
  tabRow: { flexDirection: 'row', padding: 4, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginTop: 15 },
  tab: { flex: 1, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.borderStrong },
  tabText: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
  activeTabText: { color: colors.text },
  visibilityCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 17, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 17, shadowOpacity: 0 },
  visibilityIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(177,156,255,0.13)' },
  visibilityTitle: { fontSize: 10, fontWeight: '700' },
  visibilityCopy: { color: colors.textFaint, fontSize: 9, lineHeight: 14, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 21, marginBottom: 11 },
  sectionTitle: { ...font.display, fontSize: 19, letterSpacing: -0.3 },
  sectionCopy: { color: colors.textFaint, fontSize: 10, marginTop: 3 },
  humorCard: { padding: 14, borderRadius: 18, shadowOpacity: 0 },
  humorRow: { marginBottom: 11 },
  humorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  humorLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  humorValue: { color: colors.textFaint, fontSize: 9, fontWeight: '700' },
  humorTrack: { height: 6, borderRadius: 4, backgroundColor: colors.surfaceHigh, overflow: 'hidden' },
  humorFill: { height: 6, borderRadius: 4 },
  humorSummary: { ...font.italic, color: colors.textMuted, marginTop: 2, fontSize: 14 },
  editLink: { color: colors.violet, fontSize: 10, fontWeight: '700' },
  artistRow: { gap: 13, paddingRight: 10 },
  artist: { width: 70, alignItems: 'center' },
  artistArt: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface },
  artistName: { fontSize: 9, color: colors.text, fontWeight: '700', marginTop: 6, maxWidth: 70 },
  artistTag: { fontSize: 8, color: colors.textFaint, marginTop: 2 },
  playlist: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  playlistArt: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  playlistTitle: { fontSize: 11, fontWeight: '700' },
  playlistMeta: { fontSize: 9, color: colors.textFaint, marginTop: 4 },
  savedRow: { gap: 10 },
  savedCard: { width: 145, height: 112, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end', padding: 10, backgroundColor: colors.surfaceHigh },
  savedCaption: { ...font.display, fontSize: 13, lineHeight: 16 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  photoTile: { width: '31%', aspectRatio: 0.78, borderRadius: 15, overflow: 'hidden', backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  addPhotoTile: { borderWidth: 1, borderColor: colors.borderStrong, borderStyle: 'dashed', backgroundColor: colors.surface },
  addPhotoText: { color: colors.textFaint, fontSize: 8, fontWeight: '600', marginTop: 4 },
  removePhoto: { position: 'absolute', top: 5, right: 5, backgroundColor: 'rgba(17,16,24,0.65)', borderRadius: 12 },
  photoMain: { position: 'absolute', left: 6, top: 6, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 9, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', gap: 3 },
  photoMainText: { color: colors.background, fontSize: 6, fontWeight: '900', letterSpacing: 0.5 },
  photoNote: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 15, shadowOpacity: 0 },
  photoNoteText: { color: colors.textMuted, fontSize: 10, lineHeight: 15, flex: 1 },
  promptCard: { padding: 14, marginBottom: 10, shadowOpacity: 0 },
  promptTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  promptIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  promptLabel: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
  promptAnswer: { ...font.italic, fontSize: 16, lineHeight: 21, marginTop: 10 },
  bottomNote: { flexDirection: 'row', gap: 6, justifyContent: 'center', alignItems: 'center', paddingTop: 19 },
  bottomText: { color: colors.textFaint, fontSize: 9 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  editSheet: { backgroundColor: colors.backgroundRaised, borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 20, paddingBottom: 28, borderTopWidth: 1, borderColor: colors.borderStrong },
  handle: { width: 39, height: 4, borderRadius: 4, backgroundColor: colors.textFaint, opacity: 0.6, alignSelf: 'center', marginBottom: 16 },
  editHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 19 },
  editTitle: { ...font.display, fontSize: 22 },
  fieldLabel: { color: colors.textFaint, fontSize: 8, fontWeight: '800', letterSpacing: 1.3, marginTop: 12, marginBottom: 7 },
  editInput: { minHeight: 46, paddingHorizontal: 13, borderRadius: 13, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.text, fontSize: 13 },
  bioInput: { minHeight: 82, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { alignSelf: 'flex-end', color: colors.textFaint, fontSize: 9, marginTop: 5 },
})
