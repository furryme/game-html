#!/bin/bash
# PreToolUse hook: 阻止主 agent 直接读取 .js 文件，强制使用 Workflow 子 agent
# 子 agent（stdin JSON 中有 agent_id 字段）正常放行
#
# 退出码：0 = 允许，2 = 阻止
# stdout：不输出（或输出修改后的 tool_input JSON）
# stderr：阻止时写理由

read -r input
tool_name=$(echo "$input" | jq -r '.tool_name // empty')

# 只拦截 Read 工具
if [ "$tool_name" != "Read" ]; then
  exit 0
fi

# 子 agent 正常放行（stdin JSON 中有 agent_id 字段表示来自子 agent）
is_subagent=$(echo "$input" | jq 'has("agent_id")')
if [ "$is_subagent" = "true" ]; then
  exit 0
fi

# 主 agent 读取 .js 文件 → 阻止
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')
if [[ "$file_path" == *.js ]]; then
  echo "根据项目规范，主 agent 不得直接读取 JavaScript 源码。请使用 Workflow 工具编排子 agent 来完成代码阅读、分析和修复任务。" >&2
  exit 2
fi

exit 0
