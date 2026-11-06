// 插入含 #vllm-life-r1 的真实可视化 document，位于现有脚本之后。
window.openLessonTarget = async function(action) {
  const root = document.getElementById('vllm-life-r1');
  const step = Number(action?.step);
  if (!root || action?.mode !== 'v1' || !Number.isInteger(step) || step < 1 || step > 20) throw new Error('请求生命周期跳转参数无效');
  const waitFor = async (test) => {
    const deadline = Date.now() + 4000;
    let stable = 0;
    while (Date.now() < deadline) {
      if (test()) { if (++stable >= 2) return; } else stable = 0;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('可视化未到达请求的模式与步骤');
  };
  const button = root.querySelector('button[data-step="' + step + '"]');
  if (!button) throw new Error('目标步骤按钮尚未建立');
  button.click();
  const counter = root.querySelector('[data-slot="counter"]');
  await waitFor(() => counter?.textContent.startsWith(step + ' / 20') && !root.querySelector('[data-slot="detail"]').hidden);
  return {label: root.querySelector('[data-slot="state"]').textContent.trim()};
};
