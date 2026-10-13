// 영수증 OCR 텍스트 -> {pharmacy, date, items}
function parseReceipt(text){
 const lines=text.split(/\n/).map(l=>l.replace(/\s+/g,' ').trim()).filter(Boolean);
 let pharmacy='',date='',items=[];
 const skip=/(합\s*계|총\s*액|총\s*금액|결제|카드|현금|부가세|과세|면세|공급가|받을|거스름|사업자|대표|전화|TEL|주소|승인|일시|영수증|품명|단가|금액|수량|감사)/i;
 for(const l of lines){
  if(!pharmacy){const m=l.match(/([가-힣A-Za-z0-9]+\s?약국)/);if(m)pharmacy=m[1].replace(/\s/g,'');}
  if(!date){const m=l.match(/(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/);if(m)date=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;}
 }
 for(const l of lines){
  if(skip.test(l)||/약국/.test(l))continue;
  // 끝 숫자 토큰들: [.. 수량] [단가] 금액
  const toks=l.split(' ');const nums=[];
  while(toks.length&&/^[\d,.]+원?$/.test(toks.at(-1)))nums.unshift(toks.pop().replace(/[,.원]/g,''));
  if(!nums.length||!/[가-힣A-Za-z]/.test(toks.join('')))continue;
  let name=toks.join(' ').replace(/[|*#:]/g,'').trim(),price=+nums.at(-1),qty=1;
  if(nums.length>=3)qty=+nums[nums.length-3];
  else if(nums.length===2){const u=nums[0],a=nums.at(-1);
   if(u.length>a.length&&u.endsWith(a)&&+u.slice(0,-a.length)<100)qty=+u.slice(0,-a.length); // "1 3,800"이 "13,800"으로 붙은 경우
   else if(+u>0&&price%+u===0&&price/+u<100){qty=price/+u; // 수량이 품목명 끝에 붙은 경우 제거
    if(name.endsWith(String(qty))&&/\d$/.test(name.slice(0,-String(qty).length)))name=name.slice(0,-String(qty).length);}}
  if(!(qty>0&&qty<100))qty=1;
  if(name.length<2||price<100||price>1000000)continue;
  items.push({name,qty,price});
 }
 return {pharmacy,date,items};
}
if(typeof module!=='undefined')module.exports={parseReceipt};
