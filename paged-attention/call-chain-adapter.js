(() => {
  const waitFor = async (test, label) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = test();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('PagedAttention 图未到达目标状态：' + label);
  };
  window.openLessonTarget = async function (action) {
    if (!['prefill', 'decode'].includes(action.mode) || !Number.isInteger(action.step) || action.step < 0 || action.step > 8) {
      throw new Error('无效的 PagedAttention 目标');
    }
    const root = await waitFor(() => document.querySelector('#pa-flow'), '图初始化');
    const modeButton = await waitFor(() => root.querySelector('button[data-mode="' + action.mode + '"]'), '场景按钮');
    modeButton.click();
    const focus = root.querySelector('select[data-focus]');
    if (focus.value !== 'all') { focus.value = 'all'; focus.dispatchEvent(new Event('change', {bubbles:true})); }
    const selector = action.step === 0 ? '[data-overview]' : 'ol[data-steps] button[data-step="' + action.step + '"]';
    (await waitFor(() => root.querySelector(selector), '步骤按钮')).click();
    await waitFor(() => root.dataset.scene === action.mode && root.dataset.step === String(action.step) && focus.value === 'all', '场景与步骤');
    return {label: (action.mode === 'decode' ? '跨页 Decode' : '首次 Prefill') + ' · ' + root.querySelector('[data-step-title]').textContent, mode:action.mode, step:action.step};
  };
})();
