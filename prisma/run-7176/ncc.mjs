import { readFileSync } from "node:fs";
const rd = (p) => { const b = readFileSync(p); const a = new Float64Array(b.length/2); for (let i=0;i<a.length;i++) a[i]=b.readInt16LE(i*2); return a; };
const dec = (a,f) => { const n=Math.floor(a.length/f); const o=new Float64Array(n); for(let i=0;i<n;i++){let s=0;for(let k=0;k<f;k++)s+=a[i*f+k];o[i]=s/f;} return o; };
function best(sig, pat, from, to) {
  let pe=0; for (const v of pat) pe+=v*v; pe=Math.sqrt(pe);
  let bi=-1, bv=-2, second=-2;
  const res=[];
  for (let o=from;o<=to;o++){
    let dot=0, se=0;
    for (let i=0;i<pat.length;i++){ const s=sig[o+i]; dot+=s*pat[i]; se+=s*s; }
    const v = dot/(Math.sqrt(se||1e-9)*pe||1e-9);
    res.push(v);
    if (v>bv){ bv=v; bi=o; }
  }
  return {bi,bv,res};
}
const W = rd(process.argv[2]), S = rd(process.argv[3]);
const F = 8;
// обрезаем по 50 мс с краёв вырезки: там плавный вход/выход (cut.py, fade 8 мс) и хвост кодировщика
const trim = 1200;
const w = W.subarray(trim, W.length-trim);
console.log(`вырезка ${W.length} отсчётов (${(W.length/24000).toFixed(3)} с), сверяется тело ${w.length}; предложение ${S.length} (${(S.length/24000).toFixed(3)} с)`);
const wd = dec(w,F), sd = dec(S,F);
const c = best(sd, wd, 0, sd.length-wd.length-1);
console.log(`грубый проход (÷${F}): лучшее смещение ${c.bi*F} отсч. = ${(c.bi*F/24000).toFixed(3)} с, NCC ${c.bv.toFixed(4)}`);
const far = c.res.filter((v,i)=>Math.abs(i-c.bi)>3000/F);
far.sort((a,b)=>b-a);
console.log(`  второй максимум вне ±125 мс: ${far[0].toFixed(4)}; медиана по всем смещениям ${c.res.slice().sort((a,b)=>a-b)[c.res.length>>1].toFixed(4)}`);
const lo = Math.max(0,c.bi*F-4*F), hi = Math.min(S.length-w.length-1, c.bi*F+4*F);
const f = best(S, w, lo, hi);
console.log(`точный проход: смещение ${f.bi} отсч. = ${(f.bi/24000).toFixed(4)} с, NCC ${f.bv.toFixed(4)}`);
