<template>
  <div class="snoop-tab-content">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in 4" :key="i" class="snoop-forum-skeleton">
        <div class="snoop-skeleton-line" style="width: 30%"></div>
        <div class="snoop-skeleton-line" style="width: 70%; margin-top: 8px"></div>
        <div class="snoop-skeleton-line" style="width: 90%; margin-top: 6px"></div>
        <div class="snoop-skeleton-line snoop-skeleton-line--short" style="width: 20%; margin-top: 8px"></div>
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
      <i class="ph ph-chats-circle text-[32px] text-gray-300"></i>
      <div class="text-[13px] text-gray-400 mt-2">暂无发言</div>
    </div>

    <!-- Content list -->
    <template v-else-if="!selectedPost">
      <div
        v-for="(item, idx) in items"
        :key="idx"
        class="snoop-forum-card"
        :class="{ 'snoop-forum-card--selecting': selectable, 'snoop-forum-card--selected': selectable && selectedIndices.includes(idx) }"
        @click="selectable ? $emit('toggle-select', idx) : (selectedPost = item)"
      >
        <div v-if="selectable" class="snoop-forum-checkbox">
          <div class="snoop-checkbox" :class="{ 'snoop-checkbox--checked': selectedIndices.includes(idx) }">
            <i v-if="selectedIndices.includes(idx)" class="ph ph-check text-[12px]"></i>
          </div>
        </div>
        <div class="snoop-forum-header">
          <span class="snoop-forum-platform">{{ item.platform || '论坛' }}</span>
          <span class="snoop-forum-type" :class="item.type === 'reply' ? 'snoop-forum-type--reply' : ''">
            {{ item.type === 'reply' ? '回帖' : '发帖' }}
          </span>
        </div>
        <div class="snoop-forum-title" v-if="item.title">{{ item.title }}</div>
        <div class="snoop-forum-content">{{ item.content || '' }}</div>
        <div class="snoop-forum-footer">
          <span class="snoop-forum-likes">
            <i class="ph ph-heart text-[12px]"></i>
            {{ item.likes ?? 0 }}
          </span>
          <span class="snoop-forum-time">{{ item.time || '' }}</span>
        </div>
      </div>
    </template>

    <!-- Post detail -->
    <template v-else>
      <div class="snoop-forum-detail-header" @click="selectedPost = null">
        <i class="ph ph-caret-left text-[18px]"></i>
        <span>帖子详情</span>
      </div>
      <div class="snoop-forum-detail">
        <div class="snoop-forum-detail-platform">
          <span class="snoop-forum-platform">{{ selectedPost.platform || '论坛' }}</span>
          <span class="snoop-forum-type" :class="selectedPost.type === 'reply' ? 'snoop-forum-type--reply' : ''">
            {{ selectedPost.type === 'reply' ? '回帖' : '发帖' }}
          </span>
        </div>
        <div class="snoop-forum-detail-title" v-if="selectedPost.title">{{ selectedPost.title }}</div>
        <div class="snoop-forum-detail-body">{{ selectedPost.content }}</div>
        <div class="snoop-forum-detail-footer">
          <span class="snoop-forum-likes">
            <i class="ph-fill ph-heart text-[14px]" style="color: #ff3b30;"></i>
            {{ selectedPost.likes ?? 0 }} 赞
          </span>
          <span class="snoop-forum-time">{{ selectedPost.time || '' }}</span>
        </div>
        <div class="snoop-forum-comments-section">
          <div class="snoop-forum-comments-header">
            <span class="snoop-forum-comments-title">评论区</span>
            <button
              class="snoop-forum-gen-comments"
              :disabled="generating"
              @click="handleGenComments(selectedPost)"
            >
              <i v-if="generating" class="ph ph-spinner-gap text-[14px] animate-spin"></i>
              <i v-else class="ph ph-plus-circle text-[14px]"></i>
              {{ generating ? '生成中...' : '生成评论' }}
            </button>
          </div>
          <div v-if="genErr" class="snoop-forum-comments-error">{{ genErr }}</div>
          <!-- Top-level comment input -->
          <div class="snoop-forum-comment-input-wrap">
            <input
              v-model="commentInput"
              class="snoop-forum-comment-input"
              placeholder="输入评论..."
              maxlength="200"
              @keydown.enter="submitComment(selectedPost)"
            />
            <button
              class="snoop-forum-comment-send"
              :disabled="!commentInput.trim()"
              @click="submitComment(selectedPost)"
            >
              <i class="ph ph-paper-plane-right text-[16px]"></i>
            </button>
          </div>
          <div v-if="!selectedPost.comments?.length" class="snoop-forum-no-comments">
            暂无评论，点击「生成评论」模拟其他用户的回复
          </div>

          <!-- Comments with threaded replies -->
          <div
            v-for="(comment, ci) in selectedPost.comments"
            :key="ci"
            class="snoop-forum-comment"
          >
            <div class="snoop-forum-comment-avatar" :style="{ background: randomColor(comment.username) }">
              {{ comment.username?.charAt(0) || '?' }}
            </div>
            <div class="snoop-forum-comment-body">
              <div class="snoop-forum-comment-user">
                {{ comment.username }}
                <span v-if="comment.isOwner" class="snoop-forum-owner-badge">楼主</span>
              </div>
              <div class="snoop-forum-comment-text">{{ comment.content }}</div>
              <div class="snoop-forum-comment-meta">
                <span class="snoop-forum-time">{{ comment.time }}</span>
                <span class="snoop-forum-likes">
                  <i class="ph ph-heart text-[11px]"></i> {{ comment.likes }}
                </span>
                <span class="snoop-forum-reply-btn" @click="startReply(comment, comment.username)">回复</span>
                <span class="snoop-forum-ai-btn" @click="aiReplyToComment(selectedPost, comment)">AI</span>
                <span class="snoop-forum-layer-btn" @click="layerOwnerReply(selectedPost, comment)">层主</span>
              </div>
            </div>

            <!-- Nested replies (楼中楼) -->
            <div v-if="comment.replies?.length" class="snoop-forum-nested-replies">
              <div
                v-for="(reply, ri) in comment.replies"
                :key="ri"
                class="snoop-forum-nested-reply"
              >
                <div class="snoop-forum-comment-avatar snoop-forum-nested-avatar"
                  :style="{ background: randomColor(reply.username), width: '22px', height: '22px', fontSize: '11px' }">
                  {{ reply.username?.charAt(0) || '?' }}
                </div>
                <div class="snoop-forum-comment-body">
                  <div class="snoop-forum-comment-user">
                    {{ reply.username }}
                    <span v-if="reply.isOwner" class="snoop-forum-owner-badge">楼主</span>
                    <span v-if="reply.replyTo" class="snoop-forum-reply-to"> 回复 {{ reply.replyTo }}</span>
                  </div>
                  <div class="snoop-forum-comment-text">{{ reply.content }}</div>
                  <div class="snoop-forum-comment-meta">
                    <span class="snoop-forum-time">{{ reply.time }}</span>
                    <span class="snoop-forum-likes">
                      <i class="ph ph-heart text-[11px]"></i> {{ reply.likes }}
                    </span>
                    <span class="snoop-forum-reply-btn" @click="startReply(comment, reply.username)">回复</span>
                    <span class="snoop-forum-ai-btn" @click="aiReplyToNested(selectedPost, comment, reply)">AI</span>
                    <span class="snoop-forum-layer-btn" @click="layerOwnerReply(selectedPost, comment, reply)">层主</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Inline reply input for this comment -->
            <div v-if="replyTarget === comment" class="snoop-forum-nested-input-wrap">
              <input
                v-model="replyInput"
                class="snoop-forum-nested-input"
                :placeholder="'回复 ' + comment.username + '...'"
                maxlength="200"
                @keydown.enter="submitReply(selectedPost, comment)"
                @blur="replyTarget = null; replyInput = ''; replyTo = ''"
                ref="replyInputRef"
              />
              <button
                class="snoop-forum-nested-send"
                :disabled="!replyInput.trim()"
                @click="submitReply(selectedPost, comment)"
              >
                <i class="ph ph-arrow-up text-[14px]"></i>
              </button>
            </div>
          </div>

          <div v-if="replyingTo" class="snoop-forum-comment-replying">
            <i class="ph ph-spinner-gap text-[12px] animate-spin"></i>
            {{ replyingTo }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import {
  generateForumComments,
  generateBystanderReply,
  generateOwnerNestedReply,
  generateOwnerReplyToComment,
  generateLayerOwnerReply,
  generateUserReply
} from '../composables/useSnoopGenerate.js'

const props = defineProps({
  contact: Object,
  items: Array,
  loading: Boolean,
  error: String,
  selectable: Boolean,
  selectedIndices: Array
})
defineEmits(['retry', 'toggle-select'])

const selectedPost = ref(null)
const generating = ref(false)
const genErr = ref('')
const commentInput = ref('')
const replyingTo = ref('')

// Nested reply state
const replyTarget = ref(null)
const replyInput = ref('')
const replyTo = ref('')
const replyInputRef = ref(null)

async function handleGenComments(post) {
  genErr.value = ''
  generating.value = true
  try {
    const comments = await generateForumComments(props.contact, post)
    post.comments = [...(post.comments || []), ...comments]
  } catch (e) {
    genErr.value = e.message || '生成失败了'
  } finally {
    generating.value = false
  }
}

/** User submits a top-level comment */
async function submitComment(post) {
  const text = commentInput.value.trim()
  if (!text) return
  const comment = {
    username: '匿名网友',
    content: text,
    time: '刚刚',
    likes: 0
  }
  post.comments = [...(post.comments || []), comment]
  commentInput.value = ''

  // Phone owner replies under this comment as a nested reply
  await ownerReplyToComment(post, comment)
}

/** Start replying to a specific comment (楼中楼) */
function startReply(comment, replyToName) {
  replyTarget.value = comment
  replyTo.value = replyToName || ''
  replyInput.value = replyToName ? `回复 @${replyToName}：` : ''
  nextTick(() => {
    const el = document.querySelector('.snoop-forum-nested-input')
    if (el) el.focus()
  })
}

/** User submits a nested reply to a comment */
async function submitReply(post, comment) {
  const rawText = replyInput.value.trim()
  if (!rawText) return

  // Strip the "@回复" prefix if present — exact match since we control the prefix
  let text = rawText
  const replyToName = replyTo.value
  if (replyToName) {
    const prefix = `回复 @${replyToName}：`
    if (rawText.startsWith(prefix)) {
      text = rawText.slice(prefix.length).trim()
    } else {
      // fallback: just remove leading "回复" mention
      text = rawText.replace(/^回复\s*@?\S*?\s*[：:]?\s*/, '').trim()
    }
  }
  if (!text) return
  if (!comment.replies) comment.replies = []

  // Add the user's reply
  const userNested = {
    username: '匿名网友',
    content: text,
    time: '刚刚',
    likes: 0,
    replyTo: replyToName || undefined
  }
  comment.replies.push(userNested)
  replyInput.value = ''
  replyTarget.value = null
  replyTo.value = ''

  const ownerName = props.contact?.name || '楼主'

  // 1) If user replied to the phone owner → owner replies back directly
  if (replyToName && replyToName === ownerName) {
    await ownerNestedReply(post, comment, userNested)
    return
  }

  // 2) If user replied to a specific person → that person replies back only
  if (replyToName && replyToName !== '匿名网友') {
    replyingTo.value = replyToName + ' 正在回复...'
    try {
      const replyBack = await generateUserReply(props.contact, post, replyToName, text, '匿名网友')
      setTimeout(() => {
        replyBack.replyTo = '匿名网友'
        comment.replies.push(replyBack)
        replyingTo.value = ''
      }, 500)
    } catch (e) {
      console.error('[回复回击] 失败:', e)
      replyingTo.value = ''
    }
    return
  }

  // 3) Not replying to anyone specific → only top-level comment author chimes in
  if (comment.username !== '匿名网友') {
    replyingTo.value = comment.username + ' 正在回复...'
    try {
      const byReply = await generateBystanderReply(props.contact, post, comment, text)
      setTimeout(() => {
        if (!comment.replies) comment.replies = []
        byReply.replyTo = '匿名网友'
        comment.replies.push(byReply)
        replyingTo.value = ''
      }, 500)
    } catch {
      replyingTo.value = ''
    }
  }
}

/** Phone owner replies under the user's top-level comment */
async function ownerReplyToComment(post, userComment) {
  const ownerName = props.contact?.name || '楼主'
  replyingTo.value = ownerName + ' 正在回复...'
  try {
    const ownerReply = await generateOwnerReplyToComment(props.contact, post, userComment)
    setTimeout(() => {
      if (!userComment.replies) userComment.replies = []
      ownerReply.replyTo = '匿名网友'
      userComment.replies.push(ownerReply)
      replyingTo.value = ''
    }, 800)
  } catch {
    replyingTo.value = ''
  }
}

/** Phone owner adds a nested reply under the comment thread */
async function ownerNestedReply(post, targetComment, userNested) {
  const ownerName = props.contact?.name || '楼主'
  replyingTo.value = ownerName + ' 正在回复...'
  try {
    const ownerReply = await generateOwnerNestedReply(props.contact, post, targetComment, userNested)
    setTimeout(() => {
      if (!targetComment.replies) targetComment.replies = []
      ownerReply.replyTo = '匿名网友'
      targetComment.replies.push(ownerReply)
      replyingTo.value = ''
    }, 800)
  } catch {
    replyingTo.value = ''
  }
}

/** AI button: phone owner replies to a top-level comment */
async function aiReplyToComment(post, comment) {
  const ownerName = props.contact?.name || '楼主'
  replyingTo.value = ownerName + ' 正在回复...'
  try {
    // 1) Owner generates a reply to this comment's author
    const ownerReply = await generateOwnerReplyToComment(props.contact, post, comment)
    setTimeout(async () => {
      if (!comment.replies) comment.replies = []
      ownerReply.replyTo = comment.username
      comment.replies.push(ownerReply)
      replyingTo.value = ''

      // 2) The comment author chimes back responding to the owner's reply
      try {
        const byReply = await generateBystanderReply(props.contact, post, comment, ownerReply.content, ownerName)
        byReply.replyTo = ownerName
        comment.replies.push(byReply)
      } catch {
        // bystander chime-back failed silently
      }
    }, 800)
  } catch {
    replyingTo.value = ''
  }
}

/** AI button: phone owner replies to a specific nested reply */
async function aiReplyToNested(post, comment, targetReply) {
  const ownerName = props.contact?.name || '楼主'
  replyingTo.value = ownerName + ' 正在回复...'
  try {
    // 1) Owner generates a reply to this nested reply's author
    const ownerReply = await generateOwnerNestedReply(props.contact, post, comment, targetReply)
    setTimeout(async () => {
      if (!comment.replies) comment.replies = []
      ownerReply.replyTo = targetReply.username
      comment.replies.push(ownerReply)
      replyingTo.value = ''

      // 2) The person being replied to chimes back
      try {
        const byReply = await generateUserReply(props.contact, post, targetReply.username, ownerReply.content, ownerName)
        byReply.replyTo = ownerName
        comment.replies.push(byReply)
      } catch {
        // chime-back failed silently
      }
    }, 800)
  } catch {
    replyingTo.value = ''
  }
}

/** 层主 button: the TOP-LEVEL comment author (层主) adds a follow-up */
async function layerOwnerReply(post, comment, reply) {
  const ownerName = props.contact?.name || '楼主'
  replyingTo.value = comment.username + ' 正在补充...'
  try {
    const layerReply = await generateLayerOwnerReply(props.contact, post, comment)
    setTimeout(() => {
      if (!comment.replies) comment.replies = []
      layerReply.replyTo = ownerName
      comment.replies.push(layerReply)
      replyingTo.value = ''
    }, 800)
  } catch (e) {
    console.error('[层主] 生成失败:', e)
    replyingTo.value = ''
  }
}

const platformColors = {
  '贴吧': '#4a90d9',
  '微博': '#ff8200',
  '知乎': '#1772f6',
  '小红书': '#fe2c55',
  '豆瓣': '#33a02c',
  'NGA': '#c75b12',
  '虎扑': '#f15a22',
  'B站': '#fb7299',
  'V2EX': '#e2ab6b'
}

function getPlatformColor(platform) {
  return platformColors[platform] || '#8e8e93'
}

function randomColor(str) {
  const colors = ['#ff6b6b', '#339af0', '#20c997', '#f06595', '#7950f2', '#fd7e14', '#74c0fc', '#63e8be']
  let hash = 0
  for (let i = 0; i < (str || '?').length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}
</script>

<style scoped>
.snoop-tab-content {
  padding: 8px 16px;
}

.snoop-forum-card {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
}

.snoop-forum-card--selecting { cursor: pointer; }
.snoop-forum-card--selecting:active { background: rgba(0, 0, 0, 0.06); }
.dark .snoop-forum-card--selecting:active { background: rgba(255, 255, 255, 0.1); }
.snoop-forum-card--selected {
  background: rgba(0, 122, 255, 0.06);
  border: 1px solid rgba(0, 122, 255, 0.2);
}
.dark .snoop-forum-card--selected {
  background: rgba(0, 122, 255, 0.08);
  border-color: rgba(0, 122, 255, 0.15);
}
.snoop-forum-checkbox {
  margin-bottom: 4px;
}
.snoop-checkbox {
  width: 18px; height: 18px;
  border: 1.5px solid rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: 0.15s;
}
.dark .snoop-checkbox { border-color: rgba(255, 255, 255, 0.2); }
.snoop-checkbox--checked {
  background: #007aff;
  border-color: #007aff;
  color: #fff;
}

.snoop-forum-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.snoop-forum-platform {
  font-size: 11px;
  font-weight: 600;
  color: #8e8e93;
  background: rgba(0, 0, 0, 0.04);
  padding: 1px 7px;
  border-radius: 4px;
}
.dark .snoop-forum-platform { background: rgba(255, 255, 255, 0.06); }
.snoop-forum-type {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(52, 199, 89, 0.12);
  color: #34c759;
  font-weight: 500;
}
.snoop-forum-type--reply {
  background: rgba(0, 122, 255, 0.12);
  color: #007aff;
}
.snoop-forum-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 4px;
}
.snoop-forum-content {
  font-size: 13px;
  line-height: 1.4;
  color: #48484a;
}
.dark .snoop-forum-content { color: #aeaeb2; }
.snoop-forum-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}
.snoop-forum-likes {
  font-size: 12px;
  color: #8e8e93;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.snoop-forum-time {
  font-size: 11px;
  color: #aeaeb2;
}
.snoop-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 0;
}
.snoop-retry-btn {
  margin-top: 10px;
  font-size: 12px;
  padding: 6px 16px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: inherit;
}

.snoop-forum-skeleton {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 8px;
}
.snoop-skeleton-line {
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
  height: 12px;
}
.dark .snoop-skeleton-line { background: rgba(255, 255, 255, 0.04); }
.snoop-skeleton-line--short {
  width: 20%;
  height: 8px;
}

/* Post detail */
.snoop-forum-detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
}
.snoop-forum-detail {
  background: rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  padding: 14px;
}
.dark .snoop-forum-detail { background: rgba(55, 55, 60, 0.6); }
.snoop-forum-detail-platform {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}
.snoop-forum-detail-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 8px;
}
.snoop-forum-detail-body {
  font-size: 14px;
  line-height: 1.5;
  color: #48484a;
  margin-bottom: 10px;
  white-space: pre-wrap;
}
.dark .snoop-forum-detail-body { color: #aeaeb2; }
.snoop-forum-detail-footer {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  margin-bottom: 12px;
}
.dark .snoop-forum-detail-footer {
  border-top-color: rgba(255, 255, 255, 0.04);
}

/* Comment input */
.snoop-forum-comment-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 4px 4px 4px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 20px;
}
.dark .snoop-forum-comment-input-wrap {
  background: rgba(255, 255, 255, 0.06);
}
.snoop-forum-comment-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 13px;
  padding: 6px 0;
  outline: none;
  color: inherit;
}
.snoop-forum-comment-input::placeholder {
  color: #8e8e93;
}
.snoop-forum-comment-send {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 50%;
  background: var(--primary-color, #007aff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.snoop-forum-comment-send:disabled {
  opacity: 0.4;
  cursor: default;
}
.snoop-forum-comment-send:active:not(:disabled) {
  opacity: 0.7;
}

/* Comments section */
.snoop-forum-comments-section {
  margin-top: 0;
}
.snoop-forum-comments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.snoop-forum-comments-title {
  font-size: 14px;
  font-weight: 600;
}
.snoop-forum-gen-comments {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 10px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: #007aff;
  transition: 0.15s;
}
.snoop-forum-gen-comments:disabled {
  opacity: 0.4;
  cursor: default;
}
.snoop-forum-gen-comments:active:not(:disabled) {
  background: rgba(0, 122, 255, 0.06);
}
.snoop-forum-comments-error {
  font-size: 12px;
  color: #ff3b30;
  margin-bottom: 8px;
}
.snoop-forum-no-comments {
  font-size: 12px;
  color: #aeaeb2;
  text-align: center;
  padding: 16px 0;
}

/* Comment */
.snoop-forum-comment {
  display: flex;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.03);
  flex-wrap: wrap;
}
.dark .snoop-forum-comment { border-bottom-color: rgba(255, 255, 255, 0.03); }
.snoop-forum-comment:last-child { border-bottom: none; }

.snoop-forum-comment-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}
.snoop-forum-comment-body {
  flex: 1;
  min-width: 0;
}
.snoop-forum-comment-user {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.snoop-forum-owner-badge {
  font-size: 10px;
  font-weight: 600;
  background: rgba(0, 122, 255, 0.12);
  color: #007aff;
  padding: 0 5px;
  border-radius: 3px;
}
.snoop-forum-reply-to {
  font-size: 10px;
  font-weight: 400;
  color: #8e8e93;
  margin-left: 2px;
}
.snoop-forum-comment-text {
  font-size: 13px;
  line-height: 1.4;
  color: #48484a;
  word-break: break-word;
}
.dark .snoop-forum-comment-text { color: #aeaeb2; }
.snoop-forum-comment-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 5px;
}
.snoop-forum-reply-btn {
  font-size: 11px;
  color: #8e8e93;
  cursor: pointer;
  user-select: none;
}
.snoop-forum-reply-btn:hover {
  color: #007aff;
}
.snoop-forum-ai-btn {
  font-size: 11px;
  color: #8e8e93;
  cursor: pointer;
  user-select: none;
  margin-left: 8px;
  font-weight: 600;
}
.snoop-forum-ai-btn:hover {
  color: #34c759;
}
.snoop-forum-layer-btn {
  font-size: 11px;
  color: #8e8e93;
  cursor: pointer;
  user-select: none;
  margin-left: 8px;
  font-weight: 600;
}
.snoop-forum-layer-btn:hover {
  color: #af52de;
}

/* Nested replies (楼中楼) */
.snoop-forum-nested-replies {
  width: 100%;
  margin-left: 36px;
  margin-top: 6px;
  padding-left: 10px;
  border-left: 2px solid rgba(0, 0, 0, 0.06);
}
.dark .snoop-forum-nested-replies {
  border-left-color: rgba(255, 255, 255, 0.06);
}
.snoop-forum-nested-reply {
  display: flex;
  gap: 6px;
  padding: 6px 0;
}
.snoop-forum-nested-avatar {
  width: 22px;
  height: 22px;
  font-size: 11px;
}

/* Nested reply input */
.snoop-forum-nested-input-wrap {
  width: 100%;
  margin-left: 36px;
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 10px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 16px;
}
.dark .snoop-forum-nested-input-wrap {
  background: rgba(255, 255, 255, 0.06);
}
.snoop-forum-nested-input {
  flex: 1;
  border: none;
  background: none;
  font-size: 12px;
  padding: 4px 0;
  outline: none;
  color: inherit;
}
.snoop-forum-nested-input::placeholder {
  color: #8e8e93;
}
.snoop-forum-nested-send {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 50%;
  background: var(--primary-color, #007aff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.15s;
}
.snoop-forum-nested-send:disabled {
  opacity: 0.4;
  cursor: default;
}

.snoop-forum-comment-replying {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #8e8e93;
  padding: 8px 0 8px 42px;
}
</style>
