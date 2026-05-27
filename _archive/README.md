存档说明 - 2026-05-26 17:22
============================
版本：论坛评论区互动 v2（修复自回复+旁观者视角）

改动内容：
1. 新开楼层 → 手机主人回复到用户楼下（不再新开楼层）
   - 新增 generateOwnerReplyToComment 函数
   - 上下文仅含用户评论，不含自回复链

2. 楼中楼回复 → 原作者回1次 + 手机主人以旁观者视角插话1次
   - 如果原作者是匿名网友（用户自己），跳过原作者回复

3. 上下文去重
   - generateOwnerNestedReply 检查 userReply 是否已存在于 comment.replies 中
   - 避免重复追加导致 AI 困惑

文件列表：
  - SnoopForum.vue → _archive/SnoopForum_20260526_1722.vue.bak
  - useSnoopGenerate.js → _archive/useSnoopGenerate_20260526_1722.js.bak
