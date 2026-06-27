// ============================================================
// Workflow 模板：多阶段流水线（Pipeline Stages）
// 场景：数据经过多道处理工序（如：发现 → 分析 → 修复 → 验证）
// 用法：复制此文件内容到 Workflow.script，修改标注 [TODO] 的部分
// ============================================================

export const meta = {
  name: 'pipeline-stages',
  description: '多阶段流水线处理',
  phases: [
    { title: '阶段1', detail: '第一道处理工序' },
    { title: '阶段2', detail: '第二道处理工序' },
    { title: '阶段3', detail: '第三道处理工序' }
  ]
};

// [TODO] 修改：输入数据列表
var inputs = [
  '/path/to/item1',
  '/path/to/item2'
];

// [TODO] 修改：每个阶段的具体任务描述
// 每个阶段的 prompt 会收到上一阶段的输出结果

var stage1Prompt =
  '分析以下内容，提取关键信息：\n' +
  '（输入数据由流水线注入）\n' +
  '返回格式：列出发现的所有关键点。';

var stage2Prompt =
  '基于以下分析结果，制定解决方案：\n' +
  '（阶段1结果由流水线注入）\n' +
  '返回格式：对每个关键点给出具体方案。';

var stage3Prompt =
  '验证以下解决方案的可行性：\n' +
  '（阶段2结果由流水线注入）\n' +
  '返回格式：通过/不通过，并说明原因。';

// --- 以下框架代码一般不需要修改 ---

// 流水线处理：数据依次经过三个阶段
// 注意：pipeline 是"无屏障"的，item A 可能在阶段3而 item B 还在阶段1
var results = await pipeline(
  inputs,

  // 阶段1
  function(item) {
    return agent(stage1Prompt.replace('（输入数据由流水线注入）', item), {
      label: '阶段1:' + String(item).split('/').pop(),
      phase: '阶段1'
    });
  },

  // 阶段2
  function(stage1Result) {
    if (!stage1Result) return null;
    return agent(stage2Prompt.replace('（阶段1结果由流水线注入）', stage1Result), {
      phase: '阶段2'
    });
  },

  // 阶段3
  function(stage2Result) {
    if (!stage2Result) return null;
    return agent(stage3Prompt.replace('（阶段2结果由流水线注入）', stage2Result), {
      phase: '阶段3'
    });
  }
);

// 过滤有效结果
var passed = results.filter(function(r) {
  return r && String(r).includes('通过');
});

return {
  totalInputs: inputs.length,
  completed: results.filter(Boolean).length,
  passed: passed.length
};
