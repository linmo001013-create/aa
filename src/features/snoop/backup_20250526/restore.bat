@echo off
chcp 65001 >nul
echo ================================
echo  snoop 聊天续写功能 — 一键还原
echo  备份日期: 2025-05-26
echo ================================
echo.

set BACKUP_DIR=%~dp0
set SRC_DIR=%BACKUP_DIR%..\

copy /y "%BACKUP_DIR%SnoopChats.vue" "%SRC_DIR%components\SnoopChats.vue"
copy /y "%BACKUP_DIR%useSnoopGenerate.js" "%SRC_DIR%composables\useSnoopGenerate.js"

echo ✅ 还原完成！
echo.
echo 涉及文件:
echo   src/features/snoop/components/SnoopChats.vue
echo   src/features/snoop/composables/useSnoopGenerate.js
echo.
pause
