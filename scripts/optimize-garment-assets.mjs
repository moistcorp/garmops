import { createHash } from "node:crypto";
import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import sharp from "sharp";

const root = join(process.cwd(), "public", "garments");
const reportPath = join(process.cwd(), "docs", "performance", "garment-asset-optimization.md");
const manifestPath = join(process.cwd(), "scripts", "garment-asset-signals.json");
async function walk(path) { return (await readdir(path,{withFileTypes:true})).flatMap(entry=>entry.isDirectory()?[]:[join(path,entry.name)]).concat(...await Promise.all((await readdir(path,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>walk(join(path,e.name))))); }
const hash = value => createHash("sha256").update(value).digest("hex");
function signals(raw, pixels, kind) { const out=Buffer.alloc(pixels); for(let i=0;i<pixels;i++){const o=i*4;out[i]=kind==="mask"?raw[o+3]:Math.round(raw[o]*0.2126+raw[o+1]*0.7152+raw[o+2]*0.0722);} return out; }

const files=(await walk(root)).filter(path=>/(mask\.png|(texture|shadow|highlight)\.(webp|png))$/.test(path));
const rows=[], manifest={};
for(const path of files){const before=(await stat(path)).size;const kind=path.endsWith("mask.png")?"mask":"detail";const image=sharp(path).toColourspace("srgb").ensureAlpha();const {data,info}=await image.raw().toBuffer({resolveWithObject:true});const signal=signals(data,info.width*info.height,kind);const rgba=Buffer.alloc(info.width*info.height*4);for(let i=0;i<signal.length;i++){const o=i*4;if(kind==="mask"){rgba[o]=rgba[o+1]=rgba[o+2]=255;rgba[o+3]=signal[i];}else{rgba[o]=rgba[o+1]=rgba[o+2]=signal[i];rgba[o+3]=data[o+3];}}const encoder=sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}});const candidate=path.endsWith(".png")?await encoder.png({compressionLevel:9,adaptiveFiltering:true}).toBuffer():await encoder.webp({lossless:true,effort:6}).toBuffer();const decoded=await sharp(candidate).toColourspace("srgb").ensureAlpha().raw().toBuffer({resolveWithObject:true});const candidateSignal=signals(decoded.data,decoded.info.width*decoded.info.height,kind);const equivalent=decoded.info.width===info.width&&decoded.info.height===info.height&&candidateSignal.equals(signal);let after=before,changed=false;if(equivalent&&candidate.length<before){await writeFile(path,candidate);after=candidate.length;changed=true;}const rel=relative(process.cwd(),path);manifest[rel]={width:info.width,height:info.height,kind,signalSha256:hash(signal)};rows.push({rel,before,after,changed});}
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n");
const totalBefore=rows.reduce((n,r)=>n+r.before,0),totalAfter=rows.reduce((n,r)=>n+r.after,0),percent=((totalBefore-totalAfter)/totalBefore*100).toFixed(2);
const markdown=["# Garment asset optimization","","Renderer-only assets were normalized to exactly the signal consumed by `GarmentComposite`: mask alpha or rounded Rec. 709 luminance. Dimensions and signal hashes are recorded in `scripts/garment-asset-signals.json`. Candidates replace originals only when lossless signal verification succeeds and bytes decrease.","",`Total before: ${totalBefore.toLocaleString()} bytes  `,`Total after: ${totalAfter.toLocaleString()} bytes  `,`Reduction: ${percent}%`,"","| File | Before | After | Reduction |","|---|---:|---:|---:|",...rows.map(r=>`| ${r.rel} | ${r.before} | ${r.after} | ${((r.before-r.after)/r.before*100).toFixed(2)}% |`),"",`Unchanged files: ${rows.filter(r=>!r.changed).length}.`,`Optimized files: ${rows.filter(r=>r.changed).length}.`,""];
await writeFile(reportPath,markdown.join("\n"));
console.log(JSON.stringify({files:rows.length,totalBefore,totalAfter,reductionPercent:Number(percent),unchanged:rows.filter(r=>!r.changed).length}));
