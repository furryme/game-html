// ============================================================
// Workflow 模板：扫描并修复（Scan & Fix）
// 场景：给定一组文件/路径，并行扫描问题后汇报
// 用法：复制此文件内容到 Workflow.script，修改标注 [TODO] 的部分
// ============================================================

export const meta = {
  name: 'scan-and-fix',
  description: '扫描给定文件并修复问题',
  phases: [
    { title: '扫描', detail: '并行分析每个文件' },
    { title: '修复', detail: '并行执行修复' }
  ]
};

// [TODO] 修改：要处理的文件路径列表
var files = [
  '/absolute/path/to/file1.html',
  '/absolute/path/to/file2.html'
];

// [TODO] 修改：扫描阶段 - 每个 agent 的任务描述
// 变量 file 在 pipeline 中自动注入，代表当前文件路径
var scanPrompt =
  '读取文件：' + '（文件路径由外层注入）' +
  '\n任务：扫描代码中的 bug 和问题。' +
  '\n返回格式：找出所有问题，描述问题位置和修复方案。' +
  '\n不要修改文件，只报告问题。';

// [TODO] 修改：修复阶段 - 每个 agent 的任务描述
// 变量 issue 在 parallel 中注入，代表扫描发现的具体问题
var fixPrompt =
  '读取文件后修复以下问题：' + '（问题描述由外层注入）' +
  '\n修复完成后简要说明修改内容。';

// --- 以下框架代码一般不需要修改 ---

// Phase 1: 扫描
phase('扫描');
var scanResults = [];
for (var i = 0; i < files.length; i++) {
  var f = files[i];
  scanResults.push(
    agent(scanPrompt.replace('（文件路径由外层注入）', f), {
      label: 'scan:' + f.split('/').pop(),
      phase: '扫描'
    })
  );
}

// Phase 2: 修复（过滤掉没有问题的文件）
phase('修复');
var fixes = [];
for (var i = 0; i < scanResults.length; i++) {
  var result = scanResults[i];
  if (result && result.trim().length > 0) {
    var file = files[i];
    var prompt = fixPrompt.replace('（问题描述由外层注入）', result);
    prompt = prompt.replace('读取文件后', '读取 ' + file + ' 后');
    fixes.push(
      agent(prompt, {
        label: 'fix:' + file.split('/').pop(),
        phase: '修复'
      })
    );
  }
}

// 汇总结果
return {
  scanned: files.length,
  issuesFound: fixes.length,
  fixesApplied: fixes.filter(function(f) { return f && f.trim().length > 0; }).length
};
