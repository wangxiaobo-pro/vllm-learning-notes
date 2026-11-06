// Runs in the visualization document, including sandboxed srcdoc frames.
(() => {
  const pending = new Map();
  let queue = Promise.resolve();
  const ready = document.readyState === 'loading'
    ? new Promise(resolve => document.addEventListener('DOMContentLoaded',resolve,{once:true}))
    : Promise.resolve();
  const pause = () => document.querySelectorAll('button').forEach(button => {
    if (/^(暂停(?:流程|播放|动画)?|停止播放)$/.test(button.textContent.trim())) button.click();
  });
  window.addEventListener('lesson-pause-visual',pause);
  if (parent === window) return;
  const post = data => parent.postMessage(data,'*');
  window.addEventListener('message',async event => {
    if (event.source !== parent || !event.data || typeof event.data !== 'object') return;
    const {type,id,action} = event.data;
    if (type === 'lesson-call-ping') {
      await ready; post({type:'lesson-call-ready'}); return;
    }
    if (type === 'lesson-call-pause') { pause(); return; }
    if (type !== 'lesson-call-open' || typeof id !== 'string') return;
    if (!pending.has(id)) {
      const work = queue.then(() => ready).then(() => {
        if (typeof window.openLessonTarget !== 'function') throw new Error('可视化步骤入口尚未就绪');
        return window.openLessonTarget(action);
      });
      pending.set(id,work);
      queue = work.catch(() => {});
      if (pending.size > 16) pending.delete(pending.keys().next().value);
    }
    try { post({type:'lesson-call-result',id,ok:true,result:await pending.get(id)}); }
    catch (error) { post({type:'lesson-call-result',id,ok:false,error:error.message}); }
  });
  for (const name of ['click','change']) document.addEventListener(name,event => {
    if (event.isTrusted && event.target.closest('button,select,input')) post({type:'lesson-call-edited'});
  },true);
  ready.then(() => post({type:'lesson-call-ready'}));
})();
