(() => {
  const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.openLessonTarget = async action => {
    const model = action.model || action.mode, component = action.component || 'overview', step = Number(action.step ?? 0);
    if (!window.ARCH_MODELS?.[model]?.components?.[component]) throw new Error('模型或组件不存在');
    const entry = window.ARCH_MODELS[model].components[component];
    if (!Number.isInteger(step) || step < 0 || step > entry.steps.length) throw new Error('组件步骤越界');
    const sheet = [...document.querySelectorAll('#sheets [data-model]')].find(el => el.dataset.model === model);
    if (!sheet) throw new Error('模型选择入口不存在');
    const url = new URL(location.href); url.hash = encodeURIComponent(model) + '/' + encodeURIComponent(component);
    history.replaceState(null, '', url); window.dispatchEvent(new HashChangeEvent('hashchange')); await settle();
    const select = document.getElementById('component-select');
    document.getElementById('all').click();
    for (let i = 0; i < step; i++) document.getElementById('next').click();
    if (action.node) {
      const button = [...document.querySelectorAll('.graph-node')].find(el => el.dataset.node === action.node);
      if (!button || button.dataset.target) throw new Error('目标应为当前组件的叶子算子');
      button.click();
    }
    await settle();
    const selectedModel = document.querySelector('#sheets [aria-current="page"]')?.dataset.model;
    if (selectedModel !== model || select.value !== component) throw new Error('模型组件切换未生效');
    if (step && !document.getElementById('counter').textContent.startsWith(step + ' /')) throw new Error('组件步骤切换未生效');
    return {label: `${document.getElementById('model-name').textContent} · ${document.getElementById('component-title').textContent} · ${document.getElementById('counter').textContent}`};
  };
})();
