import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
const manifest=JSON.parse(await readFile(new URL("./garment-asset-signals.json",import.meta.url),"utf8"));
for(const [path,expected] of Object.entries(manifest)){const {data,info}=await sharp(path).toColourspace("srgb").ensureAlpha().raw().toBuffer({resolveWithObject:true});if(info.width!==expected.width||info.height!==expected.height)throw new Error(`${path}: dimensions changed`);const signal=Buffer.alloc(info.width*info.height);for(let i=0;i<signal.length;i++){const o=i*4;signal[i]=expected.kind==="mask"?data[o+3]:Math.round(data[o]*0.2126+data[o+1]*0.7152+data[o+2]*0.0722);}const digest=createHash("sha256").update(signal).digest("hex");if(digest!==expected.signalSha256)throw new Error(`${path}: renderer signal changed`);}console.log(`Verified ${Object.keys(manifest).length} garment assets: dimensions and renderer signals match.`);
