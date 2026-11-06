// 插入含 #cb-flow-v1 的真实可视化 document，位于现有脚本之后。
window.openLessonTarget = async function(action) {
  const root = document.getElementById('cb-flow-v1');
  const mode = action?.mode, step = Number(action?.step);
  const limit = mode === 'continuous' ? 16 : mode === 'static' ? 24 : 0;
  if (!root || !Number.isInteger(step) || step < 1 || step > limit) throw new Error('批处理跳转参数无效');
  const waitFor = async (test) => {
    const deadline = Date.now() + 4000;
    let stable = 0;
    while (Date.now() < deadline) {
      if (test()) { if (++stable >= 2) return; } else stable = 0;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('可视化未到达请求的模式与步骤');
  };
  const select = root.querySelector('#cb-view');
  select.value = mode;
  select.dispatchEvent(new Event('change', {bubbles:true}));
  root.querySelector('[data-action="overview"]').click();
  const next = root.querySelector('[data-action="next"]');
  for (let i=0; i<step; i++) {
    if (next.disabled) throw new Error('尚未到目标步骤，下一步已禁用');
    next.click();
  }
  const round = Math.floor((step-1)/4)+1, phase = (step-1)%4+1;
  const expected = 'R' + round + ' / ' + limit/4 + ' · ' + phase + ' / 4';
  const status = root.querySelector('.cb-status');
  await waitFor(() => select.value === mode && status.textContent.includes(expected) && !root.querySelector('.cb-detail').hidden);
  return {label:status.textContent.trim()};
};
