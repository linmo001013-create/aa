<template>
  <div class="chat-view absolute inset-0 z-30 bg-[var(--chat-bg)] flex flex-col overflow-hidden">
    <!-- Header -->
    <ChatHeader
      :contact="store.activeChat"
      :badge-count="store.groups.length"
      :is-group="true"
      @back="goBack"
      @edit-contact="openEditGroup()"
      @toggle-narrations="handleAvatarToggleNarrations"
      @start-call="handleStartCall"
    />

    <!-- Search Overlay -->
    <ChatSearchOverlay
      :visible="searchVisible"
      :results="searchResults"
      :query="searchQuery"
      :top-offset="searchOverlayTop"
      @close="closeSearch"
      @update:query="performSearch"
      @jump="(msgId, partKey) => { jumpToMessage(msgId, partKey); closeSearch() }"
    />

    <!-- Token Stats Capsule -->
    <TokenCapsule
      v-if="store.showTokenCapsule && store.activeChat"
      :contact="store.activeChat"
      class="absolute right-3 z-20"
      :style="{ top: 'calc(var(--app-pt) + 72px)' }"
      @hide="hideTokenCapsule"
    />

    <ChatMessageList
      ref="messageListRef"
      :blocks="blocks"
      :chat-background-style="chatBackgroundStyle"
      :can-load-older="hasOlderMessages"
      :multi-select-mode="multiSelectMode"
      :selected-block-keys="selectedBlockKeys"
      :show-chat-avatars="store.showChatAvatars"
      :is-typing="store.ui.isTyping"
      :is-thinking="store.ui.isThinking"
      :show-watermark="showWatermark"
      :watermark-text="watermarkText"
      @load-older="loadOlderMessages"
      @toggle-select="toggleBlockSelection"
      @context-menu="showContextMenu"
      @narration-menu="showNarrationMenu"
      @open-call-history="openCallHistoryFromBubble"
      @delete-offline-card="handleDeleteOfflineCard"
      @accept-transfer="handleAcceptTransfer"
      @reject-transfer="handleRejectTransfer"
      @accept-gift="handleAcceptGift"
      @reject-gift="handleRejectGift"
      @accept-meet="handleAcceptMeet"
      @reject-meet="handleRejectMeet"
      @open-transfer-detail="openTransferDetail"
    />

    <!-- Image Preview -->
    <ImagePreview :images="store.pendingImages" @remove="removePendingImage" />

    <!-- Reply Bar -->
    <ReplyBar :visible="!!store.replyingToId" :text="store.replyingToText" @cancel="cancelReply" />

    <!-- Edit Bar -->
    <EditBar :visible="!!store.editingMsgId" :text="editPreview" @cancel="cancelEdit" />

    <!-- 多选模式工具栏 -->
    <ChatMultiSelectToolbar
      :visible="multiSelectMode"
      :selected-count="selectedBlockKeys.size"
      :favorite-disabled="selectedBlockKeys.size < 2"
      :delete-disabled="selectedBlockKeys.size === 0"
      @cancel="exitMultiSelect"
      @favorite="handleFavoriteSelectedBlocks"
      @delete="deleteSelectedBlocks"
    />

    <!-- 群聊多API模式成员选择器 -->
    <ChatGroupMemberSelector
      :visible="!multiSelectMode && store.activeChat?.groupMode === 'multi'"
      :members="groupMembers"
      v-model:selectedMemberId="store.selectedMemberId"
    />

    <!-- Input Area -->
    <ChatInput
      ref="chatInputRef"
      v-model="inputText"
      :allow-snoop="canOpenSnoop"
      @send="sendMessage"
      @send-sticker="sendSticker"
      @open-photo="openPhotoPicker"
      @open-camera="openMockCameraModal"
      @open-sticker="openStickerPanel"
      @open-memory="openMemoryPanel"
      @open-transfer="openTransferModal"
      @open-gift="openGiftPanel"
      @open-voice="openVoiceModal"
      @open-reader="openReaderBookshelf"
      @open-music="openMusicLibrary"
      @open-search="openSearch"
      @open-meet="openMeetModal"
      @open-snoop="handleOpenSnoop"
    />

    <input ref="readerFileInput" type="file" class="hidden" accept=".txt,.epub" @change="handleReaderFileInput">
    <input ref="photoInput" type="file" class="hidden" accept="image/*" multiple @change="handlePhotoInput">

    <ChatStickerLayers
      :show-sticker-panel="store.showStickerPanel"
      :show-sticker-manager="store.showStickerManager"
      :stickers="store.stickers"
      :sticker-groups="store.stickerGroups"
      :sticker-selection-mode="stickerSelectionMode"
      :selected-sticker-ids="selectedStickerIds"
      :sticker-batch-visible="stickerBatchVisible"
      :sticker-batch-text="stickerBatchText"
      :sticker-import-options-visible="stickerImportOptionsVisible"
      :sticker-import-options-summary="stickerImportOptionsSummary"
      :sticker-editor-visible="stickerEditorVisible"
      :sticker-editor-draft="stickerEditorDraft"
      :sticker-group-visible="stickerGroupVisible"
      @select-sticker="sendSticker"
      @open-manager="openStickerManager"
      @close-panel="closeStickerPanel"
      @close-manager="closeStickerManager"
      @open-batch-modal="openStickerBatchModal"
      @open-group-modal="openStickerGroupModal"
      @toggle-selection-mode="toggleStickerSelectionMode"
      @toggle-select="toggleStickerSelection"
      @toggle-select-all="toggleSelectAllStickers"
      @delete-selected="deleteSelectedStickers"
      @move-selected-to-group="moveSelectedStickersToGroup"
      @open-editor="openStickerEditor"
      @delete-sticker="deleteSticker"
      @local-input="handleStickerLocalInput"
      @update:sticker-batch-text="stickerBatchText = $event"
      @close-batch-modal="closeStickerBatchModal"
      @confirm-batch="confirmStickerBatch"
      @batch-file="handleStickerBatchFile"
      @close-import-options="closeStickerImportOptionsModal"
      @confirm-import-options="confirmStickerImportOptions"
      @close-editor="closeStickerEditor"
      @confirm-editor="confirmStickerEditor"
      @close-group-modal="closeStickerGroupModal"
      @save-group="saveStickerGroup"
      @delete-group="deleteStickerGroup"
    />

    <ChatMemoryIntegration
      v-if="showMemoryPanel || showMemorySettings"
      :panel-visible="showMemoryPanel"
      :settings-visible="showMemorySettings"
      @close-panel="closeMemoryPanel"
      @open-settings="openMemorySettings"
      @back-from-settings="backFromMemorySettings"
    />

    <!-- Transfer Modal -->
    <TransferModal
      v-if="showTransferModal"
      :visible="showTransferModal"
      @cancel="showTransferModal = false"
      @send="handleSendTransfer"
    />

    <!-- Snoop Phone Consent Dialog -->
    <SnoopConsentDialog
      v-if="showSnoopConsent"
      :visible="showSnoopConsent"
      :contact="store.activeChat"
      @close="showSnoopConsent = false"
      @confirm="handleSnoopConfirm"
    />

    <!-- Gift Picker Panel -->
    <GiftPickerPanel
      v-if="showGiftPanel"
      :visible="showGiftPanel"
      @close="showGiftPanel = false"
      @send="handleSendGift"
    />

    <!-- Transfer/Gift Detail Panel -->
    <TransferDetailPanel
      v-if="showTransferDetail"
      :visible="showTransferDetail"
      :block="transferDetailBlock"
      :contact-name="store.activeChat?.name || ''"
      @close="closeTransferDetail"
      @accept="transferDetailBlock?.type === 'gift' ? handleAcceptGift($event) : handleAcceptTransfer($event)"
      @reject="transferDetailBlock?.type === 'gift' ? handleRejectGift($event) : handleRejectTransfer($event)"
    />

    <!-- Voice Modal -->
    <VoiceModal
      v-if="showVoiceModal"
      :visible="showVoiceModal"
      @cancel="showVoiceModal = false"
      @send="handleSendVoice"
    />

    <!-- Meet Invite Modal -->
    <MeetInviteModal
      v-if="showMeetModal"
      :visible="showMeetModal"
      @cancel="showMeetModal = false"
      @send="handleSendMeet"
    />

    <MockImageModal
      v-if="showMockImageModal"
      :visible="showMockImageModal"
      :placeholder-url="store.theme.mockImagePlaceholder"
      @cancel="showMockImageModal = false"
      @send="handleSendMockImage"
    />

    <ChatReaderIntegration
      v-if="readerStore.bookshelfOpen || readerStore.readerOpen"
      :bookshelf-visible="readerStore.bookshelfOpen"
      :books="readerStore.books"
      :reader-visible="readerStore.readerOpen"
      :mode="readerStore.readerViewMode"
      @close-bookshelf="readerStore.closeBookshelf()"
      @import-file="readerFileInput?.click()"
      @open-book="openBookInReader"
      @delete-book="handleDeleteBook"
      @close-reader="readerStore.closeReader()"
      @toggle-mode="readerStore.toggleReaderViewMode()"
    />

    <ChatContextMenuLayer
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      :max-height="contextMenuMaxHeight"
      :anchor="contextMenuAnchor"
      :is-user="contextMenuIsUser"
      :favorited="contextMenuFavorited"
      :focused-bubble="focusedBubble"
      @hide="hideContextMenu"
      @reply="handleReply"
      @copy="handleCopy"
      @edit="handleEdit"
      @regen="handleRegen"
      @delete="handleDelete"
      @multi-select="handleEnterMultiSelect"
      @favorite="handleFavorite"
    />

    <ChatNarrationMenuLayer
      :visible="narrationMenuVisible"
      :x="narrationMenuX"
      :y="narrationMenuY"
      :show-narrations="store.showNarrations"
      @hide="hideNarrationMenu"
      @toggle-narrations="handleToggleNarrations"
      @copy="handleCopyNarration"
      @multi-select="handleNarrationEnterMultiSelect"
    />

    <ChatCallLayers
      ref="callOverlayRef"
      :call-mode-visible="showCallModeSheet"
      :incoming-visible="incomingCallVisible"
      :incoming-info="incomingCallInfo"
      :call-history-visible="showCallHistoryModal"
      :call-history-records="callHistoryRecords"
      :contact="store.activeChat"
      @close-call-mode-sheet="closeCallModeSheet"
      @start-call="startCallWithMode"
      @start-offline="handleStartOffline"
      @accept-call="handleAcceptCall"
      @decline-call="handleDeclineCall"
      @close-call-history="closeCallHistoryModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ChatMemoryIntegration,
  ChatReaderIntegration,
  GiftPickerPanel,
  MeetInviteModal,
  MockImageModal,
  SnoopConsentDialog,
  TransferDetailPanel,
  TransferModal,
  VoiceModal
} from '../../chat/chatAsyncComponents'
import { CHAT_TIMESTAMP_GAP_MS, useGroupChatViewStore } from '../composables/useGroupChatViewStore'
import { useStorage } from '../../../composables/useStorage'
import { useApi } from '../../../composables/useApi'
import { useToast } from '../../../composables/useToast'
import { compressImage } from '../../../composables/useImage'
import { useImageGen } from '../../../composables/useImageGen'
import { showConfirm } from '../../../composables/useConfirm'
import { parseMessageContent, rebuildMessageContent } from '../../chat/composables/useMessageParser'
import { useChatImageTokens } from '../../chat/composables/useChatImageTokens'
import { useChatCalls } from '../../chat/composables/useChatCalls'
import { useChatInteractiveFeatures } from '../../chat/composables/useChatInteractiveFeatures'
import { useChatMessageActions } from '../../chat/composables/useChatMessageActions'
import { useChatPanels } from '../../chat/composables/useChatPanels'
import { useChatReaderIntegration } from '../../chat/composables/useChatReaderIntegration'
import { useChatStickerManager } from '../../chat/composables/useChatStickerManager'
import { useChatPlannerActions } from '../../chat/composables/useChatPlannerActions'
import { useChatSearch } from '../../chat/composables/useChatSearch'
import { useChatFavorites } from '../../chat/composables/useChatFavorites'
import { useChatInteractionSurface } from '../../chat/composables/useChatInteractionSurface'
import { useChatParserBlocks } from '../../chat/composables/useChatParserBlocks'
import { useStickerImport } from '../../chat/composables/useStickerImport'
import { useChatSnoopConsent } from '../../chat/composables/useChatSnoopConsent'
import { useChatTimelineShell } from '../../chat/composables/useChatTimelineShell'
import { useChatViewLifecycle } from '../../chat/composables/useChatViewLifecycle'
import { useMemory } from '../../../composables/useMemory'
import { removeOfflineArtifactsByRemovedChatMessages } from '../../../utils/offlineSessionLinkage'
import { makeId } from '../../../utils/id'
import { useCharacterResourcesStore } from '../../../stores/characterResources'
import { useAlbumStore } from '../../../stores/album'
import { usePlannerStore } from '../../../stores/planner'
import { useGroupsStore } from '../../../stores/groups'

// 组件导入（复用消息APP的组件）
import ChatHeader from '../../chat/components/ChatHeader.vue'
import ChatMessageList from '../../chat/components/ChatMessageList.vue'
import ChatInput from '../../chat/components/ChatInput.vue'
import ImagePreview from '../../chat/components/ImagePreview.vue'
import ReplyBar from '../../chat/components/ReplyBar.vue'
import EditBar from '../../chat/components/EditBar.vue'
import ChatMultiSelectToolbar from '../../chat/components/ChatMultiSelectToolbar.vue'
import ChatGroupMemberSelector from '../../chat/components/ChatGroupMemberSelector.vue'
import ChatContextMenuLayer from '../../chat/components/ChatContextMenuLayer.vue'
import ChatNarrationMenuLayer from '../../chat/components/ChatNarrationMenuLayer.vue'
import ChatSearchOverlay from '../../chat/components/ChatSearchOverlay.vue'
import ChatCallLayers from '../../chat/components/ChatCallLayers.vue'
import ChatStickerLayers from '../../chat/components/ChatStickerLayers.vue'
import TokenCapsule from '../../chat/components/TokenCapsule.vue'
import { useReaderStore } from '../../../stores/reader'
import { useMusicStore } from '../../../stores/music'
import { useBookParser } from '../../../composables/useBookParser'
import { saveBookContent, deleteBookContent } from '../../../composables/useReadingProgress'
import { resolveMockImagePlaceholder } from '../../chat/composables/mockImage'

const router = useRouter()
const route = useRoute()
const store = useGroupChatViewStore()
const groupsStore = useGroupsStore()
const { scheduleSave: persistScheduleSave } = useStorage()
const { callAPI, callGroupAPI } = useApi()
const { showToast } = useToast()
const { onMessageSent, onAssistantReplied, invalidateRoundVectors } = useMemory()
const { generateImage } = useImageGen()
const charResStore = useCharacterResourcesStore()
const albumStore = useAlbumStore()
const plannerStore = usePlannerStore()

const {
  showSnoopConsent,
  canOpenSnoop,
  openSnoopConsent: handleOpenSnoop,
  confirmSnoopConsent: handleSnoopConfirm
} = useChatSnoopConsent({
  activeChat: computed(() => store.activeChat),
  router
})

const chatInputRef = ref(null)
const messageListRef = ref(null)

function closePlusMenu() {
  chatInputRef.value?.closeMenu?.()
}

// 群聊特有的shell状态
const isGroupChat = ref(true)
const groupMembers = computed(() => store.activeChat?.members || [])
const showWatermark = computed(() => store.theme.showWatermark !== false)
const watermarkText = computed(() => {
  const style = store.theme.layoutStyle || 'imessage'
  if (style === 'qq') return 'QQ'
  if (style === 'line') return 'LINE'
  return 'iMessage'
})
const chatBackgroundStyle = computed(() => {
  if (store.activeChat?.chatBackground) {
    return { backgroundImage: `url(${store.activeChat.chatBackground})` }
  }
  return {}
})
const isLeavingToMessages = ref(false)

function scheduleSave(options = {}) {
  persistScheduleSave(options)
}

function hideTokenCapsule() {
  store.showTokenCapsule = false
  scheduleSave()
}

// 从路由同步群聊数据
function syncActiveGroupFromRoute() {
  const rawGroupId = route.params.groupId
  const groupId = rawGroupId == null ? '' : String(rawGroupId).trim()
  if (!groupId) return

  const group = groupsStore.getGroupById(groupId)
  if (!group) return

  if (store.activeChat?.id !== group.id) {
    store.activeChat = group
  }
  group.unreadCount = 0
}

watch(() => route.params.groupId, () => {
  isLeavingToMessages.value = false
  syncActiveGroupFromRoute()
}, { immediate: true })

const readerStore = useReaderStore()
const musicStore = useMusicStore()
const { parseFile } = useBookParser()

const {
  guessStickerNameFromFile: guessImportedStickerNameFromFile,
  importLocalStickerFiles: importStickerFiles,
  runStickerBatchImport: runStickerBatchImportHelper,
  readStickerBatchFileText
} = useStickerImport({
  store,
  makeId,
  compressImage,
  showToast,
  scheduleSave
})

const {
  backFromMemorySettings,
  closeMemoryPanel,
  handlePhotoInput,
  openMemoryPanel,
  openMemorySettings,
  openMusicLibrary,
  openPhotoPicker,
  photoInput,
  removePendingImage,
  showMemoryPanel,
  showMemorySettings
} = useChatPanels({
  closePlusMenu,
  compressImage,
  musicStore,
  store
})

const {
  closeStickerBatchModal,
  closeStickerEditor,
  closeStickerGroupModal,
  closeStickerImportOptionsModal,
  closeStickerManager,
  closeStickerPanel,
  confirmStickerBatch,
  confirmStickerEditor,
  confirmStickerImportOptions,
  deleteSelectedStickers,
  deleteSticker,
  deleteStickerGroup,
  handleStickerBatchFile,
  handleStickerLocalInput,
  moveSelectedStickersToGroup,
  openStickerBatchModal,
  openStickerEditor,
  openStickerGroupModal,
  openStickerManager,
  openStickerPanel,
  saveStickerGroup,
  selectedStickerIds,
  sendSticker,
  stickerBatchText,
  stickerBatchVisible,
  stickerEditorDraft,
  stickerEditorVisible,
  stickerGroupVisible,
  stickerImportOptionsSummary,
  stickerImportOptionsVisible,
  stickerSelectionMode,
  toggleSelectAllStickers,
  toggleStickerSelection,
  toggleStickerSelectionMode
} = useChatStickerManager({
  closePlusMenu,
  compressImage,
  guessImportedStickerNameFromFile,
  importStickerFiles,
  makeId,
  runStickerBatchImport: runStickerBatchImportHelper,
  readStickerBatchFileText,
  scheduleSave,
  showConfirm,
  showToast,
  store
})

const {
  closeTransferDetail,
  handleAcceptGift,
  handleAcceptMeet,
  handleAcceptTransfer,
  handleRejectGift,
  handleRejectMeet,
  handleRejectTransfer,
  handleSendGift,
  handleSendMeet,
  handleSendMockImage,
  handleSendTransfer,
  handleSendVoice,
  openGiftPanel,
  openMeetModal,
  openMockCameraModal,
  openTransferDetail,
  openTransferModal,
  openVoiceModal,
  showGiftPanel,
  showMeetModal,
  showMockImageModal,
  showTransferDetail,
  showTransferModal,
  showVoiceModal,
  transferDetailBlock
} = useChatInteractiveFeatures({
  closePlusMenu,
  makeId,
  resolveMockImagePlaceholder,
  router,
  scheduleSave,
  store
})

const {
  handleDeleteBook,
  handleReaderFileInput,
  openBookInReader,
  openReaderBookshelf,
  readerFileInput
} = useChatReaderIntegration({
  closePlusMenu,
  deleteBookContent,
  parseFile,
  readerStore,
  saveBookContent,
  scheduleSave,
  showConfirm,
  showToast,
  store
})

// Refs
const {
  showCallModeSheet,
  showCallHistoryModal,
  callOverlayRef,
  incomingCallVisible,
  incomingCallInfo,
  closeCallHistoryModal,
  closeCallModeSheet,
  startCallWithMode,
  handleStartCall,
  checkAssistantCallInvite,
  handleAcceptCall,
  handleDeclineCall
} = useChatCalls({
  store,
  scheduleSave,
  parseMessageContent,
  makeId
})

const {
  messageWindowLimit,
  visibleMessages,
  hasOlderMessages,
  searchOverlayTop,
  callHistoryRecords,
  loadOlderMessages,
  goBack
} = useChatTimelineShell({
  router,
  store,
  isGroupChat,
  isLeavingToMessages,
  syncActiveChatSummary: () => {},
  showCallHistoryModal
})

const {
  searchVisible,
  searchQuery,
  searchResults,
  performSearch,
  jumpToMessage,
  openSearch,
  closeSearch
} = useChatSearch({ store, messageWindowLimit, messageListRef })

const {
  toggleFavorite,
  favoriteSelectedBlocks,
  processAssistantFavoriteTokens
} = useChatFavorites({ store, scheduleSave, showToast, makeId })

// 从 App.vue 注入的方法
const openEditGroup = inject('openEditGroup')

function handleStartOffline() {
  closeCallModeSheet()
  if (store.activeChat?.id) {
    router.push('/offline/' + store.activeChat.id)
  }
}

function handleAcceptedMeet(contact) {
  if (!contact?.id) return
  router.push('/offline/' + contact.id)
}

// 右键菜单
function cleanupOfflineLinksForRemovedMessages(removedMessages) {
  if (!store.activeChat) return
  removeOfflineArtifactsByRemovedChatMessages(store.activeChat, removedMessages)
}

const { blocks } = useChatParserBlocks({
  visibleMessages,
  store,
  isGroupChat,
  groupMembers,
  timestampGapMs: CHAT_TIMESTAMP_GAP_MS
})

const {
  contextMenuVisible,
  contextMenuX,
  contextMenuY,
  contextMenuMaxHeight,
  contextMenuAnchor,
  contextMenuMsgId,
  contextMenuPartIndex,
  contextMenuContent,
  contextMenuIsUser,
  focusedBubble,
  hideContextMenu,
  multiSelectMode,
  selectedBlockKeys,
  exitMultiSelect,
  toggleBlockSelection,
  deleteSelectedBlocks,
  handleAvatarToggleNarrations,
  handleCopyNarration,
  handleNarrationEnterMultiSelect,
  handleToggleNarrations,
  hideNarrationMenu,
  narrationMenuVisible,
  narrationMenuX,
  narrationMenuY,
  showNarrationMenu,
  showContextMenu,
  openCallHistoryFromBubble,
  handleEnterMultiSelect,
  contextMenuFavorited,
  handleFavorite,
  handleFavoriteSelectedBlocks
} = useChatInteractionSurface({
  store,
  blocks,
  parseMessageContent,
  rebuildMessageContent,
  onChatMutated: invalidateRoundVectors,
  showConfirm,
  showToast,
  scheduleSave,
  showCallHistoryModal,
  onDeleteWholeMessages: cleanupOfflineLinksForRemovedMessages,
  toggleFavorite,
  favoriteSelectedBlocks
})

const { scrollToBottom } = useChatViewLifecycle({
  route,
  store,
  messageListRef,
  messageWindowLimit,
  initialMessageWindow: 100,
  jumpToMessage,
  contextMenuVisible,
  hideContextMenu,
  narrationMenuVisible,
  hideNarrationMenu
})

const { processAssistantImageTokens } = useChatImageTokens({
  store,
  charResStore,
  albumStore,
  generateImage,
  makeId,
  showToast,
  scrollToBottom
})

const { processAssistantPlannerActions } = useChatPlannerActions({
  store,
  plannerStore,
  showToast
})

const {
  cancelEdit,
  cancelReply,
  editPreview,
  handleCopy,
  handleDelete,
  handleDeleteOfflineCard,
  handleEdit,
  handleRegen,
  handleReply,
  inputText,
  sendMessage
} = useChatMessageActions({
  albumStore,
  callAPI,
  callGroupAPI,
  checkAssistantCallInvite,
  cleanupOfflineLinksForRemovedMessages,
  closePlusMenu,
  contextMenuContent,
  contextMenuMsgId,
  contextMenuPartIndex,
  hideContextMenu,
  invalidateRoundVectors,
  isGroupChat,
  makeId,
  onAcceptedMeet: handleAcceptedMeet,
  onAssistantReplied,
  onMessageSent,
  parseMessageContent,
  processAssistantFavoriteTokens,
  processAssistantPlannerActions,
  processAssistantImageTokens,
  rebuildMessageContent,
  scheduleSave,
  scrollToBottom,
  showConfirm,
  showToast,
  store
})
</script>
