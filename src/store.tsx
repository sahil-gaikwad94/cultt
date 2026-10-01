import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { candidates, conversations, type ChatMessage } from './data'

const STORAGE_KEY = 'cultured.native.v1'

type Mode = 'dating' | 'friends'
type PreferenceKey = 'showFingerprintBeforeMatch' | 'locationEnabled' | 'quietHours' | 'sessionReminder' | 'notificationsEnabled' | 'reducedMotion'

type PersistedState = {
  hasOnboarded: boolean
  ageConfirmed: boolean
  mode: Mode
  interests: string[]
  userName: string
  userBio: string
  candidateIndex: number
  resonancesLeft: number
  decisionHistory: { index: number; decision: 'pass' | 'resonate'; candidateId: string }[]
  resonatedIds: string[]
  likedPosts: string[]
  laughedPosts: string[]
  savedPosts: string[]
  comments: Record<string, { id: string; author: string; text: string; time: string }[]>
  profilePhotos: string[]
  messages: Record<string, ChatMessage[]>
  readChats: string[]
  dismissedActivity: string[]
  distance: number
  mutedGenres: string[]
  preferences: Record<PreferenceKey, boolean>
}

const initialState: PersistedState = {
  hasOnboarded: false,
  ageConfirmed: false,
  mode: 'dating',
  interests: ['Dream pop', 'Neo-soul', 'Indie rock'],
  userName: 'Jamie',
  userBio: 'A soft spot for big feelings, tiny venues and oddly specific playlists.',
  candidateIndex: 0,
  resonancesLeft: 3,
  decisionHistory: [],
  resonatedIds: [],
  likedPosts: [],
  laughedPosts: [],
  savedPosts: [],
  comments: {},
  profilePhotos: [],
  messages: {},
  readChats: [],
  dismissedActivity: [],
  distance: 25,
  mutedGenres: ['Country', 'Aggressive humor'],
  preferences: {
    showFingerprintBeforeMatch: false,
    locationEnabled: true,
    quietHours: true,
    sessionReminder: true,
    notificationsEnabled: true,
    reducedMotion: false,
  },
}

type AppContextValue = {
  state: PersistedState
  hydrated: boolean
  toast: string | null
  showToast: (message: string) => void
  completeOnboarding: (ageConfirmed: boolean, mode: Mode, interests: string[]) => void
  setMode: (mode: Mode) => void
  setUserProfile: (name: string, bio: string) => void
  setProfilePhotos: (photoUris: string[]) => void
  setDistance: (distance: number) => void
  togglePreference: (key: PreferenceKey) => void
  toggleGenre: (genre: string) => void
  reactToPost: (postId: string, reaction: 'like' | 'laugh') => void
  toggleSavedPost: (postId: string) => void
  addComment: (postId: string, text: string) => void
  decideCandidate: (decision: 'pass' | 'resonate') => boolean
  rewindCandidate: () => void
  getMessages: (chatId: string) => ChatMessage[]
  sendMessage: (chatId: string, text: string) => void
  markChatRead: (chatId: string) => void
  dismissActivity: (activityId: string) => void
  resetExperience: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState<PersistedState>(initialState)
  const [hydrated, setHydrated] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let live = true
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!live) return
        if (raw) {
          const saved = JSON.parse(raw) as Partial<PersistedState>
          setState({ ...initialState, ...saved, preferences: { ...initialState.preferences, ...saved.preferences } })
        }
      })
      .catch(() => undefined)
      .finally(() => { if (live) setHydrated(true) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined)
  }, [hydrated, state])

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2300)
  }, [])

  const completeOnboarding = useCallback((ageConfirmed: boolean, mode: Mode, interests: string[]) => {
    setState((current) => ({ ...current, hasOnboarded: true, ageConfirmed, mode, interests }))
  }, [])
  const setMode = useCallback((mode: Mode) => setState((current) => ({ ...current, mode })), [])
  const setUserProfile = useCallback((userName: string, userBio: string) => setState((current) => ({ ...current, userName, userBio })), [])
  const setProfilePhotos = useCallback((profilePhotos: string[]) => setState((current) => ({ ...current, profilePhotos: profilePhotos.slice(0, 6) })), [])
  const setDistance = useCallback((distance: number) => setState((current) => ({ ...current, distance })), [])
  const togglePreference = useCallback((key: PreferenceKey) => setState((current) => ({
    ...current,
    preferences: { ...current.preferences, [key]: !current.preferences[key] },
  })), [])
  const toggleGenre = useCallback((genre: string) => setState((current) => ({
    ...current,
    mutedGenres: current.mutedGenres.includes(genre)
      ? current.mutedGenres.filter((item) => item !== genre)
      : [...current.mutedGenres, genre],
  })), [])
  const reactToPost = useCallback((postId: string, reaction: 'like' | 'laugh') => setState((current) => {
    const key = reaction === 'like' ? 'likedPosts' : 'laughedPosts'
    const values = current[key]
    return { ...current, [key]: values.includes(postId) ? values.filter((id) => id !== postId) : [...values, postId] }
  }), [])
  const toggleSavedPost = useCallback((postId: string) => setState((current) => ({
    ...current,
    savedPosts: current.savedPosts.includes(postId)
      ? current.savedPosts.filter((id) => id !== postId)
      : [...current.savedPosts, postId],
  })), [])
  const decideCandidate = useCallback((decision: 'pass' | 'resonate') => {
    const candidate = candidates[state.candidateIndex]
    if (!candidate) return false
    if (decision === 'resonate' && state.resonancesLeft <= 0) {
      showToast('Your daily Resonances are all used up. A thoughtful hello is always free.')
      return false
    }
    setState((current) => ({
      ...current,
      candidateIndex: current.candidateIndex + 1,
      decisionHistory: [...current.decisionHistory, { index: current.candidateIndex, decision, candidateId: candidate.id }],
      resonancesLeft: decision === 'resonate' ? Math.max(0, current.resonancesLeft - 1) : current.resonancesLeft,
      resonatedIds: decision === 'resonate' ? [...current.resonatedIds, candidate.id] : current.resonatedIds,
    }))
    return true
  }, [showToast, state.candidateIndex, state.resonancesLeft])
  const rewindCandidate = useCallback(() => setState((current) => {
    const previous = current.decisionHistory.at(-1)
    if (previous === undefined) return current
    return {
      ...current,
      candidateIndex: previous.index,
      decisionHistory: current.decisionHistory.slice(0, -1),
      resonancesLeft: previous.decision === 'resonate' ? Math.min(3, current.resonancesLeft + 1) : current.resonancesLeft,
      resonatedIds: previous.decision === 'resonate' ? current.resonatedIds.filter((id) => id !== previous.candidateId) : current.resonatedIds,
    }
  }), [])
  const addComment = useCallback((postId: string, rawText: string) => {
    const text = rawText.trim()
    if (!text) return
    const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    setState((current) => ({
      ...current,
      comments: {
        ...current.comments,
        [postId]: [...(current.comments[postId] ?? []), { id: `${postId}-${Date.now()}`, author: current.userName, text, time }],
      },
    }))
  }, [])
  const getMessages = useCallback((chatId: string) => {
    const local = state.messages[chatId]
    return local ?? conversations.find((item) => item.id === chatId)?.messages ?? []
  }, [state.messages])
  const sendMessage = useCallback((chatId: string, rawText: string) => {
    const text = rawText.trim()
    if (!text) return
    const conversation = conversations.find((item) => item.id === chatId)
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const newMessage: ChatMessage = { id: `${chatId}-${Date.now()}`, from: 'me', text, time: stamp }
    setState((current) => ({
      ...current,
      messages: { ...current.messages, [chatId]: [...(current.messages[chatId] ?? conversation?.messages ?? []), newMessage] },
    }))
  }, [])
  const markChatRead = useCallback((chatId: string) => setState((current) => ({ ...current, readChats: [...new Set([...current.readChats, chatId])] })), [])
  const dismissActivity = useCallback((activityId: string) => setState((current) => ({
    ...current,
    dismissedActivity: [...new Set([...current.dismissedActivity, activityId])],
  })), [])
  const resetExperience = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined)
    setState(initialState)
    setToast('Your local experience has been reset.')
  }, [])

  const value = useMemo<AppContextValue>(() => ({
    state, hydrated, toast, showToast, completeOnboarding, setMode, setUserProfile, setProfilePhotos, setDistance,
    togglePreference, toggleGenre, reactToPost, toggleSavedPost, addComment, decideCandidate, rewindCandidate,
    getMessages, sendMessage, markChatRead, dismissActivity, resetExperience,
  }), [state, hydrated, toast, showToast, completeOnboarding, setMode, setUserProfile, setProfilePhotos, setDistance,
    togglePreference, toggleGenre, reactToPost, toggleSavedPost, addComment, decideCandidate, rewindCandidate,
    getMessages, sendMessage, markChatRead, dismissActivity, resetExperience])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}
