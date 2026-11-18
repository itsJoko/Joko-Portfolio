"""Exports the island for the site. Run after build_island.py (or after editing island.blend by hand):
    exec(open(r"C:/Projects/joko-portfolio/art/island/export_island.py").read())

Writes public/playground/island.glb (meshopt-compressed; the site loads it with useGLTF(url, false, true))
and public/playground/island-poster.webp (the still shown for reduced motion, no WebGL and while loading),
then saves the .blend. Only the "island" collection is exported; the preview camera and sun are not.
"""
import bpy, os
from mathutils import Vector

ROOT = r"C:/Projects/joko-portfolio"
GLB = os.path.join(ROOT, "public/playground/island.glb")
POSTER = os.path.join(ROOT, "public/playground/island-poster.webp")

island = set(bpy.data.collections["island"].objects)
for o in bpy.data.objects:
    o.select_set(o in island)
bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=True, export_yup=True, export_apply=True,
                          export_lights=False, export_cameras=False, export_materials="EXPORT", export_extras=False,
                          export_meshopt_compression_enable=True)
for o in bpy.data.objects:
    o.select_set(False)

# Poster: the preview camera's view on a transparent background, so it sits on the page in both themes.
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

bpy.ops.wm.save_mainfile()
EXPORTED = {"glb_kb": round(os.path.getsize(GLB) / 1024), "poster_kb": round(os.path.getsize(POSTER) / 1024)}
print("Exported:", EXPORTED)
