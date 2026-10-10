import {createProgress} from './public/progress.js';

export function threadFromEvents(events) {
  for (const line of events.split(/\r?\n/)) {
    try { const event=JSON.parse(line); if(event.type==='thread.started' && /^[a-f0-9-]{36}$/i.test(event.thread_id))return event.thread_id; } catch {}
  }
}

export function beginRun(job,instruction,psd,now=new Date().toISOString()) {
  const continuing=Boolean(job.progress||job.report||job.threadId||job.logs?.length);
  job.followups??=[];
  if(instruction.trim())job.followups.push({time:now,text:instruction});
  job.attempts??=[];
  job.attempts.push({time:now,status:job.status,message:job.message,report:job.report,progress:structuredClone(job.progress)});
  if(!job.progress || (psd && !job.progress.steps.some(s=>s.id==='rebuild')))job.progress=createProgress(psd);
  else for(const step of job.progress.steps)if(['waiting','stopped','failed','running'].includes(step.state)){step.state='pending';step.detail='等待接续执行';}
  job.logs??=[];
  job.logs.push({time:now,text:continuing?'接续原任务，保留已完成阶段和已有产出。':'开始执行任务。'});
  job.status='running';job.message='';job.questions=[];
  return continuing;
}

export function continuationPrompt(job,files,continuing) {
  if(!continuing)return '';
  return '\n这是原任务的后续轮次，不是新任务。读取 continuation.json 与当前 output，接续尚未完成的阶段。保留已完成且仍有效的映射、透明素材、场景和排版结果，禁止无理由重新生成。历次补充说明按时间顺序继承，冲突时最新用户要求优先。只有新说明使已有结果失效或文件确实缺失/质检失败时，才重做受影响部分；先说明原因，再发送 [PROGRESS] 事件，stage 为最早受影响阶段，state 为 running，invalidate 为 true，以重新开放该阶段及后续阶段。完整流程是验收依据，不代表每轮重跑。\n续跑检查点：'+JSON.stringify({progress:job.progress,report:job.report,followups:job.followups,files});
}

export function executionArgs(prefix,cwd,runtime,threadId) {
  const common=[...prefix,'exec','--sandbox','workspace-write','--add-dir',runtime.generatedImages,'--add-dir',runtime.library,'-c','approval_policy="never"','-C',cwd];
  if(threadId)common.push('resume',threadId);
  return [...common,'--json','--skip-git-repo-check','--output-schema',runtime.schema,'-o',runtime.result,'-'];
}
