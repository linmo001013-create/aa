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
    // 1. 收集所有版块的缓存数据
    const sections = []
    for (const tab of tabs) {
      const cache = snoopStore.getCache(c.id, tab.key)
      if (cache?.items?.length) {
        sections.push({ key: tab.key, label: TAB_LABELS[tab.key], items: cache.items })
      }
    }
    if (!sections.length) {
      summaryError.value = '没有数据可总结，请先生成内容'
      setTimeout(() => { summaryError.value = '' }, 4000)
      return
    }

    // 2. 拼提示词让 AI 总结
    const cfg = getResolvedSnoopConfig(c)
    if (!cfg?.url || !cfg?.key) throw new Error('未配置 API，请在角色配置里填写接口地址和密钥')

    let dataDesc = ''
    for (const sec of sections) {
      if (sec.key === 'chats') {
        // 微信：按好友分组
        const chatItems = sec.items
        const friends = {}
        for (const item of chatItems) {
          const f = item.friend || '未知'
          if (!friends[f]) friends[f] = []
          const lastFew = (item.msgs || []).slice(-3).map(m => m.content).join(' | ')
          friends[f].push(lastFew)
        }
        dataDesc += `【${sec.label}】
`
        for (const [f, msgs] of Object.entries(friends)) {
          dataDesc += `和「${f}」的聊天：${msgs.join('；')}
`
        }
      } else if (sec.key === 'notes') {
        dataDesc += `【${sec.label}】
`
        for (const item of sec.items) {
          dataDesc += `- ${item.title || '无标题'}：${(item.content || '').slice(0, 100)}
`
        }
      } else if (sec.key === 'album') {
        dataDesc += `【${sec.label}】
`
        for (const item of sec.items) {
          dataDesc += `- ${item.title || '无标题'}：${(item.desc || item.content || '').slice(0, 80)}
`
        }
      } else {
        dataDesc += `【${sec.label}】
`
        for (const item of sec.items) {
          const t = item.title || item.url || item.content || ''
          dataDesc += `- ${String(t).slice(0, 100)}
`
        }
      }
    }

    const systemPrompt = `你是${c.name}的智能助理。请根据手机里的数据，总结${c.name}最近在关注什么、和谁在聊什么、有什么动向和兴趣。
用简洁的条目列出，每一条都以"${c.name}"开头，像一段档案描述。
输出格式为 JSON 数组：["条目1","条目2","条目3",...]`

    const userPrompt = `以下是${c.name}手机里的最新数据：

${dataDesc}

请总结成3-5条核心档案描述。`

    let raw = ''
    try {
      raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
    } catch (e) {
      throw new Error('AI 总结请求失败: ' + (e?.message || '未知错误'))
    }

    // 3. 解析 JSON 数组
    const parsed = JSON.parse(raw)
    const summaryItems = Array.isArray(parsed) ? parsed : (parsed.summaries || parsed.items || [])

    if (!Array.isArray(summaryItems) || !summaryItems.length) {
      throw new Error('AI 返回格式不正确，没有总结出内容')
    }

    // 4. 逐条存为联系人的核心记忆
    let saved = 0
    for (const item of summaryItems) {
      const desc = String(item?.content || item?.text || item || '').trim()
      if (!desc) continue
      addCoreMemory(c, desc, 'extracted', { enabled: true })
      saved++
    }

    console.log(`[总结] 为 ${c.name} 新增了 ${saved} 条记忆`)
    summaryError.value = `✅ 已总结 ${sections.length} 个版块，新增 ${saved} 条记忆`
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
