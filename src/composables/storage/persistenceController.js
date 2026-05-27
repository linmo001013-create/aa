// @ts-check

/** @typedef {import('./storageContracts').StorageAppData} StorageAppData */
/** @typedef {import('./storageContracts').StoragePersistenceController} StoragePersistenceController */
/** @typedef {import('./storageContracts').StoragePersistenceControllerOptions} StoragePersistenceControllerOptions */

/** @typedef {{ isNative?: boolean }} CapacitorGlobal */
/** @typedef {Window & { Capacitor?: CapacitorGlobal }} WindowWithCapacitor */

let autoFlushBound = false
let persistenceWarned = false

function getNavigatorStorage() {
  return typeof navigator !== 'undefined' ? navigator.storage : null
}

/**
 * 检测是否运行在 Capacitor 原生环境
 * Capacitor 的 WebView 不支持 `navigator.storage.persist()`，
 * 调用永远返回 false，所以直接跳过
 * 改用 @capacitor/filesystem 写入 Documents 目录做持久化
 */
function isCapacitorEnvironment() {
  try {
    const win = /** @type {WindowWithCapacitor} */ (typeof window !== 'undefined' ? window : null)
    return !!(win && win.Capacitor && win.Capacitor.isNative === true)
  } catch {
    return false
  }
}

/**
 * @param {StoragePersistenceControllerOptions} options
 * @returns {StoragePersistenceController}
 */
export function createStoragePersistenceController(options) {
  const {
    hasUserData,
    showToast,
    snapshotAppData,
    flushSaveNow,
    canFlushOnPageHide = () => true
  } = options

  /** @param {StorageAppData} snapshot */
  async function maybeWarnAboutPersistence(snapshot) {
    if (persistenceWarned) return
    if (!snapshot || !hasUserData(snapshot)) return

    // Capacitor 原生环境：persist() 不可靠，直接跳过，靠文件系统备份兜底
    if (isCapacitorEnvironment()) {
      persistenceWarned = true
      return
    }

    const storage = getNavigatorStorage()
    if (!storage) {
      persistenceWarned = true
      return
    }

    if (typeof storage.persist === 'function') {
      try {
        await storage.persist()
      } catch {
        // ignore persistence request failures
      }
    }

    let persisted = null
    if (typeof storage.persisted === 'function') {
      try {
        persisted = await storage.persisted()
      } catch {
        persisted = null
      }
    }

    if (persisted === false) {
      showToast('建议将本站添加到主屏幕或定期导出备份，避免浏览器清理站点数据', 5000)
      persistenceWarned = true
      return
    }

    if (persisted === null) {
      showToast('建议定期导出备份，避免浏览器清理站点数据', 4500)
    }

    if (persisted === true || persisted === null) persistenceWarned = true
  }

  async function requestPersistence() {
    // Capacitor 原生环境：persist() 不可靠，直接返回 true 假装成功
    // 实际数据持久化靠 @capacitor/filesystem 文件备份
    if (isCapacitorEnvironment()) return true

    const storage = getNavigatorStorage()
    if (!storage || typeof storage.persist !== 'function') return false

    try {
      const granted = await storage.persist()
      if (!granted) {
        // persist 被拒，但有文件系统备份作为兜底
      }
      return granted
    } catch {
      return false
    }
  }

  function bindAutoFlushLifecycle() {
    if (autoFlushBound || typeof window === 'undefined' || typeof document === 'undefined') return false

    autoFlushBound = true
    const flushOnHide = () => {
      if (typeof canFlushOnPageHide === 'function' && !canFlushOnPageHide()) return

      // 🛡️ 紧急同步保存：在异步 flush 之前，先用同步的 localStorage 写一次
      // Android 杀进程时 async 操作可能来不及完成，同步 setItem 能确保数据立刻落盘
      try {
        const emergencySnapshot = snapshotAppData()
        if (emergencySnapshot) {
          localStorage.setItem('aichat_backup', JSON.stringify(emergencySnapshot))
        }
      } catch {
        // 同步保存失败不阻塞，异步保存会继续尝试
      }

      void flushSaveNow({ backupFirst: true, reason: 'pagehide' })
    }

    window.addEventListener('pagehide', flushOnHide)
    window.addEventListener('beforeunload', flushOnHide)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) flushOnHide()
    })
    document.addEventListener?.('freeze', flushOnHide)

    // 🛡️ 定时自动保存（30秒一次）作为最后一道防线
    // 即使页面被杀前事件未触发，最近一次定时同步已落盘
    const AUTO_SAVE_INTERVAL_MS = 30000
    let autoSaveTimer = setInterval(() => {
      try {
        const periodicSnapshot = snapshotAppData()
        if (periodicSnapshot) {
          localStorage.setItem('aichat_backup', JSON.stringify(periodicSnapshot))
        }
      } catch {
        // 定时保存失败不阻塞
      }
    }, AUTO_SAVE_INTERVAL_MS)

    // 页面关闭时清理定时器
    window.addEventListener('pagehide', () => {
      clearInterval(autoSaveTimer)
    })

    return true
  }

  return {
    bindAutoFlushLifecycle,
    maybeWarnAboutPersistence,
    requestPersistence
  }
}

export function resetStoragePersistenceControllerForTests() {
  autoFlushBound = false
  persistenceWarned = false
}
