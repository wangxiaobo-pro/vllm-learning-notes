(() => {
  const waitFor = async (test, label) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = test();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('KV 卸载图未到达目标状态：' + label);
  };
  window.openLessonTarget = async function (action) {
    if (action.mode !== 'offload' || !Number.isInteger(action.step) || action.step < 0 || action.step > 7) {
      throw new Error('无效的 KV 卸载目标');
    }
    const root = await waitFor(() => document.querySelector('#km-map'), '图初始化');
    (await waitFor(() => root.querySelector('#km-all'), '全局按钮')).click();
    const status = () => root.querySelector('#km-status').textContent;
    await waitFor(() => status().startsWith('全局关系'), '全局状态');
    for (let step = 1; step <= action.step; step++) {
      root.querySelector('#km-next').click();
      await waitFor(() => status().startsWith(step + ' / 7'), '第 ' + step + ' 步');
    }
    return {label:'KV 卸载 · ' + status(), mode:action.mode, step:action.step};
  };
})();
