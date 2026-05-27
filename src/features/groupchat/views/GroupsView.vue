<template>
  <div class="absolute inset-0 z-20 bg-white dark:bg-black flex flex-col">
    <div class="pt-app-lg pb-2 px-4 glass-panel flex items-center justify-between relative">
      <button class="text-[#007AFF] text-[17px] flex items-center" @click="router.push('/')">
        <i class="ph ph-caret-left"></i> 主页
      </button>
      <span class="font-semibold text-[17px] text-black dark:text-white absolute left-1/2 -translate-x-1/2">群聊</span>
      <button class="text-[#007AFF]" @click="showCreateModal = true" title="新建群聊">
        <i class="ph ph-plus-circle text-2xl"></i>
      </button>
    </div>

    <div ref="listRef" class="flex-1 overflow-y-auto no-scrollbar" @scroll.passive="onListScroll">
      <div v-if="sortedGroups.length === 0" class="flex flex-col items-center justify-center h-full text-[#8E8E93]">
        <i class="ph ph-users-three text-6xl mb-4 opacity-50"></i>
        <p>暂无群聊</p>
        <p class="text-sm mt-2">点击右上角 + 新建群聊</p>
      </div>
      <div v-else class="relative" :style="{ height: `${totalListHeight}px` }">
        <div
          v-for="item in visibleGroups"
          :key="item.group.id"
          class="absolute left-0 right-0 h-[76px] px-4 py-3 flex gap-3 active:bg-gray-100 dark:active:bg-gray-800 cursor-pointer border-b border-[#C6C6C8]/30 dark:border-gray-800"
          :style="{ transform: `translateY(${item.top}px)` }"
          @click="openChat(item.group)"
        >
          <div class="relative w-[50px] h-[50px] shrink-0">
            <div class="w-full h-full rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center overflow-hidden relative">
              <template v-if="item.group.members && item.group.members.length > 0">
                <div
                  v-for="(member, idx) in item.group.members.slice(0, 4)"
                  :key="idx"
                  class="absolute flex items-center justify-center bg-[#E9E9EB] dark:bg-gray-600 overflow-hidden"
                  :style="getGroupAvatarStyle(idx, Math.min(item.group.members.length, 4))"
                >
                  <img v-if="member.avatarType === 'image' && !failedMemberAvatars.has(item.group.id + '_' + idx)" :src="member.avatar" loading="lazy" decoding="async" class="w-full h-full object-cover" @error="handleMemberAvatarError(item.group.id, idx, member)">
                  <span v-else class="text-xs">{{ member.avatar }}</span>
                </div>
              </template>
              <span v-else class="text-2xl">👥</span>
            </div>
            <span v-if="item.group.unreadCount" class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[11px] font-semibold flex items-center justify-center px-1">{{ item.group.unreadCount > 99 ? '99+' : item.group.unreadCount }}</span>
          </div>
          <div class="flex-1 min-w-0 flex flex-col justify-center">
            <div class="flex justify-between items-baseline mb-[2px]">
              <span class="font-semibold text-[17px] text-black dark:text-white truncate">{{ item.group.name }}</span>
              <span class="text-[14px] text-[#8E8E93] shrink-0 ml-2">{{ formatTimeShort(item.lastMsgTime) }}</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-[14px] text-[#8E8E93] truncate flex-1">{{ item.lastMsgPreview }}</span>
              <span v-if="item.group.groupMode === 'multi'" class="text-[11px] text-[#8E8E93] bg-[#F2F2F7] dark:bg-gray-800 px-2 py-0.5 rounded-full shrink-0">多API</span>
              <span v-else class="text-[11px] text-[#8E8E93] bg-[#F2F2F7] dark:bg-gray-800 px-2 py-0.5 rounded-full shrink-0">单API</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CreateGroupModal
      :visible="showCreateModal"
      @close="showCreateModal = false"
      @saved="showCreateModal = false"
    />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGroupsStore } from '../../../stores/groups'
import { useContactsStore } from '../../../stores/contacts'
import CreateGroupModal from '../components/CreateGroupModal.vue'

const ROW_HEIGHT = 76
const ROW_OVERSCAN = 8

const router = useRouter()
const groupsStore = useGroupsStore()
const contactsStore = useContactsStore()
const showCreateModal = ref(false)
const listRef = ref(null)
const scrollTop = ref(0)
const viewportHeight = ref(ROW_HEIGHT * 12)
const failedMemberAvatars = ref(new Set())
let resizeObserver = null

const sortedGroups = computed(() => {
  return [...groupsStore.groups]
    .map(group => {
      const lastMsg = group.msgs?.[group.msgs.length - 1]
      return {
        group,
        lastMsgTime: lastMsg?.timestamp || group.createdAt || 0,
        lastMsgPreview: lastMsg
          ? (lastMsg.senderName ? `${lastMsg.senderName}: ${lastMsg.content || '[图片]'}` : (lastMsg.content || '[图片]'))
          : '暂无消息'
      }
    })
    .sort((a, b) => Number(b.lastMsgTime) - Number(a.lastMsgTime))
})

const totalListHeight = computed(() => sortedGroups.value.length * ROW_HEIGHT)

const visibleGroups = computed(() => {
  const items = sortedGroups.value
  if (items.length === 0) return []

  const safeViewportHeight = Math.max(viewportHeight.value, ROW_HEIGHT * 6)
  const maxScrollTop = Math.max(0, totalListHeight.value - safeViewportHeight)
  const safeScrollTop = Math.max(0, Math.min(scrollTop.value, maxScrollTop))
  const startIndex = Math.max(0, Math.floor(safeScrollTop / ROW_HEIGHT) - ROW_OVERSCAN)
  const endIndex = Math.min(
    items.length,
    Math.ceil((safeScrollTop + safeViewportHeight) / ROW_HEIGHT) + ROW_OVERSCAN
  )

  return items.slice(startIndex, endIndex).map((item, offset) => ({
    ...item,
    top: (startIndex + offset) * ROW_HEIGHT
  }))
})

function syncViewportMetrics() {
  const el = listRef.value
  if (!el) return
  scrollTop.value = el.scrollTop || 0
  viewportHeight.value = el.clientHeight || ROW_HEIGHT * 12
}

function onListScroll(event) {
  scrollTop.value = event?.target?.scrollTop || 0
}

function openChat(group) {
  group.unreadCount = 0
  // 把群聊数据挂到 contactsStore.activeChat 上让聊天界面能用
  contactsStore.activeChat = group
  router.push('/chat/' + group.id)
}

function formatTimeShort(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function getGroupAvatarStyle(idx, total) {
  const size = total === 1 ? '100%' : '50%'
  let top = '0'
  let left = '0'

  if (total === 2) {
    left = idx === 0 ? '0' : '50%'
  } else if (total === 3) {
    if (idx === 0) {
      top = '25%'
      left = '0'
    } else {
      top = idx === 1 ? '0' : '50%'
      left = '50%'
    }
  } else if (total === 4) {
    top = idx < 2 ? '0' : '50%'
    left = idx % 2 === 0 ? '0' : '50%'
  }

  return {
    width: size,
    height: total === 2 ? '100%' : size,
    top,
    left
  }
}

function handleMemberAvatarError(groupId, idx, member) {
  const key = groupId + '_' + idx
  failedMemberAvatars.value.add(key)
  failedMemberAvatars.value = new Set(failedMemberAvatars.value)
  if (member) {
    member.avatarType = 'emoji'
  }
}

onMounted(() => {
  nextTick(syncViewportMetrics)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => syncViewportMetrics())
    if (listRef.value) resizeObserver.observe(listRef.value)
    return
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncViewportMetrics)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
    return
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncViewportMetrics)
  }
})
</script>
