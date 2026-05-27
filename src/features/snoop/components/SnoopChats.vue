<template>
  <div class="snoop-tab-content">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 3" :key="i" class="snoop-chat-skeleton">
        <div class="snoop-skeleton-icon"></div>
        <div class="snoop-skeleton-lines">
          <div class="snoop-skeleton-line" style="width: 40%"></div>
          <div class="snoop-skeleton-line snoop-skeleton-line--short" style="width: 60%"></div>
        </div>
      </div>
    </template>

    <!-- Error -->
    <div v-else-if="error" class="snoop-empty">
      <i class="ph ph-warning-circle text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">{{ error }}</div>
      <button class="snoop-retry-btn" @click="$emit('retry')">重试</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!items?.length" class="snoop-empty">
      <i class="ph ph-chat-dots text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">暂无聊天记录</div>
    </div>

    <!-- Chat list -->
    <template v-else-if="!selectedChat">
      <div
        v-for="(chat, idx) in items"
        :key="idx"
        class="snoop-chat-item"
        :class="{ 'snoop-chat-item--selecting': selectable }"
        @click="selectable ? $emit('toggle-select', idx) : (selectedChat = chat)"
      >
        <div v-if="selectable" class="snoop-checkbox" :class="{ 'snoop-checkbox--checked': selectedIndices.includes(idx) }">
          <i v-if="selectedIndices.includes(idx)" class="ph ph-check text-[12px]"></i>
        </div>
        <div class="snoop-chat-avatar">
          <i class="ph-fill ph-user text-[18px]"></i>
        </div>
        <div class="snoop-chat-info">
          <div class="snoop-chat-name">{{ chat.friend }}</div>
          <div class="snoop-chat-preview">
            {{ lastMsg(chat) }}
          </div>
        </div>
        <div class="snoop-chat-time">
          {{ chat.msgs?.[chat.msgs.length - 1]?.time || '' }}
        </div>
      </div>
    </template>

    <!-- Chat detail -->
    <template v-else>
      <div class="snoop-chatdetail-header">
        <i class="ph ph-caret-left text-[18px]" @click="selectedChat = null"></i>
        <span class="snoop-chatdetail-name" @click="showPersonaPopup">{{ selectedChat.friend }}</span>
        <span v-if="selectedChat.relationship" class="snoop-chatdetail-rel">{{ selectedChat.relationship }}</span>
      </div>
      <div class="snoop-chatdetail-msgs">
        <div
          v-for="(msg, idx) in selectedChat.msgs"
          :key="idx"
          class="snoop-msg"
          :class="msg.from === 'self' ? 'snoop-msg--self' : 'snoop-msg--friend'"
        >
          <div class="snoop-msg-bubble">{{ msg.content }}</div>
          <div class="snoop-msg-time">{{ msg.time || '' }}</div>
        </div>
        <div class="snoop-chatdetail-actions">
          <button
            class="snoop-genmore-chat"
            :disabled="generatingMore"
            @click="handleGenMoreChat"
          >
            <i class="ph ph-plus-circle text-[16px]"></i>
            {{ generatingMore ? '生成中...' : '生成更多' }}
          </button>
          <button v-if="!joinedChat" class="snoop-join-chat" @click="joinedChat = true">
            <i class="ph ph-sign-in text-[16px]"></i>
            加入聊天
          </button>
        </div>
        <div v-if="genMoreError" class="snoop-genmore-error">{{ genMoreError }}</div>
      </div>
      <!-- Chat input area for joined chat -->
      <div v-if="joinedChat" class="snoop-chat-input-area">
        <input
          v-model="chatInput"
          class="snoop-chat-input"
          placeholder="输入消息..."
          @keyup.enter="handleSendMessage"
          :disabled="sendingMsg"
        />
        <button
          class="snoop-chat-send"
          @click="handleSendMessage"
          :disabled="sendingMsg || !chatInput.trim()"
        >
          <i class="ph ph-paper-plane-right text-[18px]"></i>
        </button>
      </div>
      <!-- Persona popup -->
      <div v-if="personaPopup" class="snoop-persona-overlay" @click="personaPopup = null">
        <div class="snoop-persona-popup" @click.stop>
          <div class="snoop-persona-header">
            <div class="snoop-persona-avatar" :style="{ background: personaColor }">
              {{ personaInitial }}
            </div>
            <div class="snoop-persona-name">{{ personaPopup.friend }}</div>
            <button class="snoop-persona-close" @click="personaPopup = null">
              <i class="ph ph-x text-[18px]"></i>
            </button>
          </div>
          <div class="snoop-persona-body">
            <div class="snoop-persona-label">人物简介</div>
            <div class="snoop-persona-text">{{ personaPopup.persona || personaPopup.relationship || '暂无描述' }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { generateMoreChatMsgs, generateChatReply } from '../composables/useSnoopGenerate'
import { useSnoopStore } from '../../../stores/snoop'

const snoopStore = useSnoopStore()

const props = defineProps({
  contact: Object,
  items: Array,
  loading: Boolean,
  error: String,
  selectable: Boolean,
  selectedIndices: Array
})
defineEmits(['retry', 'toggle-select'])

const selectedChat = ref(null)
const personaPopup = ref(null)
const personaColor = ref('#007aff')
const personaInitial = ref('?')

function showPersonaPopup() {
  if (!selectedChat.value) return
  const names = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
  personaColor.value = names[selectedChat.value.friend?.length % names.length] || '#007aff'
  personaInitial.value = selectedChat.value.friend?.charAt(0)?.toUpperCase() || '?'
  personaPopup.value = selectedChat.value
}
const generatingMore = ref(false)
const genMoreError = ref('')
const joinedChat = ref(false)
const chatInput = ref('')
const sendingMsg = ref(false)

function lastMsg(chat) {
  const msgs = chat.msgs
  if (!msgs?.length) return ''
  const last = msgs[msgs.length - 1]
  const prefix = last.from === 'self' ? '我: ' : ''
  const text = last.content || ''
  return prefix + (text.length > 20 ? text.slice(0, 20) + '...' : text)
}

async function handleGenMoreChat() {
  if (!selectedChat.value || !props.contact || generatingMore.value) return
  generatingMore.value = true
  genMoreError.value = ''
  try {
    const chat = selectedChat.value
    const msgs = await generateMoreChatMsgs(
      props.contact,
      chat.friend,
      chat.msgs || [],
      chat.relationship || '',
      chat.persona || ''
    )
    if (msgs?.length) {
      const currentMsgs = Array.isArray(chat.msgs) ? chat.msgs : []
      const updatedMsgs = [...currentMsgs, ...msgs]
      // 更新显示（创建新对象保证响应式）
      selectedChat.value = { ...selectedChat.value, msgs: updatedMsgs }
      // 同步更新缓存
      updateCache(updatedMsgs)
      console.log(`[续写成功] 以当前 ${currentMsgs.length} 条聊天为基础，追加了 ${msgs.length} 条`)
    } else {
      genMoreError.value = '没有生成新消息，再试试吧'
      setTimeout(() => { genMoreError.value = '' }, 4000)
    }
  } catch (e) {
    console.error('生成更多聊天记录失败', e)
    genMoreError.value = e?.message || '生成失败，请重试'
    setTimeout(() => { genMoreError.value = '' }, 4000)
  } finally {
    generatingMore.value = false
  }
}

function updateCache(updatedMsgs) {
  const cId = props.contact?.id
  if (!cId) return
  const cache = snoopStore.getCache(cId, 'chats')
  if (!cache?.items) return
  const idx = cache.items.findIndex(c => c.friend === selectedChat.value?.friend)
  if (idx !== -1) {
    cache.items[idx] = { ...cache.items[idx], msgs: updatedMsgs }
    snoopStore.setCache(cId, 'chats', cache.items)
  }
}

async function handleSendMessage() {
  if (!chatInput.value.trim() || sendingMsg.value || !selectedChat.value) return
  const userMsg = chatInput.value.trim()
  chatInput.value = ''
  sendingMsg.value = true

  try {
    const currentMsgs = [...(selectedChat.value.msgs || [])]
    const userMessage = { from: 'friend', content: userMsg, time: '刚刚' }
    const msgsWithUser = [...currentMsgs, userMessage]
    selectedChat.value = { ...selectedChat.value, msgs: msgsWithUser }
    updateCache(msgsWithUser)

    const reply = await generateChatReply(
      props.contact,
      selectedChat.value.friend,
      msgsWithUser,
      selectedChat.value.relationship || '',
      userMsg,
      selectedChat.value.persona || ''
    )

    const msgsWithReply = [...msgsWithUser, reply]
    selectedChat.value = { ...selectedChat.value, msgs: msgsWithReply }
    updateCache(msgsWithReply)
    scrollToBottom()
  } catch (e) {
    console.error('发送消息失败', e)
  } finally {
    sendingMsg.value = false
  }
}

function scrollToBottom() {
  setTimeout(() => {
    const container = document.querySelector('.snoop-chatdetail-msgs')
    if (container) container.scrollTop = container.scrollHeight
  }, 50)
}
</script>

<style scoped>
.snoop-tab-content {
  padding: 8px 0;
}

/* Chat list */
.snoop-chat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.1s;
}

.snoop-chat-item:active {
  background: rgba(0, 0, 0, 0.04);
}

.dark .snoop-chat-item:active {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-chat-item--selecting { cursor: pointer; }

.snoop-chat-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #8e8e93;
}

.dark .snoop-chat-avatar {
  background: rgba(255, 255, 255, 0.08);
}

.snoop-chat-info {
  flex: 1;
  min-width: 0;
}

.snoop-chat-name {
  font-size: 15px;
  font-weight: 500;
}

.snoop-chat-preview {
  font-size: 13px;
  color: #8e8e93;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}

.snoop-chat-time {
  font-size: 11px;
  color: #8e8e93;
  flex-shrink: 0;
}

/* Chat detail */
.snoop-chatdetail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}

.dark .snoop-chatdetail-header {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.snoop-chatdetail-header:active { opacity: 0.6; }

.snoop-chatdetail-rel {
  font-size: 12px;
  font-weight: 400;
  color: #8e8e93;
}

.snoop-chatdetail-msgs {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.snoop-msg {
  display: flex;
  flex-direction: column;
  max-width: 80%;
}

.snoop-msg--self {
  align-self: flex-end;
  align-items: flex-end;
}

.snoop-msg--friend {
  align-self: flex-start;
  align-items: flex-start;
}

.snoop-msg-bubble {
  padding: 8px 12px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.snoop-msg--self .snoop-msg-bubble {
  background: var(--primary-color, #007aff);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.snoop-msg--friend .snoop-msg-bubble {
  background: rgba(0, 0, 0, 0.06);
  border-bottom-left-radius: 4px;
}

.dark .snoop-msg--friend .snoop-msg-bubble {
  background: rgba(255, 255, 255, 0.1);
}

.snoop-msg-time {
  font-size: 10px;
  color: #8e8e93;
  margin-top: 2px;
  padding: 0 4px;
}

.snoop-genmore-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  padding: 12px;
  border: none;
  background: none;
  color: var(--primary-color, #007aff);
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.snoop-genmore-chat:disabled {
  opacity: 0.4;
  cursor: default;
}

.snoop-genmore-error {
  text-align: center;
  font-size: 12px;
  color: #ff3b30;
  padding: 4px 0;
}

/* Action buttons row */
.snoop-chatdetail-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.snoop-join-chat {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex: 1;
  padding: 12px;
  border: none;
  background: none;
  color: var(--primary-color, #007aff);
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.snoop-genmore-chat:active,
.snoop-join-chat:active {
  background: rgba(0, 122, 255, 0.06);
}

.dark .snoop-genmore-chat:active,
.dark .snoop-join-chat:active {
  background: rgba(0, 122, 255, 0.12);
}

/* Chat input area */
.snoop-chat-input-area {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-top: 0.5px solid rgba(0, 0, 0, 0.06);
  background: var(--bg-color, #fff);
}

.dark .snoop-chat-input-area {
  border-top-color: rgba(255, 255, 255, 0.06);
  background: var(--bg-color-dark, #1c1c1e);
}

.snoop-chat-input {
  flex: 1;
  padding: 8px 14px;
  border: none;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 14px;
  outline: none;
  color: inherit;
}

.dark .snoop-chat-input {
  background: rgba(255, 255, 255, 0.08);
}

.snoop-chat-input::placeholder {
  color: #8e8e93;
}

.snoop-chat-send {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: var(--primary-color, #007aff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.snoop-chat-send:disabled {
  opacity: 0.4;
  cursor: default;
}

.snoop-chat-send:active:not(:disabled) {
  opacity: 0.7;
}

/* Skeleton */
.snoop-chat-skeleton {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.snoop-skeleton-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
  animation: snoop-pulse 1.5s infinite;
}

.dark .snoop-skeleton-icon {
  background: rgba(255, 255, 255, 0.06);
}

.snoop-skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.snoop-skeleton-line {
  height: 12px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.06);
  animation: snoop-pulse 1.5s infinite;
}

.snoop-skeleton-line--short { height: 10px; }

.dark .snoop-skeleton-line {
  background: rgba(255, 255, 255, 0.06);
}

@keyframes snoop-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Checkbox */
.snoop-checkbox {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #c6c6c8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.dark .snoop-checkbox {
  border-color: #636366;
}

.snoop-checkbox--checked {
  background: var(--primary-color, #007aff);
  border-color: var(--primary-color, #007aff);
  color: #fff;
}

/* Shared */
.snoop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.snoop-retry-btn {
  margin-top: 12px;
  padding: 6px 20px;
  border-radius: 8px;
  font-size: 13px;
  border: none;
  background: var(--primary-color, #007aff);
  color: #fff;
  cursor: pointer;
}

.snoop-retry-btn:active { opacity: 0.7; }
/* Persona popup */
.snoop-persona-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: snoop-fade-in 0.2s ease;
}
.snoop-persona-popup {
  width: 280px;
  border-radius: 16px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  animation: snoop-scale-in 0.2s ease;
}
.dark .snoop-persona-popup {
  background: #1c1c1e;
}
.snoop-persona-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 20px 16px;
  position: relative;
}
.snoop-persona-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #fff;
  font-weight: 600;
  margin-bottom: 10px;
}
.snoop-persona-name {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a1a;
}
.dark .snoop-persona-name {
  color: #f0f0f0;
}
.snoop-persona-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(0,0,0,0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: inherit;
  transition: background 0.15s;
}
.dark .snoop-persona-close {
  background: rgba(255,255,255,0.08);
}
.snoop-persona-close:hover {
  background: rgba(0,0,0,0.1);
}
.dark .snoop-persona-close:hover {
  background: rgba(255,255,255,0.15);
}
.snoop-persona-body {
  padding: 0 20px 20px;
}
.snoop-persona-label {
  font-size: 12px;
  color: #8e8e93;
  margin-bottom: 8px;
  font-weight: 500;
}
.snoop-persona-text {
  font-size: 14px;
  line-height: 1.6;
  color: #48484a;
  white-space: pre-wrap;
}
.dark .snoop-persona-text {
  color: #aeaeb2;
}
.snoop-chatdetail-name {
  cursor: pointer;
}
.snoop-chatdetail-name:hover {
  opacity: 0.7;
}

@keyframes snoop-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes snoop-scale-in {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
</style>
