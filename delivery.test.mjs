import {test} from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {parseCsv,validatePngDelivery,recoverCompletedPngJob} from './delivery.mjs';

test('CSV handles multiline copy and escaped quotes',()=>{
  const rows=parseCsv('\uFEFFsource_filename,copy_record,status\r\nA.jpg,"名称,型号\n卖点""引号""",passed\r\n');
  assert.equal(rows[0].copy_record,'名称,型号\n卖点"引号"');
  assert.throws(()=>parseCsv('a,b\n"unterminated'));
});

test('six displayed products pass with nineteen explicitly unused backups, but missing assigned output fails',async()=>{
  const cwd=await fs.mkdtemp(path.join(os.tmpdir(),'geo-delivery-'));
  assert.ok(path.resolve(cwd).startsWith(path.resolve(os.tmpdir())+path.sep));
  try{
    await fs.mkdir(path.join(cwd,'output','product-cutouts'),{recursive:true});
    const products=Array.from({length:25},(_,i)=>({name:'product'+i+'.jpg'}));
    const manifest={products};
    const mapping='source_filename,product_name,copy_record,status,cutout_filename,final_filename\n'+products.map((p,i)=>i<6?`${p.name},商品${i},"名称\n卖点",passed_normal_display,product${i}.png,grid.png`:`${p.name},,,unused_no_copy,,`).join('\n');
    await fs.writeFile(path.join(cwd,'input.json'),JSON.stringify(manifest));
    await fs.writeFile(path.join(cwd,'output','mapping.csv'),mapping);
    const png=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png[25]=6;
    const files=['mapping.csv','qc-report.md','final-cards/grid.png',...products.slice(0,6).map(p=>'product-cutouts/'+p.name.replace('.jpg','.png'))].map(name=>({name}));
    for(const f of files.filter(f=>f.name.startsWith('product-cutouts/')))await fs.writeFile(path.join(cwd,'output',f.name),png);
    assert.equal(await validatePngDelivery(cwd,manifest,files),true);
    assert.equal(await validatePngDelivery(cwd,manifest,files.filter(f=>!f.name.endsWith('product5.png'))),false);
    const job={status:'incomplete',finalCompleted:false,message:'输出或质检证明不完整，请检查结果。',report:{status:'completed',verified:true,message:'已完成六款'}};
    assert.equal(await recoverCompletedPngJob(job,cwd,files),true);
    assert.equal(job.finalCompleted,true);assert.equal(job.status,'completed');
    const retryFailed={status:'incomplete',finalCompleted:false,message:'CLI 执行失败，请查看日志后重试。',report:{status:'completed',verified:true,message:'此前成品已完成'}};
    assert.equal(await recoverCompletedPngJob(retryFailed,cwd,files),true);assert.equal(retryFailed.status,'incomplete');assert.match(retryFailed.message,/CLI/);assert.equal(retryFailed.finalCompleted,true);
    const failed={status:'incomplete',message:'输出或质检证明不完整',report:{status:'completed',verified:false}};
    assert.equal(await recoverCompletedPngJob(failed,cwd,files),false);
    await fs.writeFile(path.join(cwd,'output','mapping.csv'),mapping.replaceAll('unused_no_copy','needs_input'));
    assert.equal(await validatePngDelivery(cwd,manifest,files),false);
  }finally{await fs.rm(cwd,{recursive:true,force:true});}
});
