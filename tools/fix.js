// usage: node tools/fix.js file  (reads JSON pairs from stdin: [[old,new],...])
const fs=require('fs');const f=process.argv[2];let s=fs.readFileSync(f,'utf8');
const pairs=JSON.parse(fs.readFileSync(0,'utf8'));let bad=0;
for(const [a,b] of pairs){ if(!s.includes(a)){console.log('MISSING:',a.slice(0,70));bad++;continue;} s=s.split(a).join(b); }
fs.writeFileSync(f,s);console.log(f,'ok',pairs.length-bad,'/',pairs.length);
