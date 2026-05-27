<template>
  <div class="absolute inset-0 z-20 bg-[#fafafa] flex flex-col">
    <!-- Header -->
    <header
      class="tavern-header sticky top-0 z-40 bg-white/80 backdrop-blur-xl px-6 flex items-center justify-between border-b border-gray-100"
      :style="{ paddingTop: 'var(--app-pt-lg, 48px)', paddingBottom: '12px' }"
    >
      <div class="flex items-center gap-3">
        <button class="w-8 h-8 flex items-center justify-center text-gray-600 active:scale-90 transition-transform" @click="goBack">
          <i class="ph-bold ph-caret-left text-lg"></i>
        </button>
        <div>
          <h1 class="text-xl font-black text-gray-900 tracking-tight">酒馆</h1>
          <p class="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em] mt-0.5">Tavern</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-transform"
          @click="showHelp = !showHelp"
        >
          <i class="ph-bold ph-info text-base"></i>
        </button>
        <button
          class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-transform"
          @click="showDebug = !showDebug"
          :class="{ 'bg-blue-100 text-blue-500': showDebug }"
        >
          <i class="ph-bold ph-bug text-base"></i>
        </button>
        <button
          v-if="currentCard"
          class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 active:scale-90 transition-transform"
          @click="clearCard"
        >
          <i class="ph-bold ph-x text-base"></i>
        </button>
      </div>
    </header>

    <!-- Help Panel -->
    <div v-if="showHelp" class="mx-5 mt-3 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm text-gray-500 text-xs leading-relaxed">
      <p class="mb-2 font-semibold text-gray-700">酒馆角色卡导入说明</p>
      <p class="mb-1.5">• 支持 SillyTavern <strong>.png</strong> 角色卡（元数据嵌入在图片中）</p>
      <p class="mb-1.5">• 也支持 <strong>.json</strong> 格式的角色卡文件</p>
      <p class="mb-3">• 导入后可查看角色设定、世界书，并一键同步到项目世界书</p>
      <button class="text-blue-500 font-medium underline" @click="showHelp = false">收起</button>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto no-scrollbar px-5 pb-6 space-y-4 pt-4">
      <!-- Drop Zone -->
      <div v-if="!currentCard"
           class="drop-zone border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center
                  hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer"
           @click="triggerFileInput"
           @dragenter.prevent="dragOver = true"
           @dragover.prevent="dragOver = true"
           @dragleave.prevent="dragOver = false"
           @drop.prevent="handleDrop"
           :class="{ 'border-blue-400 bg-blue-50/50': dragOver }">
        <div class="text-5xl mb-3 opacity-40">🍺</div>
        <p class="text-gray-500 font-medium mb-1">拖拽角色卡到此处</p>
        <p class="text-gray-400 text-xs mb-4">支持 .png（SillyTavern）和 .json 格式</p>
        <button class="px-6 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 active:scale-[0.97] transition-all shadow-sm">
          选择文件
        </button>
        <input ref="fileInput" type="file" accept=".png,.json" class="hidden" @change="handleFileSelect" />
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center gap-3">
          <i class="ph-bold ph-spinner text-3xl text-blue-500 animate-spin"></i>
          <p class="text-gray-400 text-sm">正在解析角色卡...</p>
        </div>
      </div>

      <!-- Debug info (only shown on error) -->
      <div v-if="debugInfo && parseError" class="mx-1 p-3 rounded-xl bg-gray-50 border border-gray-200">
        <p class="text-gray-500 text-[11px] font-mono whitespace-pre-wrap">{{ debugInfo }}</p>
      </div>

      <!-- Error -->
      <div v-if="parseError" class="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
        <i class="ph-bold ph-warning-circle text-2xl text-red-400 mb-2"></i>
        <p class="text-red-600 text-sm font-medium mb-1">解析失败</p>
        <p class="text-red-400 text-xs">{{ parseError }}</p>
        <button class="mt-3 text-blue-500 text-xs underline" @click="parseError = ''; debugInfo = ''">清除</button>
      </div>

      <!-- Card Display -->
      <div v-if="currentCard && !loading" class="space-y-4">

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div class="flex items-start gap-4">
            <div class="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden shadow-sm">
              <img v-if="cardAvatar" :src="cardAvatar" class="w-full h-full object-cover" />
              <span v-else class="text-gray-400">{{ (currentCard.data.name || '?').charAt(0) }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <h2 class="text-gray-900 text-xl font-bold truncate">{{ currentCard.data.name || '未命名' }}</h2>
              <div class="flex flex-wrap gap-1.5 mt-1.5">
                <span class="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500"
                      v-for="tag in (currentCard.data.tags || [])" :key="tag">{{ tag }}</span>
              </div>
              <div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
                <span v-if="currentCard.data.creator">👤 {{ currentCard.data.creator }}</span>
                <span v-if="currentCard.data.character_version">📌 v{{ currentCard.data.character_version }}</span>
                <span>📄 {{ currentCard.fileName }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard.data.description">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">角色描述</h3>
          <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{{ currentCard.data.description }}</p>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard.data.personality">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">性格</h3>
          <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{{ currentCard.data.personality }}</p>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard.data.scenario">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">场景设定</h3>
          <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{{ currentCard.data.scenario }}</p>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard.data.system_prompt">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">系统提示词</h3>
          <p class="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-3">{{ currentCard.data.system_prompt }}</p>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard.data.first_mes">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">开场白</h3>
          <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{{ currentCard.data.first_mes }}</p>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="altGreetings.length > 0">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">备用开场白（{{ altGreetings.length }}）</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-3"
               v-for="(g, i) in altGreetings" :key="i">
              <span class="text-gray-400 text-[10px] block mb-1 font-bold">#{{ i + 1 }}</span>
              {{ g }}
            </p>
          </div>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard.data.mes_example">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">示例对话</h3>
          <p class="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap font-mono bg-gray-50 rounded-xl p-3">{{ currentCard.data.mes_example }}</p>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard.data.post_history_instructions">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">对话后指令</h3>
          <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{{ currentCard.data.post_history_instructions }}</p>
        </div>

        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard.data.creator_notes">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-2.5">作者备注</h3>
          <p class="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{{ currentCard.data.creator_notes }}</p>
        </div>

        <!-- Detected Items -->
        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-3">检测到的内容</h3>
          <div class="space-y-2.5">
            <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50">
              <div class="flex items-center gap-2.5">
                <span class="text-lg">📖</span>
                <div>
                  <span class="text-gray-700 text-sm font-medium">世界书</span>
                  <span v-if="detectedWorldBook"
                        class="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">已检测</span>
                  <span v-else class="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">未检测到</span>
                  <p v-if="detectedWorldBook" class="text-gray-400 text-xs mt-0.5">
                    {{ worldBookName }} · {{ worldBookEntryCount }} 条条目
                  </p>
                </div>
              </div>
              <button v-if="detectedWorldBook && !worldBookImported"
                      class="text-xs px-3 py-1.5 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 active:scale-[0.97] transition-all"
                      @click="importWorldBook">
                导入到世界书
              </button>
              <span v-else-if="worldBookImported"
                    class="text-xs text-green-500 font-medium">已导入 ✓</span>
            </div>

            <div class="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50">
              <span class="text-lg">⚙️</span>
              <div>
                <span class="text-gray-700 text-sm font-medium">预设</span>
                <span v-if="detectedPreset"
                      class="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">已检测</span>
                <span v-else class="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">未检测到</span>
              </div>
            </div>

            <div class="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50">
              <span class="text-lg">🔧</span>
              <div>
                <span class="text-gray-700 text-sm font-medium">正则</span>
                <span v-if="detectedRegex"
                      class="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">已检测</span>
                <span v-else class="ml-2 text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">未检测到</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Save as Contact -->
        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm" v-if="currentCard">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="text-2xl">{{ contactAvatar }}</span>
              <div>
                <p class="text-gray-800 text-sm font-medium">{{ currentCard.data.name || '未命名角色' }}</p>
                <p class="text-gray-400 text-xs">保存为联系人后可开始聊天</p>
              </div>
            </div>
            <button
              v-if="!contactSaved"
              class="px-4 py-2 rounded-xl bg-[#007AFF] text-white text-[15px] font-semibold active:scale-[0.97] transition-all"
              @click="saveAsContact"
            >
              保存为联系人
            </button>
            <span v-else class="text-sm text-green-500 font-medium">已保存 ✓</span>
          </div>
        </div>

        <!-- Import History -->
        <div class="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h3 class="text-gray-400 text-[11px] font-bold uppercase tracking-wider mb-3">导入记录</h3>
          <div v-if="importedCards.length === 0" class="text-gray-400 text-sm text-center py-4">暂无导入记录</div>
          <div v-else class="space-y-2">
            <div v-for="(card, idx) in importedCards" :key="idx"
                 class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors active:scale-[0.98]"
                 @click="selectImportedCard(card)">
              <div class="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-lg overflow-hidden flex-shrink-0">
                <img v-if="card.avatar" :src="card.avatar" class="w-full h-full object-cover" />
                <span v-else class="text-gray-400 text-sm">{{ (card.name || '?').charAt(0) }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-gray-800 text-sm font-medium truncate">{{ card.name || '未命名' }}</p>
                <p class="text-gray-400 text-xs truncate">{{ card.fileName }}</p>
              </div>
              <i class="ph-bold ph-caret-right text-gray-300"></i>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Debug Panel -->
    <div v-if="showDebug && debugInfo" class="mx-5 mb-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
      <div class="flex items-center justify-between mb-2">
        <h4 class="text-gray-500 text-[11px] font-bold uppercase tracking-wider">调试信息</h4>
        <button class="text-gray-400 text-[10px] underline" @click="debugInfo = ''">清除</button>
      </div>
      <p class="text-gray-500 text-[11px] font-mono whitespace-pre-wrap leading-relaxed">{{ debugInfo }}</p>
    </div>

    <!-- Toast -->
    <Transition name="toast-slide">
      <div v-if="toast" class="absolute left-1/2 -translate-x-1/2 bottom-24 bg-gray-800 text-white text-sm px-5 py-2.5 rounded-xl shadow-lg z-50 whitespace-nowrap">
        {{ toast }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useLorebookStore } from '../../../stores/lorebook'
import { useContactsStore } from '../../../stores/contacts'
import { useStorage } from '../../../composables/useStorage'
import pako from 'pako'

const router = useRouter()
const lorebookStore = useLorebookStore()
const contactsStore = useContactsStore()
const { scheduleSave } = useStorage()

const fileInput = ref(null)
const currentCard = ref(null)
const cardAvatar = ref(null)
const dragOver = ref(false)
const showHelp = ref(false)
const showDebug = ref(false)
const toast = ref('')
const loading = ref(false)
const parseError = ref('')
const debugInfo = ref('')
const importedCards = ref([])
const worldBookImported = ref(false)
const contactSaved = ref(false)

const contactAvatar = computed(() => {
  if (!currentCard.value) return '👤'
  const data = currentCard.value.data
  // Try card avatar image first
  if (cardAvatar.value) return ''
  // Fallback to avatar emoji from spec or name-based
  const spec = currentCard.value.spec
  if (spec === 'chara_card_v3') {
    return data.avatar || data.creator || data.name?.charAt(0) || '👤'
  }
  return data.avatar || '👤'
})

function goBack() { router.push('/') }
function triggerFileInput() { fileInput.value?.click() }

function handleDrop(e) {
  dragOver.value = false
  if (e.dataTransfer?.files?.length) processFile(e.dataTransfer.files[0])
}

function handleFileSelect(e) {
  if (e.target?.files?.length) processFile(e.target.files[0])
  if (e.target) e.target.value = ''
}

// ===== PNG PARSER =====

// Proper base64 to UTF-8 decoding (handles multi-byte characters)
function base64ToUtf8(str) {
  const binaryStr = atob(str)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

// Try all decoding strategies on a string to extract character JSON
function extractCharJson(raw) {
  if (!raw) return null

  // Strategy 1: Direct JSON parse
  let result = tryParseJson(raw)
  if (result) return result

  // Strategy 2: DecodeURIComponent then tryParseJson
  try {
    const decoded = decodeURIComponent(raw)
    result = tryParseJson(decoded)
    if (result) return result
  } catch (_) {}

  // Strategy 3: atob (base64) -> UTF8 bytes -> tryParseJson
  try {
    const decoded = base64ToUtf8(raw)
    result = tryParseJson(decoded)
    if (result) return result
  } catch (_) {}

  // Strategy 4: decodeURIComponent -> atob -> UTF8 -> tryParseJson
  try {
    const step1 = decodeURIComponent(raw)
    const step2 = base64ToUtf8(step1)
    result = tryParseJson(step2)
    if (result) return result
  } catch (_) {}

  // Strategy 5: atob -> decodeURIComponent -> UTF8 -> tryParseJson
  try {
    const step1 = atob(raw)
    const step2 = decodeURIComponent(step1)
    result = tryParseJson(step2)
    if (result) return result
  } catch (_) {}

  // Strategy 6: Find JSON inside raw text (wrapper case)
  const jsonMatch = raw.match(/\{[\s\S]*"name"[\s\S]*\}/)
  if (jsonMatch) {
    result = tryParseJson(jsonMatch[0])
    if (result) return result
  }

  // Strategy 7: Brute-force scan for any valid JSON
  for (let start = 0; start < raw.length; start++) {
    if (raw[start] === '{') {
      for (let end = start + 1; end <= raw.length; end++) {
        if (raw[end - 1] === '}') {
          try {
            const candidate = raw.substring(start, end)
            const parsed = JSON.parse(candidate)
            if (parsed && typeof parsed === 'object') {
              if (parsed.name) return parsed
              if (parsed.spec === 'chara_card_v3' && parsed.data && parsed.data.name) return parsed.data
            }
          } catch (_) {}
        }
      }
      if (result) break
    }
  }

  return null
}

async function parsePngCard(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)

  const textChunks = []

  // ---- Step 1: Extract all PNG text chunks ----
  let offset = 8 // skip PNG signature
  while (offset + 8 <= bytes.length) {
    const length = view.getUint32(offset)
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])

    if (type === 'IEND') break

    const chunkData = bytes.slice(offset + 8, offset + 8 + length)
    const crcStart = offset + 8 + length

    if (type === 'tEXt' || type === 'iTXt') {
      // Format: keyword (null-terminated) + content string
      let nullIdx = -1
      for (let i = 0; i < chunkData.length; i++) {
        if (chunkData[i] === 0) { nullIdx = i; break }
      }
      const keyword = nullIdx >= 0
        ? new TextDecoder('utf-8').decode(chunkData.slice(0, nullIdx))
        : ''
      const content = nullIdx >= 0
        ? new TextDecoder('utf-8').decode(chunkData.slice(nullIdx + 1))
        : ''

      textChunks.push({ keyword, content, type, compressed: false })
    }

    if (type === 'zTXt') {
      // Format: keyword (null-terminated) + compressionMethod (1 byte) + compressed content
      let nullIdx = -1
      for (let i = 0; i < chunkData.length; i++) {
        if (chunkData[i] === 0) { nullIdx = i; break }
      }
      if (nullIdx >= 0) {
        const keyword = new TextDecoder('utf-8').decode(chunkData.slice(0, nullIdx))
        const compressionMethod = chunkData[nullIdx + 1]
        const compressedData = chunkData.slice(nullIdx + 2)

        if (compressionMethod === 0) {
          try {
            // Decompress using pako's inflate
            const decompressed = pako.inflate(compressedData, { to: 'string' })
            textChunks.push({ keyword, content: decompressed, type, compressed: true })
          } catch (e) {
            // Try raw inflate
            try {
              const decompressed = pako.inflateRaw(compressedData, { to: 'string' })
              textChunks.push({ keyword, content: decompressed, type, compressed: true })
            } catch (e2) {
              textChunks.push({ keyword, content: '', type, compressed: true, decompressError: e.message })
            }
          }
        }
      }
    }

    // Fallback: check any chunk for JSON-like content
    // This catches cards that store data in non-standard chunks
    if (!['IHDR', 'PLTE', 'IDAT', 'IEND', 'tEXt', 'zTXt', 'iTXt', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'bKGD', 'pHYs', 'sBIT', 'sPLT', 'hIST', 'tIME', 'oFFs', 'sCAL', 'misc'].includes(type)) {
      const rawText = new TextDecoder('utf-8').decode(chunkData)
      // Only try chunks that contain JSON-like patterns
      if (rawText.includes('"name"') || rawText.includes('"description"')) {
        textChunks.push({ keyword: type, content: rawText, type, compressed: false })
      }
    }

    offset += 12 + length
  }

  // ---- Step 2: Try to extract JSON from text chunks ----

  // Collect debug info
  debugInfo.value = '检测到 ' + textChunks.length + ' 个文本块:\n'
  textChunks.forEach((c, i) => {
    const preview = c.content.substring(0, 120).replace(/\n/g, '\\n')
    debugInfo.value += `  [${i}] keyword="${c.keyword}" type=${c.type} len=${c.content.length}\n    preview: ${preview}\n`
  })

  // Try each chunk using extractCharJson
  let jsonData = null

  for (const chunk of textChunks) {
    if (!chunk.content) continue
    jsonData = extractCharJson(chunk.content)
    if (jsonData) {
      console.log('Found JSON in chunk:', chunk.keyword, chunk.type)
      break
    }
  }

  if (!jsonData) {
    throw new Error('无法从 PNG 中解析角色数据。检测到 ' + textChunks.length + ' 个文本块，但未能提取有效 JSON。\n请确认文件为 SillyTavern 格式的角色卡（.png 或 .json）')
  }

  // Create avatar from the PNG image
  const blob = new Blob([buffer], { type: file.type || 'image/png' })
  const avatarUrl = URL.createObjectURL(blob)

  return { fileName: file.name, data: jsonData, avatarUrl }
}

function tryParseJson(str) {
  try {
    const parsed = JSON.parse(str)
    if (parsed && typeof parsed === 'object') {
      // V3 format: spec + data wrapper
      if (parsed.spec === 'chara_card_v3' && parsed.data && typeof parsed.data === 'object') {
        return parsed.data
      }
      // V2 format: flat object with name at top
      if (parsed.name) {
        return parsed
      }
    }
  } catch (_) {}
  return null
}

// ===== JSON File Parser =====

async function parseJsonCard(file) {
  const text = await file.text()
  const parsed = JSON.parse(text)
  
  // V3 format: spec + data wrapper
  if (parsed.spec === 'chara_card_v3' && parsed.data && typeof parsed.data === 'object' && parsed.data.name) {
    return { fileName: file.name, data: parsed.data, avatarUrl: null }
  }
  // V2 flat format
  if (parsed.name) {
    return { fileName: file.name, data: parsed, avatarUrl: null }
  }
  // V2 with data wrapper
  if (parsed.data && typeof parsed.data === 'object' && parsed.data.name) {
    return { fileName: file.name, data: parsed.data, avatarUrl: null }
  }
  
  throw new Error('JSON 文件格式不正确，未找到角色名称')
}

// ===== Main Processor =====

async function processFile(file) {
  if (!file) return
  loading.value = true
  parseError.value = ''
  debugInfo.value = ''

  try {
    const ext = file.name.split('.').pop().toLowerCase()
    let result

    if (ext === 'png') {
      result = await parsePngCard(file)
    } else if (ext === 'json') {
      result = await parseJsonCard(file)
    } else {
      throw new Error('不支持的文件格式，请使用 .png 或 .json 文件')
    }

    currentCard.value = result
    cardAvatar.value = result.avatarUrl
    worldBookImported.value = false

    const exists = importedCards.value.find(c => c.fileName === result.fileName)
    if (!exists) {
      importedCards.value.unshift({
        name: result.data.name,
        fileName: result.fileName,
        avatar: result.avatarUrl,
        data: result
      })
    }

    showToast(`「${result.data.name || '未命名'}」导入成功！`)
  } catch (err) {
    console.error('Parse error:', err)
    parseError.value = err.message || '解析文件时发生错误'
  } finally {
    loading.value = false
  }
}

// ===== Computed =====

const altGreetings = computed(() => {
  if (!currentCard.value?.data) return []
  const data = currentCard.value.data
  const greetings = []
  if (Array.isArray(data.alternate_greetings)) {
    greetings.push(...data.alternate_greetings.filter(Boolean))
  }
  return greetings
})

const worldBookData = computed(() => {
  return currentCard.value?.data?.character_book || currentCard.value?.data?.world_book || null
})

const detectedWorldBook = computed(() => {
  const wb = worldBookData.value
  return wb && wb.entries && Array.isArray(wb.entries) && wb.entries.length > 0
})

const worldBookName = computed(() => worldBookData.value?.name || '未命名世界书')
const worldBookEntryCount = computed(() => worldBookData.value?.entries?.length || 0)

const detectedPreset = computed(() => {
  return !!(currentCard.value?.data?.system_prompt)
})

const detectedRegex = computed(() => {
  const data = currentCard.value?.data
  return !!(data?.regex_scripts && Array.isArray(data.regex_scripts) && data.regex_scripts.length > 0)
})

// ===== Actions =====

function importWorldBook() {
  const book = worldBookData.value
  if (!book) return

  const newBook = {
    id: 'tavern_' + Date.now(),
    name: book.name || '从酒馆导入',
    description: book.description || '',
    scanDepth: book.scan_depth ?? 2,
    tokenBudget: book.token_budget ?? 1000,
    entries: (book.entries || []).map((entry, idx) => ({
      id: 'entry_' + Date.now() + '_' + idx,
      name: entry.comment || entry.name || `条目 ${idx + 1}`,
      content: entry.content || '',
      keywords: entry.keys || [],
      insertDepth: entry.insertion_order ?? idx,
      alwaysActive: !!entry.constant,
      enabled: entry.enabled !== false,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))
  }

  if (!lorebookStore.lorebook.books) {
    lorebookStore.lorebook.books = []
  }
  lorebookStore.lorebook.books.push(newBook)
  worldBookImported.value = true
  showToast(`世界书「${book.name || '未命名'}」已导入！（${newBook.entries.length} 条条目）`)
}

function saveAsContact() {
  const data = currentCard.value?.data
  if (!data || !data.name) {
    showToast('角色数据不完整，无法保存')
    return
  }

  const NL = String.fromCharCode(10) // newline
  const parts = []
  if (data.system_prompt || data.prompt) {
    parts.push(data.system_prompt || data.prompt)
  }
  if (data.description) {
    parts.push(NL + data.description)
  }
  if (data.personality) {
    parts.push(NL + '性格：' + data.personality)
  }
  if (data.mes_example || data.example_dialogue) {
    parts.push(NL + '对话示例：' + NL + (data.mes_example || data.example_dialogue))
  }
  if (data.post_history_instructions || data.character_book_behavior) {
    parts.push(NL + '历史指令：' + NL + (data.post_history_instructions || data.character_book_behavior))
  }
  const prompt = parts.join('').trim()

  const newContact = {
    id: 'c_' + Date.now(),
    name: data.name.trim(),
    avatarType: 'emoji',
    avatar: '👤',
    prompt,
    msgs: [],
    boundLorebooks: [],
    personaId: null,
    stickerGroupIds: [],
    mcpServerIds: [],
    configId: null,
    edgeVoiceId: '',
    minimaxVoiceId: '',
    maxMessages: 0,
    chatBackground: null,
    callHistory: []
  }

  contactsStore.contacts.unshift(newContact)
  contactSaved.value = true
  scheduleSave()
  showToast('已保存联系人：' + data.name)
}

function selectImportedCard(card) {
  if (card.data) {
    currentCard.value = card.data
    cardAvatar.value = card.avatar
    worldBookImported.value = false
    contactSaved.value = false
  }
}

function clearCard() {
  currentCard.value = null
  cardAvatar.value = null
  worldBookImported.value = false
  contactSaved.value = false
  parseError.value = ''
  debugInfo.value = ''
}

function showToast(msg) {
  toast.value = msg
  setTimeout(() => { toast.value = '' }, 2500)
}
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.drop-zone {
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.toast-slide-enter-active, .toast-slide-leave-active {
  transition: all 0.3s ease;
}
.toast-slide-enter-from, .toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
