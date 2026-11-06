(() => {
  const waitFor = async (test, label) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = test();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('启动图未到达目标状态：' + label);
  };
  window.openLessonTarget = async function (action) {
    if (action.mode !== 'startup' || !Number.isInteger(action.step) || action.step < 0 || action.step > 26) {
      throw new Error('无效的启动图目标');
    }
    const root = await waitFor(() => document.querySelector('#ascend-startup-flow'), '启动图初始化');
    const selector = action.step === 0 ? '[data-action="global"]' : '.sequence-item[data-step="' + action.step + '"] button';
    const button = await waitFor(() => root.querySelector(selector), '步骤按钮');
    button.click();
    await waitFor(() => root.dataset.step === String(action.step), '第 ' + action.step + ' 步');
    const title = root.querySelector('[data-field="title"]')?.textContent || button.textContent.trim();
    return {label: 'Ascend 启动 · 第 ' + action.step + ' / 26 步 · ' + title, mode: action.mode, step: action.step};
  };
})();
