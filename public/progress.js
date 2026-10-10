export const phases = [
  ['prepare','准备任务'], ['mapping','文案与产品映射'], ['cutouts','透明素材处理'],
  ['scene','场景与图文排版'], ['qc','成品质检'], ['delivery','归档交付']
];
const psdPhases = [['prepare','准备任务'],['rebuild','重建可编辑图层'],['qc','PSD 重开验证'],['delivery','归档交付']];
export function createProgress(psd=false) {
  return {steps:(psd?psdPhases:phases).map(([id,label])=>({id,label,state:'pending',detail:'等待执行'}))};
}
export function updateProgress(progress,event,now=new Date().toISOString()) {
  if(!progress||!event||!['running','completed'].includes(event.state))return false;
  const step=progress.steps.find(s=>s.id===event.stage);
  if(!step||step.state==='completed'&&event.state==='running')return false;
  step.state=event.state;step.detail=typeof event.detail==='string'?event.detail.slice(0,1000):step.label;
  step.startedAt??=now;if(event.state==='completed')step.finishedAt=now;
  return true;
}
export function readProgressMessage(progress,message) {
  for(const line of String(message).split(/\r?\n/)){
    if(!line.startsWith('[PROGRESS] '))continue;
    try{updateProgress(progress,JSON.parse(line.slice(11)));}catch{}
  }
}
export function finishProgress(progress,status,message,now=new Date().toISOString()) {
  if(!progress)return;
  if(status==='completed')for(const step of progress.steps){step.state='completed';step.finishedAt??=now;step.detail=step.id==='delivery'?'产出文件与质检结果已归档':step.detail==='等待执行'?'已完成并通过最终检查':step.detail;}
  else for(const step of progress.steps)if(step.state==='running'){step.state=status==='needs_input'?'waiting':status==='cancelled'?'stopped':'failed';step.detail=message||'执行已中断';}
}
export function progressSummary(progress,status) {
  const steps=progress?.steps||createProgress().steps,done=steps.filter(s=>s.state==='completed').length;
  return {steps,done,total:steps.length,value:done/steps.length*100,busy:['queued','running'].includes(status)};
}
