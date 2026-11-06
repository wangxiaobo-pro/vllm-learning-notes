(() => {
  const waitFor = async (test, label) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = test();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('前缀缓存图未到达目标状态：' + label);
  };
  window.openLessonTarget = async function (action) {
    if (!['vllm', 'sglang'].includes(action.mode) || !Number.isInteger(action.step) || action.step < 0 || action.step > 8) {
      throw new Error('无效的前缀缓存目标');
    }
    const root = await waitFor(() => document.querySelector('#prefix-kv-map'), '图初始化');
    const tab = await waitFor(() => root.querySelector('button[data-engine="' + action.mode + '"]'), '引擎标签');
    tab.click();
    const selector = action.step === 0 ? '[data-overview]' : 'ol[data-steps] button[data-step="' + action.step + '"]';
    (await waitFor(() => root.querySelector(selector), '步骤按钮')).click();
    await waitFor(() => tab.getAttribute('aria-selected') === 'true' && (action.step === 0 ? root.querySelector('[data-overview]').getAttribute('aria-pressed') === 'true' : root.querySelector('ol[data-steps] button[aria-current="step"]')?.dataset.step === String(action.step)), '引擎与步骤');
    return {label: (action.mode === 'vllm' ? 'vLLM' : 'SGLang') + ' · ' + root.querySelector('[data-status]').textContent, mode:action.mode, step:action.step};
  };
})();
