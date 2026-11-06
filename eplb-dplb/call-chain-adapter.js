// 插入含 #lb-atlas 的真实可视化 document，位于现有脚本之后。
window.openLessonTarget = async function(action) {
  const root = document.getElementById('lb-atlas');
  const mode = action?.mode, step = Number(action?.step);
  const counts = {overview:8,feedback:7,choice:6,placement:11,timeline:16};
  const preset = action?.preset || 'original';
  if (!root || !Object.hasOwn(counts,mode) || !Number.isInteger(step) || step < 1 || step > counts[mode] || !['original','counter','tie'].includes(preset)) throw new Error('负载均衡跳转参数无效');
  const waitFor = async (test) => {
    const deadline = Date.now() + 4000;
    let stable = 0;
    while (Date.now() < deadline) {
      if (test()) { if (++stable >= 2) return; } else stable = 0;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('可视化未到达请求的模式与步骤');
  };
  const select = root.querySelector('#atlas-mode');
  select.value = mode; select.dispatchEvent(new Event('change', {bubbles:true}));
  if (mode === 'choice') {
    const scenario = root.querySelector('#atlas-preset');
    scenario.value = preset; scenario.dispatchEvent(new Event('change', {bubbles:true}));
  }
  root.querySelector('#atlas-global').click();
  const next = root.querySelector('#atlas-next');
  for (let i=0; i<step; i++) {
    if (next.disabled) throw new Error('尚未到目标步骤，下一步已禁用');
    next.click();
  }
  const expectedPreset = mode === 'choice' ? preset : 'none';
  await waitFor(() => root.dataset.mode === mode && Number(root.dataset.step) === step && [...root.querySelectorAll('.atlas-frame')].some(frame => !frame.hidden && frame.dataset.mode === mode && frame.dataset.preset === expectedPreset && Number(frame.dataset.step) === step));
  return {label:root.querySelector('#atlas-title').textContent.trim() + (mode === 'choice' ? ' · ' + root.querySelector('#atlas-preset').selectedOptions[0].textContent.trim() : '')};
};
