// @ts-check
/**
 * Capacitor 原生文件系统备份
 * 每次保存时额外写到 Android 内部存储，防止 WebView 存储被清导致数据丢失
 */
import { Filesystem, Directory } from '@capacitor/filesystem'

const BACKUP_FILE = 'aichat_data_backup.json'

/**
 * 将数据快照写入文件系统作为兜底备份
 * @param {unknown} snapshot
 */
export async function saveFileBackup(snapshot) {
  if (!snapshot) return
  try {
    const json = JSON.stringify(snapshot)
    await Filesystem.writeFile({
      path: BACKUP_FILE,
      data: json,
      directory: Directory.Documents,
      encoding: 'utf-8'
    })
  } catch {
    // 文件写入失败不要影响主流程
  }
}

/**
 * 从文件系统读取兜底备份
 * @returns {Promise<unknown | null>}
 */
export async function loadFileBackup() {
  try {
    const result = await Filesystem.readFile({
      path: BACKUP_FILE,
      directory: Directory.Documents,
      encoding: 'utf-8'
    })
    if (result?.data) {
      return JSON.parse(result.data)
    }
    return null
  } catch {
    return null
  }
}

/**
 * 删除文件备份
 */
export async function removeFileBackup() {
  try {
    await Filesystem.deleteFile({
      path: BACKUP_FILE,
      directory: Directory.Documents
    })
  } catch {
    // ignore
  }
}
