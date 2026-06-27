// ============================================================
// Workflow 模板：并行任务（Parallel Tasks）
// 场景：多个独立任务同时执行（如批量生成、独立分析等）
// 用法：复制此文件内容到 Workflow.script，修改标注 [TODO] 的部分
// ============================================================

export const meta = {
  name: 'parallel-tasks',
  description: '并行执行多个独立任务',
  phases: [
    { title: '执行', detail: '并行处理所有任务' }
  ]
};

// [TODO] 修改：任务定义数组
// 每个任务对象包含：label（显示名称）、prompt（任务描述）
var tasks = [
  {
    label: '任务1',
    prompt: '在此填写第一个任务的具体指令'
  },
  {
    label: '任务2',
    prompt: '在此填写第二个任务的具体指令'
  }
  // 可以继续添加更多任务
];

// --- 以下框架代码一般不需要修改 ---

phase('执行');

// 并行执行所有任务
var results = await parallel(
  tasks.map(function(task) {
    return function() {
      return agent(task.prompt, {
        label: task.label,
        phase: '执行'
      });
    };
  })
);

// 过滤掉空结果（用户跳过或失败的任务）
var completed = results.filter(function(r) {
  return r !== null && r !== undefined && String(r).trim().length > 0;
});

// 汇总结果
return {
  totalTasks: tasks.length,
  completed: completed.length,
  results: completed
};
