<template>
  <div class="phone-picker">
    <!-- Top bar -->
    <div class="picker-topbar">
      <button class="picker-back" @click="goBack">
        <i class="ph ph-caret-left"></i> 主页
      </button>
      <span class="picker-title">联系人</span>
      <div class="picker-back-placeholder"></div>
    </div>

    <!-- Search -->
    <div class="picker-search">
      <i class="ph ph-magnifying-glass text-[16px] text-[#8e8e93]"></i>
      <input
        v-model="searchQuery"
        class="picker-search-input"
        placeholder="搜索联系人..."
        type="text"
      />
    </div>

    <!-- Contact list -->
    <div class="picker-list">
      <div
        v-for="contact in filteredContacts"
        :key="contact.id"
        class="picker-item"
        @click="openPhone(contact.id)"
      >
        <div class="picker-avatar">
          <img v-if="contact.avatarType === 'image'" :src="contact.avatar" class="w-full h-full object-cover rounded-full">
          <span v-else>{{ contact.avatar || contact.name?.charAt(0)?.toUpperCase() || '?' }}</span>
        </div>
        <div class="picker-info">
          <div class="picker-name">{{ contact.name }}</div>
          <div class="picker-desc">{{ contact.prompt?.slice(0, 40) || '点击查看手机内容' }}...</div>
        </div>
        <button class="picker-more" @click.stop="openActionSheet(contact)">
          <i class="ph ph-dots-three-vertical text-[16px]"></i>
        </button>
      </div>

      <div v-if="filteredContacts.length === 0" class="picker-empty">
        <i class="ph ph-smiley-sad text-[32px] text-[#c7c7cc]"></i>
        <p>没有找到联系人</p>
      </div>
    </div>

    <!-- Action Sheet overlay -->
    <Transition name="action-sheet">
      <div v-if="actionContact" class="action-overlay" @click="closeActionSheet">
        <div class="action-sheet" @click.stop>
          <div class="action-sheet-title">{{ actionContact.name }}</div>
          <div class="action-sheet-item" @click="openEdit(actionContact)">
            <i class="ph ph-pencil-simple-line text-[18px] text-[#007aff]"></i>
            编辑联系人
          </div>
          <div class="action-sheet-item action-sheet-item--danger" @click="confirmDelete(actionContact)">
            <i class="ph ph-trash text-[18px]"></i>
            删除联系人
          </div>
          <div class="action-sheet-cancel" @click="closeActionSheet">取消</div>
        </div>
      </div>
    </Transition>

    <!-- ContactModal (reuses messages' setting template) -->
    <ContactModal
      :visible="showContactModal"
      :is-edit="true"
      :contact-id="editContactId"
      @close="closeEdit"
      @saved="onSaved"
      @deleted="onDeleted"
    />

    <!-- Delete Confirm overlay -->
    <Transition name="action-sheet">
      <div v-if="deletingContact" class="action-overlay" @click="closeDelete">
        <div class="confirm-modal" @click.stop>
          <div class="confirm-icon">
            <i class="ph ph-warning-circle text-[40px] text-[#ff3b30]"></i>
          </div>
          <div class="confirm-title">删除联系人</div>
          <div class="confirm-desc">确定要删除「{{ deletingContact.name }}」吗？<br/>此操作不可撤销。</div>
          <div class="confirm-actions">
            <button class="confirm-cancel" @click="closeDelete">取消</button>
            <button class="confirm-delete" @click="handleDelete">删除</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import ContactModal from '../../../components/modals/ContactModal.vue'

const router = useRouter()
const contactsStore = useContactsStore()
const searchQuery = ref('')

const filteredContacts = computed(() => {
  const list = contactsStore.contacts || []
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list.filter(c => !c.isGroup)
  return list.filter(c => !c.isGroup && c.name?.toLowerCase().includes(q))
})

// Action sheet
const actionContact = ref(null)
function openActionSheet(contact) {
  actionContact.value = contact
}
function closeActionSheet() {
  actionContact.value = null
}

// Edit via ContactModal
const showContactModal = ref(false)
const editContactId = ref('')

function openEdit(contact) {
  closeActionSheet()
  editContactId.value = contact.id
  showContactModal.value = true
}
function closeEdit() {
  showContactModal.value = false
  editContactId.value = ''
}
function onSaved() {
  closeEdit()
}
function onDeleted() {
  closeEdit()
}

// Delete
const deletingContact = ref(null)
function confirmDelete(contact) {
  closeActionSheet()
  deletingContact.value = contact
}
function closeDelete() {
  deletingContact.value = null
}
function handleDelete() {
  const contact = deletingContact.value
  if (!contact) return
  const idx = contactsStore.contacts.findIndex(c => c.id === contact.id)
  if (idx !== -1) {
    contactsStore.contacts.splice(idx, 1)
  }
  deletingContact.value = null
}

function goBack() {
  router.push('/')
}

function openPhone(contactId) {
  router.push(`/snoop/${contactId}`)
}
</script>

<style scoped>
.phone-picker {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  background: #f5f5f7;
  color: #1c1c1e;
}
.dark .phone-picker {
  background: #0e0e10;
  color: #f5f5f7;
}

/* Top bar */
.picker-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--app-pt, 48px) 16px 12px;
  min-height: calc(var(--app-pt, 48px) + 44px);
  background: rgba(245, 245, 247, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 0.5px solid rgba(0,0,0,0.08);
  flex-shrink: 0;
  position: relative;
}
.dark .picker-topbar {
  background: rgba(14, 14, 16, 0.85);
  border-bottom-color: rgba(255,255,255,0.08);
}
.picker-back {
  border: none;
  background: none;
  color: var(--primary-color, #007aff);
  cursor: pointer;
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.picker-back:active { opacity: 0.5; }
.picker-back-placeholder {
  width: 40px;
  flex-shrink: 0;
}
.picker-title {
  font-size: 17px;
  font-weight: 600;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

/* Search */
.picker-search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 16px;
  padding: 8px 12px;
  background: rgba(118, 118, 128, 0.12);
  border-radius: 10px;
  flex-shrink: 0;
}
.dark .picker-search {
  background: rgba(118, 118, 128, 0.24);
}
.picker-search-input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  font-size: 15px;
  color: inherit;
}
.picker-search-input::placeholder {
  color: #8e8e93;
}

/* Contact list */
.picker-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}
.picker-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 0;
  border: none;
  background: none;
  border-bottom: 0.5px solid rgba(0,0,0,0.08);
  cursor: pointer;
  color: inherit;
  text-align: left;
}
.dark .picker-item {
  border-bottom-color: rgba(255,255,255,0.08);
}
.picker-item:active {
  opacity: 0.5;
}
.picker-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #34C759, #1FA447);
  flex-shrink: 0;
  overflow: hidden;
}
.picker-info {
  flex: 1;
  min-width: 0;
}
.picker-name {
  font-size: 16px;
  font-weight: 500;
}
.picker-desc {
  font-size: 13px;
  color: #8e8e93;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-more {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: #8e8e93;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.picker-more:active {
  background: rgba(0,0,0,0.06);
}
.dark .picker-more:active {
  background: rgba(255,255,255,0.08);
}
.picker-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 60px 0;
  color: #8e8e93;
}

/* Action Sheet */
.action-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}
.action-sheet {
  width: 100%;
  max-width: 400px;
  background: rgba(245,245,247,0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 14px 14px 0 0;
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
}
.dark .action-sheet {
  background: rgba(28,28,30,0.95);
}
.action-sheet-title {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #8e8e93;
  padding: 6px 0 14px;
  border-bottom: 0.5px solid rgba(0,0,0,0.06);
  margin-bottom: 8px;
}
.dark .action-sheet-title {
  border-bottom-color: rgba(255,255,255,0.06);
}
.action-sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 8px;
  font-size: 17px;
  cursor: pointer;
  border-radius: 10px;
  transition: background 0.1s;
}
.action-sheet-item:active {
  background: rgba(0,0,0,0.06);
}
.dark .action-sheet-item:active {
  background: rgba(255,255,255,0.06);
}
.action-sheet-item--danger {
  color: #ff3b30;
}
.action-sheet-cancel {
  text-align: center;
  padding: 14px 8px;
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  margin-top: 8px;
  border-radius: 10px;
  background: rgba(255,255,255,0.8);
}
.dark .action-sheet-cancel {
  background: rgba(44,44,46,0.8);
}
.action-sheet-cancel:active {
  opacity: 0.5;
}

/* Confirm Modal */
.confirm-modal {
  width: 280px;
  background: rgba(245,245,247,0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 14px;
  padding: 24px 20px 16px;
  text-align: center;
}
.dark .confirm-modal {
  background: rgba(28,28,30,0.98);
}
.confirm-icon {
  margin-bottom: 12px;
}
.confirm-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 8px;
}
.confirm-desc {
  font-size: 13px;
  color: #8e8e93;
  line-height: 1.5;
  margin-bottom: 20px;
}
.confirm-actions {
  display: flex;
  gap: 8px;
}
.confirm-cancel,
.confirm-delete {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}
.confirm-cancel {
  background: rgba(118,118,128,0.12);
  color: inherit;
}
.dark .confirm-cancel {
  background: rgba(118,118,128,0.24);
}
.confirm-cancel:active {
  opacity: 0.5;
}
.confirm-delete {
  background: #ff3b30;
  color: #fff;
}
.confirm-delete:active {
  opacity: 0.7;
}

/* Transitions */
.action-sheet-enter-active,
.action-sheet-leave-active {
  transition: all 0.25s ease;
}
.action-sheet-enter-from,
.action-sheet-leave-to {
  opacity: 0;
}
.action-sheet-enter-from .action-sheet,
.action-sheet-enter-from .confirm-modal,
.action-sheet-leave-to .action-sheet,
.action-sheet-leave-to .confirm-modal {
  transform: translateY(20px);
}
</style>
