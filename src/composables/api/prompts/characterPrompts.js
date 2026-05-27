export function buildPersonaSystemPrompt(store, contactId) {
  const persona = store.getPersonaForContact(contactId)
  if (!persona) return ''
  const lines = []
  if (persona.name) lines.push('名称：' + persona.name)
  if (persona.description) lines.push('描述：' + persona.description)
  if (lines.length === 0) return ''
  return '用户面具：\n' + lines.join('\n')
}

export function buildGroupSystemPrompt(members) {
  const memberList = members.map(m => {
    let desc = `- ${m.name}`
    if (m.prompt) desc += `：${m.prompt}`
    return desc
  }).join('\n')

  return `你正在模拟一个群聊场景。群里有以下成员：
${memberList}

重要规则：
1. 群里的每一位成员都必须对用户的最新消息做出自己的回复，不能只有部分成员回复。
2. 每个角色发言占一行，格式：[角色名]: 内容（如 [${members[0]?.name || '角色'}]: 你好！）。
3. 严格按照各自的人设和性格来回复，保持角色之间性格的差异化。
4. 每位成员的回复内容要体现其独特的个性、语气和态度。`
}
