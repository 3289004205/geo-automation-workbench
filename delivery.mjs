import {promises as fs} from 'node:fs';
import path from 'node:path';

// Mapping copy fields can contain quoted commas, newlines and escaped quotes.
export function parseCsv(text){
  const rows=[];let row=[],field='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}
    else if(!quoted&&(c===','||c==='\n')){row.push(field);field='';if(c==='\n'){rows.push(row);row=[];}}
    else if(c!=='\r'||quoted)field+=c;
  }
  if(quoted)throw Error('映射 CSV 引号未闭合。');
  if(field||row.length){row.push(field);rows.push(row);}
  const headers=rows.shift()||[];
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
}

export async function validatePngDelivery(cwd,manifest,files){
  if(!files.some(f=>/^final-cards\/.+\.png$/i.test(f.name))||!['mapping.csv','qc-report.md'].every(name=>files.some(f=>f.name===name)))return false;
  let rows;try{rows=parseCsv(await fs.readFile(path.join(cwd,'output','mapping.csv'),'utf8'));}catch{return false;}
  const products=manifest.products.filter(product=>{
    const matches=rows.filter(row=>row.source_filename===product.name);
    // Exclude only an explicitly unused source with no assigned copy/output.
    return !(matches.length===1&&matches[0].status==='unused_no_copy'&&!matches[0].product_name&&!matches[0].copy_record&&!matches[0].cutout_filename&&!matches[0].final_filename);
  });
  if(!products.length)return false;
  for(const product of products){
    const name='product-cutouts/'+product.name.replace(/\.[^.]+$/,'.png');
    if(!files.some(f=>f.name===name))return false;
    const png=await fs.readFile(path.join(cwd,'output',name)).catch(()=>null);
    // Pixel fidelity and actual alpha coverage remain the QC report's checks.
    if(!png||png.length<33||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||!([4,6].includes(png[25])||png.includes(Buffer.from('tRNS'))))return false;
  }
  return true;
}

export async function recoverCompletedPngJob(job,cwd,files){
  if(job.finalCompleted||['running','queued'].includes(job.status)||job.report?.status!=='completed'||job.report?.verified!==true)return false;
  const manifest=JSON.parse(await fs.readFile(path.join(cwd,'input.json'),'utf8'));
  if(!await validatePngDelivery(cwd,manifest,files))return false;
  job.finalCompleted=true;
  if(job.status==='incomplete'&&job.message?.includes('输出或质检证明不完整')){job.status='completed';job.message=job.report.message;}
  job.logs??=[];job.logs.push({time:new Date().toISOString(),text:'按实际展示范围复核通过；未使用的备选素材不计入交付数量。成品已完成，可生成分层 PSD。'});
  return true;
}
