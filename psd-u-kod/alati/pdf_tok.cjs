const fs=require("fs"),zlib=require("zlib");const [f,n]=process.argv.slice(2);const b=fs.readFileSync(f),s=b.toString("latin1");
const i=s.indexOf("\n"+n+" 0 obj")>=0?s.indexOf("\n"+n+" 0 obj"):s.indexOf("\r"+n+" 0 obj");const st=s.indexOf("stream",i);let p=st+6;if(s[p]=="\r")p++;if(s[p]=="\n")p++;const e=s.indexOf("endstream",p);
console.error(s.slice(i,st).slice(0,300));let d=b.slice(p,e);try{d=zlib.inflateSync(d)}catch(x){console.error("raw")}process.stdout.write(d);
