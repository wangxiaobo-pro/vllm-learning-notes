(() => {
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.openLessonTarget = async action => {
    const scenario = action.scenario || 'middle';
    if (!['middle','all','first'].includes(scenario)) throw new Error('未知验证情形');
    const compare = document.getElementById('draft-compare');
    if (compare) {
      if (action.mode !== 'comparison') throw new Error('该目标属于算法详解页，请先跨页导航');
      if (![4,5].includes(Number(action.step))) throw new Error('对照页仅有验证情形控制，目标应为验证或有效输出区域');
      const select = compare.querySelector('#scenario'); select.value = scenario; select.dispatchEvent(new Event('change', {bubbles:true})); await settle();
      if (select.value !== scenario || !compare.querySelector('#new-output').textContent.trim()) throw new Error('验证对照状态未生效');
      return {label: '串行 / 并行算法对照 · ' + select.selectedOptions[0].textContent + ' · 新增 ' + compare.querySelector('#new-output').textContent};
    }
    const root = document.getElementById('spec-method-guide'), method = action.mode, step = Number(action.step ?? 0);
    if (!root || !['eagle','eagle3','mtp','draft','medusa','dflash','ngram'].includes(method)) throw new Error('投机算法目标不存在');
    if (!Number.isInteger(step) || step < 0) throw new Error('投机算法步骤无效');
    const select = root.querySelector('#method'); select.value = method; select.dispatchEvent(new Event('change', {bubbles:true}));
    const situation = root.querySelector('#scenario'); situation.value = scenario; situation.dispatchEvent(new Event('change', {bubbles:true}));
    root.querySelector('#global').click();
    for (let i = 0; i < step; i++) { const next = root.querySelector('#next'); if (next.disabled) throw new Error('投机算法步骤越界'); next.click(); }
    await settle();
    if (select.value !== method || situation.value !== scenario || Number(root.querySelector('#position').dataset.step) !== step) throw new Error('投机算法状态未切换成功');
    return {label: select.selectedOptions[0].textContent + ' · ' + root.querySelector('#position').textContent + ' · ' + root.querySelector('#current-title').textContent};
  };
})();
