// @ts-check
import { App } from '@capacitor/app'
import { useErrorHandler } from './useErrorHandler'
import { useToast } from './useToast'
import { notifyCloudSyncLocalSave } from './cloudSync/manager'
import {
  idbGet,
  idbMediaSetMany,
  idbMessagesDeleteMany,
  idbMessagesGetAllKeys,
  idbMessagesGetMany,
  idbMessagesSetMany,
  idbSet
} from './storage/idbKv'
import { getLegacyLocalStorageData, getLocalStorageBackup, saveBackupToLocalStorage } from './storage/localBackup'
import { saveFileBackup, loadFileBackup } from './storage/fileBackup'
import { defaultAppData, hasUserData, normalizeLoadedAppData, prepareLoadedAppData, redactSecretsForExport } from './storage/appData'
import { createBackupTransport } from './storage/backupTransport'
import {
  buildSnapshotForMediaGc,
  hydrateStoredContactMessages,
  partitionContactMessages,
  restoreInlineMediaInMessagePartitions
} from './storage/contactMessagePersistence'
import { loadStoredSnapshot } from './storage/loadController'
import { createMediaSnapshotController } from './storage/mediaSnapshot'
import { createStoragePersistenceController } from './storage/persistenceController'
import { createStorageSaveController } from './storage/saveController'
import { createStorageRuntime, resolveStorageRuntimeDeps } from './storage/storageRuntime'
import { clearDeferredStorageSaveAfterHydration, consumeDeferredStorageSaveAfterHydration, deferStorageSaveAfterHydration, getSharedStorageComposableApi, setSharedStorageComposableApi } from './storage/storageSessionState'
import { useBootstrapStore } from '../stores/bootstrap'
import { useAccessControlStore } from '../stores/accessControl'
import { toLocalDateKey } from '../utils/dateKey'
import { downloadBlob } from '../utils/download'
const KEY_APP_DATA = 'appData', BACKUP_DOWNLOAD_REVOKE_DELAY_MS = 3 * 60 * 1000
export function useStorage() {
  const sharedStorageComposableApi = getSharedStorageComposableApi()
  if (sharedStorageComposableApi) return sharedStorageComposableApi
  const { handleError } = useErrorHandler(), { showToast } = useToast()
  const bootstrapStore = useBootstrapStore()
  const accessStore = useAccessControlStore()
  let storageApi = /** @type {import('./storage/storageContracts').StorageBridgeApi | null} */ (null)
  const mediaController = createMediaSnapshotController()
  const SAVE_DELAY_SMALL_MS = 200
  const SAVE_DELAY_MEDIUM_MS = 900
  const SAVE_DELAY_LARGE_MS = 2000
  const SAVE_DELAY_HUGE_MS = 4500
  const SNAPSHOT_SIZE_MEDIUM_BYTES = 25 * 1024 * 1024
  const SNAPSHOT_SIZE_LARGE_BYTES = 80 * 1024 * 1024
  const SNAPSHOT_SIZE_HUGE_BYTES = 120 * 1024 * 1024
  const SAVE_MIN_INTERVAL_LARGE_MS = 3500
  const SAVE_MIN_INTERVAL_HUGE_MS = 12000
  const IDLE_SAVE_TIMEOUT_MS = 2500
  const MEDIA_GC_EVERY_SAVES = 24
  const LOCAL_BACKUP_INTERVAL_MS = 60 * 1000
  const LOCAL_BACKUP_FULL_MAX_BYTES = 6 * 1024 * 1024
  const LOCAL_BACKUP_MSG_LIMIT_NORMAL = 30
  const LOCAL_BACKUP_MSG_LIMIT_LARGE = 10
  const savePolicy = {
    mediumBytes: SNAPSHOT_SIZE_MEDIUM_BYTES,
    largeBytes: SNAPSHOT_SIZE_LARGE_BYTES,
    hugeBytes: SNAPSHOT_SIZE_HUGE_BYTES,
    smallDelayMs: SAVE_DELAY_SMALL_MS,
    mediumDelayMs: SAVE_DELAY_MEDIUM_MS,
    largeDelayMs: SAVE_DELAY_LARGE_MS,
    hugeDelayMs: SAVE_DELAY_HUGE_MS,
    largeMinIntervalMs: SAVE_MIN_INTERVAL_LARGE_MS,
    hugeMinIntervalMs: SAVE_MIN_INTERVAL_HUGE_MS
  }
  const {
    applyMediaMapToSnapshot,
    collectMediaEntriesForExport,
    collectMediaRefsFromSnapshot,
    externalizeStateMedia,
    guessMediaExtensionFromMimeType,
    hydrateSnapshotMedia,
    maybeGarbageCollectUnusedMedia,
    mediaBinaryToDataUrl,
    normalizeMediaBinary,
    persistMediaEntries,
    restoreInlineMediaFromMap,
    stripSnapshotMedia
  } = mediaController
  const storageRuntime = createStorageRuntime({
    ...resolveStorageRuntimeDeps(),
    externalizeStateMedia
  })
  const {
    applyAppDataToState: applyRuntimeDataToState,
    buildBaseSnapshot,
    trimMessagesIfNeeded
  } = storageRuntime
  let persistenceController = /** @type {import('./storage/storageContracts').StoragePersistenceController | null} */ (null)
  const storageSaveController = createStorageSaveController({
    keyAppData: KEY_APP_DATA,
    savePolicy,
    snapshotSizeLargeBytes: SNAPSHOT_SIZE_LARGE_BYTES,
    snapshotSizeHugeBytes: SNAPSHOT_SIZE_HUGE_BYTES,
    idleSaveTimeoutMs: IDLE_SAVE_TIMEOUT_MS,
    mediaGcEverySaves: MEDIA_GC_EVERY_SAVES,
    localBackupIntervalMs: LOCAL_BACKUP_INTERVAL_MS,
    localBackupFullMaxBytes: LOCAL_BACKUP_FULL_MAX_BYTES,
    localBackupMsgLimitNormal: LOCAL_BACKUP_MSG_LIMIT_NORMAL,
    localBackupMsgLimitLarge: LOCAL_BACKUP_MSG_LIMIT_LARGE,
    snapshotAppData,
    trimMessagesIfNeeded,
    persistMediaEntries,
    restoreInlineMediaFromMap,
    restoreInlineMediaInMessagePartitions,
    buildSnapshotForMediaGc,
    maybeGarbageCollectUnusedMedia,
    idbMessagesSetMany,
    idbMessagesDeleteMany,
    idbSet,
    saveBackupToLocalStorage,
    maybeWarnAboutPersistence: (...args) => persistenceController?.maybeWarnAboutPersistence(...args),
    notifyCloudSyncLocalSave,
    getStorageApi: () => storageApi,
    handleError
  })
  const {
    flushSaveNow,
    getLastLocalUpdatedAt,
    scheduleSave: scheduleSaveImpl,
    setLastLocalUpdatedAt,
    setPersistedMessageContactIds,
    setPersistedSnapshotSummary
  } = storageSaveController

  function canAutoPersist() {
    if (bootstrapStore.isHydrating) return false
    if (bootstrapStore.loadError) return false
    if (!accessStore.canAccessApp) return false
    return true
  }

  persistenceController = createStoragePersistenceController({
    hasUserData,
    showToast,
    snapshotAppData,
    flushSaveNow,
    canFlushOnPageHide: canAutoPersist
  })
  const { bindAutoFlushLifecycle, requestPersistence } = persistenceController
  const { buildBackupBlob, importBackupBlob } = createBackupTransport({
    snapshotAppData,
    getLocalUpdatedAt: getLastLocalUpdatedAt,
    redactSecretsForExport,
    collectMediaRefsFromSnapshot,
    collectMediaEntriesForExport,
    mediaBinaryToDataUrl,
    applyMediaMapToSnapshot,
    stripSnapshotMedia,
    normalizeMediaBinary,
    guessMediaExtensionFromMimeType,
    idbMediaSetMany,
    normalizeLoadedAppData,
    hydrateSnapshotMedia,
    applyAppDataToState,
    flushSaveNow,
    handleError
  })
  function snapshotAppData(options = {}) {
    const packed = buildBaseSnapshot()
    const preservedLocalUpdatedAt = Math.max(0, Number(options.localUpdatedAt ?? getLastLocalUpdatedAt()) || 0)
    if (packed?.snapshot && !options.freshLocalUpdatedAt) {
      packed.snapshot.localUpdatedAt = preservedLocalUpdatedAt
    }
    if (options && options.inlineMessages === true) {
      return {
        snapshot: packed.snapshot,
        mediaEntries: packed.mediaEntries,
        messagePartitions: new Map()
      }
    }
    return partitionContactMessages(packed)
  }
  function applyAppDataToState(appData) { return applyRuntimeDataToState(appData, scheduleSave) }
  function scheduleSave(options = {}) {
    if (bootstrapStore.isHydrating) {
      deferStorageSaveAfterHydration()
      return
    }
    if (!canAutoPersist()) return
    scheduleSaveImpl(options)
  }
  async function loadAll() {
    bootstrapStore.startHydration()
    try {
      const loaded = await loadStoredSnapshot({
        keyAppData: KEY_APP_DATA,
        idbGet,
        idbSet,
        getLocalStorageBackup,
        getFileBackup: loadFileBackup,
        getLegacyLocalStorageData,
        hasUserData,
        normalizeLoadedAppData,
        prepareLoadedAppData,
        defaultAppData,
        hydrateStoredContactMessages,
        getMessageKeys: idbMessagesGetAllKeys,
        getMessages: idbMessagesGetMany,
        showToast,
        handleError
      })
      setPersistedMessageContactIds(loaded.persistedContactIds)
      setPersistedSnapshotSummary(loaded.snapshot)
      setLastLocalUpdatedAt(loaded.snapshot.localUpdatedAt)
      await hydrateSnapshotMedia(loaded.snapshot)
      applyAppDataToState(loaded.snapshot)
      if (loaded.shouldMigrateInlineMessages) scheduleSave()
      return loaded.snapshot
    } catch (error) {
      clearDeferredStorageSaveAfterHydration()
      bootstrapStore.finishHydration(error)
      throw error
    } finally {
      if (bootstrapStore.isHydrating) bootstrapStore.finishHydration()
      if (consumeDeferredStorageSaveAfterHydration()) {
        scheduleSave({ urgent: true })
      }
    }
  }
  async function exportData(options = {}) {
    try {
      const includeSecrets = options && options.includeSecrets === true
      const format = options && options.format === 'json' ? 'json' : 'zip'
      const backup = await buildBackupBlob({ includeSecrets, format })
      const blob = backup.blob
      const fileExt = format === 'json' ? 'json' : 'zip'
      await downloadBlob(blob, 'aichat_backup_' + toLocalDateKey() + '.' + fileExt, {
        revokeDelayMs: BACKUP_DOWNLOAD_REVOKE_DELAY_MS
      })
      return true
    } catch (error) {
      handleError(error, {
        mode: 'toast',
        context: 'Storage:Export',
        fallbackMessage: '导出失败',
        toastMessage: '导出失败，请重试',
        toastDuration: 3000
      })
      return false
    }
  }
  async function importData(file) { return importBackupBlob(file) }
  function getCurrentSnapshotMeta() {
    const snapshot = snapshotAppData({ inlineMessages: true, localUpdatedAt: getLastLocalUpdatedAt() }).snapshot
    return {
      localUpdatedAt: Math.max(0, Number(snapshot?.localUpdatedAt || getLastLocalUpdatedAt()) || 0),
      hasUserData: hasUserData(snapshot)
    }
  }
  storageApi = {
    buildBackupBlob,
    flushSaveNow,
    getCurrentSnapshotMeta,
    importBackupBlob,
    scheduleSave
  }
  bindAutoFlushLifecycle()

  // Capacitor Android: 切后台时优先从内存写文件，再异步尝试 IndexedDB
  // 关键: 不等待 IndexedDB 完成再写文件——避免后台冻结导致写操作永远不完成
  if (typeof App !== 'undefined' && App?.addListener) {
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        // [1] 直接从内存拿快照，立即写文件系统（不受 WebView 冻结影响）
        try {
          const packed = snapshotAppData()
          if (packed?.snapshot) {
            saveFileBackup(packed.snapshot).catch(() => {})
          }
        } catch {
          // 内存快照失败不影响主流程
        }
        // [2] IndexedDB 异步保存，能成最好，失败也不影响文件备份
        flushSaveNow({ backupFirst: true, reason: 'app-background' }).catch(() => {})
      }
    })
  }

  // 定期写入文件系统备份（每 15 秒检查一次，比原来的 60 秒更可靠）
  let fileBackupTimer
  const startFileBackupTimer = () => {
    if (fileBackupTimer) return
    fileBackupTimer = setInterval(async () => {
      try {
        const meta = storageApi?.getCurrentSnapshotMeta?.()
        if (meta?.hasUserData) {
          const packed = snapshotAppData()
          if (packed?.snapshot) {
            await saveFileBackup(packed.snapshot)
          }
        }
      } catch {
        // 静默失败
      }
    }, 15000)
  }
  const stopFileBackupTimer = () => {
    if (fileBackupTimer) {
      clearInterval(fileBackupTimer)
      fileBackupTimer = null
    }
  }
  if (typeof window !== 'undefined') {
    startFileBackupTimer()
  }

  return setSharedStorageComposableApi(/** @type {import('./storage/storageContracts').StorageComposableApi} */ ({
    loadAll,
    scheduleSave,
    flushSaveNow,
    exportData,
    importData,
    buildBackupBlob,
    importBackupBlob,
    getCurrentSnapshotMeta,
    requestPersistence
  }))
}
