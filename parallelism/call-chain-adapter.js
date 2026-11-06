(() => {
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.openLessonTarget = async action => {
    const root = document.getElementById('parallelism-flows');
    if (!root) throw new Error('未找到并行流程 document');
    const mode = action.mode, step = Number(action.step ?? 0), view = action.view || 'device';
    if (!['tp','ep','sp','pp','cp','dp','tpsp','dpep','dptpp'].includes(mode)) throw new Error('调用链仅对应 vLLM 推理模式');
    if (!Number.isInteger(step) || step < 0 || !['device','detail'].includes(view)) throw new Error('无效并行流程目标');
    const button = [...root.querySelectorAll('[data-mode]')].find(el => el.dataset.mode === mode);
    if (!button) throw new Error('未找到并行方式');
    button.click();
    if (mode === 'dp') root.querySelector('[data-scenario="dp"]').click();
    const viewButton = root.querySelector('[data-view="' + view + '"]');
    if (!viewButton || viewButton.disabled) throw new Error('此模式不支持目标视图');
    viewButton.click(); root.querySelector('#pf-overview').click();
    for (let i = 0; i < step; i++) { const next = root.querySelector('#pf-next'); if (next.disabled) throw new Error('并行步骤越界'); next.click(); }
    await settle();
    if (button.getAttribute('aria-pressed') !== 'true' || !root.querySelector('#pf-counter').textContent.startsWith(step + ' /')) throw new Error('并行流程状态未切换成功');
    return {label: root.querySelector('#pf-title').textContent + ' · ' + root.querySelector('#pf-counter').textContent};
  };
})();
