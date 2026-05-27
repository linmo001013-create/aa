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
        <div class="snoop-forum-author-row">
          <div class="snoop-forum-author-avatar" :style="contact?.avatarType === 'image' ? {} : { background: randomColor(contact?.name || '?') }">
            <img v-if="contact?.avatarType === 'image' && contact?.avatar" :src="contact.avatar" class="snoop-forum-author-img" alt="" />
            <template v-else>{{ (contact?.name || '?')[0] }}</template>
          </div>
          <div class="snoop-forum-author-name">{{ contact?.name || '楼主' }}</div>
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
        <div class="snoop-forum-author-row">
          <div class="snoop-forum-author-avatar" :style="contact?.avatarType === 'image' ? {} : { background: randomColor(contact?.name || '?') }">
            <img v-if="contact?.avatarType === 'image' && contact?.avatar" :src="contact.avatar" class="snoop-forum-author-img" alt="" />
            <template v-else>{{ (contact?.name || '?')[0] }}</template>
          </div>
          <div class="snoop-forum-author-name">{{ contact?.name || '楼主' }}</div>
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
            <template v-if="isOwner(comment.username)">
              <div class="snoop-forum-comment-avatar" :style="contact?.avatarType === 'image' && contact?.avatar ? {} : { background: ownerAvatarColor }">
                <img v-if="contact?.avatarType === 'image' && contact?.avatar" :src="contact.avatar" class="snoop-forum-comment-avatar-img" alt="" />
                <template v-else>{{ (contact?.name || '?')[0] }}</template>
              </div>
            </template>
            <div v-else class="snoop-forum-comment-avatar snoop-forum-avatar-clickable" :style="{ background: randomColor(comment.username) }" @click.stop="showPersona(comment, selectedPost.comments)">
              {{ comment.username?.charAt(0) || '?' }}
            </div>
            <div class="snoop-forum-comment-body">
              <div class="snoop-forum-comment-user">
                {{ comment.username }}
                <span v-if="comment.isOwner" class="snoop-forum-owner-badge">楼主</span>
              </div>
              <div
                class="snoop-forum-comment-text"
                :class="{ 'snoop-forum-comment-editing': isEditing('comment', ci) }"
                :contenteditable="isEditing('comment', ci)"
                @dblclick="startEdit(comment, 'comment', ci, $event)"
                @touchstart="onTouchStart($event, comment, 'comment', ci)"
                @touchend="onTouchEnd"
                @blur="saveEdit(comment, $event)"
                @keydown.enter.prevent="handleEnter($event)"
                @keydown.escape.prevent="cancelEdit($event)"
              >{{ comment.content }}</div>
              <div class="snoop-forum-comment-meta">
                <span class="snoop-forum-time">{{ comment.time }}</span>
                <span class="snoop-forum-likes">
                  <i class="ph ph-heart text-[11px]"></i> {{ comment.likes }}
                </span>
                <span class="snoop-forum-reply-btn" @click="startReply(comment, comment.username)">回复</span>
                <span class="snoop-forum-ai-btn" @click="aiReplyToComment(selectedPost, comment)">AI</span>
                <span class="snoop-forum-layer-btn" @click="layerOwnerReply(selectedPost, comment)">层主</span>
                <span class="snoop-forum-del-btn" @click="deleteComment(comment)">删除</span>
              </div>
            </div>

            <!-- Nested replies (楼中楼) -->
            <div v-if="comment.replies?.length" class="snoop-forum-nested-replies">
              <div
                v-for="(reply, ri) in comment.replies"
                :key="ri"
                class="snoop-forum-nested-reply"
              >
                <template v-if="isOwner(reply.username)">
                  <div class="snoop-forum-comment-avatar snoop-forum-nested-avatar" :style="contact?.avatarType === 'image' && contact?.avatar ? {} : { background: ownerAvatarColor }">
                    <img v-if="contact?.avatarType === 'image' && contact?.avatar" :src="contact.avatar" class="snoop-forum-comment-avatar-img" alt="" style="width:22px;height:22px;border-radius:50%;object-fit:cover;" />
                    <template v-else>{{ (contact?.name || '?')[0] }}</template>
                  </div>
                </template>
                <div v-else class="snoop-forum-comment-avatar snoop-forum-nested-avatar snoop-forum-avatar-clickable"
                  :style="{ background: randomColor(reply.username), width: '22px', height: '22px', fontSize: '11px' }"
                  @click.stop="showPersona(reply, selectedPost.comments)">
                  {{ reply.username?.charAt(0) || '?' }}
                </div>
                <div class="snoop-forum-comment-body">
                  <div class="snoop-forum-comment-user">
                    {{ reply.username }}
                    <span v-if="reply.isOwner" class="snoop-forum-owner-badge">楼主</span>
                    <span v-if="reply.replyTo" class="snoop-forum-reply-to"> 回复 {{ reply.replyTo }}</span>
                  </div>
                  <div
                  class="snoop-forum-comment-text"
                  :class="{ 'snoop-forum-comment-editing': isEditing('reply', ci, ri) }"
                  :contenteditable="isEditing('reply', ci, ri)"
                  @dblclick="startEdit(reply, 'reply', ci, ri, $event)"
                  @touchstart="onTouchStart($event, reply, 'reply', ci, ri)"
                  @touchend="onTouchEnd"
                  @blur="saveEdit(reply, $event)"
                  @keydown.enter.prevent="handleEnter($event)"
                  @keydown.escape.prevent="cancelEdit($event)"
                >{{ reply.content }}</div>
                  <div class="snoop-forum-comment-meta">
                    <span class="snoop-forum-time">{{ reply.time }}</span>
                    <span class="snoop-forum-likes">
                      <i class="ph ph-heart text-[11px]"></i> {{ reply.likes }}
                    </span>
                    <span class="snoop-forum-reply-btn" @click="startReply(comment, reply.username)">回复</span>
                    <span class="snoop-forum-ai-btn" @click="aiReplyToNested(selectedPost, comment, reply)">AI</span>
                    <span class="snoop-forum-layer-btn" @click="layerOwnerReply(selectedPost, comment, reply)">层主</span>
                    <span class="snoop-forum-del-btn" @click="deleteNestedReply(comment, ri)">删除</span>
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

    <!-- Persona popup modal -->
    <div v-if="personaPopup" class="snoop-persona-overlay" @click="personaPopup = null">
      <div class="snoop-persona-popup" @click.stop>
        <div class="snoop-persona-header">
          <div class="snoop-persona-avatar" :style="{ background: randomColor(personaPopup.username) }">
            {{ personaPopup.username?.charAt(0) || '?' }}
          </div>
          <div class="snoop-persona-name">{{ personaPopup.username }}</div>
          <button class="snoop-persona-close" @click="personaPopup = null">
            <i class="ph ph-x text-[18px]"></i>
          </button>
        </div>
        <div class="snoop-persona-body">
          <div class="snoop-persona-label">人物简介</div>
          <div class="snoop-persona-text">{{ personaPopup.persona || '暂无描述' }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
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

/** Check if a username matches the phone owner */
function isOwner(username) {
  return username === props.contact?.name
}

/** Consistent background color for owner avatar */
const ownerAvatarColor = '#007aff'
defineEmits(['retry', 'toggle-select'])

const selectedPost = ref(null)
const generating = ref(false)
const genErr = ref('')
const commentInput = ref('')
const replyingTo = ref('')

// Nested reply state
const replyTarget = ref(null)
const editingItem = ref(null)  // { type: 'comment'|'reply', ci, ri? }
const editingBuffer = ref('')

// 双击编辑自动聚焦
watch(editingItem, async (val) => {
  if (val) {
    await nextTick()
    document.querySelector('.snoop-forum-edit-textarea')?.focus()
  }
})

const replyInput = ref('')
const replyTo = ref('')
const replyInputRef = ref(null)
const personaPopup = ref(null)

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
      const history = buildConversationHistory(comment)
      const replyBack = await generateUserReply(props.contact, post, replyToName, text, '匿名网友', findUserPersona(selectedPost.value?.comments, replyToName), history)
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

}

/** Find a user's persona from the comments array */
function findUserPersona(comments, username) {
  if (!comments?.length || !username) return ''
  for (const c of comments) {
    if (c.username === username) return c.persona || ''
    if (c.replies?.length) {
      for (const r of c.replies) {
        if (r.username === username) return r.persona || ''  // fallback to comment's persona
      }
    }
  }
  return ''
}

/** Show persona popup for a comment user */
function showPersona(item, allComments) {
  // If the item itself has a persona, use it directly
  if (item.persona) {
    personaPopup.value = item
    return
  }
  // Otherwise, look it up in the comments array
  const persona = findUserPersona(allComments, item.username)
  if (persona) {
    personaPopup.value = { ...item, persona }
  } else {
    // Still show popup but with empty persona
    personaPopup.value = item
  }
}

/** Build conversation history from a comment's replies thread */
function buildConversationHistory(comment) {
  if (!comment.replies?.length) return ''
  const lines = []
  for (const r of comment.replies) {
    const replyToStr = r.replyTo ? '(回复' + r.replyTo + ')' : ''
    lines.push(r.username + replyToStr + '：「' + r.content + '」')
  }
  return lines.join('\n')
}

/** Phone owner replies under the user's top-level comment */
async function ownerReplyToComment(post, userComment) {
  const ownerName = props.contact?.name || '楼主'
  replyingTo.value = ownerName + ' 正在回复...'
  try {
    const ownerReply = await generateOwnerReplyToComment(props.contact, post, userComment, selectedPost.value?.comments)
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
    const ownerReply = await generateOwnerNestedReply(props.contact, post, targetComment, userNested, selectedPost.value?.comments)
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
    const ownerReply = await generateOwnerReplyToComment(props.contact, post, comment, selectedPost.value?.comments)
    setTimeout(async () => {
      if (!comment.replies) comment.replies = []
      ownerReply.replyTo = comment.username
      comment.replies.push(ownerReply)
      replyingTo.value = ''

      // 2) The comment author chimes back responding to the owner's reply
      try {
        const byHistory = buildConversationHistory(comment)
        const byReply = await generateBystanderReply(props.contact, post, comment, ownerReply.content, ownerName, comment.persona, byHistory)
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
    const ownerReply = await generateOwnerNestedReply(props.contact, post, comment, targetReply, selectedPost.value?.comments)
    setTimeout(async () => {
      if (!comment.replies) comment.replies = []
      ownerReply.replyTo = targetReply.username
      comment.replies.push(ownerReply)
      replyingTo.value = ''

      // 2) The person being replied to chimes back
      try {
        const byHistory2 = buildConversationHistory(comment)
        const byReply = await generateUserReply(props.contact, post, targetReply.username, ownerReply.content, ownerName, findUserPersona(selectedPost.value?.comments, targetReply.username), byHistory2)
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

/** 层主 button: layer owner (层主) starts a reply, then the other person chimes back */
async function layerOwnerReply(post, comment, reply) {
  const ownerName = props.contact?.name || '楼主'
  replyingTo.value = comment.username + ' 正在回复...'
  try {
    // Determine who the layer owner is replying to
    const targetName = reply ? reply.username : ownerName
    const triggerContent = reply ? reply.content : post.content

    const history = buildConversationHistory(comment)

    // Step 1: Layer owner actively replies to target
    const layerReply = await generateUserReply(
      props.contact, post, comment.username,
      triggerContent, targetName,
      findUserPersona(selectedPost.value?.comments, comment.username),
      history, true  // isActive = true → 层主主动回复
    )

    setTimeout(async () => {
      if (!comment.replies) comment.replies = []
      layerReply.replyTo = targetName
      comment.replies.push(layerReply)
      replyingTo.value = ''

      // Step 2: The replied person chimes back
      try {
        const byHistory = buildConversationHistory(comment)
        if (targetName === ownerName) {
          // If layer owner replied to the phone owner → owner chimes back
          const ownerBack = await generateOwnerNestedReply(
            props.contact, post, comment, layerReply,
            selectedPost.value?.comments
          )
          ownerBack.replyTo = comment.username
          comment.replies.push(ownerBack)
        } else {
          // If layer owner replied to another user → that user chimes back
          const byReply = await generateUserReply(
            props.contact, post, targetName,
            layerReply.content, comment.username,
            findUserPersona(selectedPost.value?.comments, targetName),
            byHistory
          )
          byReply.replyTo = comment.username
          comment.replies.push(byReply)
        }
      } catch {
        // chime-back failed silently
      }
    }, 800)
  } catch (e) {
    console.error('[层主] 生成失败:', e)
    replyingTo.value = ''
  }
}

/** Delete a top-level comment */
function startEdit(item, type, ci, ri, $event) {
  editingItem.value = { type, ci, ri: ri ?? -1 }
  editingBuffer.value = item.content
  nextTick(() => {
    const el = $event?.target
    if (el) {
      el.focus()
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(el)
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    }
  })
}
function saveEdit(item, $event) {
  if (!editingItem.value) return
  const newContent = $event?.target?.innerText?.trim()
  if (newContent) {
    item.content = newContent
  }
  $event?.target?.blur()
  editingItem.value = null
  editingBuffer.value = ''
}
function handleEnter($event) {
  $event.target.blur()
}
function cancelEdit($event) {
  if ($event?.target) {
    $event.target.innerText = editingBuffer.value
  }
  editingItem.value = null
  editingBuffer.value = ''
}
let touchTimer = null
function onTouchStart($event, item, type, ci, ri) {
  touchTimer = setTimeout(() => {
    startEdit(item, type, ci, ri, $event)
  }, 500)
}
function onTouchEnd() {
  clearTimeout(touchTimer)
}

function isEditing(type, ci, ri) {
  const e = editingItem.value
  if (!e) return false
  if (e.type !== type) return false
  if (e.ci !== ci) return false
  if (type === 'reply' && e.ri !== ri) return false
  return true
}

function deleteComment(comment) {
  if (!selectedPost.value?.comments) return
  const idx = selectedPost.value.comments.indexOf(comment)
  if (idx !== -1) {
    selectedPost.value.comments.splice(idx, 1)
  }
}

/** Delete a nested reply by index */
function deleteNestedReply(comment, replyIdx) {
  if (!comment.replies?.length) return
  comment.replies.splice(replyIdx, 1)
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

.snoop-forum-author-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.snoop-forum-author-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
}
.snoop-forum-author-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.snoop-forum-author-name {
  font-size: 13px;
  font-weight: 500;
  color: #1c1c1e;
}
.dark .snoop-forum-author-name { color: #f5f5f7; }
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
  overflow: hidden;
}

.snoop-forum-comment-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
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

.snoop-forum-del-btn {
  font-size: 11px;
  color: #8e8e93;
  cursor: pointer;
  user-select: none;
  margin-left: 8px;
  font-weight: 600;
}

.snoop-forum-del-btn:hover {
  color: #ff3b30;
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

/* Persona popup */
.snoop-forum-avatar-clickable {
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
}
.snoop-forum-avatar-clickable:hover {
  transform: scale(1.1);
  opacity: 0.85;
}

.snoop-persona-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: snoop-fade-in 0.2s ease;
}
.snoop-persona-popup {
  background: #fff;
  border-radius: 16px;
  width: 320px;
  max-width: 85vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  animation: snoop-scale-in 0.25s ease;
  overflow: hidden;
}
.dark .snoop-persona-popup {
  background: #2c2c2e;
}
.snoop-persona-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 0;
  position: relative;
}
.snoop-persona-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  flex-shrink: 0;
}
.snoop-persona-name {
  font-size: 16px;
  font-weight: 600;
}
.snoop-persona-close {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: inherit;
  transition: background 0.15s;
}
.dark .snoop-persona-close {
  background: rgba(255, 255, 255, 0.08);
}
.snoop-persona-close:hover {
  background: rgba(0, 0, 0, 0.1);
}
.dark .snoop-persona-close:hover {
  background: rgba(255, 255, 255, 0.15);
}
.snoop-persona-body {
  padding: 16px 20px 20px;
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

@keyframes snoop-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes snoop-scale-in {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

</style>
