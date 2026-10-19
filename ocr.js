// OCR 파이프라인: 전처리 → tesseract(작업자 1개 재사용) → 파싱. 약국명을 못 찾으면 상단 영역만 한 번 더 인식.
const OCR=(()=>{
let worker=null,workerP=null,progressCb=null;
async function getWorker(){
 if(worker)return worker;
 if(!workerP)workerP=Tesseract.createWorker('kor+eng',1,{logger:m=>progressCb&&progressCb(m)}).then(w=>worker=w);
 return workerP;}
async function recognize(file,o={}){
 o={psm:4,targetW:2000,crop:null,rotate:0,onProgress:null,...o};progressCb=o.onProgress;const t0=performance.now();
 const wP=getWorker();// 전처리와 병렬로 작업자/언어 데이터 로딩
 const pre=await Preproc.run(file,{targetW:o.targetW,crop:o.crop,rotate:o.rotate,...(o.pre||{})});
 const w=await wP;
 await w.setParameters({tessedit_pageseg_mode:String(o.psm),preserve_interword_spaces:'1',user_defined_dpi:'300'});
 const r=await w.recognize(pre.canvas);
 const parsed=parseReceipt(r.data.text,r.data.lines,o.parse||{});
 let text=r.data.text;
 if(!parsed.pharmacy&&o.topPass!==false){// 상단 25%만 다시 인식 (PSM 6)
  const c=pre.canvas;await w.setParameters({tessedit_pageseg_mode:'6'});
  const r2=await w.recognize(c,{rectangle:{left:0,top:0,width:c.width,height:Math.round(c.height*0.25)}});
  const p2=parseReceipt(r2.data.text,[],o.parse||{});if(p2.pharmacy)parsed.pharmacy=p2.pharmacy;if(!parsed.date&&p2.date)parsed.date=p2.date;text+='\n--- 상단 재인식 ---\n'+r2.data.text;}
 progressCb=null;
 return {parsed,text,info:pre.info,canvas:pre.canvas,ms:Math.round(performance.now()-t0)};}
return {recognize,getWorker};})();
