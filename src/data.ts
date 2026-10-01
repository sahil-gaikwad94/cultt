import type { ImageSourcePropType } from 'react-native'

const image = {
  maya: require('../assets/images/maya.webp'),
  sophie: require('../assets/images/sophie.webp'),
  leo: require('../assets/images/leo.webp'),
  jules: require('../assets/images/jules.webp'),
  guitarist: require('../assets/images/guitarist.webp'),
  singer: require('../assets/images/singer.webp'),
} satisfies Record<string, ImageSourcePropType>

export type Candidate = {
  id: string
  name: string
  age: number
  distance: string
  city: string
  score: number
  photo: ImageSourcePropType
  sharedArtist: string
  sharedMeme: string
  prompt: string
  track: string
  artist: string
  genres: string[]
  humor: [number, number, number, number]
  bio: string
}

export const candidates: Candidate[] = [
  {
    id: 'maya', name: 'Maya', age: 26, distance: '2.4 mi', city: 'Brooklyn', score: 94,
    photo: image.maya, sharedArtist: 'Men I Trust', sharedMeme: 'deeply specific humor',
    prompt: 'I will absolutely stop walking to show you a dog.', track: 'Show Me How', artist: 'Men I Trust',
    genres: ['indie pop', 'dream pop', 'soft rock'], humor: [82, 72, 26, 38],
    bio: 'Museum afternoons, very niche playlists, and pretending I can cook something besides pasta.',
  },
  {
    id: 'leo', name: 'Leo', age: 28, distance: '3.1 mi', city: 'Williamsburg', score: 91,
    photo: image.leo, sharedArtist: 'Khruangbin', sharedMeme: 'quietly unhinged',
    prompt: 'My most controversial food opinion: fries are a side salad.', track: 'Friday Morning', artist: 'Khruangbin',
    genres: ['neo-soul', 'funk', 'jazz'], humor: [76, 83, 31, 41],
    bio: 'Weekend guitarist, weekday architect. Looking for someone who enjoys a long walk to get coffee.',
  },
  {
    id: 'sophie', name: 'Sophie', age: 25, distance: '1.8 mi', city: 'Greenpoint', score: 87,
    photo: image.sophie, sharedArtist: 'Japanese Breakfast', sharedMeme: 'theatre kid energy',
    prompt: 'The movie is never better than the book. Except that one time.', track: 'Be Sweet', artist: 'Japanese Breakfast',
    genres: ['indie rock', 'alt pop', 'shoegaze'], humor: [88, 62, 21, 34],
    bio: 'Currently learning to make pottery. The bowls are getting better; the commitment is questionable.',
  },
  {
    id: 'jules', name: 'Jules', age: 27, distance: '4.2 mi', city: 'Lower East Side', score: 84,
    photo: image.jules, sharedArtist: 'Cleo Sol', sharedMeme: 'chaotic good',
    prompt: 'Together we could build a playlist for a very specific situation.', track: 'When I’m in Your Arms', artist: 'Cleo Sol',
    genres: ['neo-soul', 'R&B', 'jazz'], humor: [73, 87, 24, 44],
    bio: 'Slow mornings, late-night voice notes, and making the aux cord everyone’s problem.',
  },
]

export type FeedPost = {
  id: string
  type: 'meme' | 'track'
  author: string
  handle: string
  photo: ImageSourcePropType
  location: string
  time: string
  caption: string
  likes: number
  laughs: number
  comments: number
  art?: ImageSourcePropType
  track?: string
  artist?: string
  mood?: string
}

export const feedPosts: FeedPost[] = [
  {
    id: 'post-1', type: 'meme', author: 'Jules', handle: '@jules.jpeg', photo: image.jules, location: 'Brooklyn', time: '12 min',
    caption: 'me explaining that the playlist is sequenced like a three-act play and you can’t skip track 4',
    likes: 128, laughs: 63, comments: 18, art: image.guitarist,
  },
  {
    id: 'post-2', type: 'track', author: 'Sam', handle: '@samin.stereo', photo: image.singer, location: 'Queens', time: '38 min',
    caption: 'For the walk home when you’re not ready for the night to be over.', likes: 84, laughs: 0, comments: 11,
    track: 'Sweet Disposition', artist: 'The Temper Trap', mood: 'the long way home',
  },
  {
    id: 'post-3', type: 'meme', author: 'Maya', handle: '@mayaday', photo: image.maya, location: 'Williamsburg', time: '1 hr',
    caption: 'my therapist: and what do we do when we get overwhelmed? me: add three songs to the “do not perceive me” playlist',
    likes: 96, laughs: 41, comments: 7, art: image.sophie,
  },
]

export type ChatMessage = { id: string; from: 'them' | 'me'; text: string; time: string; shared?: boolean }
export type Conversation = {
  id: string
  name: string
  photo: ImageSourcePropType
  online: boolean
  preview: string
  time: string
  unread?: number
  matchLine: string
  matchTrack: string
  messages: ChatMessage[]
}

export const conversations: Conversation[] = [
  {
    id: 'maya', name: 'Maya', photo: image.maya, online: true,
    preview: 'ok but that song is a perfect 4-minute movie', time: 'now', unread: 2,
    matchLine: 'You both laughed at “dating your notes app”', matchTrack: 'Show Me How · Men I Trust',
    messages: [
      { id: 'm1', from: 'them', text: 'Your “best song for a rainy bodega run” take is extremely correct.', time: '11:24 AM' },
      { id: 'm2', from: 'me', text: 'Thank you. I’ve been waiting for someone to understand.', time: '11:29 AM' },
      { id: 'm3', from: 'them', text: 'ok but that song is a perfect 4-minute movie', time: '11:31 AM' },
    ],
  },
  {
    id: 'sophie', name: 'Sophie', photo: image.sophie, online: false,
    preview: 'Sent you a playlist', time: 'Yesterday', matchLine: 'You both saved “tiny victories”', matchTrack: 'Be Sweet · Japanese Breakfast',
    messages: [
      { id: 's1', from: 'them', text: 'I made you a tiny playlist. No pressure, just vibes.', time: 'Yesterday' },
      { id: 's2', from: 'them', text: 'shared a playlist: the greenpoint-to-nowhere mix', time: 'Yesterday', shared: true },
    ],
  },
  {
    id: 'leo', name: 'Leo', photo: image.leo, online: true,
    preview: 'Tell me about the pottery class', time: 'Mon', matchLine: 'You both love Khruangbin', matchTrack: 'Friday Morning · Khruangbin',
    messages: [
      { id: 'l1', from: 'me', text: 'How’s the pottery class going?', time: 'Monday' },
      { id: 'l2', from: 'them', text: 'One functional cup, four emotional support bowls.', time: 'Monday' },
    ],
  },
]

export const artists = [
  { name: 'Men I Trust', tag: 'dream pop', color: '#B8A8FF' },
  { name: 'Khruangbin', tag: 'psych funk', color: '#D5F477' },
  { name: 'Cleo Sol', tag: 'neo-soul', color: '#F4A7C5' },
  { name: 'The Marías', tag: 'indie pop', color: '#96CCFF' },
  { name: 'Little Simz', tag: 'alt hip-hop', color: '#FF9A7D' },
]

export const humorSignals = [
  { label: 'Affiliative', value: 82, color: '#B19CFF' },
  { label: 'Self-enhancing', value: 68, color: '#D5F477' },
  { label: 'Aggressive', value: 24, color: '#FF9A7D' },
  { label: 'Self-deprecating', value: 41, color: '#96CCFF' },
]

export const genres = ['Dream pop', 'Neo-soul', 'Indie rock', 'Jazz', 'Alt pop', 'R&B', 'Funk', 'Electronic']
export const mutedGenreChoices = ['Country', 'Aggressive humor', 'EDM', 'True crime', 'Heavy metal']
