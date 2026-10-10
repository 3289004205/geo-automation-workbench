import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beginRun,threadFromEvents,executionArgs,continuationPrompt} from './continuation.mjs';
import {createProgress,updateProgress,finishProgress,readProgressMessage} from './public/progress.js';

test('resume retains completed phases, reports, old logs and ordered instructions',()=>{
  const progress=createProgress();
  for(const stage of ['prepare','mapping','cutouts'])updateProgress(progress,{stage,state:'completed',detail:'已验证'});
  updateProgress(progress,{stage:'scene',state:'running',detail:'等待说明'});
  finishProgress(progress,'needs_input','请补充文案');
  const job={status:'needs_input',progress,report:{status:'needs_input'},logs:[{text:'旧日志'}],followups:[{text:'仅使用已有工具'}]};
  assert.equal(beginRun(job,'允许少量白边',false),true);
  assert.equal(job.progress.steps.filter(s=>s.state==='completed').length,3);
  assert.equal(job.progress.steps[3].state,'pending');
  assert.equal(job.logs[0].text,'旧日志');
  assert.deepEqual(job.followups.map(x=>x.text),['仅使用已有工具','允许少量白边']);
  assert.equal(job.report.status,'needs_input');
  assert.equal(job.attempts[0].progress.steps[3].state,'waiting');
  assert.match(continuationPrompt(job,[{name:'product-cutouts/A.png'}],true),/product-cutouts\/A.png/);
  beginRun(job,'',false);assert.equal(job.followups.length,2);
});

test('legacy events recover exact task session and CLI resumes it',()=>{
  const id='01a12478-ccf9-7c32-bfe5-ec1fb024af69';
  assert.equal(threadFromEvents('invalid\n'+JSON.stringify({type:'thread.started',thread_id:id})),id);
  const args=executionArgs([],'task-dir',{generatedImages:'images',library:'library',schema:'schema',result:'result'},id);
  assert.deepEqual(args.slice(args.indexOf('resume'),args.indexOf('resume')+2),['resume',id]);
  assert.ok(!args.includes('--last'));
  assert.ok(!executionArgs([],'task-dir',{},undefined).includes('resume'));
});

test('new requirements reopen only affected stage and downstream',()=>{
  const progress=createProgress();finishProgress(progress,'completed','done');
  readProgressMessage(progress,'[PROGRESS] '+JSON.stringify({stage:'scene',state:'running',invalidate:true,detail:'修正标题'}));
  assert.deepEqual(progress.steps.map(s=>s.state),['completed','completed','completed','running','pending','pending']);
});
