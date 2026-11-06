// 插入含 #vllm-mooncake-pd 的 iframe 内 document，位于现有脚本之后。
window.openLessonTarget = async function(action) {
  const root = document.getElementById('vllm-mooncake-pd');
  const mode = action?.mode, step = Number(action?.step);
  if (!root || !['v0','v1'].includes(mode) || !Number.isInteger(step) || step < 1 || step > 9) throw new Error('PD 跳转参数无效');
  const modeButton = root.querySelector('#vmp-' + mode);
  modeButton.click();
  const next = root.querySelector('#vmp-next');
  for (let i=0; i<step; i++) {
    if (next.disabled) throw new Error('尚未到目标步骤，下一步已禁用');
    next.click();
  }
  const counter = root.querySelector('#vmp-stage');
  const deadline = Date.now() + 4000;
  let stable = 0;
  while (Date.now() < deadline) {
    if (modeButton.getAttribute('aria-pressed') === 'true' && counter.textContent.startsWith(step + ' / 9')) {
      if (++stable >= 2) return {label:mode.toUpperCase() + ' · ' + counter.textContent.trim()};
    } else stable = 0;
    await new Promise(resolve => setTimeout(resolve,20));
  }
  throw new Error('PD 可视化未到达请求的模式与步骤');
};
