/* Common entry: verified call tree -> existing visualization, preserving native DOM. */
(() => {
  function mount() {
    const dataElement = document.getElementById('lesson-call-chain-data');
    if (!dataElement || document.getElementById('lesson-call-chain')) return;
    const data = JSON.parse(dataElement.textContent);
    const variants = new Map(data.variants.map(variant => [variant.id,variant]));
    const fallback = variants.get(data.defaultVariant) || data.variants[0];
    const topic = data.topic;
    const original = [...document.body.children].filter(node =>
      !['SCRIPT','STYLE','LINK','META','NOSCRIPT'].includes(node.tagName) && !node.classList.contains('learning-scope-shell'));
    original.forEach(node => node.classList.add('lesson-original'));
    const frame = document.getElementById('codex-visualization');
    const storageKey = 'lesson-call-chain:' + topic + ':' + location.pathname.split('/').at(-1);
    let variant = fallback, selected = variant.entry || variant.nodes[0].id, screen = 'chain', targetIndex = null;
    let collapsed = new Set(), busy = false, revision = 0, frameReady = false, requestId = 0;
    const replies = new Map();
    let nativeQueue = Promise.resolve();
    const nodeById = id => variant.nodes.find(node => node.id === id);
    const make = (tag,text,className) => {
      const node = document.createElement(tag);
      if (text !== undefined) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    const root = make('section',undefined,'code-walkthrough');
    root.id = 'lesson-call-chain';
    root.innerHTML = `<header class="cw-header"><a href="../index.html">← vLLM 学习笔记</a><h1></h1><p>先沿源码调用链定位接口，再进入对应的可视化步骤。</p></header>
      <nav class="cw-nav" aria-label="阅读方式"><button type="button" data-cw-view="chain">01 整体调用链</button><button type="button" data-cw-view="visual">02 可视化执行</button></nav>
      <p class="cw-error" role="alert" hidden></p>
      <section class="cw-chain"><div class="cw-variant"><label>实现与场景 <select aria-label="选择调用链实现"></select></label><p class="cw-scope-text"></p><details class="cw-scope"><summary>源码仓库与固定 commit</summary><div class="cw-repositories"></div></details></div>
      <p class="cw-guide">默认展开三层，点 ＋ 继续跟入子调用。父子缩进表示调用或明确标记的控制块；异步提交与消费分别说明。点名称查看数据变化，沿详情中的调用路径返回上层。</p>
      <div class="cw-layout"><section class="cw-tree-panel" aria-label="源码调用树"><div class="cw-tools"><strong></strong><div><button type="button" data-cw-depth>展开三层</button> <button type="button" data-cw-expand>全部展开</button> <button type="button" data-cw-fold>只看主链</button></div></div><div class="cw-tree-scroll"><ol class="cw-tree"></ol></div></section>
      <article class="cw-detail" tabindex="-1" aria-labelledby="cw-node-title"><nav class="cw-path" aria-label="当前调用路径"></nav><div class="cw-kicker"></div><h2 id="cw-node-title"></h2><p class="cw-summary"></p><dl class="cw-data"></dl><p class="cw-note" hidden></p>
      <section class="cw-evidence"><h3>源码依据 · 行号属于所示 commit</h3><div></div></section><section class="cw-targets"><h3>进入可视化执行</h3><p>按下列入口定位现有图中的对应步骤。</p><div></div></section></article></div></section>
      <div class="cw-context" tabindex="-1" hidden></div>`;
    document.body.insertBefore(root,original[0] || dataElement);
    const $ = selector => root.querySelector(selector);
    $('.cw-header h1').textContent = data.title;
    for (const item of data.variants) {
      const option = make('option',item.title); option.value = item.id; $('.cw-variant select').append(option);
    }
    function validState(value) {
      const nextVariant = variants.get(value?.variant);
      const node = nextVariant?.nodes.find(item => item.id === value.node);
      if (!node || !['chain','visual'].includes(value.screen)) return null;
      const target = value.target === null ? null : Number(value.target);
      if (target !== null && (!Number.isInteger(target) || target < 0 || target >= node.targets.length)) return null;
      return {variant:nextVariant.id,node:node.id,screen:value.screen,target};
    }
    const state = () => ({variant:variant.id,node:selected,screen,target:targetIndex});
    function parseRoute() {
      const query = new URLSearchParams(location.search);
      if (!query.has('cw-view')) return null;
      return validState({variant:query.get('cw-variant'),node:query.get('cw-node'),screen:query.get('cw-view'),target:query.has('cw-target') ? query.get('cw-target') : null});
    }
    function applyState(next) {
      variant = variants.get(next.variant); selected = next.node; screen = next.screen; targetIndex = next.target;
    }
    try {
      const saved = validState(JSON.parse(localStorage.getItem(storageKey)));
      if (saved) applyState({...saved,screen:'chain'});
    } catch {}
    const requested = parseRoute();
    if (requested) applyState(requested);
    function routeKey() {
      const query = new URLSearchParams(location.search);
      return ['cw-view','cw-variant','cw-node','cw-target'].map(key => query.get(key)).join('|');
    }
    let lastRoute = routeKey();
    function urlFor(next = state(),url = new URL(location.href)) {
      url.searchParams.set('cw-view',next.screen); url.searchParams.set('cw-variant',next.variant); url.searchParams.set('cw-node',next.node);
      if (next.target === null) url.searchParams.delete('cw-target'); else url.searchParams.set('cw-target',String(next.target));
      return url;
    }
    function remember(method = 'replace') {
      try { localStorage.setItem(storageKey,JSON.stringify(state())); } catch {}
      const url = urlFor();
      if (url.href !== location.href) {
        try { history[method + 'State']({...history.state,lessonCallChain:state()},'',url); } catch {}
      }
      lastRoute = routeKey();
    }
    function depthOf(node) {
      let depth = 1;
      while (node.parent !== null) { node = nodeById(node.parent); depth++; }
      return depth;
    }
    function resetTree() {
      collapsed = new Set(variant.nodes.filter(node => depthOf(node) >= 3).map(node => node.id));
      revealSelected();
    }
    function revealSelected() {
      let node = nodeById(selected);
      while (node?.parent) { collapsed.delete(node.parent); node = nodeById(node.parent); }
    }
    function buildTree() {
      const top = $('.cw-tree'); top.replaceChildren();
      const append = (list,parent) => {
        const children = variant.nodes.filter(node => node.parent === parent);
        children.forEach((node,index) => {
          const item = make('li'), row = make('div',undefined,'cw-row');
          const hasChildren = variant.nodes.some(child => child.parent === node.id);
          const branch = make(hasChildren ? 'button' : 'span',hasChildren ? (collapsed.has(node.id) ? '+' : '−') : (index === children.length - 1 ? '└─' : '├─'),hasChildren ? 'cw-toggle' : 'cw-branch');
          if (hasChildren) {
            branch.type = 'button'; branch.dataset.cwToggle = node.id;
            branch.setAttribute('aria-expanded',!collapsed.has(node.id)); branch.setAttribute('aria-label',(collapsed.has(node.id) ? '展开 ' : '收起 ') + node.title);
          } else branch.setAttribute('aria-hidden','true');
          const button = make('button',undefined,'cw-node'); button.type = 'button'; button.dataset.cwNode = node.id;
          const childCount = variant.nodes.filter(child => child.parent === node.id).length;
          const label = make('span'); label.append(make('code',node.title),make('small','[' + node.kind + '] ' + node.summary + (childCount ? ' · ' + childCount + ' 个子节点' : '')));
          button.append(make('span',node.number,'cw-number'),label); row.append(branch,button); item.append(row);
          if (hasChildren) { const nested = make('ol',undefined,'cw-tree'); nested.hidden = collapsed.has(node.id); append(nested,node.id); item.append(nested); }
          list.append(item);
        });
      };
      append(top,null); $('.cw-tools strong').textContent = '调用与返回 · ' + variant.nodes.length + ' 节点 / ' + Math.max(...variant.nodes.map(depthOf)) + ' 层';
    }
    function detail() {
      const node = nodeById(selected);
      const ancestors = [];
      for (let item = node; item; item = item.parent === null ? null : nodeById(item.parent)) ancestors.unshift(item);
      const path = $('.cw-path'); path.replaceChildren(make('span','调用路径'));
      ancestors.forEach((item,index) => {
        if (index) path.append(make('span','›'));
        const part = make(index === ancestors.length - 1 ? 'span' : 'button',item.number + ' ' + item.title);
        if (part.tagName === 'BUTTON') { part.type = 'button'; part.dataset.cwAncestor = item.id; }
        path.append(part);
      });
      root.querySelectorAll('[data-cw-node]').forEach(button => {
        if (button.dataset.cwNode === selected) button.setAttribute('aria-current','true'); else button.removeAttribute('aria-current');
      });
      $('.cw-kicker').textContent = '节点 ' + node.number + ' / ' + node.kind;
      $('#cw-node-title').textContent = node.title; $('.cw-summary').textContent = node.summary;
      $('.cw-data').replaceChildren();
      for (const [label,key] of [['输入从哪来','input'],['内部动作与持久状态','changes'],['输出交给谁','output'],['返回后在哪里继续','resume']]) $('.cw-data').append(make('dt',label),make('dd',node[key]));
      $('.cw-note').hidden = !node.note; $('.cw-note').textContent = node.note || '';
      $('.cw-evidence>div').replaceChildren();
      $('.cw-evidence h3').textContent = variant.provenance === 'teaching' ? '算法教学对照 · 不绑定源码' : '源码依据 · 行号属于所示 commit';
      if (variant.provenance === 'teaching') $('.cw-evidence>div').append(make('p','此分支说明教学算法，不表示 vLLM 内存在同名函数。','cw-guide'));
      for (const evidence of node.evidence) {
        const repo = variant.repositories[evidence.repo];
        const link = make('a',evidence.label + ' · ' + evidence.path + ':' + evidence.line + (evidence.end ? '–' + evidence.end : ''));
        link.href = repo.url + '/blob/' + repo.commit + '/' + evidence.path + '#L' + evidence.line + (evidence.end ? '-L' + evidence.end : '');
        link.target = '_blank'; link.rel = 'noopener noreferrer'; link.title = repo.commit;
        link.append(make('small',(repo.label || evidence.repo) + ' @ ' + repo.commit.slice(0,10)));
        $('.cw-evidence>div').append(link);
      }
      $('.cw-targets>div').replaceChildren();
      node.targets.forEach((target,index) => {
        const button = make('button',target.label + ' →','cw-jump'); button.type = 'button'; button.dataset.cwTarget = index; button.disabled = busy;
        $('.cw-targets>div').append(button);
      });
    }
    function render() {
      const visual = screen === 'visual';
      root.dataset.cwBusy = String(busy);
      root.dataset.cwScreen = screen;
      original.forEach(node => node.classList.toggle('lesson-hidden',!visual));
      $('.cw-header').hidden = visual; $('.cw-chain').hidden = visual; $('.cw-context').hidden = !visual;
      root.querySelectorAll('[data-cw-view]').forEach(button => button.setAttribute('aria-pressed',button.dataset.cwView === screen));
      $('[data-cw-view=chain]').textContent = visual ? '← 返回调用链' : '01 整体调用链';
      $('.cw-variant select').value = variant.id; $('.cw-scope-text').textContent = variant.scope;
      const repos = $('.cw-repositories'); repos.replaceChildren();
      $('.cw-scope summary').textContent = variant.provenance === 'teaching' ? '算法教学对照 · 无源码仓库' : '源码仓库与固定 commit';
      for (const [key,repo] of Object.entries(variant.repositories)) {
        const link = make('a',(repo.label || key) + ' · ' + repo.url.replace('https://github.com/','') + ' @ ' + repo.commit);
        link.href = repo.url + '/tree/' + repo.commit; link.target = '_blank'; link.rel = 'noopener noreferrer'; repos.append(link);
      }
      $('.cw-context').textContent = targetIndex === null
        ? '当前展示原交互流程。从调用链的具体节点跳转，可定位对应模式和步骤。'
        : '来自节点 ' + nodeById(selected).number + ' · ' + nodeById(selected).title + '。可继续使用图中的模式与步进控件。';
      detail();
      if (visual) window.dispatchEvent(new Event('resize'));
    }
    function scrollSelected() {
      const button = root.querySelector('[data-cw-node="' + selected + '"]'), box = $('.cw-tree-scroll');
      const a = button.getBoundingClientRect(), b = box.getBoundingClientRect();
      if (a.top < b.top) box.scrollTop += a.top - b.top - 8;
      else if (a.bottom > b.bottom) box.scrollTop += a.bottom - b.bottom + 8;
    }
    function clearError() { $('.cw-error').hidden = true; $('.cw-error').textContent = ''; }
    function errorMessage(error) { $('.cw-error').textContent = '无法定位该步骤：' + error.message; $('.cw-error').hidden = false; }
    window.addEventListener('message',event => {
      if (!frame || event.source !== frame.contentWindow || !event.data) return;
      if (event.data.type === 'lesson-call-ready') frameReady = true;
      if (event.data.type === 'lesson-call-result') {
        const pending = replies.get(event.data.id);
        if (pending) { replies.delete(event.data.id); clearTimeout(pending.timer); event.data.ok ? pending.resolve(event.data.result) : pending.reject(new Error(event.data.error)); }
      }
      if (event.data.type === 'lesson-call-edited' && !busy && screen === 'visual') markEdited();
    });
    function markEdited() {
      targetIndex = null;
      $('.cw-context').textContent = '图中的模式或步骤已手动调整，当前状态不再绑定调用链节点。返回调用链可重新定位源码对应步骤。';
      remember();
    }
    async function invoke(action) {
      if (!frame) {
        if (typeof window.openLessonTarget !== 'function') throw new Error('当前页面缺少步骤入口');
        const work = nativeQueue.then(() => window.openLessonTarget(action));
        nativeQueue = work.catch(() => {});
        return work;
      }
      const deadline = Date.now() + 5000;
      while (!frameReady && Date.now() < deadline) {
        frame.contentWindow?.postMessage({type:'lesson-call-ping'},'*');
        await new Promise(resolve => setTimeout(resolve,80));
      }
      if (!frameReady) throw new Error('内嵌可视化尚未就绪，请稍后重试');
      const id = topic + ':' + ++requestId;
      return new Promise((resolve,reject) => {
        const timer = setTimeout(() => { replies.delete(id); reject(new Error('步骤定位超时')); },8000);
        replies.set(id,{resolve,reject,timer});
        frame.contentWindow.postMessage({type:'lesson-call-open',id,action},'*');
      });
    }
    async function openTarget(index,method = 'push',scroll = true) {
      const target = nodeById(selected).targets[index];
      if (!target) return;
      const currentPage = location.pathname.split('/').at(-1);
      if (target.action.page && target.action.page !== currentPage) {
        if (!['index.html','comparison.html'].includes(target.action.page)) throw new Error('不支持的页面目标');
        const url = new URL(target.action.page,location.href); url.hash = '';
        location.assign(urlFor({...state(),screen:'visual',target:index},url)); return;
      }
      const job = ++revision; busy = true; screen = 'visual'; targetIndex = index; clearError(); render();
      $('.cw-context').textContent = '正在定位：' + target.label;
      try {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const result = await invoke(target.action);
        if (job !== revision) return;
        $('.cw-context').textContent = '来自节点 ' + nodeById(selected).number + ' · ' + nodeById(selected).title + ' → ' + (result?.label || target.label);
        if (method) remember(method);
        if (scroll) { $('.cw-context').scrollIntoView({block:'start'}); $('.cw-context').focus({preventScroll:true}); }
      } catch (error) {
        if (job === revision) { screen = 'chain'; render(); errorMessage(error); }
      } finally { if (job === revision) { busy = false; root.dataset.cwBusy = 'false'; detail(); } }
    }
    function pauseVisual() {
      if (frame) frame.contentWindow?.postMessage({type:'lesson-call-pause'},'*');
      else window.dispatchEvent(new Event('lesson-pause-visual'));
    }
    function openChain() {
      revision++; busy = false; screen = 'chain'; clearError();
      pauseVisual();
      revealSelected(); buildTree(); render(); remember('push'); scrollSelected();
      root.scrollIntoView({block:'start'});
    }
    root.addEventListener('click',event => {
      const target = event.target.closest('[data-cw-target]');
      if (target) { openTarget(Number(target.dataset.cwTarget)); return; }
      const layer = event.target.closest('[data-cw-view]');
      if (layer) {
        if (layer.dataset.cwView === 'chain') openChain();
        else if (targetIndex !== null) openTarget(targetIndex);
        else { screen = 'visual'; clearError(); render(); remember('push'); }
        return;
      }
      const toggle = event.target.closest('[data-cw-toggle]');
      if (toggle) {
        const id = toggle.dataset.cwToggle;
        if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
        buildTree(); detail(); root.querySelector('[data-cw-toggle="' + id + '"]').focus({preventScroll:true}); return;
      }
      const button = event.target.closest('[data-cw-node],[data-cw-ancestor]');
      if (button) {
        selected = button.dataset.cwNode || button.dataset.cwAncestor; targetIndex = null; clearError();
        if (button.dataset.cwAncestor) { revealSelected(); buildTree(); }
        detail(); remember('push');
        if (button.dataset.cwAncestor) scrollSelected();
        if (matchMedia('(max-width:760px)').matches) { $('.cw-detail').scrollIntoView({block:'start'}); $('.cw-detail').focus({preventScroll:true}); }
      }
    });
    $('[data-cw-expand]').addEventListener('click',() => { collapsed.clear(); buildTree(); detail(); });
    $('[data-cw-depth]').addEventListener('click',() => { resetTree(); buildTree(); detail(); });
    $('[data-cw-fold]').addEventListener('click',() => { collapsed = new Set(variant.nodes.filter(node => node.parent !== null).map(node => node.id)); buildTree(); detail(); });
    $('.cw-variant select').addEventListener('change',event => {
      variant = variants.get(event.target.value); selected = variant.entry || variant.nodes[0].id; targetIndex = null;
      resetTree(); buildTree(); clearError(); render(); remember('push');
    });
    for (const name of ['click','change']) document.addEventListener(name,event => {
      if (event.isTrusted && !busy && screen === 'visual' && event.target.closest('.lesson-original') && event.target.closest('button,select,input')) markEdited();
    },true);
    window.addEventListener('popstate',() => {
      if (routeKey() === lastRoute) return;
      lastRoute = routeKey(); revision++; busy = false;
      const next = parseRoute() || {variant:fallback.id,node:fallback.entry || fallback.nodes[0].id,screen:'chain',target:null};
      applyState(next); resetTree(); buildTree(); render(); clearError();
      if (screen === 'visual' && targetIndex !== null) openTarget(targetIndex,null,false);
      else if (screen === 'chain') { pauseVisual(); scrollSelected(); }
    });
    resetTree(); buildTree(); render();
    if (screen === 'visual' && targetIndex !== null) openTarget(targetIndex,null,false);
    else if (screen === 'chain') scrollSelected();
    document.documentElement.dataset.callChainReady = 'true';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();
