/* All chapters stay visible. Each view has an equivalent HTML data table. */
'use strict';
const views = new Map();
const resources = new Map();
const resourceVersion = '20261027-story-3';
async function jsonResource(url){
 if(resources.has(url))return resources.get(url);
 const response=await fetch(url+'?v='+resourceVersion);if(!response.ok)throw Error('Could not load '+url+' ('+response.status+')');
 const value=await response.json();resources.set(url,value);return value;
}
function dataUrls(value,found=new Set()){
 if(value&&typeof value==='object'){
  if(typeof value.url==='string'&&value.url.startsWith('data/'))found.add(value.url);
  Object.values(value).forEach(child=>dataUrls(child,found));
 }return found;
}
// Validate each public resource once. Resize uses fresh copies of cached values,
// so Vega cannot silently swallow a later fetch error or mutate the cache.
function bindData(value){
 if(!value||typeof value!=='object')return;
 if(typeof value.url==='string'&&value.url.startsWith('data/')){
  let source=resources.get(value.url);if(source===undefined)throw Error('Unloaded data: '+value.url);
  if(value.format?.property)source=value.format.property.split('.').reduce((v,k)=>v[k],source);
  value.values=structuredClone(source);delete value.url;delete value.format;
 }
 Object.values(value).forEach(bindData);
}
async function batch(items,fn){
 const results=[];for(let i=0;i<items.length;i+=4)results.push(...await Promise.all(items.slice(i,i+4).map(fn)));return results;
}
const settings = {education:2015, origin:'All five', role:'All occupations'};
const number = (value,key) => typeof value === 'number' ? (key === 'year' ? String(value) : key === 'share' ? (value*100).toFixed(2)+'%' : value.toLocaleString('en-AU',{maximumFractionDigits:2})) : String(value);
function element(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
// Align paired headings and figure starts. Disclosure heights remain independent.
function alignFigureStarts(){
 document.querySelectorAll('.chart-pair').forEach(pair=>{
  const headings=[...pair.querySelectorAll(':scope > .chart-card > h3')];
  const figures=[...pair.querySelectorAll(':scope > .chart-card > figure')];
  headings.forEach(h=>h.style.minHeight='');
  figures.forEach(f=>f.style.marginTop='24px');
  if(window.innerWidth<1200||figures.length!==2)return;
  const headingHeight=Math.max(...headings.map(h=>h.getBoundingClientRect().height));
  headings.forEach(h=>h.style.minHeight=headingHeight+'px');
  const tops=figures.map(f=>f.getBoundingClientRect().top);
  figures.forEach((f,i)=>f.style.marginTop=(24+Math.max(...tops)-tops[i])+'px');
 });
}
async function equivalentTable(item,figure){
 const rows=await jsonResource('data/'+item.csv+'.json');const wrapper=element('div');wrapper.className='chart-tools';
 const details=element('details');details.id='data-'+item.id;const summary=element('summary','Read the data: '+item.title);details.append(summary);
 const scroll=element('div');scroll.className='table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',item.title+' data table');
 const table=element('table');const caption=element('caption',item.title);caption.className='quiet';table.append(caption);const head=element('thead');const hrow=element('tr');
 Object.values(item.columns).forEach(label=>{const th=element('th',label);th.scope='col';hrow.append(th);});head.append(hrow);table.append(head);const body=element('tbody');
 rows.forEach(row=>{const tr=element('tr');Object.keys(item.columns).forEach(key=>tr.append(element('td',number(row[key],key))));body.append(tr);});table.append(body);scroll.append(table);details.append(scroll);wrapper.append(details);
 const links=element('p');for(const [label,path] of [['Download CSV','data/'+item.csv+'.csv'],['Chart specification','specs/'+item.id+'.json']]){const a=element('a',label);a.href=path;a.setAttribute('aria-label',label+': '+item.title);if(label.includes('CSV'))a.download='';links.append(a);}wrapper.append(links);figure.after(wrapper);
}
async function renderChart(item,spec){
 const holder=document.getElementById('chart-'+item.id);const width=Math.max(240,Math.floor(holder.clientWidth));const copy=structuredClone(spec);bindData(copy);
 if(copy.$schema.includes('vega-lite')){
  copy.width=width;
  if(width<430){
   copy.config.axis.labelFontSize=14;copy.config.axis.titleFontSize=16;
   copy.config.legend.labelFontSize=14;copy.config.legend.titleFontSize=15;
   if(['concentration','business-map','filing-map'].includes(item.id))copy.height=item.id==='filing-map'?320:390;
   if(item.id==='education')copy.encoding.x.axis.labelExpr="toNumber(datum.label) % 2 == 0 ? datum.label : ''";
   if(item.id==='ip-history')copy.encoding.color.legend.columns=1;
   if(item.id==='business-mosaic')copy.layer[0].encoding.color.legend.columns=1;
   if(item.id==='filing-map')copy.layer[1].encoding.strokeWidth.legend.columns=2;
   if(item.id==='business-change')copy.layer[1].encoding.x.axis.labelExpr="replace(datum.label, 'June ', '')";
   if(item.id==='workforce'){copy.layer[0].encoding.x.axis={tickCount:5};copy.layer[0].encoding.size.scale.range=[0,1200];copy.layer[0].encoding.size.legend.columns=2;}
  }
  if(item.id==='education'&&width<600){
   // Rotate the same heatmap on phones so every year and index stays readable.
   copy.height=660;copy.padding={left:4,right:6,top:8,bottom:12};
   copy.encoding.x={field:'field',type:'nominal',axis:{title:null,orient:'top',labelAngle:0,labelLineHeight:18,labelPadding:12,labelExpr:"datum.label == 'Architecture and Building' ? ['Arch. &','building'] : datum.label == 'Creative Arts' ? ['Creative','arts'] : 'IT'"}};
   copy.encoding.y={field:'year',type:'ordinal',sort:'ascending',axis:{title:null,labelAngle:0,labelPadding:8}};
   copy.layer=[{mark:{type:'rect',stroke:'#fffdf7',strokeWidth:2}},
    {transform:[{filter:'datum.year == baseYear'}],mark:{type:'rect',fillOpacity:0,stroke:'#253c39',strokeWidth:2},encoding:{color:{value:'#253c39'}}},
    {mark:{type:'text',fontSize:14,stroke:'#fffdf7',strokeWidth:4},encoding:{text:{field:'index',format:'.0f'},color:{value:'#253c39'}}},
    {mark:{type:'text',fontSize:14},encoding:{text:{field:'index',format:'.0f'},color:{value:'#253c39'}}}];
  }
 }
 else{copy.width=width-(typeof copy.padding==='number'?2*copy.padding:0);if(item.id==='economy')copy.height=width<500?560:520;}
 if(copy.params)copy.params.forEach(p=>{if(p.name==='baseYear')p.value=settings.education;if(p.name==='chosenOrigin')p.value=settings.origin;});
 if(copy.signals)copy.signals.forEach(p=>{if(p.name==='chosenRole')p.value=settings.role;});
 if(views.has(item.id))views.get(item.id).finalize();
 try{const result=await vegaEmbed(holder,copy,{actions:false,renderer:'svg',tooltip:{theme:'light'},defaultStyle:false});views.set(item.id,result.view);holder.dataset.rendered='true';holder.dataset.width=String(width);holder.setAttribute('role','img');holder.setAttribute('aria-label',item.title+'. The finding is explained above; the source, limitations and equivalent data table follow.');holder.querySelector('svg')?.setAttribute('aria-hidden','true');}
 catch(error){holder.dataset.rendered='error';const box=element('p','This chart could not load. Read its data table below or download the CSV.');box.className='chart-error';holder.replaceChildren(box);console.error(item.id,error);}
}
async function main(){
 const manifest=await jsonResource('chart-manifest.json');
 const specs=await batch(manifest,item=>jsonResource('specs/'+item.id+'.json'));
 const urls=dataUrls(specs);manifest.forEach(item=>urls.add('data/'+item.csv+'.json'));
 await batch([...urls],jsonResource);
 await document.fonts.ready;
 alignFigureStarts();
 await Promise.all(manifest.map(async(item,index)=>{const figure=document.querySelector('[data-chart="'+item.id+'"]');await equivalentTable(item,figure);await renderChart(item,specs[index]);}));
 // Nearby reading notes open the matching native table and move keyboard focus there.
 document.querySelectorAll('[data-open-table]').forEach(button=>button.addEventListener('click',()=>{
  const details=document.getElementById(button.dataset.openTable);
  if(!details)return;
  details.open=true;
  details.querySelector('summary').focus({preventScroll:true});
  details.scrollIntoView({block:'nearest',behavior:'auto'});
 }));
 const roleSelect=document.getElementById('role-profile');
 [...new Set(resources.get('data/industry-profiles.json').map(row=>row.occupation))].forEach(role=>roleSelect.append(element('option',role)));
 roleSelect.addEventListener('change',async event=>{settings.role=event.target.value;await views.get('industry-profiles').signal('chosenRole',settings.role).runAsync();document.getElementById('profile-status').textContent=settings.role==='All occupations'?'Three example profiles are emphasised; all eight remain visible.':settings.role+' highlighted. Every other profile stays visible for comparison.';});
 document.getElementById('base-year').addEventListener('change',async event=>{settings.education=Number(event.target.value);await views.get('education').signal('baseYear',settings.education).runAsync();document.getElementById('education-status').textContent='Colours compare each year with '+settings.education+'. The headline comparison stays 2015–2024.';});
 document.getElementById('origin').addEventListener('change',async event=>{settings.origin=event.target.value;await views.get('filing-map').signal('chosenOrigin',settings.origin).runAsync();document.getElementById('flow-status').textContent=settings.origin==='All five'?'All five published origins are highlighted.':settings.origin+' highlighted. All five origin counts and the omitted 2,013 filings remain unchanged.';});
 let pending;const observer=new ResizeObserver(()=>{clearTimeout(pending);pending=setTimeout(()=>{alignFigureStarts();manifest.forEach((item,i)=>{const h=document.getElementById('chart-'+item.id);if(Math.abs(h.clientWidth-Number(h.dataset.width))>2)renderChart(item,specs[i]);});},200);});manifest.forEach(item=>observer.observe(document.getElementById('chart-'+item.id)));
 document.body.dataset.ready='true';
}
main().catch(error=>{console.error(error);document.body.dataset.ready='error';const p=element('p','Some charts could not initialise. Refresh the page or use the downloadable data linked in the chart manifest.');p.className='chart-error';document.querySelector('.intro').append(p);});
