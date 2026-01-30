import { create } from 'zustand'

const SETTINGS_ACCORDION_IDS = ['layer', 'profile-effects'] as const

type SettingsAccordionId = (typeof SETTINGS_ACCORDION_IDS)[number]

type SettingsPanelState = {
  settingsAccordionExpandedKeys: Set<string>
  actions: {
    setSettingsAccordionExpandedKeys: (keys: Set<string>) => void
  }
}

const defaultExpandedKeys = new Set<string>(['layer'] satisfies SettingsAccordionId[])

export const useSettingsPanelStore = create<SettingsPanelState>((set) => ({
  settingsAccordionExpandedKeys: defaultExpandedKeys,
  actions: {
    setSettingsAccordionExpandedKeys: (keys) =>
      set({ settingsAccordionExpandedKeys: keys })
  }
}))
