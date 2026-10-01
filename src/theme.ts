export const colors = {
  background: '#111018',
  backgroundRaised: '#15131D',
  surface: '#1B1923',
  surfaceHigh: '#24212E',
  surfaceSoft: '#2B2737',
  border: 'rgba(238, 231, 248, 0.10)',
  borderStrong: 'rgba(238, 231, 248, 0.18)',
  text: '#F7F3FB',
  textMuted: '#B8B0C4',
  textFaint: '#847C91',
  violet: '#B19CFF',
  violetDeep: '#8067D7',
  lime: '#D5F477',
  coral: '#FF9A7D',
  sky: '#96CCFF',
  rose: '#F4A7C5',
  success: '#9DD7AD',
  danger: '#FF808A',
  overlay: 'rgba(5, 4, 9, 0.72)',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const
export const radius = { sm: 12, md: 18, lg: 24, xl: 30, pill: 999 } as const
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 6,
  },
} as const
