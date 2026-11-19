// Compresses the vertex colours (the baked shading, COLOR_0) of the island's glb files with EXT_meshopt_compression.
// Blender's exporter compresses positions, normals and indices that way but writes colours raw (about 0.9 MB).
// Run by export_island.py after each export, or by hand:  node art/island/pack_colors.mjs <file.glb> [...]
// The site already decodes the extension (useGLTF(url, false, true)), so nothing changes there.
import { readFileSync, writeFileSync } from "node:fs";
import { MeshoptEncoder } from "meshoptimizer";

await MeshoptEncoder.ready;
const align4 = (n) => (n + 3) & ~3;

function pack(path) {
  const glb = readFileSync(path);
  const jsonLen = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLen).toString("utf8"));
  const binStart = 20 + jsonLen + 8;
  const bin = glb.subarray(binStart, binStart + glb.readUInt32LE(20 + jsonLen));

  // The fallback buffer Blender declared for compressed views (no data, only a length).
  const fb = json.buffers.findIndex((b) => b.extensions?.EXT_meshopt_compression?.fallback);
  if (fb < 0) throw new Error(`${path}: no meshopt fallback buffer`);
  const views = new Set();
  for (const m of json.meshes) for (const p of m.primitives) if (p.attributes.COLOR_0 !== undefined) {
    const a = json.accessors[p.attributes.COLOR_0];
    if (!(a.byteOffset > 0)) views.add(a.bufferView);
  }
  const encoded = new Map();
  for (const vi of views) {
    const v = json.bufferViews[vi];
    if (v.extensions?.EXT_meshopt_compression || v.buffer !== 0) continue;
    const acc = json.accessors.filter((a) => a.bufferView === vi);
    let stride = v.byteStride ?? 8;
    let src = new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset ?? 0), v.byteLength);
    // 16-bit colours to 8-bit (normalized unsigned bytes): plenty for soft shading, half the data.
    if (acc.every((a) => a.componentType === 5123 && a.type === "VEC4" && a.normalized) && stride === 8) {
      const n = v.byteLength / 8, u16 = new Uint16Array(src.slice().buffer), out = new Uint8Array(n * 4);
      for (let i = 0; i < n * 4; i++) out[i] = Math.round(u16[i] / 257);
      src = out; stride = 4; v.byteStride = 4; v.byteLength = n * 4;
      for (const a of acc) a.componentType = 5121;
    }
    encoded.set(vi, { data: MeshoptEncoder.encodeGltfBuffer(src, v.byteLength / stride, stride, "ATTRIBUTES"), stride });
  }

  // Rebuild the binary: every piece of buffer 0 still in use, colours now compressed.
  const parts = []; let size = 0;
  const put = (bytes) => { const at = size; parts.push({ at, bytes }); size = align4(size + bytes.length); return at; };
  let fallbackLen = json.buffers[fb].byteLength;
  json.bufferViews.forEach((v, vi) => {
    const ext = v.extensions?.EXT_meshopt_compression;
    if (encoded.has(vi)) {
      const { data, stride } = encoded.get(vi);
      const count = v.byteLength / stride;
      v.extensions = { EXT_meshopt_compression: { buffer: 0, byteOffset: put(data), byteLength: data.length, byteStride: stride, count, mode: "ATTRIBUTES" } };
      v.buffer = fb; v.byteOffset = fallbackLen; fallbackLen = align4(fallbackLen + v.byteLength);
    } else if (ext && ext.buffer === 0) {
      ext.byteOffset = put(bin.subarray(ext.byteOffset ?? 0, (ext.byteOffset ?? 0) + ext.byteLength));
    } else if (v.buffer === 0) {
      v.byteOffset = put(bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
    }
  });
  json.buffers[fb].byteLength = fallbackLen;
  json.buffers[0].byteLength = size;

  const newBin = Buffer.alloc(size);
  for (const { at, bytes } of parts) newBin.set(bytes, at);
  let js = Buffer.from(JSON.stringify(json), "utf8");
  js = Buffer.concat([js, Buffer.alloc(align4(js.length) - js.length, 0x20)]);
  const head = Buffer.alloc(12); head.write("glTF", 0); head.writeUInt32LE(2, 4);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.write("JSON", 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(size, 0); bh.write("BIN\0", 4);
  const out = Buffer.concat([head, jh, js, bh, newBin]);
  out.writeUInt32LE(out.length, 8);
  writeFileSync(path, out);
  return { file: path.split(/[\\/]/).pop(), colourViews: encoded.size, before_kb: Math.round(glb.length / 1024), after_kb: Math.round(out.length / 1024) };
}

for (const f of process.argv.slice(2)) console.log(JSON.stringify(pack(f)));
