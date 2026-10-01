import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AnimatedWave } from '../../src/components/AnimatedWave'
import { Avatar, AppText, Button, Chip, IconButton, SectionHeading, Surface, font, hapticImpact, hapticSelection } from '../../src/components/ui'
import { feedPosts, type FeedPost } from '../../src/data'
import { useApp } from '../../src/store'
import { colors, radius, space } from '../../src/theme'

export default function FeedScreen() {
  const router = useRouter()
  const { state, reactToPost, toggleSavedPost, addComment, showToast } = useApp()
  const [playing, setPlaying] = useState<string | null>(null)
  const [commentPost, setCommentPost] = useState<FeedPost | null>(null)
  const [comment, setComment] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toUpperCase()

  const refresh = () => {
    setRefreshing(true)
    setTimeout(() => { setRefreshing(false); showToast('You’re all caught up on culture.') }, 650)
  }
  const share = async (post: FeedPost) => {
    const result = await Share.share({ message: `A little something from cultured: “${post.caption}” — ${post.author}` })
    if (result.action === Share.sharedAction) showToast('Shared. Good taste travels.')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.violet} colors={[colors.violet]} progressBackgroundColor={colors.surfaceHigh} />}
      >
        <View style={styles.topbar}>
          <View style={styles.brand}><View style={styles.brandDisc}><View style={styles.brandDot} /></View><AppText style={styles.brandName}>cultured.</AppText></View>
          <View style={styles.topActions}>
            <View style={styles.locationPill}><Ionicons name="location-outline" color={colors.lime} size={13} /><AppText style={styles.locationText}>Brooklyn</AppText></View>
            <IconButton icon="notifications-outline" label="Open activity" badge onPress={() => router.push('/activity')} />
          </View>
        </View>

        <View style={styles.hero}>
          <AppText style={styles.eyebrow}>{weekday} · YOUR LITTLE UNIVERSE</AppText>
          <AppText style={styles.title}>Your culture,{'\n'}<AppText style={styles.titleAccent}>lately.</AppText></AppText>
          <AppText style={styles.subtitle}>Good things people are laughing at and listening to around you.</AppText>
        </View>

        <View style={styles.dropCard}>
          <LinearGradient colors={['#29243A', '#211D2B', '#181620']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.dropHeader}><View style={styles.dropTag}><View style={styles.liveDot} /><AppText style={styles.dropTagText}>YOUR DAILY DROP</AppText></View><AppText style={styles.dropOrdinal}>01 / 03</AppText></View>
          <View style={styles.dropVisuals}>
            <View style={styles.memeTile}>
              <Image source={feedPosts[0].art} contentFit="cover" style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['transparent', 'rgba(9,8,13,0.88)']} style={StyleSheet.absoluteFill} />
              <View style={styles.memeMood}><Ionicons name="happy-outline" size={12} color={colors.lime} /><AppText style={styles.memeMoodText}>MOOD CHECK</AppText></View>
              <AppText style={styles.memeCopy}>when they send a song and say “this is so you”</AppText>
            </View>
            <View style={styles.dropTrack}>
              <View style={styles.recordArt}>
                <View style={styles.vinyl}><View style={styles.vinylRing}><View style={styles.vinylLabel}><View style={styles.vinylDot} /></View></View></View>
                <Pressable accessibilityRole="button" accessibilityLabel={playing === 'drop' ? 'Pause track preview' : 'Play track preview'} onPress={() => { hapticSelection(); setPlaying(playing === 'drop' ? null : 'drop') }} style={styles.playButton}>
                  <Ionicons name={playing === 'drop' ? 'pause' : 'play'} size={19} color={colors.background} />
                </Pressable>
              </View>
              <AppText style={styles.trackEyebrow}>THE TRACK OF THE DAY</AppText>
              <AppText style={styles.trackTitle}>Show Me How</AppText>
              <AppText style={styles.trackArtist}>Men I Trust · dream pop</AppText>
              <AnimatedWave playing={playing === 'drop'} reducedMotion={state.preferences.reducedMotion} bars={18} height={20} />
            </View>
          </View>
          <View style={styles.dropFooter}><View style={styles.avatarStack}><Avatar source={feedPosts[0].photo} size={22} /><Avatar source={feedPosts[1].photo} size={22} /><Avatar source={feedPosts[2].photo} size={22} /></View><AppText style={styles.dropFooterText}>58 nearby feel this</AppText><View style={{ flex: 1 }} /><Pressable onPress={() => share(feedPosts[0])} accessibilityRole="button" accessibilityLabel="Share today's drop"><Ionicons name="arrow-forward-circle-outline" size={22} color={colors.lime} /></Pressable></View>
        </View>

        <View style={styles.feedHeading}><SectionHeading title="Out in the open" subtitle="Good taste travels. See what’s around." action="For you" onAction={() => showToast('Your feed is tuned to your taste.')} /></View>
        {feedPosts.map((post) => (
          <FeedCard
            key={post.id}
            post={post}
            liked={state.likedPosts.includes(post.id)}
            laughed={state.laughedPosts.includes(post.id)}
            saved={state.savedPosts.includes(post.id)}
            commentCount={post.comments + (state.comments[post.id]?.length ?? 0)}
            playing={playing === post.id}
            reducedMotion={state.preferences.reducedMotion}
            onLike={() => { reactToPost(post.id, 'like'); hapticImpact() }}
            onLaugh={() => { reactToPost(post.id, 'laugh'); hapticImpact() }}
            onSave={() => { toggleSavedPost(post.id); showToast(state.savedPosts.includes(post.id) ? 'Removed from your saved culture.' : 'Saved to your Fingerprint.') }}
            onComment={() => { setCommentPost(post); setComment('') }}
            onShare={() => share(post)}
            onPlay={() => setPlaying(playing === post.id ? null : post.id)}
          />
        ))}
        <View style={styles.feedEnd}><View style={styles.endMark}><Ionicons name="sparkles" size={18} color={colors.violet} /></View><AppText style={styles.endTitle}>That’s your corner, for now.</AppText><AppText style={styles.endCopy}>Come back when the group chat finds something good.</AppText></View>
      </ScrollView>
      <CommentSheet post={commentPost} comments={commentPost ? state.comments[commentPost.id] ?? [] : []} value={comment} onChange={setComment} onClose={() => setCommentPost(null)} onSend={() => {
        if (!commentPost || !comment.trim()) return
        addComment(commentPost.id, comment)
        showToast('Your thought is part of the conversation.')
        setComment('')
        setCommentPost(null)
      }} />
    </SafeAreaView>
  )
}

function FeedCard({ post, liked, laughed, saved, playing, commentCount, reducedMotion, onLike, onLaugh, onSave, onComment, onShare, onPlay }: {
  post: FeedPost; liked: boolean; laughed: boolean; saved: boolean; playing: boolean; commentCount: number; reducedMotion: boolean
  onLike: () => void; onLaugh: () => void; onSave: () => void; onComment: () => void; onShare: () => void; onPlay: () => void
}) {
  return (
    <Surface style={styles.postCard}>
      <View style={styles.postAuthor}><Avatar source={post.photo} size={40} /><View style={{ flex: 1 }}><View style={styles.authorLine}><AppText style={styles.authorName}>{post.author}</AppText><View style={styles.verified}><Ionicons name="checkmark" size={9} color={colors.background} /></View></View><AppText style={styles.authorMeta}>{post.handle} · {post.location} · {post.time}</AppText></View><IconButton icon="ellipsis-horizontal" label="More post actions" size={18} onPress={() => onShare()} /></View>
      {post.type === 'meme' ? (
        <View style={styles.postArt}>
          <Image source={post.art} contentFit="cover" style={StyleSheet.absoluteFill} />
          <LinearGradient colors={['rgba(11,10,16,0.03)', 'rgba(11,10,16,0.12)', 'rgba(11,10,16,0.86)']} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
          <View style={styles.postMood}><AppText style={styles.postMoodText}>DRY HUMOR</AppText></View>
          <AppText style={styles.postCaption}>{post.caption}</AppText>
          <View style={styles.groupTag}><Ionicons name="people-outline" size={10} color={colors.text} /><AppText style={styles.groupTagText}>THE GROUP CHAT GETS IT</AppText></View>
        </View>
      ) : (
        <View style={styles.trackPost}>
          <View style={styles.trackPostTop}><View style={styles.trackMiniDisc}><Ionicons name="musical-note" size={19} color={colors.lime} /></View><View style={{ flex: 1 }}><AppText style={styles.trackTitle}>{post.track}</AppText><AppText style={styles.trackArtist}>{post.artist} · {post.mood}</AppText></View><Pressable onPress={onPlay} accessibilityRole="button" accessibilityLabel={playing ? 'Pause preview' : 'Play preview'} style={styles.trackPlay}><Ionicons name={playing ? 'pause' : 'play'} size={17} color={colors.background} /></Pressable></View>
          <AnimatedWave playing={playing} reducedMotion={reducedMotion} bars={26} height={24} />
          <AppText style={styles.trackNote}>{post.caption}</AppText>
        </View>
      )}
      <View style={styles.reactionRow}>
        <Pressable onPress={onLike} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike' : 'Like'} style={styles.reaction}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? colors.coral : colors.textMuted} /><AppText style={[styles.reactionText, liked && { color: colors.coral }]}>{post.likes + (liked ? 1 : 0)}</AppText></Pressable>
        <Pressable onPress={onLaugh} accessibilityRole="button" accessibilityLabel={laughed ? 'Remove laugh reaction' : 'React with laugh'} style={styles.reaction}><Ionicons name={laughed ? 'happy' : 'happy-outline'} size={18} color={laughed ? colors.lime : colors.textMuted} /><AppText style={[styles.reactionText, laughed && { color: colors.lime }]}>{post.laughs + (laughed ? 1 : 0)}</AppText></Pressable>
        <Pressable onPress={onComment} accessibilityRole="button" accessibilityLabel={`${commentCount} comments`} style={styles.reaction}><Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.textMuted} /><AppText style={styles.reactionText}>{commentCount}</AppText></Pressable>
        <Pressable onPress={onShare} accessibilityRole="button" accessibilityLabel="Share post" style={styles.reaction}><Ionicons name="paper-plane-outline" size={17} color={colors.textMuted} /></Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onSave} accessibilityRole="button" accessibilityLabel={saved ? 'Remove saved post' : 'Save post'} style={styles.saveButton}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.lime : colors.textMuted} /></Pressable>
      </View>
    </Surface>
  )
}

function CommentSheet({ post, comments, value, onChange, onClose, onSend }: {
  post: FeedPost | null; comments: { id: string; author: string; text: string; time: string }[]; value: string; onChange: (value: string) => void; onClose: () => void; onSend: () => void
}) {
  return (
    <Modal visible={!!post} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.modalScrim} onPress={onClose} />
        <View style={styles.commentSheet}>
          <View style={styles.sheetGrabber} />
          <View style={styles.sheetHeader}><View><AppText style={styles.sheetTitle}>Good thoughts</AppText><AppText style={styles.sheetSubtitle}>Keep it kind. Keep it cultured.</AppText></View><IconButton icon="close" size={18} label="Close comments" onPress={onClose} /></View>
          <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={{ paddingBottom: 10 }}>
            {post?.id === 'post-1' ? <View style={styles.comment}><Avatar source={post.photo} size={34} /><View style={styles.commentBubble}><AppText style={styles.commentName}>Jules</AppText><AppText style={styles.commentText}>Ok this has absolutely happened to me.</AppText><AppText style={styles.commentTime}>8 min ago</AppText></View></View> : null}
            {post?.id === 'post-1' ? <View style={styles.comment}><Avatar source={feedPosts[1].photo} size={34} /><View style={styles.commentBubble}><AppText style={styles.commentName}>Sam</AppText><AppText style={styles.commentText}>The track 4 rule is universal.</AppText><AppText style={styles.commentTime}>3 min ago</AppText></View></View> : null}
            {comments.map((item) => <View key={item.id} style={styles.comment}><View style={styles.commentUser}><AppText style={styles.commentInitial}>{item.author.slice(0, 1).toUpperCase()}</AppText></View><View style={styles.commentBubble}><AppText style={styles.commentName}>{item.author}</AppText><AppText style={styles.commentText}>{item.text}</AppText><AppText style={styles.commentTime}>{item.time}</AppText></View></View>)}
            {post?.id !== 'post-1' && comments.length === 0 ? <AppText style={styles.noComments}>Start the conversation. Keep it kind, keep it cultured.</AppText> : null}
          </ScrollView>
          <View style={styles.commentInputRow}><TextInput value={value} onChangeText={onChange} placeholder="Add your two cents…" placeholderTextColor={colors.textFaint} style={styles.commentInput} returnKeyType="send" onSubmitEditing={onSend} accessibilityLabel="Write a comment" /><Pressable onPress={onSend} accessibilityRole="button" accessibilityLabel="Send comment" style={[styles.sendButton, !value.trim() && { opacity: 0.45 }]}><Ionicons name="arrow-up" color={colors.background} size={18} /></Pressable></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.lg, paddingBottom: 122 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, paddingTop: 4 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandDisc: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: colors.violet, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  brandName: { ...font.display, fontSize: 21, letterSpacing: -0.7 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  locationPill: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 11, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  locationText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  hero: { paddingTop: 27, paddingBottom: 18 },
  eyebrow: { color: colors.textFaint, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  title: { ...font.display, color: colors.text, fontSize: 39, lineHeight: 42, letterSpacing: -1.3 },
  titleAccent: { ...font.italic, color: colors.violet },
  subtitle: { color: colors.textMuted, fontSize: 12, lineHeight: 18, maxWidth: 300, marginTop: 8 },
  dropCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(177,156,255,0.30)', padding: 13, overflow: 'hidden' },
  dropHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dropTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  dropTagText: { color: colors.text, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  dropOrdinal: { color: colors.textFaint, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  dropVisuals: { flexDirection: 'row', gap: 10 },
  memeTile: { flex: 1.08, minHeight: 194, borderRadius: 17, overflow: 'hidden', justifyContent: 'flex-end', padding: 12, backgroundColor: colors.surfaceHigh },
  memeMood: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: 'rgba(17,16,24,0.78)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 6 },
  memeMoodText: { color: colors.text, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  memeCopy: { ...font.display, fontSize: 16, lineHeight: 19, color: colors.text, letterSpacing: -0.2 },
  dropTrack: { flex: 0.92, minHeight: 194, padding: 10, borderRadius: 17, backgroundColor: 'rgba(14,13,19,0.50)', justifyContent: 'flex-end' },
  recordArt: { flex: 1, minHeight: 85, position: 'relative', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  vinyl: { height: 78, width: 78, borderRadius: 39, backgroundColor: '#15131D', borderWidth: 1, borderColor: '#5D5176', alignItems: 'center', justifyContent: 'center' },
  vinylRing: { height: 59, width: 59, borderRadius: 30, borderWidth: 1, borderColor: '#4A405D', alignItems: 'center', justifyContent: 'center' },
  vinylLabel: { width: 29, height: 29, borderRadius: 15, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  vinylDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime },
  playButton: { position: 'absolute', right: 0, bottom: 3, width: 37, height: 37, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lime },
  trackEyebrow: { color: colors.textFaint, fontSize: 8, letterSpacing: 1, fontWeight: '800', marginBottom: 3 },
  trackTitle: { color: colors.text, fontSize: 13, fontWeight: '700' },
  trackArtist: { color: colors.textMuted, fontSize: 10, marginTop: 2, marginBottom: 5 },
  dropFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 11, paddingTop: 10 },
  avatarStack: { flexDirection: 'row', width: 63 },
  dropFooterText: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  feedHeading: { marginTop: 1 },
  postCard: { padding: 12, marginBottom: 13, borderRadius: radius.lg },
  postAuthor: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  authorLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  authorName: { fontWeight: '700', fontSize: 13 },
  verified: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.violet, alignItems: 'center', justifyContent: 'center' },
  authorMeta: { color: colors.textFaint, fontSize: 10, marginTop: 3 },
  postArt: { height: 214, borderRadius: 17, overflow: 'hidden', justifyContent: 'flex-end', padding: 14 },
  postMood: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(17,16,24,0.75)', borderWidth: 1, borderColor: colors.borderStrong },
  postMoodText: { color: colors.text, fontSize: 8, fontWeight: '800', letterSpacing: 0.8 },
  postCaption: { ...font.display, fontSize: 21, lineHeight: 25, maxWidth: 290, letterSpacing: -0.4 },
  groupTag: { alignSelf: 'flex-start', flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: 'rgba(17,16,24,0.62)', marginTop: 10, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  groupTagText: { color: colors.textMuted, fontSize: 7, letterSpacing: 0.9, fontWeight: '800' },
  trackPost: { padding: 15, borderRadius: 17, backgroundColor: colors.backgroundRaised, gap: 12 },
  trackPostTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  trackMiniDisc: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#302744', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong },
  trackPlay: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  trackNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  reactionRow: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingTop: 13, paddingHorizontal: 2 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 28 },
  reactionText: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  saveButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  feedEnd: { alignItems: 'center', paddingTop: 19, paddingBottom: 28 },
  endMark: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  endTitle: { ...font.display, fontSize: 19 },
  endCopy: { color: colors.textFaint, fontSize: 11, textAlign: 'center', marginTop: 4 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalScrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.overlay },
  commentSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 27, borderTopRightRadius: 27, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 24 },
  sheetGrabber: { width: 39, height: 4, borderRadius: 4, backgroundColor: colors.textFaint, opacity: 0.6, alignSelf: 'center', marginBottom: 17 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  sheetTitle: { ...font.display, fontSize: 23 },
  sheetSubtitle: { color: colors.textFaint, fontSize: 11, marginTop: 3 },
  comment: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 13 },
  commentUser: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.violetDeep },
  commentInitial: { color: colors.text, fontSize: 12, fontWeight: '800' },
  commentBubble: { flex: 1, padding: 11, borderRadius: 14, backgroundColor: colors.surfaceHigh },
  commentName: { fontSize: 11, fontWeight: '700', color: colors.text },
  commentText: { fontSize: 12, lineHeight: 18, color: colors.textMuted, marginTop: 3 },
  commentTime: { fontSize: 9, color: colors.textFaint, marginTop: 6 },
  noComments: { color: colors.textFaint, fontSize: 11, lineHeight: 17, paddingVertical: 14 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 8 },
  commentInput: { flex: 1, minHeight: 46, borderRadius: 23, backgroundColor: colors.backgroundRaised, color: colors.text, paddingHorizontal: 16, fontSize: 13 },
  sendButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
})
