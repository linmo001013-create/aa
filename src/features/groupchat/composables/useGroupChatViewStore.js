import { useGroupsStore } from '../../../stores/groups'
import { useChatStore } from '../../../stores/chat'
import { useSettingsStore } from '../../../stores/settings'
import { usePersonasStore } from '../../../stores/personas'
import { useStickersStore } from '../../../stores/stickers'
import { useVNStore } from '../../../stores/vn'
import { defineAliasedProxyMap, defineProxyMap } from '../../../utils/objectProxy'

export const CHAT_TIMESTAMP_GAP_MS = 30 * 60 * 1000

const SETTINGS_PROXY_FIELDS = [
  'showChatAvatars',
  'showChatTimestamps',
  'allowAIStickers',
  'showNarrations',
  'showTokenCapsule',
  'allowAIFavorite',
  'allowAITransfer',
  'allowAIGift',
  'allowAIVoice',
  'allowAICall',
  'allowAIMockImage',
  'allowAIMusicRecommend',
  'allowAIMeet',
  'allowAIImageGeneration',
  'allowPlannerAI',
  'allowAIPlannerCapture',
  'toolCallingConfig',
  'theme'
]

/**
 * 群聊专属的视图状态管理器
 * 与 useChatViewStore 类似，但使用 groupsStore 代替 contactsStore
 * 确保群聊的数据与消息APP完全独立
 */
export function useGroupChatViewStore() {
  const groupsStore = useGroupsStore()
  const chatStore = useChatStore()
  const settingsStore = useSettingsStore()
  const personasStore = usePersonasStore()
  const stickersStore = useStickersStore()
  const vnStore = useVNStore()
  const store = {}

  // 将 groupsStore 的 activeGroup 代理为 activeChat（兼容现有composable）
  // 将 groupsStore的 groups 代理为 contacts（部分composable会用到）
  defineProxyMap(store, groupsStore, ['groups', 'activeGroup', 'selectedMemberId'])
  // 添加一个别名：activeGroup 也作为 activeChat 访问
  Object.defineProperty(store, 'activeChat', {
    get: () => groupsStore.activeGroup,
    set: (val) => { groupsStore.activeGroup = val },
    enumerable: true,
    configurable: true
  })
  // contacts 代理为 groups
  Object.defineProperty(store, 'contacts', {
    get: () => groupsStore.groups,
    set: (val) => {},
    enumerable: true,
    configurable: true
  })

  defineProxyMap(store, chatStore, ['replyingToId', 'replyingToText', 'editingMsgId', 'pendingImages'])
  defineProxyMap(store, settingsStore, SETTINGS_PROXY_FIELDS)
  defineProxyMap(store, personasStore, ['personas', 'defaultPersonaId'])
  defineProxyMap(store, stickersStore, ['showStickerPanel', 'showStickerManager', 'stickers', 'stickerGroups'])
  defineAliasedProxyMap(store, vnStore, { vnImageGenConfig: 'imageGenConfig' })

  store.ui = chatStore.ui
  store.getStickerUrl = stickersStore.getStickerUrl

  return store
}
