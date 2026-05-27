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
      <div class="snoop-chatdetail-header" @click="selectedChat = null">
        <i class="ph ph-caret-left text-[18px]"></i>
        <span>{{ selectedChat.friend }}</span>
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
        <button
          v-if="!selectable"
          class="snoop-genmore-chat"
          :disabled="generatingMore"
          @click="handleGenMoreChat"
        >
          <i class="ph ph-plus-circle text-[16px]"></i>
          {{ generatingMore ? '生成中...' : '生成更多聊天记录' }}
        </button>
        <div v-if="genMoreError" class="snoop-genmore-error">{{ genMoreError }}</div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { generateMoreChatMsgs } from '../composables/useSnoopGenerate'
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
const generatingMore = ref(false)
const genMoreError = ref('')

function lastMsg(chat) {
  const msgs = chat.msgs
  if (!msgs?.length) return ''
  const last = msgs[msgs.length - 1]
  const prefix = last.from === 'self' ? '我: ' : ''
  const text = last.content || ''
  return prefix + (text.length > 20 ? text.slice(0, 20) + '...' : text)
}

async function handleGenMoreChat() {
  if (!selectedChat || !props.contact || generatingMore.value) return
  generatingMore.value = true
  genMoreError.value = ''
  try {
    const msgs = await generateMoreChatMsgs(
      props.contact,
      selectedChat.friend,
      selectedChat.msgs || [],
      selectedChat.relationship || ''
    )
    if (msgs?.length) {
      const currentMsgs = Array.isArray(selectedChat.value?.msgs) ? selectedChat.value.msgs : []
      const updatedMsgs = [...currentMsgs, ...msgs]
      // 更新显示（创建新对象保证响应式）
      selectedChat.value = { ...selectedChat.value, msgs: updatedMsgs }
      // 同步更新缓存，返回后数据不丢失
      const cId = props.contact?.id
      if (cId) {
        const cache = snoopStore.getCache(cId, 'chats')
        if (cache?.items) {
          const idx = cache.items.findIndex(c => c.friend === selectedChat.value.friend)
          if (idx !== -1) {
            cache.items[idx] = { ...cache.items[idx], msgs: updatedMsgs }
            snoopStore.setCache(cId, 'chats', cache.items)
          }
        }
      }
      console.log(`[续写成功] 追加了 ${msgs.length} 条，共 ${updatedMsgs.length} 条`)
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
  width: 100%;
  padding: 12px;
  margin-top: 8px;
  border: none;
  background: none;
  color: var(--primary-color, #007aff);
  font-size: 14px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.15s;
}

.snoop-genmore-chat:active {
  background: rgba(0, 0, 0, 0.04);
}

.dark .snoop-genmore-chat:active {
  background: rgba(255, 255, 255, 0.06);
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
</style>
