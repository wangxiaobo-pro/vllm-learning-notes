(() => {
  const waitFor = async (test, label) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const result = test();
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error('权重预取图未到达目标状态：' + label);
  };
  window.openLessonTarget = async function (action) {
    if (action.mode !== 'prefetch' || !Number.isInteger(action.step) || action.step < 0 || action.step > 11) {
      throw new Error('无效的权重预取目标');
    }
    const root = await waitFor(() => document.querySelector('#weights-flow'), '图初始化');
    (await waitFor(() => root.querySelector('[data-action="overview"]'), '全局按钮')).click();
    const count = () => root.querySelector('[data-count]').textContent;
    await waitFor(() => count().startsWith('全图'), '全局状态');
    for (let step = 1; step <= action.step; step++) {
      root.querySelector('[data-action="next"]').click();
      await waitFor(() => count() === step + ' / 11', '第 ' + step + ' 步');
    }
    if (action.focus === true) {
      const panel = root.querySelector('details[data-focus]');
      const canvas = root.querySelector('svg.wf-focus');
      panel.open = true;
      // The shell may reveal its visual pane only after this adapter returns.
      // The original drawFocus intentionally skips a canvas whose width is zero.
      if (canvas.getBoundingClientRect().width > 0) {
        panel.dispatchEvent(new Event('toggle'));
      } else {
        const observer = new ResizeObserver(() => {
          if (canvas.getBoundingClientRect().width > 0) {
            panel.dispatchEvent(new Event('toggle'));
            observer.disconnect();
          }
        });
        observer.observe(canvas);
        setTimeout(() => observer.disconnect(), 10000);
      }
      await waitFor(() => panel.open, '双流面板已展开');
    }
    return {label:'权重预取 · ' + count() + ' · ' + root.querySelector('[data-description]').textContent, mode:action.mode, step:action.step};
  };
})();
