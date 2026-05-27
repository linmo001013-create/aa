<template>
  <IosModal
    :visible="visible"
    title="新建群聊"
    height="90%"
    @close="$emit('close')"
    @done="handleSave"
  >
    <div class="p-6 flex flex-col gap-5">
      <!-- 群聊头像预览 -->
      <div class="flex flex-col items-center gap-3">
        <div class="group-avatar-preview">
          <template v-if="form.members.length > 0">
            <div
              v-for="(member, idx) in form.members.slice(0, 4)"
              :key="idx"
              class="group-avatar-item"
              :style="getAvatarPosition(idx, Math.min(form.members.length, 4))"
            >
              <img v-if="member.avatarType === 'image'" :src="member.avatar" class="w-full h-full object-cover">
              <span v-else class="text-sm">{{ member.avatar }}</span>
            </div>
          </template>
          <span v-else class="text-3xl">👥</span>
        </div>
      </div>

      <!-- 群聊名称 -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <input
          v-model="form.name"
          type="text"
          placeholder="群聊名称 (必填)"
          class="w-full px-4 py-3 text-[17px] outline-none bg-transparent dark:text-white"
        >
      </div>

      <!-- 群聊模式 -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">群聊模式</span>
        </div>
        <div
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA] dark:border-gray-700"
          @click="form.groupMode = 'single'"
        >
          <div class="flex-1">
            <div class="text-[17px] text-black dark:text-white">单API模拟</div>
            <div class="text-[13px] text-[#8E8E93]">一个API模拟所有角色对话，成本低</div>
          </div>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center shrink-0 ml-3"
            :class="form.groupMode === 'single' ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'"
          >
            <i v-if="form.groupMode === 'single'" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
        <div
          class="px-4 py-3 flex justify-between items-center cursor-pointer active:bg-gray-100 dark:active:bg-gray-800"
          @click="form.groupMode = 'multi'"
        >
          <div class="flex-1">
            <div class="text-[17px] text-black dark:text-white">多API独立</div>
            <div class="text-[13px] text-[#8E8E93]">每个角色独立API，指定发言人</div>
          </div>
          <div
            class="w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center shrink-0 ml-3"
            :class="form.groupMode === 'multi' ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'"
          >
            <i v-if="form.groupMode === 'multi'" class="ph-bold ph-check text-white text-sm"></i>
          </div>
        </div>
      </div>

      <!-- 已选成员 -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700 flex justify-between items-center">
          <span class="text-[13px] text-[#8E8E93] uppercase">已选成员 ({{ form.members.length }})</span>
        </div>
        <div v-if="form.members.length === 0" class="px-4 py-4 text-[#8E8E93] text-center text-[14px]">
          请从下方联系人列表中选择
        </div>
        <div v-else class="px-4 py-3 flex flex-col gap-2">
          <div
            v-for="member in form.members"
            :key="member.contactId"
            class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F2F2F7] dark:bg-gray-800"
          >
            <div class="w-8 h-8 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-base overflow-hidden shrink-0">
              <img v-if="member.avatarType === 'image'" :src="member.avatar" class="w-full h-full object-cover">
              <span v-else>{{ member.avatar }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[15px] text-black dark:text-white font-medium truncate">{{ member.name }}</div>
              <div class="text-[11px] text-[#8E8E93] mt-[1px] truncate leading-tight">{{ getMemberPromptPreview(member) }}</div>
            </div>
            <button class="text-[#FF3B30] p-1" @click="removeMember(member.contactId)">
              <i class="ph ph-x text-base"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- 联系人列表（可多选添加） -->
      <div class="w-full bg-white dark:bg-[#2c2c2e] rounded-[10px] overflow-hidden">
        <div class="px-4 py-3 border-b border-[#E5E5EA] dark:border-gray-700">
          <span class="text-[13px] text-[#8E8E93] uppercase">联系人列表</span>
        </div>
        <div v-if="availableContacts.length === 0" class="px-4 py-4 text-[#8E8E93] text-center text-[14px]">
          暂无联系人，请先添加联系人
        </div>
        <div v-else class="max-h-[240px] overflow-y-auto">
          <div
            v-for="contact in availableContacts"
            :key="contact.id"
            class="px-4 py-3 flex items-center gap-3 cursor-pointer active:bg-gray-100 dark:active:bg-gray-800 border-b border-[#E5E5EA]/50 dark:border-gray-800"
            @click="toggleMember(contact)"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
              :class="isSelected(contact.id) ? 'bg-[#007AFF] border-[#007AFF]' : 'border-[#C6C6C8]'"
            >
              <i v-if="isSelected(contact.id)" class="ph-bold ph-check text-white text-[10px]"></i>
            </div>
            <div class="w-9 h-9 rounded-full bg-[#E9E9EB] dark:bg-gray-700 flex items-center justify-center text-base overflow-hidden shrink-0">
              <img v-if="contact.avatarType === 'image'" :src="contact.avatar" class="w-full h-full object-cover">
              <span v-else>{{ contact.avatar || '🤖' }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[15px] text-black dark:text-white truncate">{{ contact.name }}</div>
              <div class="text-[11px] text-[#8E8E93] mt-[1px] truncate leading-tight">{{ getContactPersonaDesc(contact) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </IosModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useContactsStore } from '../../../stores/contacts'
import { useGroupsStore } from '../../../stores/groups'
import { usePersonasStore } from '../../../stores/personas'
import { useToast } from '../../../composables/useToast'
import IosModal from '../../../components/common/IosModal.vue'

const props = defineProps({
  visible: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'saved'])

const contactsStore = useContactsStore()
const groupsStore = useGroupsStore()
const personasStore = usePersonasStore()
const { showToast } = useToast()

const form = ref({
  name: '',
  groupMode: 'single',
  members: []
})

const availableContacts = computed(() => {
  return contactsStore.contacts.filter(c => c.type !== 'group')
})

function truncateText(text, maxLen) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

function getMemberPromptPreview(member) {
  if (member.prompt) {
    return truncateText(member.prompt, 40)
  }
  return getContactPersonaDesc({ id: member.contactId })
}

function getContactPersonaDesc(contact) {
  const persona = personasStore.getPersonaForContact(contact.id)
  if (persona?.description) {
    return truncateText(persona.description, 40)
  }
  if (contact.prompt) {
    return truncateText(contact.prompt, 40)
  }
  return '无详细人设'
}

function isSelected(contactId) {
  return form.value.members.some(m => m.contactId === contactId)
}

function toggleMember(contact) {
  const idx = form.value.members.findIndex(m => m.contactId === contact.id)
  if (idx !== -1) {
    form.value.members.splice(idx, 1)
  } else {
    const persona = personasStore.getPersonaForContact(contact.id)
    const personaDesc = persona?.description || ''
    const combinedPrompt = contact.prompt
      ? personaDesc
        ? `${contact.prompt}

${personaDesc}`
        : contact.prompt
      : personaDesc || ''
    form.value.members.push({
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      contactId: contact.id,
      name: contact.name,
      avatar: contact.avatar,
      avatarType: contact.avatarType || 'emoji',
      configId: contact.configId || '',
      prompt: combinedPrompt
    })
  }
}

function removeMember(contactId) {
  const idx = form.value.members.findIndex(m => m.contactId === contactId)
  if (idx !== -1) form.value.members.splice(idx, 1)
}

function getAvatarPosition(idx, total) {
  const size = total === 1 ? '100%' : '50%'
  let top = '0'
  let left = '0'
  if (total === 2) {
    left = idx === 0 ? '0' : '50%'
  } else if (total === 3) {
    if (idx === 0) { top = '25%'; left = '0' }
    else { top = idx === 1 ? '0' : '50%'; left = '50%' }
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

function resetForm() {
  form.value = { name: '', groupMode: 'single', members: [] }
}

function handleSave() {
  if (!form.value.name.trim()) {
    showToast('请输入群聊名称')
    return
  }
  if (form.value.members.length < 2) {
    showToast('至少需要选择2个成员')
    return
  }

  groupsStore.createGroup({
    name: form.value.name.trim(),
    groupMode: form.value.groupMode,
    members: form.value.members.map(m => ({
      ...m,
      mcpServerIds: []
    }))
  })

  showToast('已创建')
  resetForm()
  emit('saved')
  emit('close')
}
</script>

<style scoped>
.group-avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  background: #E9E9EB;
}
.group-avatar-item {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #E9E9EB;
}
</style>
