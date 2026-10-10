export const displayImages=files=>(files||[]).filter(file=>/^(final-cards|product-cutouts)\/.+\.(png|jpe?g|webp)$/i.test(file.name));
let dialog;
function ensurePreview(){
  if(dialog)return dialog;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/image-gallery.css';document.head.append(css);
  dialog=document.createElement('dialog');dialog.className='image-lightbox';dialog.setAttribute('aria-label','图片放大预览');
  const header=document.createElement('div');header.className='lightbox-header';
  const title=document.createElement('strong');title.id='image-preview-title';dialog.setAttribute('aria-labelledby',title.id);
  const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','关闭预览');close.onclick=()=>dialog.close();
  const frame=document.createElement('div');frame.className='lightbox-frame';const img=document.createElement('img');frame.append(img);
  const download=document.createElement('a');download.className='lightbox-download';download.textContent='下载图片 ↓';download.setAttribute('download','');
  header.append(title,close);dialog.append(header,frame,download);document.body.append(dialog);
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  dialog.addEventListener('close',()=>{document.documentElement.style.overflow='';img.removeAttribute('src');});
  return dialog;
}
function preview(file,url){
  const box=ensurePreview();box.querySelector('strong').textContent=file.name.split('/').pop();
  const img=box.querySelector('img');img.src=url(file.name);img.alt=file.name.split('/').pop();
  box.querySelector('.lightbox-frame').classList.toggle('is-cutout',file.name.startsWith('product-cutouts/'));
  const down=box.querySelector('a');down.href=url(file.name)+'?download';down.download=file.name.split('/').pop();
  document.documentElement.style.overflow='hidden';box.showModal();
}
export function renderImageGallery(container,files,url){
  ensurePreview();container.classList.add('image-results');container.replaceChildren();
  const images=displayImages(files);
  for(const [prefix,label] of [['final-cards/','最终成品'],['product-cutouts/','透明底产品图']]){
    const group=images.filter(file=>file.name.startsWith(prefix));if(!group.length)continue;
    const section=document.createElement('div');section.className='image-group';
    const heading=document.createElement('h3');heading.textContent=label+' · '+group.length+' 张';
    const grid=document.createElement('div');grid.className='image-card-grid';
    for(const file of group){
      const card=document.createElement('article');card.className='image-result-card';
      const button=document.createElement('button');button.type='button';button.className='image-card-open'+(prefix==='product-cutouts/'?' is-cutout':'');button.setAttribute('aria-label','放大预览 '+file.name.split('/').pop());
      const img=document.createElement('img');img.src=url(file.name);img.alt=file.name.split('/').pop();img.loading='lazy';
      const name=document.createElement('span');name.textContent=file.name.split('/').pop();name.title=name.textContent;
      button.append(img,name);button.onclick=()=>preview(file,url);
      const down=document.createElement('a');down.href=url(file.name)+'?download';down.download=name.textContent;down.textContent='下载 ↓';
      card.append(button,down);grid.append(card);
    }
    section.append(heading,grid);container.append(section);
  }
}
