"""Exports the island for the site. Run after build_island.py and bake_ao.py (or after editing island.blend by hand):
    exec(open(r"C:/Projects/joko-portfolio/art/island/export_island.py").read())

Writes, from the "island" collection only (the preview camera and sun are not exported):
- public/playground/island.glb: the full island, meshopt-compressed, with the baked shading (the "AO" colour
  attribute) as vertex colours, packed to 8 bits by pack_colors.mjs (needs Node and `npm install`).
  The site loads it with useGLTF(url, false, true).
- public/playground/island-lite.glb: the phone and weak-device version: no flowers, grass tufts or path stones,
  and trees, bushes, the garden, fences, benches, lamps and the studio simplified (Decimate, only while exporting).
- public/playground/island-poster.webp: the still for reduced motion, no WebGL and while loading.
Then saves the .blend.
"""
import bpy, os
from mathutils import Vector

ROOT = r"C:/Projects/joko-portfolio"
GLB = os.path.join(ROOT, "public/playground/island.glb")
LITE = os.path.join(ROOT, "public/playground/island-lite.glb")
POSTER = os.path.join(ROOT, "public/playground/island-poster.webp")
island = list(bpy.data.collections["island"].objects)

def export(path, objs):
    for o in bpy.data.objects:
        o.select_set(o in objs)
    args = dict(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
                export_lights=False, export_cameras=False, export_materials="EXPORT", export_extras=False,
                export_meshopt_compression_enable=True)
    try:
        bpy.ops.export_scene.gltf(**args, export_vertex_color="ACTIVE")
    except TypeError:                                    # older exporter option name
        bpy.ops.export_scene.gltf(**args, export_colors=True)
    for o in bpy.data.objects:
        o.select_set(False)

export(GLB, set(island))

# The light version: leave out the small things, simplify the busiest meshes while exporting.
LEAVE_OUT = ("deco_flowers", "deco_grass", "deco_path_stones", "deco_daisies", "deco_path_edge")
SIMPLIFY = {"block_tree": 0.35, "deco_bushes": 0.35, "block_garden": 0.35, "block_fence": 0.35, "block_bench": 0.5,
            "block_lamp": 0.5, "lm_studio": 0.45, "lm_gallery": 0.5, "deco_cliff": 0.5, "block_rock": 0.5,
            "block_planter": 0.5, "island_base": 0.5, "phys_": 0.6, "block_bike_rack": 0.6}
lite = [o for o in island if not o.name.startswith(LEAVE_OUT)]
added = []
for o in lite:
    ratio = next((r for k, r in SIMPLIFY.items() if o.name.startswith(k)), None)
    if ratio and o.type == "MESH":
        m = o.modifiers.new("lite_decimate", "DECIMATE"); m.ratio = ratio; added.append((o, m))
export(LITE, set(lite))
def tris(objs, evaluated):
    dg = bpy.context.evaluated_depsgraph_get(); n = 0
    for o in objs:
        if o.type != "MESH" or o.name.startswith("walk_deck_"):
            continue
        if evaluated:
            ev = o.evaluated_get(dg); me = ev.to_mesh(); n += sum(len(p.vertices) - 2 for p in me.polygons); ev.to_mesh_clear()
        else:
            n += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return n
lite_tris = tris(lite, True)
for o, m in added:
    o.modifiers.remove(m)
full_tris = tris(island, False)

# Blender compresses everything but the vertex colours: pack those too (8-bit, meshopt), see pack_colors.mjs.
import subprocess, shutil
node = shutil.which("node") or r"C:/Program Files/nodejs/node.exe"
pack = subprocess.run([node, os.path.join(ROOT, "art/island/pack_colors.mjs"), GLB, LITE], cwd=ROOT,
                      capture_output=True, text=True)
PACKED = pack.stdout.strip() if pack.returncode == 0 else "pack failed: " + pack.stderr.strip()[-400:]

# Poster: the preview camera's view on a transparent background, so it sits on the page in both themes. Blender's
# materials don't read the baked "AO" colours, so for this render only, each material multiplies them in.
temp = []
for mt in bpy.data.materials:
    nt = mt.node_tree if mt.use_nodes else None
    bsdf = nt.nodes.get("Principled BSDF") if nt else None
    if not bsdf or bsdf.inputs["Base Color"].is_linked:
        continue
    ca = nt.nodes.new("ShaderNodeVertexColor"); ca.layer_name = "AO"
    mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
    a_, b_ = [s for s in mix.inputs if s.type == "RGBA"][:2]          # the colour A and B sockets
    out_ = next(s for s in mix.outputs if s.type == "RGBA")
    next(s for s in mix.inputs if s.name == "Factor" and s.type == "VALUE").default_value = 1.0
    a_.default_value = bsdf.inputs["Base Color"].default_value
    nt.links.new(ca.outputs["Color"], b_); nt.links.new(out_, bsdf.inputs["Base Color"])
    temp.append((nt, ca, mix))
sc = bpy.context.scene; cam = bpy.data.objects["preview_cam"]; S = 1.35
cam.data.type = "PERSP"; cam.data.lens = 40
cam.location = (31 * S, -31 * S, 25 * S); cam.rotation_euler = (Vector((0, 0, -1.5)) - cam.location).to_track_quat("-Z", "Y").to_euler()
keep = (sc.render.resolution_x, sc.render.resolution_y, sc.render.film_transparent, sc.render.image_settings.file_format,
        sc.render.image_settings.color_mode, sc.render.filepath)
sc.render.resolution_x, sc.render.resolution_y, sc.render.film_transparent = 1600, 1000, True
sc.render.image_settings.file_format = "WEBP"; sc.render.image_settings.color_mode = "RGBA"
sc.render.image_settings.quality = 82
sc.render.filepath = POSTER
bpy.ops.render.render(write_still=True)
(sc.render.resolution_x, sc.render.resolution_y, sc.render.film_transparent, sc.render.image_settings.file_format,
 sc.render.image_settings.color_mode, sc.render.filepath) = keep
for nt, ca, mix in temp:
    nt.nodes.remove(mix); nt.nodes.remove(ca)          # removing the mix unlinks Base Color; it keeps its value

bpy.ops.wm.save_mainfile()
EXPORTED = {"glb_kb": round(os.path.getsize(GLB) / 1024), "lite_kb": round(os.path.getsize(LITE) / 1024),
            "poster_kb": round(os.path.getsize(POSTER) / 1024), "tris": full_tris, "lite_tris": lite_tris, "packed": PACKED}
print("Exported:", EXPORTED)
