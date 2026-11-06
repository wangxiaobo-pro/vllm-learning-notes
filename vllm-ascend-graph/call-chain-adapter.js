(() => {
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.openLessonTarget = async action => {
    const root = document.getElementById('ascend-op-detail');
    if (!root) throw new Error('未找到图捕获可视化 document');
    const get = id => { const el = root.querySelector('#' + id); if (!el) throw new Error('缺少控件：' + id); return el; };
    if (!['capture', 'replay'].includes(action.mode)) throw new Error('未知捕获模式');
    const step = Number(action.step ?? 0), operator = Number(action.operator ?? 0);
    if (!Number.isInteger(step) || step < 0 || step > 7 || !Number.isInteger(operator) || operator < 0 || operator > 12) throw new Error('图步骤越界');
    get('od-mode').value = action.mode; get('od-mode').dispatchEvent(new Event('change', {bubbles:true}));
    get('od-both').click();
    for (let i = 0; i < step; i++) get('od-stage-next').click();
    get('od-all').click();
    if (operator) { get('od-expanded').open = true; for (let i = 0; i < operator; i++) get('od-next').click(); }
    await settle();
    if (get('od-mode').value !== action.mode || (step && !get('od-stage-count').textContent.startsWith(step + ' /'))) throw new Error('图状态未切换成功');
    if (operator && !get('od-count').textContent.startsWith(operator + ' /')) throw new Error('算子状态未切换成功');
    return {label: `${get('od-mode').selectedOptions[0].textContent} · ${get('od-stage-count').textContent}${operator ? ' · ' + get('od-count').textContent : ''}`};
  };
})();
