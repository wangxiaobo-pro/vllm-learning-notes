// 插入含 #chunked-prefill-flow 的真实可视化 document，位于现有脚本之后。
window.openLessonTarget = async function(action) {
  const root = document.getElementById('chunked-prefill-flow');
  const mode = action?.mode, step = Number(action?.step);
  if (!root || !['chunked','whole'].includes(mode) || !Number.isInteger(step) || step < 1 || step > 12) throw new Error('Prefill 跳转参数无效');
  const waitFor = async (test) => {
    const deadline = Date.now() + 4000;
    let stable = 0;
    while (Date.now() < deadline) {
      if (test()) { if (++stable >= 2) return; } else stable = 0;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('可视化未到达请求的模式与步骤');
  };
  const select = root.querySelector('#cf-mode');
  select.value = mode;
  select.dispatchEvent(new Event('change', {bubbles:true}));
  root.querySelector('#cf-global').click();
  const next = root.querySelector('#cf-next');
  for (let i=0; i<step; i++) {
    if (next.disabled) throw new Error('尚未到目标步骤，下一步已禁用');
    next.click();
  }
  const status = root.querySelector('#cf-status');
  await waitFor(() => select.value === mode && status.textContent.startsWith(step + ' / 12') && root.querySelector('#cf-global').getAttribute('aria-pressed') === 'false');
  return {label:(mode === 'whole' ? 'V0 整段 · ' : 'V1 分块 · ') + status.textContent.trim()};
};
