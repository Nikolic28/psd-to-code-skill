// indeksirana lista slojeva po grupi: idx, ime, x,y,w,h, placed id, clip, hidden
const fs=require("fs"),path=require("path");
const agp=require(path.join(__dirname,"..","agpsd.cjs"));
const psd=agp.readPsd(fs.readFileSync(process.argv[2]),{skipLayerImageData:true,skipCompositeImageData:true,skipThumbnail:true});
for(const g of psd.children){ let i=0;
 const rec=(list,pre)=>{for(const l of list){ if(l.children){console.log(`${g.name}  ${pre}[G ${l.name}]${l.mask?" MASK":""}${l.hidden?" HIDDEN":""}`);rec(l.children,pre+"  ");continue;}
  console.log(`${g.name}#${i++} ${pre}${l.name} | ${l.left},${l.top} ${l.right-l.left}x${l.bottom-l.top}${l.hidden?" HIDDEN":""}${l.clipping?" CLIP":""}${l.placedLayer?" pl="+l.placedLayer.id.slice(0,8):""}${l.text?" TEXT":""}`);}};
 rec(g.children,""); }
