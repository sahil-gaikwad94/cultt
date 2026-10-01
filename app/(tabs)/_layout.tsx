import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Tabs } from 'expo-router'
import React from 'react'
import { StyleSheet } from 'react-native'
import { conversations } from '../../src/data'
import { useApp } from '../../src/store'
import { colors } from '../../src/theme'

export default function TabLayout() {
  const { state } = useApp()
  const unread = conversations.reduce((count, item) => count + (state.readChats.includes(item.id) ? 0 : item.unread ?? 0), 0)
  return (
    <Tabs screenOptions={{
      headerShown: false,
      sceneStyle: { backgroundColor: colors.background },
      tabBarActiveTintColor: colors.lime,
      tabBarInactiveTintColor: colors.textFaint,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2, marginTop: -1 },
      tabBarStyle: styles.tabBar,
      tabBarBackground: () => <BlurView tint="dark" intensity={42} style={StyleSheet.absoluteFill} />,
      tabBarHideOnKeyboard: true,
      tabBarItemStyle: { paddingTop: 5 },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Feed', tabBarAccessibilityLabel: 'Culture Feed', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'sparkles' : 'sparkles-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="discover" options={{ title: 'Matrix', tabBarAccessibilityLabel: 'Taste Twins discovery', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'radio' : 'radio-outline'} color={color} size={size} /> }} />
      <Tabs.Screen name="people" options={{
        title: 'People',
        tabBarAccessibilityLabel: 'People and conversations',
        tabBarBadge: unread > 0 ? unread : undefined,
        tabBarBadgeStyle: { backgroundColor: colors.violet, color: colors.background, fontSize: 9, minWidth: 16, height: 16 },
        tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} color={color} size={size} />,
      }} />
      <Tabs.Screen name="profile" options={{ title: 'You', tabBarAccessibilityLabel: 'Your Cultural Fingerprint', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} color={color} size={size + 2} /> }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    height: 84,
    paddingBottom: 22,
    paddingTop: 9,
    backgroundColor: 'transparent',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
  },
})
