# 新主题的流程数据接口

`<topic>/lesson.js` 声明 `window.LESSON`，由公共工作台生成离线 HTML。数据构建函数只计算教学示例，不访问 DOM 或网络；数值、图、表格和步骤须来自同一份计算结果。

```js
window.LESSON = {
  title: '主题名称', subtitle: '本页解决的问题', kind: '基础知识 / 框架机制',
  controls: [
    {id:'scenario', label:'场景', type:'select', value:'normal', options:[{value:'normal',label:'普通路径'}]},
    {id:'count', label:'数量', type:'number', value:4, min:1, max:16, step:1}
  ],
  build(params) {
    return {
      scope:'固定实现、简化条件与教学假设',
      nodes:[
        {id:'input', title:'上游输入', lane:'CPU', detail:'x = [1, 2]', row:0, col:0, readyAt:0},
        {id:'output', title:'下游消费者', lane:'GPU', detail:'y = [3, 4]', row:1, col:0, readyAt:1}
      ],
      edges:[{id:'produce', from:'input', to:'output', label:'x → y', steps:[1]}],
      steps:[{
        title:'执行一个实际动作', summary:'谁消费什么，并把结果交给谁。',
        activeNodes:['input','output'], activeEdges:['produce'],
        state:{output:'本步结果 y = [3, 4]'},
        equation:'可选公式', tables:[], plots:[], notes:[]
      }],
      metrics:[{label:'关键量',value:'4 tokens'}],
      tables:[{title:'数据表',headers:['字段','值'],rows:[['x','[1, 2]']]}],
      plots:[], notes:['教学数值，不表示硬件执行或性能实测。']
    };
  },
  sources:[{label:'论文、官方文档或固定 commit 源码',url:'https://...'}],
  related:[{label:'相关主题',href:'../scheduler/index.html'}]
};
```

- 控件类型：`select`、`number`、`range`。数值控件有有限上下界；`showIf(params)` 可选，用于只显示当前场景的参数。选择值使用字符串。
- `build` 必须确定性返回新对象，不修改 `params`，不依赖浏览器。不同场景可有不同节点、边和步数。
- 节点 `row`、`col` 是逻辑网格，最多三列；同一行适合并列的输入/参与者。窄屏按行列顺序重排，保持可读字号。`lane` 标参与方。每条边须有生产者、消费者、传递内容与步骤编号。
- `step=0` 表示全局关系，`1..steps.length` 表示具体步骤。`state` 覆盖该步节点详情；未覆盖且尚未到 `readyAt` 的输出显示等待状态，避免提前显示已完成结果。关键持久状态请逐步显式提供。
- 全局表与图表放结果顶层；需要每步不同内容时在该步提供 `tables`、`plots`。不存在的步骤字段沿用全局内容。
- `metrics`、`tables`、`equation` 等均用原始计算值格式化，不手写相互矛盾的副本。表格内容为字符串或有限数字，不放 HTML。
- 支持图表：
  - `bars`：`{type:'bars',title,labels:['a','b'],series:[{label:'概率',values:[0.2,0.8]}],unit:'概率'}`。
  - `vectors`：`{type:'vectors',title,vectors:[{label:'q',x:1,y:2},{label:'旋转后 q',x:-2,y:1}]}`。
  - `timeline`：`{type:'timeline',title,unit:'ms',rows:[{label:'A',segments:[{label:'排队',start:0,end:20,kind:'wait'}],events:[{label:'token 1',time:100}]}]}`。
  - `stack`：`{type:'stack',title,total:80,parts:[{label:'权重',value:14},{label:'KV',value:2}],unit:'GiB'}`，超过总量须显示超出，不裁成看似能放下。
- 公共页面提供全局/上一步/下一步、步骤列表、重置参数、状态恢复、来源及相关主题。没有真实时间测量时不使用动画时长比较性能。

框架主题另写标准 `call-chain.json`，固定完整源码 SHA，关键流程至少展开真实的几层调用，明确异步/跨进程边界。目标格式为：

```json
{"label":"定位输入打包", "action":{"step":3,"params":{"scenario":"normal"}}}
```

适配器内容：

```js
window.openLessonTarget = async action => window.lessonController.openTarget(action);
```

`openTarget` 会先恢复默认参数，再应用目标参数，并验证场景和步数，返回实际定位标签。基础数学主题不编造 vLLM 调用链。每个主题保留 README 与有意义的独立数值/状态验证脚本；HTML、源码锁、首页和范围元数据由根任务统一生成。
