(() => {
  const groups = [...document.querySelectorAll('.module')].map(element => ({
    element,
    id: element.id,
    label: element.dataset.label,
    count: element.querySelector('.module-count'),
    flows: [...element.querySelectorAll('.flow')].map(link => ({
      item: link.closest('li'),
      searchText: `${element.dataset.label} ${link.textContent} ${link.dataset.keywords || ''}`.toLocaleLowerCase(),
    })),
  }));
  const search = document.querySelector('#flow-search');
  const nav = document.querySelector('#module-nav');
  const status = document.querySelector('#result-status');
  const emptyState = document.querySelector('#empty-state');
  const toggle = document.querySelector('#toggle-groups');
  const total = groups.reduce((sum, group) => sum + group.flows.length, 0);
  const filters = [];
  let activeModule = 'all';

  function updateToggle() {
    const visibleGroups = groups.filter(group => !group.element.hidden);
    toggle.disabled = visibleGroups.length === 0;
    toggle.textContent = visibleGroups.every(group => group.element.open) ? '收起全部' : '展开全部';
  }

  function applyFilters() {
    const query = search.value.trim().toLocaleLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    let visibleCount = 0;

    for (const group of groups) {
      let matches = 0;
      for (const flow of group.flows) {
        const match = terms.every(term => flow.searchText.includes(term));
        flow.item.hidden = !match;
        if (match) matches += 1;
      }
      group.element.hidden = matches === 0 || (activeModule !== 'all' && activeModule !== group.id);
      group.count.textContent = query ? `${matches} / ${group.flows.length}` : `${group.flows.length} 个流程`;
      if (!group.element.hidden) {
        visibleCount += matches;
        if (query) group.element.open = true;
      }
    }

    for (const filter of filters) {
      filter.button.setAttribute('aria-pressed', String(filter.id === activeModule));
    }
    emptyState.hidden = visibleCount > 0;
    const label = activeModule === 'all' ? '全部模块' : groups.find(group => group.id === activeModule).label;
    status.textContent = `${label} · ${visibleCount} 个流程${query ? ` · 搜索“${search.value.trim()}”` : ''}`;
    status.hidden = !query && activeModule === 'all';
    updateToggle();
  }

  function addFilter(id, label, count) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'module-filter';
    button.setAttribute('aria-controls', 'flow-groups');
    const name = document.createElement('span');
    name.textContent = label;
    const badge = document.createElement('span');
    badge.className = 'filter-count';
    badge.textContent = count;
    button.append(name, badge);
    button.addEventListener('click', () => {
      activeModule = id;
      if (id !== 'all') groups.find(group => group.id === id).element.open = true;
      applyFilters();
    });
    nav.append(button);
    filters.push({ id, button });
  }

  addFilter('all', '全部流程', total);
  for (const group of groups) {
    addFilter(group.id, group.label, group.flows.length);
    group.element.addEventListener('toggle', updateToggle);
  }
  search.addEventListener('input', applyFilters);
  toggle.addEventListener('click', () => {
    const visibleGroups = groups.filter(group => !group.element.hidden);
    const open = !visibleGroups.every(group => group.element.open);
    for (const group of visibleGroups) group.element.open = open;
    updateToggle();
  });
  document.querySelector('#reset-filters').addEventListener('click', () => {
    search.value = '';
    activeModule = 'all';
    for (const group of groups) group.element.open = true;
    applyFilters();
    search.focus();
  });

  const catalogCount = document.querySelector('#catalog-count');
  catalogCount.textContent = `${total} 个流程 / ${groups.length} 个模块`;
  catalogCount.hidden = false;
  document.querySelector('.sidebar').hidden = false;
  document.querySelector('.toolbar').hidden = false;
  applyFilters();
})();
