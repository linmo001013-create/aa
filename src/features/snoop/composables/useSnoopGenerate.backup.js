import { getTemplateVars, applyTemplateVars } from '../../../composables/api/prompts'
import {
  buildSnoopRolePrompt,
  createSnoopError,
  createSnoopPromptContext,
  getResolvedSnoopConfig,
  normalizeSnoopApiError,
  requestSnoopChatCompletion
} from '../../../composables/snoop/shared'

const CATEGORY_PROMPTS = {
  browser: {
    label: '浏览器历史和搜索记录',
    userPrompt: `现在请你模拟{{char}}手机里的浏览器历史和搜索记录。
根据{{char}}的性格、身份、爱好、最近的对话内容，生成10-15条浏览记录和3-5条搜索记录。
其中应有1-2条比较隐私或意想不到的内容（不需要太夸张）。

请严格以JSON数组输出，不要加任何其他文字：
[{"type":"history"或"search","title":"网页/搜索标题","url":"简短URL","time":"x小时前/昨天/x天前"}]`
  },
  notes: {
    label: '备忘录/便签',
    userPrompt: `现在请你模拟{{char}}手机里的备忘录/便签内容。
生成5-8条，包括：待办事项、随手想法、购物清单、日记片段、密码备忘等。
其中应有1-2条比较私密或有趣的内容。

请严格以JSON数组输出，不要加任何其他文字：
[{"title":"标题","content":"正文内容（可以多行）","time":"日期","pinned":true或false}]`
  },
  chats: {
    label: '和朋友的聊天记录',
    userPrompt: `现在请你模拟{{char}}手机里和朋友的聊天记录。
生成2-3段和不同朋友的对话。每段对话5-8条消息。
朋友的名字和关系由你根据{{char}}的身份设定。聊天中可能提到{{user}}。

请严格以JSON数组输出，不要加任何其他文字：
[{"friend":"朋友名","relationship":"关系简述","msgs":[{"from":"friend"或"self","content":"消息内容","time":"时间"}]}]`
  },
  album: {
    label: '相册',
    userPrompt: `现在请你模拟{{char}}手机相册里最近的8-12张照片。
用文字描述每张照片的内容（自拍、风景、食物、截图、合照等）。
其中可能有1-2张比较有故事或有趣的照片。

请严格以JSON数组输出，不要加任何其他文字：
[{"desc":"照片内容描述","time":"日期","tag":"自拍"或"风景"或"美食"或"截图"或"合照"或"其他"}]`
  },
  forum: {
    label: '论坛/社交平台发言',
    userPrompt: `现在请你模拟{{char}}在各种网络论坛/社交平台上的发言历史。
生成6-10条，包括发帖和回帖，涉及不同话题和平台。
内容要符合{{char}}的性格、兴趣和说话风格。

请严格以JSON数组输出，不要加任何其他文字：
[{"platform":"平台名","type":"post"或"reply","title":"帖子标题","content":"{{char}}的发言内容","time":"日期","likes":数字}]`
  }
}

function stripMarkdownCodeFence(text) {
  const raw = String(text || '').trim()
  const match = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return match?.[1]?.trim() || raw
}

function parseJsonValue(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function extractArrayFromObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const preferredKeys = ['items', 'data', 'list', 'results', 'records', 'history', 'notes', 'chats', 'messages', 'photos', 'posts']
  for (const key of preferredKeys) {
    if (Array.isArray(value[key])) return value[key]
    if (value[key] && typeof value[key] === 'object' && Array.isArray(value[key].items)) return value[key].items
  }

  const arrayValues = Object.values(value).filter(Array.isArray)
  if (arrayValues.length === 1) return arrayValues[0]
  return null
}

function sanitizeBrowserItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      type: item.type === 'search' ? 'search' : 'history',
      title: String(item.title || item.content || item.name || '').trim(),
      url: String(item.url || item.link || '').trim(),
      time: String(item.time || item.date || '').trim()
    }))
}

function sanitizeNoteItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      title: String(item.title || item.name || '').trim(),
      content: String(item.content || item.text || item.body || '').trim(),
      time: String(item.time || item.date || '').trim(),
      pinned: item.pinned === true
    }))
}

function sanitizeChatItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      friend: String(item.friend || item.name || item.contact || '联系人').trim(),
      relationship: String(item.relationship || item.remark || '').trim(),
      msgs: Array.isArray(item.msgs || item.messages)
        ? (item.msgs || item.messages)
          .filter(msg => msg && typeof msg === 'object')
          .map(msg => ({
            from: msg.from === 'self' ? 'self' : 'friend',
            content: String(msg.content || msg.text || '').trim(),
            time: String(msg.time || msg.date || '').trim()
          }))
        : []
    }))
}

function sanitizeAlbumItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      desc: String(item.desc || item.description || item.content || '').trim(),
      time: String(item.time || item.date || '').trim(),
      tag: String(item.tag || item.type || '其他').trim() || '其他'
    }))
}

function sanitizeForumItems(items) {
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      platform: String(item.platform || item.app || '').trim(),
      type: item.type === 'reply' ? 'reply' : 'post',
      title: String(item.title || '').trim(),
      content: String(item.content || item.text || '').trim(),
      time: String(item.time || item.date || '').trim(),
      likes: Number.isFinite(Number(item.likes)) ? Number(item.likes) : 0
    }))
}

function normalizeCategoryItems(category, items) {
  if (!Array.isArray(items)) return null
  if (category === 'browser') return sanitizeBrowserItems(items)
  if (category === 'notes') return sanitizeNoteItems(items)
  if (category === 'chats') return sanitizeChatItems(items)
  if (category === 'album') return sanitizeAlbumItems(items)
  if (category === 'forum') return sanitizeForumItems(items)
  return items
}

function extractJsonArray(text) {
  const raw = String(text || '').trim()
  if (!raw) return null

  const candidates = [
    raw,
    stripMarkdownCodeFence(raw)
  ]

  const arrayMatch = raw.match(/\[[\s\S]*\]/)
  if (arrayMatch?.[0]) candidates.push(arrayMatch[0])

  const objectMatch = raw.match(/\{[\s\S]*\}/)
  if (objectMatch?.[0]) candidates.push(objectMatch[0])

  for (const candidate of candidates) {
    const parsed = parseJsonValue(candidate)
    if (Array.isArray(parsed)) return parsed
    const extracted = extractArrayFromObject(parsed)
    if (Array.isArray(extracted)) return extracted
  }

  return null
}

/**
 * Generate a phone owner reply to a user's top-level comment (no self-reply chain)
 * @param {Object} contact - The phone owner contact
 * @param {Object} post - The forum post
 * @param {Object} userComment - The user's top-level comment
 * @returns {Object} Owner reply {username, content, time, likes, isOwner: true}
 */
export async function generateOwnerReplyToComment(contact, post, userComment) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  const name = contact.name || '念白'

  const systemParts = [baseSystemPrompt]
  systemParts.push(`你是${name}，正在逛论坛。

帖子：${post.content}

你看到用户「${userComment.username}」评论了你，他说：「${userComment.content}」

请以你自己的身份、第一人称视角，只针对「${userComment.content}」这句来回复。语气自然生活化，就像平时聊天一样。只说一句话，15-40字左右。`)

  const systemPrompt = systemParts.join('\n')

  const userPrompt = `帖子：${post.content}
用户评论：${userComment.content}

直接以第一人称回复用户这句，JSON输出：
{"content":"回复内容","time":"刚刚","likes":数字}`

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsed = parseJsonValue(stripMarkdownCodeFence(raw))
  if (!parsed || typeof parsed !== 'object') {
    throw createSnoopError('AI 返回格式错误', '生成评论没有按要求返回 JSON')
  }

  return {
    username: name,
    content: String(parsed.content || parsed.text || '').trim(),
    time: String(parsed.time || parsed.date || '刚刚').trim(),
    likes: Number.isFinite(Number(parsed.likes)) ? Number(parsed.likes) : 0,
    isOwner: true
  }
}

/**
 * Generate a nested reply from the phone owner under a comment thread (third-party observer)
 * @param {Object} contact - The phone owner contact
 * @param {Object} post - The forum post
 * @param {Object} targetComment - The top-level comment being discussed
 * @param {Object} userReply - The user's nested reply that triggered this
 * @returns {Object} Owner nested reply {username, content, time, likes, isOwner: true}
 */
export async function generateOwnerNestedReply(contact, post, targetComment, userReply) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  const name = contact.name || '念白'

  // Build context: the comment thread so far (avoid duplicate user reply)
  const threadLines = [`${targetComment.username}：${targetComment.content}`]
  let alreadyHasUserReply = false
  if (targetComment.replies?.length) {
    targetComment.replies.forEach(r => {
      if (r.username === userReply.username && r.content === userReply.content) {
        alreadyHasUserReply = true
      } else {
        threadLines.push(`  ↳ ${r.username}：${r.content}`)
      }
    })
  }
  if (!alreadyHasUserReply) {
    threadLines.push(`  ↳ 匿名网友：${userReply.content}`)
  }
  const threadContext = threadLines.join('\n')

  const systemParts = [baseSystemPrompt]
  systemParts.push(`你是${name}，正在逛论坛。

你在评论区说过：「${targetComment.content}」

现在用户「匿名网友」回复了你，他对你说：「${userReply.content}」

请以你自己的身份、第一人称视角，只针对「${userReply.content}」这句来回复。语气自然生活化，就像平时聊天一样。只说一句话，15-40字左右。`)

  const systemPrompt = systemParts.join('\n')

  const userPrompt = `帖子：${post.content}
你之前说：${targetComment.content}
用户回复你：${userReply.content}

直接以第一人称回复用户这句，JSON输出：
{"content":"回复内容","time":"刚刚","likes":数字}`

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsed = parseJsonValue(stripMarkdownCodeFence(raw))
  if (!parsed || typeof parsed !== 'object') {
    throw createSnoopError('AI 返回格式错误', '生成评论没有按要求返回 JSON')
  }

  return {
    username: name,
    content: String(parsed.content || parsed.text || '').trim(),
    time: String(parsed.time || parsed.date || '刚刚').trim(),
    likes: Number.isFinite(Number(parsed.likes)) ? Number(parsed.likes) : 0,
    isOwner: true
  }
}

/**
 * Generate forum comments for a specific post
 * @param {Object} contact - The phone owner contact
 * @param {Object} post - The forum post to generate comments for
 * @returns {Array} New comments [{username, content, time, likes}]
 */
export async function generateForumComments(contact, post) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  const systemParts = [baseSystemPrompt]
  systemParts.push(`你正在模拟论坛/社交平台上其他用户对一篇帖子的评论。
帖子发布于「${post.platform || '论坛'}」，标题是「${post.title || ''}」，内容是「${post.content}」。
请生成2-3个不同用户的评论，这些用户互相不认识，观点各不相同（可以赞同、反对、吐槽、补充等）。
用户名要有真实感，不要用"用户123"这种。给每个评论随机分配0-5个赞。`)

  const systemPrompt = systemParts.join('\n\n')

  const userPrompt = `帖子内容：${post.content}
${post.title ? '标题：' + post.title : ''}

请生成2-3条评论，以JSON数组输出：
[{"username":"用户名","content":"评论内容","time":"刚刚/1分钟前/5分钟前","likes":数字}]`

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsed = extractJsonArray(raw)
  if (!Array.isArray(parsed)) {
    console.warn('[论坛评论] 解析失败, raw:', raw)
    throw createSnoopError('AI 返回格式错误', '生成评论没有按要求返回 JSON 数组')
  }

  const result = parsed
    .filter(c => c && typeof c === 'object')
    .map(c => ({
      username: String(c.username || c.name || c.user || '匿名用户').trim(),
      content: String(c.content || c.text || c.comment || '').trim(),
      time: String(c.time || c.date || '刚刚').trim(),
      likes: Number.isFinite(Number(c.likes)) ? Number(c.likes) : 0
    }))
    .filter(c => c.content)

  console.log(`[论坛评论] 成功生成 ${result.length} 条评论`)
  return result
}

/**
 * Generate a nested reply from the original comment author when user replies to them
 * @param {Object} contact - The phone owner contact
 * @param {Object} post - The forum post
 * @param {Object} targetComment - The comment being replied to
 * @param {Object} userReply - The user's reply content
 * @returns {Object} Reply comment {username, content, time, likes}
 */
export async function generateBystanderReply(contact, post, targetComment, userReply) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  const systemParts = [baseSystemPrompt]
  systemParts.push(`你正在模拟论坛用户之间的互相回复。
帖子发布于「${post.platform || '论坛'}」，标题是「${post.title || ''}」，内容是「${post.content}」。
用户「${targetComment.username}」之前评论说：「${targetComment.content}」
现在「匿名网友」回复了「${targetComment.username}」说：「${userReply}」
请以「${targetComment.username}」的身份，自然地回复匿名网友的这条回复。不要自己重复自己的话。`)

  const systemPrompt = systemParts.join('\n\n')

  const userPrompt = `帖子：${post.content}
${targetComment.username} 之前说：${targetComment.content}
匿名网友回复 ${targetComment.username}：${userReply}

请以 ${targetComment.username} 的身份回复匿名网友，JSON输出：
{"content":"回复内容","time":"刚刚/1分钟前","likes":数字}`

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsed = parseJsonValue(stripMarkdownCodeFence(raw))
  if (!parsed || typeof parsed !== 'object') {
    throw createSnoopError('AI 返回格式错误', '生成回复没有按要求返回 JSON')
  }

  return {
    username: targetComment.username,
    content: String(parsed.content || parsed.text || '').trim(),
    time: String(parsed.time || parsed.date || '刚刚').trim(),
    likes: Number.isFinite(Number(parsed.likes)) ? Number(parsed.likes) : 0
  }
}

/**
 * Generate a top-level comment from the phone owner joining the conversation
 * @param {Object} contact - The phone owner contact
 * @param {Object} post - The forum post
 * @param {Array} allComments - All current comments + replies for context
 * @returns {Object} Owner comment {username, content, time, likes, isOwner: true}
 */
export async function generateOwnerComment(contact, post, allComments) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  const name = contact.name || '念白'

  // Build context from recent comments
  const recentLines = (allComments || []).slice(-5).map(c => {
    const line = `${c.username}：${c.content}`
    if (c.replies?.length) {
      return line + '\n' + c.replies.map(r => `  ↳ ${r.username}：${r.content}`).join('\n\n')
    }
    return line
  }).join('\n\n')

  const systemParts = [baseSystemPrompt]
  systemParts.push(`你正在以「${name}」的身份浏览论坛帖子。
帖子平台：${post.platform || '论坛'}，标题：${post.title || ''}，内容：${post.content}
你看到评论区里大家在聊天，也想参与进去说几句。
请自然地以「${name}」的口吻发表一条新的评论。
要有自己的观点，可以是对帖子的感受，也可以是对其他用户评论的回应。
语气自然生活化，有个人特色。`)

  const systemPrompt = systemParts.join('\n\n')

  const userPrompt = `帖子：${post.content}
评论区讨论：
${recentLines || '还没有人评论'}

请以 ${name} 的身份发表一条新评论，JSON输出：
{"content":"评论内容","time":"刚刚","likes":数字}`

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsed = parseJsonValue(stripMarkdownCodeFence(raw))
  if (!parsed || typeof parsed !== 'object') {
    throw createSnoopError('AI 返回格式错误', '生成评论没有按要求返回 JSON')
  }

  return {
    username: name,
    content: String(parsed.content || parsed.text || '').trim(),
    time: String(parsed.time || parsed.date || '刚刚').trim(),
    likes: Number.isFinite(Number(parsed.likes)) ? Number(parsed.likes) : 0,
    isOwner: true
  }
}

/**
 * Generate a single AI reply to a specific forum comment
 * @param {Object} contact - The phone owner contact
 * @param {Object} post - The forum post being discussed
 * @param {Object} comment - The comment to reply to
 * @returns {Object} Reply comment {username, content, time, likes}
 */
export async function generateForumCommentReply(contact, post, comment) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  const systemParts = [baseSystemPrompt]
  systemParts.push(`你正在模拟论坛/社交平台上其他用户回复别人的评论。
帖子发布在「${post.platform || '论坛'}」，标题是「${post.title || ''}」，内容是「${post.content}」。
用户「${comment.username}」评论说：「${comment.content}」
请以另一个不同的用户的身份，自然地对这条评论进行回复。
用户名要有真实感，不要用"用户123"或"匿名网友"这种。给回复随机分配0-5个赞。`)

  const systemPrompt = systemParts.join('\n\n')

  const userPrompt = `帖子内容：${post.content}
用户「${comment.username}」说：${comment.content}

请用另一个用户的身份回复这条评论，以JSON对象输出：
{"username":"用户名","content":"回复内容","time":"刚刚/1分钟前","likes":数字}`

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsed = parseJsonValue(stripMarkdownCodeFence(raw))
  if (!parsed || typeof parsed !== 'object') {
    console.warn('[论坛回复] 解析失败, raw:', raw)
    throw createSnoopError('AI 返回格式错误', '生成回复没有按要求返回 JSON')
  }

  const result = {
    username: String(parsed.username || parsed.name || parsed.user || '匿名用户').trim(),
    content: String(parsed.content || parsed.text || '').trim(),
    time: String(parsed.time || parsed.date || '刚刚').trim(),
    likes: Number.isFinite(Number(parsed.likes)) ? Number(parsed.likes) : 0
  }

  if (!result.content) throw createSnoopError('AI 返回为空', '回复内容为空')

  console.log(`[论坛回复] ${result.username} 回复了 ${comment.username}: ${result.content}`)
  return result
}

/**
 * Generate an AI reply as the contact ("self") in a joined chat
 * @param {Object} contact - The phone owner contact
 * @param {string} friendName - The friend's name (user's role)
 * @param {Array} msgs - All messages in the conversation so far
 * @param {string} relationship - Optional relationship description
 * @param {string} userMsg - The message the user just sent as "friend"
 * @returns {Object} AI's reply message {from: 'self', content, time}
 */
export async function generateChatReply(contact, friendName, msgs = [], relationship = '', userMsg) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  // Build conversation log
  const recentMsgs = msgs.slice(-20)
  const chatLines = recentMsgs.map(m => {
    const who = m.from === 'self' ? contact.name : friendName
    return who + ': ' + m.content
  })
  const chatLog = chatLines.join('\n')

  const systemParts = [baseSystemPrompt]
  systemParts.push('你正在模拟手机的微信聊天界面。')
  systemParts.push(`你和「${friendName}」${relationship ? `（${relationship}）` : ''}在聊天。`)
  systemParts.push(`${friendName}刚刚给你发了一条消息，请你以「${contact.name}」的身份自然回复，就像平时的微信聊天一样。`)
  systemParts.push('只说一句话作为回复，不要带任何前缀或格式，就像真的在微信里打字那样。回复不要太长，15-30字左右即可，符合你们的日常聊天风格。')

  const systemPrompt = systemParts.join('\n\n')

  const userPrompt = `以下是你们最近的聊天记录：
${chatLog || '（还没有聊过天）'}

${friendName}刚才说：${userMsg}

请回复${friendName}：`

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const reply = String(raw || '').replace(/^["']|["']$/g, '').trim()
  if (!reply) {
    throw createSnoopError('AI 回复为空', '没有生成回复内容')
  }

  console.log(`[加入聊天] ${contact.name} 回复: ${reply}`)
  return {
    from: 'self',
    content: reply,
    time: '刚刚'
  }
}
/**
 * Generate phone content for a specific category
 */
export async function generateSnoopContent(contact, category) {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  const categoryDef = CATEGORY_PROMPTS[category]
  if (!categoryDef) throw new Error('未知分类: ' + category)

  const systemParts = [baseSystemPrompt]
  systemParts.push(`你现在需要模拟你手机中${categoryDef.label}的内容。请根据你的性格、身份、爱好、日常生活和最近的对话内容来生成真实可信的内容。`)

  const systemPrompt = systemParts.join('\n\n')
  const userPrompt = applyTemplateVars(categoryDef.userPrompt, vars)

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsedItems = extractJsonArray(raw)
  const items = normalizeCategoryItems(category, parsedItems)

  if (!items || !Array.isArray(items)) {
    throw createSnoopError('AI 返回格式错误', `${categoryDef.label}没有按要求返回 JSON 数组`)
  }

  return items
}

/**
 * Generate more messages for a specific chat conversation
 * @param {Object} contact - The phone owner contact
 * @param {string} friendName - The friend's name to continue chatting with
 * @param {Array} existingMsgs - Existing messages in this conversation
 * @param {string} relationship - Optional relationship description
 * @returns {Array} New messages to append
 */
export async function generateMoreChatMsgs(contact, friendName, existingMsgs = [], relationship = '') {
  const cfg = getResolvedSnoopConfig(contact)
  if (!cfg?.url || !cfg?.key) throw new Error('未配置 API：请先在角色配置里填写接口地址和密钥')

  const promptStore = createSnoopPromptContext(contact)
  const vars = getTemplateVars(promptStore, contact.name)
  const { systemPrompt: baseSystemPrompt } = buildSnoopRolePrompt(contact)

  // Build an excerpt of the existing conversation for context
  const recentMsgs = existingMsgs.slice(-10)
  const chatLines = recentMsgs.map(m => {
    const who = m.from === 'self' ? contact.name : friendName
    return who + ': ' + m.content
  })
  const chatLog = chatLines.join('\n')

  const systemParts = [baseSystemPrompt]
  systemParts.push('你正在模拟手机的微信聊天界面。')
  systemParts.push(`你和「${friendName}」${relationship ? `（${relationship}）` : ''}的对话正在进行中。`)
  systemParts.push('请根据你们的关系和说话风格，自然地续写这段对话，生成6-8条新的消息，穿插双方发言。')
  systemParts.push('内容要符合你们的日常聊天习惯，可以聊最近的事、分享见闻、约着出去玩等等。')

  const systemPrompt = systemParts.join('\n\n')

  const userPrompt = `以下是你们最近的部分对话记录：
${chatLog || '（还没有聊过天，现在是第一次发消息）'}

请续写接下来的6-8条消息，继续这段对话。以JSON数组输出，每条消息包含from（"self"或"friend"）、content（消息内容）、time（时间）：
[{"from":"self","content":"消息内容","time":"刚刚"}]`

  let raw = ''
  try {
    raw = await requestSnoopChatCompletion(cfg, systemPrompt, userPrompt)
  } catch (error) {
    throw normalizeSnoopApiError(error)
  }

  const parsed = extractJsonArray(raw)
  if (!Array.isArray(parsed)) {
    console.warn('[续写] 解析失败, raw:', raw)
    throw createSnoopError('AI 返回格式错误', '续写聊天记录没有按要求返回 JSON 数组')
  }

  const result = parsed
    .filter(m => m && typeof m === 'object')
    .map(m => ({
      from: m.from === 'self' ? 'self' : 'friend',
      content: String(m.content || m.text || '').trim(),
      time: String(m.time || m.date || '刚刚').trim()
    }))
    .filter(m => m.content)

  console.log(`[续写] 成功生成 ${result.length} 条消息`)
  return result
}
