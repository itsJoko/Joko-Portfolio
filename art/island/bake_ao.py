"""Bakes ambient occlusion into the island's vertex colours. Run after build_island.py, before export_island.py:
    exec(open(r"C:/Projects/joko-portfolio/art/island/bake_ao.py").read())

Soft contact shading for the flat-colour look: corners, the feet of walls, the ground under benches and trees
get a little darker. For every face corner, a fixed set of rays over its normal's hemisphere is cast against the
whole island (a BVH of every mesh); nearby hits darken it. The result is a colour attribute "AO" (per face corner)
that the glTF exporter writes as COLOR_0, and three.js multiplies it into each material's colour.
"""
import bpy, math, time
from mathutils import Vector
from mathutils.bvhtree import BVHTree

t0 = time.time()
N_RAYS, MAXD = 14, 0.8                  # rays per corner, and how far an occluder still counts (m)
STRENGTH, FLOOR = 0.5, 0.62             # how much a fully enclosed corner darkens, and the darkest it gets
# Not baked (plain white): the ground, paths and things lying flat on them. Their triangles are large, so baked
# shading smears into streaks and halos, and the site's real-time shadows already ground everything on them.
FLAT = ("walk_ground", "walk_path", "deco_path", "deco_paving", "deco_photo_spot", "deco_lilies", "deco_shore",
        "deco_grass", "island_base")
SKIP = ("water_", "walk_deck_", "collect_plane", "debug_") + FLAT
# Things lying flat or tiny don't shade anything else either (a path stone 2 cm up would darken a ring around it).
NOT_OCCLUDERS = ("water_", "walk_deck_", "collect_plane", "debug_", "deco_path", "deco_paving", "deco_photo_spot",
                 "deco_lilies", "deco_grass", "deco_flowers")
coll = bpy.data.collections["island"]
objs = [o for o in coll.objects if o.type == "MESH" and not o.name.startswith(SKIP)]

# One BVH of the island's solid things, in world space.
verts, polys = [], []
for o in (o for o in coll.objects if o.type == "MESH" and not o.name.startswith(NOT_OCCLUDERS)):
    mw = o.matrix_world; base = len(verts)
    verts.extend(mw @ v.co for v in o.data.vertices)
    polys.extend([base + i for i in p.vertices] for p in o.data.polygons)
tree = BVHTree.FromPolygons(verts, polys, all_triangles=False, epsilon=0.0)

# Cosine-weighted hemisphere directions (a Fibonacci spiral, the same for every corner: no noise).
GOLD = math.pi * (3 - math.sqrt(5))
LOCAL = []
for k in range(N_RAYS):
    u = (k + 0.5) / N_RAYS; r = math.sqrt(u)
    LOCAL.append((r * math.cos(k * GOLD), r * math.sin(k * GOLD), math.sqrt(1 - u)))

def basis(n):
    t = Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0))
    a = n.cross(t).normalized(); b = n.cross(a)
    return a, b

def occlusion(p, n):
    a, b = basis(n); o = p + n * 0.02; occ = 0.0
    for lx, ly, lz in LOCAL:
        hit = tree.ray_cast(o, a * lx + b * ly + n * lz, MAXD)
        if hit[0] is not None:
            occ += 1 - hit[3] / MAXD
    return occ / N_RAYS

rays = 0
for o in objs:
    me = o.data; mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed()
    strength, floor = STRENGTH, FLOOR
    if "AO" in me.color_attributes:
        me.color_attributes.remove(me.color_attributes["AO"])
    attr = me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
    cn = me.corner_normals
    cache = {}
    for li, loop in enumerate(me.loops):
        n = (nm @ cn[li].vector).normalized()
        key = (loop.vertex_index, round(n.x, 2), round(n.y, 2), round(n.z, 2))
        v = cache.get(key)
        if v is None:
            occ = occlusion(mw @ me.vertices[loop.vertex_index].co, n); rays += N_RAYS
            look = max(floor, 1 - strength * occ)       # how it reads on screen (sRGB-ish)
            look = round(look * 24) / 24                # 24 steps: invisible, and repeated values compress well
            v = cache[key] = look ** 2.2                # stored linear, as glTF expects
        attr.data[li].color = (v, v, v, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find("AO")

# Meshes left out of the bake still get an "AO" layer, plain white: a material shared with baked meshes then reads
# the same layer everywhere (the poster render multiplies it in) instead of black.
for o in coll.objects:
    if o.type == "MESH" and o.name.startswith(SKIP):
        me = o.data
        if "AO" in me.color_attributes:
            me.color_attributes.remove(me.color_attributes["AO"])
        attr = me.color_attributes.new("AO", "FLOAT_COLOR", "CORNER")
        for d in attr.data:
            d.color = (1.0, 1.0, 1.0, 1.0)
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find("AO")

AO_STATS ={"objects": len(objs), "rays": rays, "seconds": round(time.time() - t0, 1)}
print("AO baked:", AO_STATS)
