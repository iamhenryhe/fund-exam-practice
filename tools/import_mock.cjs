const fs=require('node:fs');
const assert=require('node:assert/strict');
const raw=fs.readFileSync(0,'utf8').replace(/\f/g,'\n');
const marks=[...raw.matchAll(/^\s*(\d{1,3})、/gm)];
// Input: pdftotext -nodiag -layout SOURCE.pdf -
const clean=s=>s.split('\n').map(l=>l.trim()).filter(l=>l&&!/^(?:基金从业-基金法律法规|第\d+讲.*|模考密训.*)$/.test(l)).reduce((out,line)=>out+(!out?'':/^[ⅠⅡⅢⅣⅤⅥⅦⅧ]/.test(line)?'\n':/[a-z0-9]$/i.test(out)&&/^[a-z0-9]/i.test(line)?' ':'')+line,'').replace(/[（(]\s+[）)]/g,'（ ）');
const sets=[[],[]];
let set=0;
for(let i=0;i<marks.length;i++){
 const m=marks[i], n=Number(m[1]);
 if(n!==sets[set].length+1){if(n===1&&sets[0].length===100)set=1;else continue;}
 const block=raw.slice(m.index+m[0].length,marks[i+1]?.index??raw.length);
 const match=block.match(/【答案】\s*([A-D])/);
 if(!match)throw Error('Missing key: '+set+'/'+n);
 const stem=block.slice(0,match.index);
 const opts=[...stem.matchAll(/(?:^|\s)([A-D])[．.、]/gm)];
 assert.equal(opts.map(x=>x[1]).join(''),'ABCD',set+'/'+n);
 const question=clean(stem.slice(0,opts[0].index));
 const options=opts.map((o,j)=>clean(stem.slice(o.index+o[0].length,opts[j+1]?.index??stem.length)));
 assert(question&&options.every(Boolean),set+'/'+n);
 sets[set].push({question,options,answer:'ABCD'.indexOf(match[1])});
}
assert.deepEqual(sets.map(x=>x.length),[100,100]);
process.stdout.write(JSON.stringify(sets,null,2)+'\n');
