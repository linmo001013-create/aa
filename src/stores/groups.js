import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGroupsStore = defineStore('groups', () => {
  const groups = ref([])

  function createGroup(data) {
    const newGroup = {
      id: 'g_' + Date.now(),
      type: 'group',
      name: data.name || '未命名群聊',
      groupMode: data.groupMode || 'single',
      configId: data.configId || '',
      personaId: data.personaId || '',
      boundLorebooks: data.boundLorebooks ? [...data.boundLorebooks] : [],
      mcpServerIds: data.mcpServerIds ? [...data.mcpServerIds] : [],
      members: data.members ? JSON.parse(JSON.stringify(data.members)).map(m => ({
        ...m,
        // 备份头像原始数据，避免被外部化机制替换为 blob URL 后丢失
        avatarBackup: m.avatarType === 'image' ? (m.avatar || '') : ''
      })) : [],
      msgs: [],
      maxMessages: data.maxMessages ?? 100,
      chatBackground: data.chatBackground || '',
      callHistory: [],
      unreadCount: 0,
      createdAt: Date.now()
    }
    groups.value.unshift(newGroup)
    return newGroup
  }

  function updateGroup(id, data) {
    const idx = groups.value.findIndex(g => g.id === id)
    if (idx === -1) return null
    const group = groups.value[idx]
    if (data.name !== undefined) group.name = data.name
    if (data.groupMode !== undefined) group.groupMode = data.groupMode
    if (data.configId !== undefined) group.configId = data.configId
    if (data.personaId !== undefined) group.personaId = data.personaId
    if (data.boundLorebooks !== undefined) group.boundLorebooks = [...data.boundLorebooks]
    if (data.mcpServerIds !== undefined) group.mcpServerIds = [...data.mcpServerIds]
    if (data.members !== undefined) {
      group.members = JSON.parse(JSON.stringify(data.members))
      // 更新成员时同步备份头像，防止外部化机制丢失
      group.members.forEach((member) => {
        if (member && member.avatarType === 'image' && typeof member.avatar === 'string' && member.avatar.startsWith('data:')) {
          member.avatarBackup = member.avatar
        }
      })
    }
    if (data.maxMessages !== undefined) group.maxMessages = data.maxMessages
    if (data.chatBackground !== undefined) group.chatBackground = data.chatBackground
    if (data.unreadCount !== undefined) group.unreadCount = data.unreadCount
    return group
  }

  function deleteGroup(id) {
    const idx = groups.value.findIndex(g => g.id === id)
    if (idx === -1) return false
    groups.value.splice(idx, 1)
    return true
  }

  function getGroupById(id) {
    return groups.value.find(g => g.id === id) || null
  }

  function updateGroupMsgs(id, msgs) {
    const group = getGroupById(id)
    if (group) {
      group.msgs = msgs
    }
  }

  return {
    groups,
    createGroup,
    updateGroup,
    deleteGroup,
    getGroupById,
    updateGroupMsgs
  }
})
