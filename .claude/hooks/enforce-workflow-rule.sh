#!/bin/bash
# SessionStart hook: 注入强制使用 Workflow 的行为指令
# 这个指令会在每个会话开始时自动注入到系统提示词中

cat << 'EOF'
{"additionalContext": "【强制执行规则】根据本项目开发规范，你作为主 agent 时严禁直接读取项目的 JavaScript 源码文件（.js）。遇到任何需要查看或修改代码的问题时，必须使用 Workflow 工具编排子 agent 来完成。Workflow 脚本中写明文件路径、任务目标和验收标准即可，子 agent 会自行读取和处理文件。你唯一的工作是：1) 编写 Workflow 脚本 2) 等待完成 3) 汇总结果。不要绕过此规则。"}
EOF
