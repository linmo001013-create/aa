<template>
  <div class="snoop-phone">
    <!-- Top bar -->
    <div class="snoop-topbar">
      <button class="snoop-back" @click="router.back()">
        <i class="ph ph-caret-left text-[20px]"></i>
      </button>
      <div class="snoop-topbar-title">{{ contact?.name }}的手机</div>
      <div class="snoop-topbar-actions">
        <button
          class="snoop-topbar-btn"
          :disabled="summarizing"
          @click="handleSummarize"
        >
          <i class="ph ph-list-dashes text-[16px]"></i>
          {{ summarizing ? '总结中...' : '总结' }}
        </button>
        <button
          v-if="!selecting"
          class="snoop-topbar-btn"
          @click="selecting = true"
        >
          选择
        </button>
        <button
          v-if="selecting"
          class="snoop-topbar-btn"
          @click="cancelSelect"
        >
          取消
        </button>
        <button
          class="snoop-refresh"
          :class="{ 'snoop-refresh--spinning': refreshing }"
          @click="handleRefresh"
          :disabled="refreshing"
        >
          <i class="ph ph-arrows-clockwise text-[18px]"></i>
        </button>
      </div>
    </div>

    <!-- Selection bar -->
    <Transition name="snoop-slide">
      <div v-if="selecting" class="snoop-selectbar">
        <button class="snoop-selectall-btn" @click="toggleSelectAll">
          {{ isAllSelected ? '取消全选' : '全选' }}
        </button>
        <span class="snoop-selectcount">已选 {{ selectedSet.size }} 条</span>
        <div class="snoop-selectbar-actions">
          <button
            class="snoop-genmore-btn"
            :disabled="generatingMore"
            @click="handleGenerateMore"
          >
            {{ generatingMore ? '生成中...' : '生成更多' }}
          </button>
          <button
            class="snoop-regenselect-btn"
            :disabled="selectedSet.size === 0 || refreshing"
            @click="handleRefresh"
          >
            重新生成
          </button>
        </div>
      </div>
    </Transition>

    <!-- Summary toast -->
    <Transition name="snoop-slide">
      <div v-if="summaryError" class="snoop-summary-toast" :class="{ 'snoop-summary-toast--error': !summaryError.startsWith('✅') }">
        {{ summaryError }}
      </div>
    </Transition>

    <!-- Content area -->
    <div class="snoop-content">
      <KeepAlive>
        <component
          :is="currentTabComponent"
          :key="activeTab"
          :contact="contact"
          :items="currentItems"
          :loading="currentLoading"
          :error="currentError"
          :selectable="selecting"
          :selected-indices="selectedArr"
          @toggle-select="toggleSelect"
          @retry="loadTab(activeTab)"
        />
      </KeepAlive>
    </div>

    <!-- Bottom tab bar -->
    <div class="snoop-tabbar">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        class="snoop-tab"
        :class="{ 'snoop-tab--active': activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        <i :class="tab.icon" class="text-[20px]"></i>
        <span class="snoop-tab-label">{{ tab.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import { useSnoopStore } from '../../../stores/snoop'
import { generateSnoopContent } from '../composables/useSnoopGenerate'
import { getResolvedSnoopConfig, requestSnoopChatCompletion } from '../../../composables/snoop/shared'
import { addCoreMemory } from '../../../composables/memory/coreMemory'
import SnoopBrowser from '../components/SnoopBrowser.vue'
import SnoopNotes from '../components/SnoopNotes.vue'
import SnoopChats from '../components/SnoopChats.vue'
import SnoopAlbum from '../components/SnoopAlbum.vue'
import SnoopForum from '../components/SnoopForum.vue'

const router = useRouter()
const route = useRoute()
const contactsStore = useContactsStore()
const snoopStore = useSnoopStore()

const contact = computed(() => {
  const id = route.params.contactId
  return contactsStore.contacts.find(c => c.id === id)
})

const tabs = [
  { key: 'browser', label: '浏览器', icon: 'ph ph-globe-simple' },
  { key: 'notes', label: '便签', icon: 'ph ph-note-pencil' },
  { key: 'chats', label: '微信', icon: 'ph ph-chat-dots' },
  { key: 'album', label: '相册', icon: 'ph ph-images' },
  { key: 'forum', label: '论坛', icon: 'ph ph-chats-circle' }
]

const TAB_COMPONENTS = {
  browser: SnoopBrowser,
  notes: SnoopNotes,
  chats: SnoopChats,
  album: SnoopAlbum,
  forum: SnoopForum
}

const activeTab = ref('browser')
const loadingTabs = ref({})
const errorTabs = ref({})
const refreshing = ref(false)
const generatingMore = ref(false)
const summarizing = ref(false)
const summaryError = ref('')

// Selection mode
const selecting = ref(false)
const selectedSet = ref(new Set())

const selectedArr = computed(() => [...selectedSet.value].sort((a, b) => a - b))

const currentItems = computed(() => {
  const cached = snoopStore.getCache(contact.value?.id, activeTab.value)
  return cached?.items || null
})
const currentLoading = computed(() => !!loadingTabs.value[activeTab.value])
const currentError = computed(() => errorTabs.value[activeTab.value] || '')

const currentTabComponent = computed(() => TAB_COMPONENTS[activeTab.value])

const isAllSelected = computed(() => {
  const items = currentItems.value
  if (!items?.length) return false
  return selectedSet.value.size === items.length
})

function toggleSelect(idx) {
  const set = new Set(selectedSet.value)
  if (set.has(idx)) {
    set.delete(idx)
  } else {
    set.add(idx)
  }
  selectedSet.value = set
}

function toggleSelectAll() {
  const items = currentItems.value
  if (!items?.length) return
  if (isAllSelected.value) {
    selectedSet.value = new Set()
  } else {
    selectedSet.value = new Set(items.map((_, i) => i))
  }
}

function cancelSelect() {
  selecting.value = false
  selectedSet.value = new Set()
}

function switchTab(key) {
  activeTab.value = key
  selecting.value = false
  selectedSet.value = new Set()
  loadTab(key)
}

async function loadTab(category) {
  const c = contact.value
  if (!c) return

  const cached = snoopStore.getCache(c.id, category)
  if (cached) return

  loadingTabs.value[category] = true
  errorTabs.value[category] = ''

  try {
    const items = await generateSnoopContent(c, category)
    snoopStore.setCache(c.id, category, items)
  } catch (e) {
    errorTabs.value[category] = e?.message || '生成失败'
  } finally {
    loadingTabs.value[category] = false
  }
}

async function handleRefresh() {
  const c = contact.value
  if (!c) return
  const category = activeTab.value
  refreshing.value = true

  try {
    const newItems = await generateSnoopContent(c, category)

    if (selecting.value && selectedSet.value.size > 0) {
      // Partially regenerate: replace only selected items
      const oldCache = snoopStore.getCache(c.id, category)
      const oldItems = oldCache?.items || []
      const merged = [...oldItems]
      const sortedSelected = [...selectedSet.value].sort((a, b) => a - b)
      sortedSelected.forEach((idx) => {
        if (idx < newItems.length) {
          merged[idx] = newItems[idx]
        }
      })
      snoopStore.setCache(c.id, category, merged)
      selectedSet.value = new Set()
    } else {
      // Regenerate all
      snoopStore.setCache(c.id, category, newItems)
    }
  } catch (e) {
    errorTabs.value[category] = e?.message || '生成失败'
  } finally {
    refreshing.value = false
  }
}

async function handleGenerateMore() {
  const c = contact.value
  if (!c) return
  const category = activeTab.value
  generatingMore.value = true

  try {
    const newItems = await generateSnoopContent(c, category)
    const extra = newItems.slice(0, 3)
    const oldCache = snoopStore.getCache(c.id, category)
    const oldItems = oldCache?.items || []
    snoopStore.setCache(c.id, category, [...oldItems, ...extra])
  } catch (e) {
    errorTabs.value[category] = e?.message || '生成失败'
  } finally {
    generatingMore.value = false
  }
}

const TAB_LABELS = { browser: '浏览器', notes: '便签', chats: '微信', album: '相册', forum: '论坛' }

async function handleSummarize() {
  const c = contact.value
  if (!c || summarizing.value) return
  summarizing.value = true
  summaryError.value = ''

  try {
    // 1. 收集各版块数据，拆成总结单元
    const units = []  // { id, label, data }

    for (const tab of tabs) {
      const cache = snoopStore.getCache(c.id, tab.key)
      if (!cache?.items?.length) continue

      if (tab.key === 'chats') {
        // 微信：按好友分组，每个好友一个单元（含关系描述）
        const byFriend = {}
        for (const item of cache.items) {
          const f = item.friend || '未知'
          if (!byFriend[f]) byFriend[f] = []
          byFriend[f].push(item)
        }
        for (const [friend, convs] of Object.entries(byFriend)) {
          const rel = convs[0]?.relationship || ''
          const msgsText = convs.map(conv => {
            const convMsgs = (conv.msgs || []).map(m => {
              const who = m.from === 'self' ? c.name : friend
              const time = m.time || ''
              return time ? `[${time}] ${who}：${m.content}` : `${who}：${m.content}`
            }).join('\n')
            return convMsgs
          }).join('\n---\n')
          units.push({
            id: `微信-${friend}`,
            label: `和${friend}的聊天`,
            data: `与「${friend}」的关系：${rel || '未知'}\n以下是聊天记录：\n\n${msgsText}`
          })
        }
      } else if (tab.key === 'forum') {
        // 论坛：每个帖子一个单元
        for (const post of cache.items) {
          const postContent = ((post.content || '') + '\n' + (post.replies || []).map(r =>
            `${r.author || '匿名'}：${r.content}`
          ).join('\n')).trim()
          units.push({ id: `论坛-${post.title || post.id || '帖子'}`, label: `论坛帖：${post.title || '无标题'}`, data: postContent.slice(0, 600) })
        }
      } else if (tab.key === 'notes') {
        // 便签：整个版块一个单元
        const text = cache.items.map(item => `${item.title || '无标题'}：${(item.content || '').slice(0, 150)}`).join('\n')
        units.push({ id: '便签', label: '便签记录', data: text })
      } else if (tab.key === 'album') {
        const text = cache.items.map(item => `${item.title || '无标题'}：${(item.desc || item.content || '').slice(0, 120)}`).join('\n')
        units.push({ id: '相册', label: '相册内容', data: text })
      } else {
        // 浏览器等
        const text = cache.items.map(item => String(item.title || item.url || item.content || '').slice(0, 100)).join('\n')
        units.push({ id: tab.key, label: tab.label, data: text })
      }
    }

    if (!units.length) {
      summaryError.value = '没有数据可总结，请先生成内容'
      setTimeout(() => { summaryError.value = '' }, 4000)
      return
    }

    // 2. 准备 API
    const cfg = getResolvedSnoopConfig(c)
    if (!cfg?.url || !cfg?.key) throw new Error('未配置 API，请在角色配置里填写接口地址和密钥')

    let saved = 0

    // 3. 逐单元调用 AI 总结（每个单元单独一条提示，防止混淆）
    for (const unit of units) {
      // 聊天数据用关系分析专用 prompt
      const isChat = unit.id.startsWith('微信-')
      const systemPrompt = isChat
        ? `你是${c.name}的智能助理。请根据聊天记录，分析${c.name}和这位好友的关系、聊天话题和互动模式。
用「${c.name}」开头，用一句话概括他们之间的关系和最近在聊什么。语气像人物档案。
只返回 JSON，格式：{"summary": "一句话描述"}`
        : `你是${c.name}的智能助理。请根据以下数据，用一句话总结出关于${c.name}的一条档案描述。
用「${c.name}」开头，语气像在写人物档案。只返回一个 JSON 字符串，不要有多余内容。
格式：{"summary": "一句话描述"}`

      const userPrompt = isChat
        ? `下面是${c.name}和某位好友的聊天记录，请分析两人的关系、讨论的话题和互动特点：

${unit.data}`
        : `以下是${unit.label}中的数据：

${unit.data}

请总结成一条关于${c.name}的档案描述。`

      let raw = ''
      try {
        raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
      } catch (e) {
        console.warn(`[总结] ${unit.id} 失败:`, e?.message)
        continue
      }

      // 4. 解析
      try {
        const parsed = JSON.parse(raw)
        const summaryText = parsed?.summary?.trim()
        if (summaryText) {
          addCoreMemory(c, summaryText, 'extracted', { enabled: true })
          saved++
        }
      } catch {
        // 可能直接返回了字符串，兜底
        const cleaned = raw.replace(/^["']|["']$/g, '').trim()
        if (cleaned && cleaned.length > 5) {
          addCoreMemory(c, cleaned, 'extracted', { enabled: true })
          saved++
        }
      }
    }

    console.log(`[总结] 为 ${c.name} 新增了 ${saved} 条记忆`)
    summaryError.value = `✅ 已总结 ${units.length} 个项目，新增 ${saved} 条记忆`
    setTimeout(() => { summaryError.value = '' }, 4000)
  } catch (e) {
    console.error('总结失败', e)
    summaryError.value = e?.message || '总结失败'
    setTimeout(() => { summaryError.value = '' }, 4000)
  } finally {
    summarizing.value = false
  }
}

onMounted(() => {
  loadTab(activeTab.value)
})
</script>

<style scoped>
.snoop-phone {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f5f5f7;
  color: #1c1c1e;
  position: absolute;
  inset: 0;
}

.dark .snoop-phone {
  background: #0e0e10;
  color: #f5f5f7;
}

/* Top bar */
.snoop-topbar {
  display: flex;
  align-items: center;
  padding: var(--app-pt, 48px) 16px 12px;
  min-height: calc(var(--app-pt, 48px) + 44px);
  gap: 8px;
  background: rgba(245, 245, 247, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
  position: relative;
  z-index: 5;
}

.dark .snoop-topbar {
  background: rgba(14, 14, 16, 0.85);
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.snoop-back {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--primary-color, #007aff);
  cursor: pointer;
  border-radius: 8px;
}

.snoop-back:active { opacity: 0.5; }

.snoop-topbar-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.snoop-topbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.snoop-topbar-btn {
  font-size: 15px;
  color: var(--primary-color, #007aff);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 6px;
}

.snoop-topbar-btn:active { opacity: 0.5; }

.snoop-refresh {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--primary-color, #007aff);
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.3s;
}

.snoop-refresh:active { opacity: 0.5; }
.snoop-refresh:disabled { opacity: 0.4; cursor: default; }

.snoop-refresh--spinning {
  animation: snoop-spin 0.8s linear infinite;
}

@keyframes snoop-spin {
  to { transform: rotate(360deg); }
}

/* Selection bar */
.snoop-selectbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: rgba(245, 245, 247, 0.9);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
  gap: 8px;
}

.dark .snoop-selectbar {
  background: rgba(14, 14, 16, 0.9);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

.snoop-selectall-btn {
  font-size: 13px;
  color: var(--primary-color, #007aff);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
}

.snoop-selectall-btn:active { opacity: 0.5; }

.snoop-selectcount {
  font-size: 13px;
  color: #8e8e93;
}

.snoop-selectbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.snoop-genmore-btn {
  font-size: 13px;
  font-weight: 500;
  color: var(--primary-color, #007aff);
  background: rgba(0, 122, 255, 0.08);
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  white-space: nowrap;
}

.snoop-genmore-btn:active { opacity: 0.7; }
.snoop-genmore-btn:disabled { opacity: 0.4; cursor: default; }

.snoop-regenselect-btn {
  font-size: 13px;
  font-weight: 500;
  color: #fff;
  background: var(--primary-color, #007aff);
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  white-space: nowrap;
}

.snoop-regenselect-btn:active { opacity: 0.7; }
.snoop-regenselect-btn:disabled { opacity: 0.4; cursor: default; }

/* Content */
.snoop-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Tab bar */
.snoop-tabbar {
  display: flex;
  padding: 6px 0;
  padding-bottom: max(6px, env(safe-area-inset-bottom));
  background: rgba(245, 245, 247, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 0.5px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.dark .snoop-tabbar {
  background: rgba(14, 14, 16, 0.85);
  border-top-color: rgba(255, 255, 255, 0.08);
}

.snoop-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 0;
  border: none;
  background: none;
  color: #8e8e93;
  cursor: pointer;
  transition: color 0.15s;
}

.snoop-tab--active {
  color: var(--primary-color, #007aff);
}

.snoop-tab-label {
  font-size: 10px;
}

/* Summary toast */
.snoop-summary-toast {
  padding: 6px 12px;
  margin: 4px 12px;
  background: #22c55e;
  color: #fff;
  border-radius: 6px;
  font-size: 12px;
  text-align: center;
  line-height: 1.5;
}
.snoop-summary-toast--error {
  background: #ef4444;
}

/* Transitions */
.snoop-slide-enter-active,
.snoop-slide-leave-active {
  transition: all 0.2s ease;
}

.snoop-slide-enter-from,
.snoop-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
