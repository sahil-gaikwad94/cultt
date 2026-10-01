import { Ionicons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { useRouter } from 'expo-router'
import React from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AppText, Button, Chip, IconButton, Surface, font, hapticSelection } from '../src/components/ui'
import { mutedGenreChoices } from '../src/data'
import { useApp } from '../src/store'
import { colors, radius, space } from '../src/theme'

export default function SettingsScreen() {
  const router = useRouter()
  const { state, setMode, setDistance, togglePreference, toggleGenre, resetExperience, showToast } = useApp()
  const clear = () => Alert.alert('Reset this device?', 'This clears local preferences, reactions, and messages. You can start again from onboarding.', [
    { text: 'Keep everything', style: 'cancel' },
    { text: 'Reset device data', style: 'destructive', onPress: async () => { await resetExperience(); router.replace('/') } },
  ])
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}><IconButton icon="chevron-back" label="Back" onPress={() => router.back()} /><View style={{ flex: 1 }}><AppText style={styles.eyebrow}>YOUR COMFORT COMES FIRST</AppText><AppText style={styles.title}>Make it yours.</AppText></View><View style={{ width: 44 }} /></View>
        <AppText style={styles.subtitle}>Keep the good stuff close and the rest at arm’s length.</AppText>

        <Section icon="compass-outline" title="Discovery, at your speed" subtitle="Change who you meet and how it feels.">
          <View style={styles.settingRow}><View style={styles.settingIcon}><Ionicons name="people-outline" size={16} color={colors.violet} /></View><View style={{ flex: 1 }}><AppText style={styles.rowTitle}>Looking to meet</AppText><AppText style={styles.rowHint}>Keep Dating and Friends separate.</AppText></View><View style={styles.modeControl}>{(['dating', 'friends'] as const).map((mode) => <Pressable key={mode} onPress={() => setMode(mode)} style={[styles.modePill, state.mode === mode && styles.modePillActive]} accessibilityRole="radio" accessibilityState={{ selected: state.mode === mode }}><AppText style={[styles.modePillText, state.mode === mode && styles.modePillTextActive]}>{mode === 'dating' ? 'Dating' : 'Friends'}</AppText></Pressable>)}</View></View>
          <View style={styles.settingRow}><View style={styles.settingIcon}><Ionicons name="location-outline" size={16} color={colors.lime} /></View><View style={{ flex: 1 }}><AppText style={styles.rowTitle}>Distance, not destiny</AppText><AppText style={styles.rowHint}>People within {state.distance} miles.</AppText></View><AppText style={styles.distanceValue}>{state.distance} mi</AppText></View>
          <Slider minimumValue={5} maximumValue={100} step={5} value={state.distance} onValueChange={setDistance} minimumTrackTintColor={colors.violet} maximumTrackTintColor={colors.surfaceSoft} thumbTintColor={colors.lime} accessibilityLabel="Maximum discovery distance" />
          <View style={styles.rangeLabels}><AppText style={styles.rangeHint}>5 miles</AppText><AppText style={styles.rangeHint}>100 miles</AppText></View>
        </Section>

        <Section icon="finger-print-outline" title="Your cultural data" subtitle="Keep the signals yours. Edit any of them, anytime.">
          <SettingsRow icon="musical-notes-outline" title="Connected music" description="Men I Trust, Cleo Sol + 3 more · Updated today" trailing={<Pressable onPress={() => showToast('Connect a music account to sync your library.')} accessibilityRole="button"><AppText style={styles.connected}>Connect</AppText></Pressable>} />
          <SettingsRow icon="refresh-outline" title="Rebuild my Fingerprint" description="Start fresh with the things you love now." onPress={() => showToast('Your taste can grow without starting from zero.')} />
          <SettingsRow icon="notifications-outline" title="Listening session reminder" description="A gentle heads-up before your free session ends." trailing={<SettingSwitch value={state.preferences.sessionReminder} onPress={() => togglePreference('sessionReminder')} label="Listening session reminder" />} />
        </Section>

        <Section icon="options-outline" title="Not quite your thing?" subtitle="Choose what you’d rather not have in your mix.">
          <View style={styles.genreWrap}>{mutedGenreChoices.map((genre) => <Chip key={genre} label={genre} selected={state.mutedGenres.includes(genre)} color={colors.coral} onPress={() => toggleGenre(genre)} compact />)}</View>
          <AppText style={styles.filterHelp}>These preferences shape your discovery. They never judge what you enjoy.</AppText>
        </Section>

        <Section icon="shield-checkmark-outline" title="Boundaries & privacy" subtitle="You’re always the one deciding what gets shared.">
          <SettingsRow icon="eye-outline" title="Fingerprint visibility" description={state.preferences.showFingerprintBeforeMatch ? 'Visible before matching.' : 'Visible to people after you match.'} trailing={<SettingSwitch value={state.preferences.showFingerprintBeforeMatch} onPress={() => togglePreference('showFingerprintBeforeMatch')} label="Fingerprint visibility" />} />
          <SettingsRow icon="location-outline" title="Use my location" description="Location helps show nearby people." trailing={<SettingSwitch value={state.preferences.locationEnabled} onPress={() => togglePreference('locationEnabled')} label="Use my location" />} />
          <SettingsRow icon="shield-checkmark-outline" title="Photo verification" description="Verified with a selfie check." trailing={<View style={styles.verifiedPill}><Ionicons name="checkmark-circle" size={11} color={colors.lime} /><AppText style={styles.verifiedText}>VERIFIED</AppText></View>} />
          <Pressable onPress={() => showToast('Your culture data is never sold. You can delete it at any time.')} accessibilityRole="button" style={styles.policyLink}><AppText style={styles.policyLinkText}>Read the whole promise</AppText><Ionicons name="arrow-forward" size={13} color={colors.violet} /></Pressable>
        </Section>

        <Section icon="moon-outline" title="Keep in touch (or don’t)" subtitle="Activity should be useful, not needy.">
          <SettingsRow icon="notifications-outline" title="Activity notifications" description="Messages, replies and Fingerprint updates." trailing={<SettingSwitch value={state.preferences.notificationsEnabled} onPress={() => togglePreference('notificationsEnabled')} label="Activity notifications" />} />
          <SettingsRow icon="moon-outline" title="A quieter corner at night" description="Pause gentle reminders after 10 PM." trailing={<SettingSwitch value={state.preferences.quietHours} onPress={() => togglePreference('quietHours')} label="Quiet hours" />} />
          <SettingsRow icon="accessibility-outline" title="Reduce motion" description="Use gentler, shorter transitions." trailing={<SettingSwitch value={state.preferences.reducedMotion} onPress={() => togglePreference('reducedMotion')} label="Reduce motion" />} />
        </Section>

        <Surface style={styles.promise}><View style={styles.promiseMark}><Ionicons name="lock-closed" size={16} color={colors.lime} /></View><View style={{ flex: 1 }}><AppText style={styles.promiseTitle}>Good connections need good boundaries.</AppText><AppText style={styles.promiseCopy}>Your music is not a public log. Your culture data stays yours, and you can clear this device whenever you want.</AppText></View></Surface>
        <Button label="Reset this device’s experience" variant="quiet" icon="refresh-outline" onPress={clear} style={{ marginTop: 15 }} />
        <AppText style={styles.version}>CULTURED · YOUR CORNER, YOUR RULES</AppText>
      </ScrollView>
    </SafeAreaView>
  )
}

function Section({ icon, title, subtitle, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; children: React.ReactNode }) {
  return <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionIcon}><Ionicons name={icon} size={16} color={colors.violet} /></View><View><AppText style={styles.sectionTitle}>{title}</AppText><AppText style={styles.sectionSubtitle}>{subtitle}</AppText></View></View><Surface style={styles.sectionCard}>{children}</Surface></View>
}

function SettingSwitch({ value, onPress, label }: { value: boolean; onPress: () => void; label: string }) {
  return <Switch accessibilityLabel={label} value={value} onValueChange={() => { hapticSelection(); onPress() }} trackColor={{ false: colors.surfaceSoft, true: colors.violetDeep }} thumbColor={value ? colors.violet : colors.textMuted} />
}

function SettingsRow({ icon, title, description, trailing, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; trailing?: React.ReactNode; onPress?: () => void }) {
  return <View style={styles.settingRow}>
    {onPress ? <Pressable onPress={onPress} accessibilityRole="button" style={styles.rowMain}><View style={styles.settingIcon}><Ionicons name={icon} size={15} color={colors.textMuted} /></View><View style={{ flex: 1 }}><AppText style={styles.rowTitle}>{title}</AppText><AppText style={styles.rowHint}>{description}</AppText></View></Pressable> : <View style={styles.rowMain}><View style={styles.settingIcon}><Ionicons name={icon} size={15} color={colors.textMuted} /></View><View style={{ flex: 1 }}><AppText style={styles.rowTitle}>{title}</AppText><AppText style={styles.rowHint}>{description}</AppText></View></View>}
    {trailing ?? (onPress ? <Ionicons name="chevron-forward" size={14} color={colors.textFaint} /> : null)}
  </View>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.xl, paddingTop: 5, paddingBottom: 34 },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  eyebrow: { color: colors.textFaint, fontSize: 8, letterSpacing: 1.4, fontWeight: '800', marginBottom: 4 },
  title: { ...font.display, fontSize: 29, letterSpacing: -0.8 },
  subtitle: { color: colors.textMuted, fontSize: 11, marginTop: 8, marginBottom: 8 },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 9 },
  sectionIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  sectionTitle: { ...font.display, fontSize: 17 },
  sectionSubtitle: { color: colors.textFaint, fontSize: 9, marginTop: 2 },
  sectionCard: { paddingHorizontal: 12, paddingVertical: 3, borderRadius: 18, shadowOpacity: 0 },
  settingRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, minHeight: 58 },
  settingIcon: { width: 29, height: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceHigh },
  rowTitle: { fontSize: 10, fontWeight: '700' },
  rowHint: { color: colors.textFaint, fontSize: 8, lineHeight: 12, marginTop: 3 },
  modeControl: { flexDirection: 'row', borderRadius: 16, padding: 3, backgroundColor: colors.backgroundRaised },
  modePill: { paddingHorizontal: 8, paddingVertical: 7, borderRadius: 12 },
  modePillActive: { backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.borderStrong },
  modePillText: { color: colors.textFaint, fontSize: 8, fontWeight: '700' },
  modePillTextActive: { color: colors.text },
  distanceValue: { color: colors.lime, fontSize: 10, fontWeight: '800' },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8, paddingHorizontal: 5 },
  rangeHint: { color: colors.textFaint, fontSize: 8 },
  connected: { color: colors.lime, fontSize: 9, fontWeight: '700' },
  genreWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingVertical: 12 },
  filterHelp: { color: colors.textFaint, fontSize: 8, lineHeight: 13, paddingBottom: 9 },
  verifiedPill: { flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(213,244,118,0.1)' },
  verifiedText: { color: colors.lime, fontSize: 7, fontWeight: '800', letterSpacing: 0.5 },
  policyLink: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingVertical: 12, paddingLeft: 38 },
  policyLinkText: { color: colors.violet, fontSize: 9, fontWeight: '700' },
  promise: { marginTop: 20, flexDirection: 'row', gap: 10, padding: 13, shadowOpacity: 0 },
  promiseMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(213,244,118,0.12)', alignItems: 'center', justifyContent: 'center' },
  promiseTitle: { fontSize: 10, fontWeight: '700' },
  promiseCopy: { color: colors.textFaint, fontSize: 8, lineHeight: 13, marginTop: 4 },
  version: { textAlign: 'center', color: colors.textFaint, fontSize: 7, letterSpacing: 1.1, marginTop: 14 },
})
