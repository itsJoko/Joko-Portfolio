"""Generates the Playground's Studio island (docs/studio.md) in the open Blender file.

Run it from Blender's Scripting tab, or through the Blender MCP:
    exec(open(r"C:/Projects/joko-portfolio/art/island/build_island.py").read())

It replaces everything in the scene. Object and material names are read by the site, so keep them:
walk_* (walkable), block_* / lm_* (obstacles), door_* and spawn (empties), deco_* (decoration only),
water_pond (not walkable).

Hand moves survive: move, rotate or scale objects in Blender, then run capture_overrides.py. It writes
art/island/overrides.json, which this script applies at the end of every run. Mesh edits (Tab mode) are not
kept; ask Claude to put those into this script.

Layout, as a journey: you arrive by boat at the south dock, walk up to the welcome plaza, and a signpost
points the way. North: the café (projects) with its kitchen garden. West: the gallery (graphics) with the
bike rack. East: the notice board (experience). South-west: the commons (picnic, campfire, community
poster). South-east: a bench looking over the lake.
"""
import bpy, bmesh, math, random, json, os, re
import numpy as np
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

S = 1.35          # island scale (radius about 24 m)
DETAIL = True     # bevels, tiles, trims, grass lip
HERE = r"C:/Projects/joko-portfolio/art/island"
random.seed(21)

# ---------------------------------------------------------------- scene reset
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
for c in list(bpy.data.collections):
    bpy.data.collections.remove(c)
for m in list(bpy.data.meshes):
    bpy.data.meshes.remove(m)
coll = bpy.data.collections.new("island"); bpy.context.scene.collection.children.link(coll)
prev = bpy.data.collections.new("preview"); bpy.context.scene.collection.children.link(prev)

# ---------------------------------------------------------------- materials
def lin(h):
    h = h.lstrip("#"); out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out

def mat(name, hexv, rough=0.85, glow=0.0, double=False):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    col = lin(hexv)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
    if b:
        b.inputs["Base Color"].default_value = (*col, 1)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Emission Strength"].default_value = glow
        if glow:
            b.inputs["Emission Color"].default_value = (*col, 1)
    m.diffuse_color = (*col, 1)
    m.use_backface_culling = not double
    return m

MATS = {
    "grass": ("#A3C45C",), "grass_dark": ("#86A846", 0.9, 0, True), "sand": ("#E9D3A6",), "sand_edge": ("#D9BE8C",),
    "paver": ("#E0C595",), "paver_light": ("#EEDCB6",),
    "plaster": ("#F2E6CF",), "plaster_trim": ("#E2D2B4",), "earth": ("#C8935C",), "earth_dark": ("#A26D41",), "soil": ("#7A5236",),
    "stone": ("#A29D94",), "stone_light": ("#BDB6AA",), "trim": ("#7B4B2C",), "wood": ("#A86E40",), "wood_light": ("#C08A55",),
    "leaf": ("#8DB44A",), "leaf_dark": ("#6E9A3A",), "roof": ("#D9673A", 0.75), "roof_dark": ("#8E3E22", 0.8),
    "cream": ("#F7EBD3", 0.8, 0, True),
    "shutter": ("#7E9C86",), "lamp_glow": ("#FFD27F", 0.5, 2.0), "flame": ("#FF9A3C", 0.5, 4.0), "paper": ("#FBF7EE",), "paper_plane": ("#FFFDF7", 0.7, 0, True),
    "chalk": ("#3D4A40",), "tomato": ("#D9442F", 0.6), "terracotta": ("#C46A3E", 0.8), "tire": ("#2E2E33", 0.7), "water": ("#7EC3E3", 0.12), "lily": ("#7FA94A",), "metal": ("#4A4A52", 0.5),
    "flower_white": ("#FFFFFF", 0.8, 0, True), "flower_purple": ("#B58BE0", 0.8, 0, True), "flower_yellow": ("#F2C443", 0.8, 0, True),
    "hue_projects": ("#D96B3B", 0.7), "hue_graphics": ("#5E93D8", 0.45), "glass": ("#5E93D8", 0.3), "hue_experience": ("#B49BF0", 0.6), "hue_community": ("#CF8BEA", 0.6),
}
M = {k: mat(k, *v) for k, v in MATS.items()}
for m in list(bpy.data.materials):
    if m.users == 0 and m.name not in M:
        bpy.data.materials.remove(m)

# ---------------------------------------------------------------- layout
V = lambda x, y: Vector((x, y))
def R(t):
    return S * (18 + 1.4 * math.sin(3 * t + 0.5) + 0.9 * math.cos(5 * t))

PLAZA_R = 5.8
STUDIO, GALLERY, BOARD = V(0, 15.5), V(-16, 1.0), V(15.5, 1.0)
POND, POND_R = V(3.0, -15.0), 5.0
LANDING = V(3.0, -9.2)                    # where the dock meets the shore
PLATFORM = V(3.0, -15.6)                  # dock platform centre: visitors appear here
COMMONS, GARDEN = V(-11.2, -10.6), V(8.6, 12.8)
LOOKOUT = POND + V(6.4 * math.cos(math.radians(18)), 6.4 * math.sin(math.radians(18)))   # deck over the east shore
AWAY = (LOOKOUT - POND).normalized()
DOORS = {
    "door_studio": STUDIO + V(0, -3.7), "door_gallery": GALLERY + V(3.5, 0), "door_board": BOARD + V(-2.1, 0),
    "door_poster": COMMONS + V(-1.0, 0.6), "spawn": PLATFORM,
}
HILLS = [(-15, 15, 1.4), (17, 14, 1.1), (-19, -3, 0.8), (19, -7, 0.9), (-5, 20, 0.9)]
PADS = [(0, 0, PLAZA_R + 1.3), (STUDIO.x, STUDIO.y, 6.8), (GALLERY.x, GALLERY.y, 6.0), (BOARD.x, BOARD.y, 4.5),
        (COMMONS.x, COMMONS.y, 4.6), (GARDEN.x, GARDEN.y, 3.8), (LOOKOUT.x, LOOKOUT.y, 2.4), (LANDING.x, LANDING.y, 2.6)]
# The lake sits in a basin with a low bank around it, open where the dock and the lookout meet the shore.
BERM_GAPS = [math.degrees(math.atan2(LANDING.y - POND.y, LANDING.x - POND.x)), math.degrees(math.atan2(AWAY.y, AWAY.x))]

def pond_edge(a):
    return POND_R * (1 + 0.08 * math.sin(3 * a + 1) + 0.05 * math.cos(5 * a))

def H(x, y):
    hills = sum(a * math.exp(-((x - hx) ** 2 + (y - hy) ** 2) / 50.0) for hx, hy, a in HILLS)
    f = 1.0
    for px, py, pr in PADS:
        f = min(f, max(0.0, min(1.0, (math.hypot(x - px, y - py) - pr) / 3.5)))
    h = hills * f
    dx, dy = x - POND.x, y - POND.y; dp = math.hypot(dx, dy); e = pond_edge(math.atan2(dy, dx))
    if dp < e + 1.6:
        s = max(0.0, min(1.0, (e + 1.6 - dp) / 2.2)); s = s * s * (3 - 2 * s)
        h = h * (1 - s) - 0.8 * s
    if dp < e + 4.0:
        ad = math.degrees(math.atan2(dy, dx))
        gap = min(abs(((ad - c + 180) % 360) - 180) for c in BERM_GAPS)
        open_ = max(0.0, min(1.0, (gap - 16) / 14))      # fades the bank out near the dock and the lookout
        g = dp - (e + 1.8)
        h += 0.42 * open_ * math.exp(-(g * g) / 1.1)
    rr = math.hypot(x, y) / R(math.atan2(y, x))
    if rr > 0.9:
        h -= ((rr - 0.9) / 0.1) ** 2 * 0.3
    return h

# ---------------------------------------------------------------- mesh builder
class B:
    def __init__(self):
        self.bm = bmesh.new(); self.names = []; self.beveled = False
    def mi(self, n):
        if n not in self.names:
            self.names.append(n)
        return self.names.index(n)
    def paint(self, verts, n):
        i = self.mi(n)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = i
    def box(self, c, s, n, rz=0.0, rx=0.0, ry=0.0, bevel=True):
        mtx = Matrix.Translation(c) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Rotation(rx, 4, "X") @ Matrix.Diagonal((*s, 1))
        verts = bmesh.ops.create_cube(self.bm, size=1.0, matrix=mtx)["verts"]
        self.paint(verts, n)
        small = min(s)
        if DETAIL and bevel and small >= 0.1:
            edges = list({e for v in verts for e in v.link_edges})
            big = small >= 0.9
            res = bmesh.ops.bevel(self.bm, geom=list(verts) + edges, offset=0.07 if big else min(0.045, small * 0.2),
                                  offset_type="OFFSET", segments=2 if big else 1, profile=0.5, affect="EDGES",
                                  clamp_overlap=True, material=self.mi(n))
            for f in res.get("faces", []):
                f.material_index = self.mi(n)
            self.beveled = True
    def ico(self, c, s, n, sub=1):
        self.paint(bmesh.ops.create_icosphere(self.bm, subdivisions=sub, radius=1.0, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*s, 1)))["verts"], n)
    def cone(self, c, r1, r2, d, n, seg=8, rot=None):
        mtx = Matrix.Translation(c) @ (rot if rot else Matrix.Identity(4))
        self.paint(bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=d, matrix=mtx)["verts"], n)
    def disc(self, c, r, n, seg=5):
        self.paint(bmesh.ops.create_circle(self.bm, cap_ends=True, segments=seg, radius=r, matrix=Matrix.Translation(c))["verts"], n)
    def face(self, pts, n):
        f = self.bm.faces.new([self.bm.verts.new(p) for p in pts]); f.material_index = self.mi(n); return f
    def obj(self, name, loc=(0, 0, 0), rz=0.0, smooth=False):
        me = bpy.data.meshes.new(name); self.bm.to_mesh(me); self.bm.free()
        for n in self.names:
            me.materials.append(M[n])
        if smooth or self.beveled:
            for p in me.polygons:
                p.use_smooth = True
            if self.beveled:
                try:
                    me.set_sharp_from_angle(angle=math.radians(35))
                except Exception:
                    pass
        o = bpy.data.objects.new(name, me); o.location = loc; o.rotation_euler = (0, 0, rz); coll.objects.link(o); return o

def at(name, b, p, deg=0.0, smooth=False):
    return b.obj(name, loc=(p.x, p.y, H(p.x, p.y)), rz=math.radians(deg), smooth=smooth)

def facing(dir_deg):
    """Rotation (degrees) that turns an object whose front is local -Y towards the compass angle dir_deg."""
    return dir_deg + 90

def angle_to(a, b):
    return math.degrees(math.atan2(b.y - a.y, b.x - a.x))

def flowers_on(b, c, rx, rz, cols, n=5, seed=0):
    """Small flowers sitting on the upper surface of a bush (an ellipsoid at c with radii rx, rx, rz)."""
    rnd = random.Random(seed)
    for k in range(n):
        a = rnd.uniform(0, 2 * math.pi); e = rnd.uniform(0.35, 1.1)
        p = (c[0] + rx * math.cos(e) * math.cos(a), c[1] + rx * math.cos(e) * math.sin(a), c[2] + rz * math.sin(e))
        b.ico(p, (0.07, 0.07, 0.06), cols[k % len(cols)])

def pot(b, c, r=0.28, h=0.42, cols=("flower_purple", "flower_white", "flower_yellow"), seed=0):
    """A tapered terracotta pot with a rim and soil, a plant sitting in the soil and flowers on the plant."""
    x, y, z = c
    b.cone((x, y, z + h / 2), r * 0.72, r, h, "terracotta", seg=10)
    b.cone((x, y, z + h - 0.03), r * 1.1, r * 1.1, 0.08, "terracotta", seg=10)
    b.cone((x, y, z + h - 0.02), r * 0.92, r * 0.92, 0.03, "soil", seg=10)
    pc = (x, y, z + h + r * 0.45)
    b.ico(pc, (r * 0.95, r * 0.95, r * 0.75), "leaf")
    if cols:
        flowers_on(b, pc, r * 0.95, r * 0.75, cols, n=5, seed=seed)

# ---------------------------------------------------------------- ground, cliff, grass lip
b = B(); bm = b.bm; SEG, RINGS = 112, 26
c0 = bm.verts.new((0, 0, H(0, 0))); rings = []
for i in range(1, RINGS + 1):
    ring = []
    for s in range(SEG):
        t = 2 * math.pi * s / SEG; rad = R(t) * i / RINGS
        x, y = rad * math.cos(t), rad * math.sin(t); ring.append(bm.verts.new((x, y, H(x, y))))
    rings.append(ring)
gi = b.mi("grass")
for s in range(SEG):
    bm.faces.new((c0, rings[0][s], rings[0][(s + 1) % SEG])).material_index = gi
for i in range(RINGS - 1):
    for s in range(SEG):
        n = (s + 1) % SEG; bm.faces.new((rings[i][s], rings[i + 1][s], rings[i + 1][n], rings[i][n])).material_index = gi
rim = [v.co.copy() for v in rings[-1]]
b.obj("walk_ground", smooth=True)

b = B(); bm = b.bm
LAYERS = [(0, 1.0), (-0.9, 1.012), (-2.0, 0.995), (-2.25, 0.955), (-3.4, 0.94), (-4.8, 0.82), (-6.4, 0.6), (-7.8, 0.32)]
levels = []
for k, (dz, sc) in enumerate(LAYERS):
    ring = []
    for j, co in enumerate(rim):
        jit = 0 if k == 0 else 0.18 * math.sin(j * 1.3 + k * 2) + 0.12 * math.cos(j * 0.7 - k)
        ring.append(bm.verts.new((co.x * (sc + jit * 0.02), co.y * (sc + jit * 0.02), (co.z if k == 0 else rim[j].z) + dz + jit)))
    levels.append(ring)
tip = bm.verts.new((0.5, -0.4, -9.4)); e1, e2 = b.mi("earth"), b.mi("earth_dark")
for k in range(len(levels) - 1):
    for s in range(SEG):
        n = (s + 1) % SEG
        bm.faces.new((levels[k][s], levels[k][n], levels[k + 1][n], levels[k + 1][s])).material_index = e1 if k < 2 else e2
for s in range(SEG):
    bm.faces.new((levels[-1][s], levels[-1][(s + 1) % SEG], tip)).material_index = e2
bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
b.obj("island_base")

if DETAIL:
    b = B(); bm = b.bm; gi = b.mi("grass")
    r0 = [bm.verts.new((co.x, co.y, co.z + 0.02)) for co in rim]
    r1 = [bm.verts.new((co.x * 1.012, co.y * 1.012, co.z - (0.32 + 0.12 * math.sin(j * 0.9) + 0.08 * math.cos(j * 2.1)))) for j, co in enumerate(rim)]
    for s in range(SEG):
        n = (s + 1) % SEG; bm.faces.new((r0[s], r1[s], r1[n], r0[n])).material_index = gi
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    b.obj("deco_grass_lip", smooth=True)

    # Small rounded rocks set into the cliff, in loose clusters (no rectangular blocks).
    b = B(); t = random.uniform(0, 1)
    while t < 2 * math.pi:
        r = R(t); n = random.randint(1, 3)
        for k in range(n):
            s = random.uniform(0.25, 0.6); tt = t + random.uniform(-0.03, 0.03)
            rr = r * random.uniform(0.985, 1.0)
            b.ico((rr * math.cos(tt), rr * math.sin(tt), random.uniform(-2.0, -0.5)), (s, s * 0.85, s * 0.7), random.choice(["stone", "stone_light"]))
        t += random.uniform(2.5, 5.5) / r
    b.obj("deco_cliff_rocks")

# ---------------------------------------------------------------- water
b = B(); bm = b.bm; wi = b.mi("water")
cv = bm.verts.new((POND.x, POND.y, -0.32)); ring = []
for s in range(64):
    a = 2 * math.pi * s / 64; e = pond_edge(a) + 0.6
    ring.append(bm.verts.new((POND.x + e * math.cos(a), POND.y + e * math.sin(a), -0.32)))
for s in range(64):
    bm.faces.new((cv, ring[s], ring[(s + 1) % 64])).material_index = wi
b.obj("water_pond")

# ---------------------------------------------------------------- paths: one smooth shape from a distance field
def plaza_pt(a, r=PLAZA_R - 0.6):
    return V(r * math.cos(math.radians(a)), r * math.sin(math.radians(a)))
MAIN, SPUR = 1.35, 1.0   # half widths
PATHS = [   # (centreline control points, half width)
    ([LANDING + V(0, 0.4), V(2.4, -7.0), plaza_pt(282)], MAIN),                 # arrival
    ([plaza_pt(90), V(0, 8.6), DOORS["door_studio"]], MAIN),                     # café
    ([plaza_pt(180), V(-9.0, 0.9), DOORS["door_gallery"]], MAIN),                # gallery
    ([plaza_pt(0), V(9.0, 0.9), DOORS["door_board"]], MAIN),                     # notice board
    ([plaza_pt(238), V(-6.2, -7.4), COMMONS + V(1.4, 0.9)], MAIN),               # commons
    ([V(0.5, 10.6), V(4.2, 9.6), GARDEN + V(-1.25, -3.0)], SPUR),                # kitchen garden gate
    ([LANDING + V(0.8, -0.2), V(7.4, -9.6), LOOKOUT + AWAY * 1.9], SPUR),       # lake lookout
]
BLOBS = [(0, 0, PLAZA_R), (LANDING.x, LANDING.y, 2.0), (COMMONS.x, COMMONS.y, 3.4)] + \
        [(p.x, p.y, 1.7) for k, p in DOORS.items() if k.startswith("door_") and k != "door_poster"]

def catmull(pts, step=0.4):
    pts = [pts[0]] + pts + [pts[-1]]; out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]; n = max(2, int((p2 - p1).length / step))
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-2]); return out
DENSE = [(catmull(p), w) for p, w in PATHS]

RES = 0.4; LIM = 27.0
gx = np.arange(-LIM, LIM + RES, RES); X, Y = np.meshgrid(gx, gx)   # rows: y, cols: x
def smin(a, b, k=1.1):
    h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1)
    return b * (1 - h) + a * h - k * h * (1 - h)
D = np.full(X.shape, 99.0)
for cx, cy, r in BLOBS:
    D = smin(D, np.hypot(X - cx, Y - cy) - r)
for dense, w in DENSE:
    pd = np.full(X.shape, 99.0)
    for a, c in zip(dense, dense[1:]):
        ax, ay, bx, by = a.x, a.y, c.x, c.y; abx, aby = bx - ax, by - ay; l2 = abx * abx + aby * aby or 1e-6
        t = np.clip(((X - ax) * abx + (Y - ay) * aby) / l2, 0, 1)
        pd = np.minimum(pd, np.hypot(X - (ax + abx * t), Y - (ay + aby * t)))
    D = smin(D, pd - w, 0.9)
D += 0.09 * np.sin(0.9 * X + 1.3) * np.cos(0.7 * Y - 0.4) + 0.05 * np.sin(1.7 * X - 2.1 * Y)

bpy.context.view_layer.update()
GROUND_BVH = BVHTree.FromObject(bpy.data.objects["walk_ground"], bpy.context.evaluated_depsgraph_get())
def ground_z(x, y):
    """The height of the ground mesh itself at (x, y) (H is the smooth formula; the mesh is flat between its
    vertices), so things laid on the ground follow what is actually drawn."""
    hit = GROUND_BVH.ray_cast(Vector((x, y, 60.0)), Vector((0, 0, -1)))
    return hit[0].z if hit[0] is not None else H(x, y)

def path_mesh(name, D, lift, material):
    """Marching squares over the field: one mesh for everything where D < 0, with smooth interpolated edges,
    laid on the ground mesh. Merged into larger faces, then triangulated here, so no long concave face gets
    folded through the grass when it is drawn."""
    b = B(); bm = b.bm; mi = b.mi(material); cache = {}
    def vert(key, x, y):
        v = cache.get(key)
        if v is None:
            v = cache[key] = bm.verts.new((x, y, ground_z(x, y) + lift))
        return v
    ny, nx = D.shape
    inside = D < 0
    cand = np.argwhere(inside[:-1, :-1] | inside[1:, :-1] | inside[:-1, 1:] | inside[1:, 1:])
    for i, j in cand:
        c = [(i, j), (i, j + 1), (i + 1, j + 1), (i + 1, j)]
        d = [D[p] for p in c]
        poly = []
        for k in range(4):
            p, q = c[k], c[(k + 1) % 4]; dp, dq = d[k], d[(k + 1) % 4]
            if dp < 0:
                poly.append(vert(("c",) + p, gx[p[1]], gx[p[0]]))
            if (dp < 0) != (dq < 0):
                t = dp / (dp - dq)
                key = ("e",) + (min(p, q) + max(p, q))
                poly.append(vert(key, gx[p[1]] + (gx[q[1]] - gx[p[1]]) * t, gx[p[0]] + (gx[q[0]] - gx[p[0]]) * t))
        if len(poly) >= 3 and len(set(poly)) == len(poly):
            try:
                bm.faces.new(poly).material_index = mi
            except ValueError:
                pass
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.5), verts=bm.verts[:], edges=bm.edges[:])
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method="BEAUTY", ngon_method="BEAUTY")
    # Drop the crumbs: the field's wobble leaves tiny separate patches along the edges (thin wedges on the grass).
    left = set(bm.faces); crumbs = []
    while left:
        f0 = left.pop(); isl = [f0]; todo = [f0]
        while todo:
            f = todo.pop()
            for e in f.edges:
                for g in e.link_faces:
                    if g in left:
                        left.remove(g); isl.append(g); todo.append(g)
        if sum(f.calc_area() for f in isl) < 1.5:
            crumbs += isl
    bmesh.ops.delete(bm, geom=crumbs, context="FACES")
    return b.obj(name)

path_mesh("walk_path", D, 0.05, "sand")
if DETAIL:
    # A slightly darker band just outside the path (only the band, not a second copy underneath).
    path_mesh("deco_path_edge", np.maximum(D - 0.25, -(D + 0.08)), 0.035, "sand_edge")

def lerp_along(dense, dist):
    """Point and direction at a distance along a centreline."""
    acc = 0.0
    for a, c in zip(dense, dense[1:]):
        l = (c - a).length
        if acc + l >= dist:
            t = (dist - acc) / max(l, 1e-6); return a.lerp(c, t), (c - a).normalized()
        acc += l
    return dense[-1], (dense[-1] - dense[-2]).normalized()
def length(dense):
    return sum((c - a).length for a, c in zip(dense, dense[1:]))

# ---------------------------------------------------------------- plaza planter
b = B()
b.cone((0, 0, 0.2), 2.3, 2.25, 0.4, "stone", seg=32)
b.cone((0, 0, 0.55), 1.9, 1.85, 0.36, "stone_light", seg=32)
b.cone((0, 0, 0.74), 1.72, 1.72, 0.04, "grass", seg=32)
b.cone((0, 0, 1.9), 0.42, 0.28, 2.4, "trim")
for (x, y, z, s, n) in [(0, 0, 4.0, 1.9, "leaf"), (1.2, 0.5, 3.5, 1.25, "leaf_dark"), (-1.1, -0.6, 3.6, 1.2, "leaf"), (0.2, -1.1, 4.4, 1.0, "leaf"), (-0.4, 1.0, 4.6, 1.0, "leaf_dark")]:
    b.ico((x, y, z), (s, s, s * 0.85), n)
for k in range(10):   # bushes round the tree, with flowers growing on them (nothing floats)
    t = k * 0.63; c = (1.35 * math.cos(t), 1.35 * math.sin(t), 0.9)
    b.ico(c, (0.32, 0.32, 0.26), "leaf_dark" if k % 2 else "leaf")
    if k % 2 == 0:
        flowers_on(b, c, 0.32, 0.26, (["flower_white", "flower_purple", "flower_yellow"][k % 3],), n=3, seed=k)
b.obj("block_planter", loc=(0, 0, H(0, 0)))

if DETAIL:
    # Plaza paving: rings of flat pavers around the planter, every other ring offset by half a stone.
    b = B(); tones = ["paver", "paver_light", "sand_edge"]; rnd = random.Random(5)
    for ri, r0 in enumerate((2.72, 3.47, 4.22, 4.97)):
        n = int(2 * math.pi * r0 / 0.95)
        for k in range(n):
            a = 2 * math.pi * (k + 0.5 * (ri % 2)) / n
            # Each paver on the ground mesh under it, its top 1.5 cm over the sand path (Folio and the bikes stand on
            # the path, so they don't sink into raised tiles).
            px_, py_ = r0 * math.cos(a), r0 * math.sin(a)
            b.box((px_, py_, ground_z(px_, py_) + 0.05), (0.68, 2 * math.pi * r0 / n - 0.07, 0.03),
                  tones[rnd.randrange(3)], rz=a, bevel=False)
    b.obj("deco_paving")
    # A few flat stones set into the paths, off-centre, like worn stepping stones.
    b = B()
    for dense, w in DENSE[:5]:
        L = length(dense); d = 1.2
        while d < L - 1.0:
            p, t = lerp_along(dense, d); nrm = V(-t.y, t.x)
            q = p + nrm * rnd.uniform(-0.45, 0.45)
            if q.length > PLAZA_R + 0.4:
                b.cone((q.x, q.y, ground_z(q.x, q.y) + 0.05), rnd.uniform(0.2, 0.3), rnd.uniform(0.2, 0.3), 0.03, rnd.choice(["paver", "paver_light"]), seg=7)
            d += rnd.uniform(1.4, 2.2)
    b.obj("deco_path_stones")

# ---------------------------------------------------------------- dock: a straight walkway and a platform, no overlaps
TOP = 0.1
b = B()
x0, x1 = LANDING.x - 0.8, LANDING.x + 0.8
y_start, y_plat = LANDING.y + 0.5, PLATFORM.y + 1.7       # walkway runs from the shore down to the platform edge
y = y_start; k = 0
while y - 0.36 > y_plat:
    b.box((LANDING.x, y - 0.18, TOP), (1.6, 0.34, 0.08), "wood_light" if k % 2 else "wood"); y -= 0.4; k += 1
for sx in (x0 + 0.06, x1 - 0.06):
    b.box((sx, (y_start + y_plat) / 2, TOP - 0.1), (0.12, y_start - y_plat, 0.14), "trim", bevel=False)
px0, px1, py0, py1 = PLATFORM.x - 1.7, PLATFORM.x + 1.7, PLATFORM.y - 1.7, PLATFORM.y + 1.7
for k in range(9):
    yy = py1 - 0.19 - k * 0.38
    b.box((PLATFORM.x, yy, TOP), (3.4, 0.34, 0.08), "wood_light" if k % 2 else "wood")
for (px, py) in [(x0 + 0.1, LANDING.y - 1.6), (x1 - 0.1, LANDING.y - 1.6), (x0 + 0.1, y_plat + 0.2), (x1 - 0.1, y_plat + 0.2),
                 (px0 + 0.1, py0 + 0.1), (px1 - 0.1, py0 + 0.1), (px0 + 0.1, py1 - 0.1), (px1 - 0.1, py1 - 0.1)]:
    b.box((px, py, TOP - 0.6), (0.2, 0.2, 1.1), "trim")
# Railings: the south side, and the east side except a boarding gap by the rowboat's seat (the boat is moored
# along the east side; Folio steps in through the gap). RAILS and POSTS go into the walk grid as obstacles.
BOAT_POS, BOAT_RZ = PLATFORM + V(2.6, -0.2), 96
boat_seat = BOAT_POS + V(math.cos(math.radians(BOAT_RZ)), math.sin(math.radians(BOAT_RZ))) * -0.55   # the stern seat
GAP_TOP = boat_seat.y + 0.6             # the east rail runs from here north; south of it is open to the boat
RAILS, POSTS = [], []                   # world (x, y) segments and points, for the walk grid
for (px, py) in [(px1 - 0.1, py1 - 0.1), (px1 - 0.1, GAP_TOP), (px1 - 0.1, py0 + 0.1), (px0 + 0.1, py0 + 0.1)]:
    b.box((px, py, TOP + 0.4), (0.18, 0.18, 0.7), "wood"); POSTS.append((px, py))
b.box((px1 - 0.1, (GAP_TOP + py1 - 0.1) / 2, TOP + 0.62), (0.08, py1 - 0.1 - GAP_TOP, 0.08), "wood", bevel=False)
b.box((PLATFORM.x, py0 + 0.1, TOP + 0.62), (3.2, 0.08, 0.08), "wood", bevel=False)
RAILS += [((px1 - 0.1, GAP_TOP), (px1 - 0.1, py1 - 0.1)), ((px0 + 0.1, py0 + 0.1), (px1 - 0.1, py0 + 0.1))]
b.obj("walk_dock")

def deck_top(name, rects, z, loc=(0, 0, 0), rz=0.0):
    """A deck's floor for the site: one flat top without the gaps between planks, 12 cm wider than the planks so
    Folio's feet never slip off an edge. Hidden in renders and on the site; Folio stands on it."""
    b = B()
    for (x0_, y0_, x1_, y1_) in rects:
        b.face([(x0_, y0_, z), (x1_, y0_, z), (x1_, y1_, z), (x0_, y1_, z)], "wood")
    o = b.obj(name, loc=loc, rz=rz); o.hide_render = True; o.display_type = "WIRE"
    return o
DECK_E = 0.12
deck_top("walk_deck_dock", [(x0 - DECK_E, y_plat, x1 + DECK_E, y_start), (px0 - DECK_E, py0 - DECK_E, px1 + DECK_E, py1 + DECK_E)], TOP + 0.04)

# Life ring on the east railing; a lantern at the platform's north-east corner.
# A smooth torus in the plane of the railing (Y-Z), four orange and four cream quarters.
b = B(); bm_ = b.bm; RM, RT, NU, NV = 0.34, 0.075, 32, 10
ring = [[bm_.verts.new((RT * math.sin(2 * math.pi * v / NV),
                        (RM + RT * math.cos(2 * math.pi * v / NV)) * math.cos(2 * math.pi * u / NU),
                        (RM + RT * math.cos(2 * math.pi * v / NV)) * math.sin(2 * math.pi * u / NU))) for v in range(NV)] for u in range(NU)]
oi, ci = b.mi("hue_projects"), b.mi("cream")
for u in range(NU):
    for v in range(NV):
        f = bm_.faces.new((ring[u][v], ring[(u + 1) % NU][v], ring[(u + 1) % NU][(v + 1) % NV], ring[u][(v + 1) % NV]))
        f.material_index = oi if (u // (NU // 8)) % 2 == 0 else ci
        f.smooth = True
bmesh.ops.recalc_face_normals(bm_, faces=bm_.faces[:])
b.obj("deco_lifering", loc=(px1 + 0.06, PLATFORM.y + 0.6, TOP + 0.36), smooth=True)

# ---------------------------------------------------------------- rowboat: a hollow hull with seats and oars
def rowboat():
    """A rowboat. The outer hull is lofted from cross-sections and closed at the stern (transom) and the bow
    (stem), then given wall thickness with solidify, so it is one closed shell with no holes. Faces are then
    coloured by where they face: outside wood, inside lighter wood, the gunwale dark trim."""
    b = B(); bm = b.bm
    xs = [-1.3 + i * 0.34 for i in range(9)]   # stern (-x) to bow (+x)
    def half_w(x):
        if x > -0.1:
            return max(0.03, 0.62 * math.sqrt(max(0.0, 1 - ((x + 0.1) / 1.56) ** 2)))
        return 0.62 * (1 - 0.3 * ((x + 0.1) / 1.2) ** 2)
    def top(x):
        return 0.46 + 0.12 * ((x - 0.1) / 1.4) ** 2
    def bot(x):
        return 0.25 * max(0.0, (x - 0.6) / 0.85) ** 2
    rings = []
    for x in xs:
        w, zt, zb = half_w(x), top(x), bot(x)
        prof = [(w, zt), (0.93 * w, zt - 0.45 * (zt - zb)), (0.62 * w, zb + 0.05), (0.0, zb)]
        pts = prof + [(-yy, zz) for (yy, zz) in reversed(prof[:-1])]
        rings.append([bm.verts.new((x, yy, zz)) for (yy, zz) in pts])
    n = len(rings[0])
    for s in range(len(xs) - 1):
        for k in range(n - 1):
            bm.faces.new((rings[s][k], rings[s + 1][k], rings[s + 1][k + 1], rings[s][k + 1]))
    bm.faces.new(rings[0])                       # transom
    bm.faces.new(list(reversed(rings[-1])))      # stem
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.05)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    o, i_, t_ = b.mi("wood"), b.mi("wood_light"), b.mi("trim")
    bm.normal_update()
    for f in bm.faces:
        c = f.calc_center_median(); nrm = f.normal
        if nrm.z > 0.55 and c.z > top(c.x) - 0.09:
            f.material_index = t_
        elif nrm.dot(c - Vector((c.x, 0.0, 0.95))) > 0:
            f.material_index = o
        else:
            f.material_index = i_
    for x in (-0.55, 0.4):
        b.box((x, 0, top(x) - 0.16), (0.22, 2 * (half_w(x) - 0.09), 0.05), "trim", bevel=False)
    # Oars lying inside the hull, resting on both seats: 1.8 m long, between x -1.0 and 0.8, where the hull is
    # wider than they are, so nothing pokes through the sides or the bow.
    seat_top = min(top(-0.55), top(0.4)) - 0.16 + 0.025
    for sgn in (-1, 1):
        y = sgn * 0.17
        b.cone((-0.1, y, seat_top + 0.035), 0.03, 0.03, 1.5, "wood_light", seg=6, rot=Matrix.Rotation(math.pi / 2, 4, "Y"))
        b.box((0.72, y, seat_top + 0.035), (0.36, 0.12, 0.025), "wood_light", bevel=False)
    return b
# Its keel just touches the water (z -0.32), so the floor stays dry and visible inside.
boat = rowboat().obj("deco_boat", loc=(BOAT_POS.x, BOAT_POS.y, -0.31), rz=math.radians(BOAT_RZ))

# ---------------------------------------------------------------- building helpers
def prism(b, x0, x1, y0, y1, z0, z1, n, wall=None, wx=None):
    pts = [(x0, y0, z0), (x1, y0, z0), (x1, 0, z1), (x0, 0, z1), (x0, y1, z0), (x1, y1, z0)]
    b.face([pts[0], pts[1], pts[2], pts[3]], n); b.face([pts[5], pts[4], pts[3], pts[2]], n)
    b.face([pts[1], pts[5], pts[2]], n); b.face([pts[4], pts[0], pts[3]], n); b.face([pts[0], pts[4], pts[5], pts[1]], n)
    if wall:
        for x in (-wx, wx):
            tri = [(x, y0 + 0.4, z0), (x, y1 - 0.4, z0), (x, 0, z1 - 0.12)]; b.face(tri if x > 0 else tri[::-1], wall)

def awning(b, cx, z, w, d, tilt, stripes, y0):
    sw = w / stripes
    for k in range(stripes):
        b.box((cx - w / 2 + sw * (k + 0.5), y0 - d / 2 * math.cos(tilt), z - d / 2 * math.sin(tilt)), (sw, d, 0.05),
              "hue_projects" if k % 2 == 0 else "cream", rx=tilt, bevel=False)

def wall_window(b, wall, u, z, w, h, glass, hw, hd, shutters=False):
    """A framed window with bars on one wall of a box building (hw, hd: half width and depth).
    wall: 'front' (-Y), 'back' (+Y), 'left' (-X), 'right' (+X); u runs along the wall."""
    if wall in ("front", "back"):
        sy = -1 if wall == "front" else 1; y = sy * hd
        b.box((u, y + sy * 0.02, z), (w + 0.2, 0.1, h + 0.2), "trim")
        b.box((u, y + sy * 0.06, z), (w, 0.06, h), glass, bevel=False)
        if DETAIL:
            b.box((u, y + sy * 0.1, z), (0.06, 0.04, h), "trim", bevel=False); b.box((u, y + sy * 0.1, z), (w, 0.04, 0.06), "trim", bevel=False)
            b.box((u, y + sy * 0.14, z - h / 2 - 0.12), (w + 0.35, 0.22, 0.08), "plaster_trim", bevel=False)
        if shutters and DETAIL:
            for so in (-1, 1):
                b.box((u + so * (w / 2 + 0.28), y + sy * 0.05, z), (0.32, 0.06, h + 0.1), "shutter")
    else:
        sx = -1 if wall == "left" else 1; x = sx * hw
        b.box((x + sx * 0.02, u, z), (0.1, w + 0.2, h + 0.2), "trim")
        b.box((x + sx * 0.06, u, z), (0.06, w, h), glass, bevel=False)
        if DETAIL:
            b.box((x + sx * 0.1, u, z), (0.04, 0.06, h), "trim", bevel=False); b.box((x + sx * 0.1, u, z), (0.04, w, 0.06), "trim", bevel=False)
            b.box((x + sx * 0.14, u, z - h / 2 - 0.12), (0.22, w + 0.35, 0.08), "plaster_trim", bevel=False)

# ---------------------------------------------------------------- the café (projects)
b = B(); HW, HD, WH = 3.0, 2.5, 3.0
b.box((0, 0, WH / 2), (2 * HW, 2 * HD, WH), "plaster")
b.box((0, 0, 0.14), (2 * HW + 0.3, 2 * HD + 0.3, 0.28), "stone_light")
if DETAIL:
    for (cx, cy) in [(-HW, -HD), (HW, -HD), (-HW, HD), (HW, HD)]:   # corner trims
        b.box((cx, cy, WH / 2 + 0.1), (0.3, 0.3, WH - 0.2), "plaster_trim")
    for x in (-HW - 0.04, HW + 0.04):                                # beam under each gable
        b.box((x, 0, WH - 0.05), (0.14, 2 * HD + 0.2, 0.2), "trim")
RX0, RX1, RY, RZ0, RZ1 = -3.5, 3.5, 3.05, 2.9, 4.7
prism(b, RX0, RX1, -RY, RY, RZ0, RZ1, "roof_dark" if DETAIL else "hue_projects", wall="plaster", wx=HW)
slope = math.atan2(RZ1 - RZ0, RY); slen = math.hypot(RZ1 - RZ0, RY); rows = 6
for k in range(rows):
    f = (k + 0.5) / rows
    zc = RZ0 + (RZ1 - RZ0) * f + 0.1; yc = RY * (1 - f)
    if DETAIL:
        n = 10; tw = (RX1 - RX0) / n
        spans = [(RX0 + tw * c, RX0 + tw * (c + 1)) for c in range(n)] if k % 2 == 0 else \
                [(RX0, RX0 + tw / 2)] + [(RX0 + tw / 2 + tw * c, RX0 + tw / 2 + tw * (c + 1)) for c in range(n - 1)] + [(RX1 - tw / 2, RX1)]
        for (a0, a1) in spans:
            for sgn in (-1, 1):
                # Each row tilts a little steeper than the roof, so its lower edge steps out like a shingle.
                b.box(((a0 + a1) / 2, sgn * yc, zc), ((a1 - a0) - 0.07, slen / rows + 0.1, 0.12), "roof", rx=-sgn * (slope + 0.12))
    else:
        for sgn in (-1, 1):
            b.box((0, sgn * yc, zc), (RX1 - RX0, slen / rows, 0.09), "roof", rx=-sgn * slope)
b.box((0, 0, RZ1 + 0.06), (RX1 - RX0 + 0.1, 0.42, 0.22), "roof")
if DETAIL:
    for x in [RX0 + 0.35 + 0.7 * i for i in range(10)]:              # rafter ends under the eaves
        for sgn in (-1, 1):
            b.box((x, sgn * (HD + 0.3), RZ0 - 0.08), (0.12, 0.5, 0.12), "trim", bevel=False)
b.box((1.9, 1.0, 4.95), (0.72, 0.72, 1.5), "stone_light"); b.box((1.9, 1.0, 5.75), (0.88, 0.88, 0.14), "plaster_trim")
b.box((0, -HD - 0.03, 1.1), (1.35, 0.1, 2.2), "trim"); b.box((0, -HD - 0.06, 2.3), (1.6, 0.1, 0.16), "plaster_trim")
if DETAIL:
    for z in (0.6, 1.6):
        b.box((0, -HD - 0.1, z), (1.0, 0.04, 0.7), "wood", bevel=False)
    b.box((0.45, -HD - 0.16, 1.1), (0.08, 0.08, 0.08), "metal", bevel=False)
    b.box((1.0, -HD - 0.12, 2.0), (0.06, 0.25, 0.06), "metal", bevel=False); b.box((1.0, -HD - 0.24, 1.82), (0.2, 0.2, 0.28), "lamp_glow", bevel=False)
    b.box((0, -HD - 0.08, 2.62), (1.5, 0.08, 0.34), "cream")         # café sign above the door
    for k, x in enumerate((-0.95, 0.95)):
        pot(b, (x, -HD - 0.5, 0.0), r=0.24, h=0.38, seed=10 + k)
for x in (-1.95, 1.95):
    wall_window(b, "front", x, 1.6, 1.05, 0.9, "lamp_glow", HW, HD, shutters=True)
    b.box((x, -HD - 0.28, 0.98), (1.4, 0.4, 0.22), "wood")
    for k in range(4):
        b.ico((x - 0.5 + k * 0.33, -HD - 0.28, 1.16), (0.17, 0.17, 0.14), "leaf" if k % 2 else "flower_purple")
    awning(b, x, 2.55, 1.6, 0.8, math.radians(22), 6, -HD - 0.1)
for wall in ("left", "right"):
    wall_window(b, wall, -0.9, 1.6, 0.9, 0.9, "lamp_glow", HW, HD)
    wall_window(b, wall, 1.1, 1.6, 0.9, 0.9, "lamp_glow", HW, HD)
for u in (-1.6, 1.6):
    wall_window(b, "back", u, 1.6, 1.0, 0.9, "lamp_glow", HW, HD)
b.box((0, -HD - 0.5, 0.08), (1.9, 0.8, 0.16), "stone")
lm_studio = at("lm_studio", b, STUDIO, facing(270))
# Where the café's chimney smoke starts (the site puffs smoke from here).
bpy.context.view_layer.update()
e = bpy.data.objects.new("fx_chimney", None); e.empty_display_type = "SPHERE"; e.empty_display_size = 0.2
e.location = lm_studio.matrix_world @ Vector((1.9, 1.0, 5.9)); coll.objects.link(e)

# ---------------------------------------------------------------- the gallery (graphics)
b = B()
b.box((0, 0, 1.55), (9, 4, 3.1), "plaster"); b.box((0, 0, 3.2), (9.5, 4.5, 0.3), "plaster_trim")
b.box((0, 0, 0.12), (9.3, 4.3, 0.24), "stone_light")
# The gallery's window panes have their own material ("glass", the same blue by day) so the site can light them
# warm in the evening without lighting everything else that is blue.
for x in (-3.0, -0.4):
    wall_window(b, "front", x, 1.75, 1.85, 1.45, "glass", 4.5, 2.0)
b.box((2.6, -2.03, 1.1), (1.3, 0.1, 2.2), "hue_graphics"); b.box((2.6, -2.5, 2.45), (2.0, 1.0, 0.1), "hue_graphics")
b.box((2.6, -2.15, 2.25), (2.0, 0.12, 0.3), "plaster_trim")
for u in (-1.0, 1.0):
    wall_window(b, "left", u, 1.75, 1.2, 1.2, "glass", 4.5, 2.0); wall_window(b, "right", u, 1.75, 1.2, 1.2, "glass", 4.5, 2.0)
for u in (-2.6, 0.0, 2.6):
    wall_window(b, "back", u, 1.75, 1.6, 1.2, "glass", 4.5, 2.0)
if DETAIL:
    b.box((-2.0, 0.6, 3.5), (1.4, 1.0, 0.35), "plaster_trim"); b.box((2.5, 0.8, 3.45), (0.8, 0.8, 0.25), "metal")
    for (cx, cy, sx, sy) in [(0, -2.15, 9.5, 0.2), (0, 2.15, 9.5, 0.2), (-4.65, 0, 0.2, 4.5), (4.65, 0, 0.2, 4.5)]:
        b.box((cx, cy, 3.48), (sx, sy, 0.28), "plaster")                        # parapet round the flat roof
    b.box((-1.7, -2.12, 2.95), (3.2, 0.08, 0.36), "cream")                      # name board above the windows
    b.box((-1.7, -2.17, 2.95), (2.8, 0.03, 0.1), "hue_graphics", bevel=False)
for x in (-4.0, 4.0):
    b.box((x, -2.45, 0.25), (0.9, 0.6, 0.5), "wood"); b.ico((x, -2.45, 0.75), (0.45, 0.4, 0.4), "leaf")
at("lm_gallery", b, GALLERY, facing(0))

# ---------------------------------------------------------------- notice board (experience)
b = B()
for x in (-1.95, 1.95):
    b.box((x, 0, 1.45), (0.24, 0.24, 2.9), "trim")
b.box((0, 0, 1.75), (4.1, 0.2, 2.2), "wood"); b.box((0, -0.08, 1.75), (3.7, 0.08, 1.85), "hue_experience", bevel=False)
for r in range(2):
    for c in range(4):
        b.box((-1.35 + c * 0.9, -0.14, 2.2 - r * 0.9), (0.66, 0.03, 0.72), "paper", bevel=False)
        if DETAIL:
            b.box((-1.35 + c * 0.9, -0.17, 2.5 - r * 0.9), (0.08, 0.03, 0.08), "hue_projects", bevel=False)
prism(b, -2.45, 2.45, -0.6, 0.6, 2.9, 3.4, "roof")
b.box((0, 0, 3.42), (5.0, 0.18, 0.12), "trim")
for x in (-1.2, 1.2):
    b.ico((x, -0.6, 0.3), (0.45, 0.4, 0.38), "leaf_dark")
at("lm_board", b, BOARD, facing(180))

# ---------------------------------------------------------------- community poster stand
b = B()
for x in (-0.85, 0.85):
    b.box((x, 0, 1.4), (0.16, 0.16, 2.8), "wood")
b.box((0, 0, 2.75), (1.9, 0.14, 0.14), "wood")
b.box((0, 0, 1.7), (1.7, 0.12, 2.1), "wood")                                    # frame
b.box((0, -0.05, 1.7), (1.5, 0.08, 1.9), "hue_community", bevel=False)
b.box((0, -0.1, 1.85), (1.1, 0.03, 1.3), "paper", bevel=False)
for k, col in enumerate(["hue_projects", "hue_graphics", "flower_yellow"]):   # the poster's "design"
    b.box((-0.3 + k * 0.3, -0.12, 2.2 - k * 0.12), (0.22, 0.02, 0.22), col, bevel=False)
b.box((0, -0.12, 1.25), (0.5, 0.03, 0.18), "hue_community", bevel=False)
prism(b, -1.1, 1.1, -0.38, 0.38, 2.82, 3.15, "roof")                           # a little roof
b.box((0, 0, 0.12), (2.0, 0.6, 0.24), "stone")
for k, x in enumerate((-1.3, 1.3)):
    pot(b, (x, -0.1, 0.0), r=0.26, h=0.4, cols=("hue_community", "flower_white"), seed=20 + k)
lm_poster_pos = COMMONS + V(-3.4, 0.4)
at("lm_poster", b, lm_poster_pos, facing(angle_to(lm_poster_pos, COMMONS)))

for name, p in DOORS.items():
    e = bpy.data.objects.new(name, None); e.empty_display_type = "PLAIN_AXES"; e.empty_display_size = 0.6
    # The spawn is on the dock platform: the deck top (planks at TOP, 8 cm thick), not the lake bed under it.
    e.location = (p.x, p.y, TOP + 0.04 if name == "spawn" else H(p.x, p.y)); coll.objects.link(e)
bpy.data.objects["door_poster"].location = (lm_poster_pos.x + 1.4 * math.cos(math.radians(angle_to(lm_poster_pos, COMMONS))),
                                            lm_poster_pos.y + 1.4 * math.sin(math.radians(angle_to(lm_poster_pos, COMMONS))),
                                            H(lm_poster_pos.x, lm_poster_pos.y))

# ---------------------------------------------------------------- props
FOOT_PREFIX = ("block_", "lm_", "phys_", "walk_lookout")
def footprint(o, pad=0.0):
    """An object's real footprint on the ground: its bounding box, turned with it, as four world (x, y) corners."""
    mw = o.matrix_world; xs = [c[0] for c in o.bound_box]; ys = [c[1] for c in o.bound_box]
    x0_, x1_, y0_, y1_ = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
    return [(p.x, p.y) for p in (mw @ Vector((x0_, y0_, 0)), mw @ Vector((x1_, y0_, 0)), mw @ Vector((x1_, y1_, 0)), mw @ Vector((x0_, y1_, 0)))]
def overlaps(A, B):
    """Do two convex footprints overlap? (separating-axis test on their edges)"""
    for poly in (A, B):
        for k in range(len(poly)):
            (ax_, ay_), (bx_, by_) = poly[k], poly[(k + 1) % len(poly)]
            nx_, ny_ = by_ - ay_, ax_ - bx_
            pa = [nx_ * x + ny_ * y for x, y in A]; pb = [nx_ * x + ny_ * y for x, y in B]
            if max(pa) < min(pb) or max(pb) < min(pa):
                return False
    return True
def square(x, y, h):
    return [(x - h, y - h), (x + h, y - h), (x + h, y + h), (x - h, y + h)]

BENCH_L = 2.1      # two visitors side by side: a seated Folio is about 1 m wide with its arms
BENCH_SEATS = (-0.52, 0.52)   # seat centres along the bench (local X); the site reads the same values

def bench_parts(b, ox=0.0, oy=0.0, oz=0.0):
    """A three-seat park bench, front towards local -Y: side frames (front leg, back leg rising into the backrest
    support, seat rail, armrest), a middle frame without armrest, three seat slats and two backrest boards."""
    tilt = 0.14; half = BENCH_L / 2 - 0.08
    for x, arm in ((-half, True), (0.0, False), (half, True)):
        b.box((ox + x, oy - 0.2, oz + 0.25), (0.08, 0.08, 0.5), "trim", bevel=False)                   # front leg
        b.box((ox + x, oy + 0.24, oz + 0.5), (0.08, 0.08, 1.0), "trim", rx=-tilt, bevel=False)          # back leg + support
        b.box((ox + x, oy + 0.01, oz + 0.44), (0.07, 0.5, 0.06), "trim", bevel=False)                   # seat rail
        if arm:
            b.box((ox + x, oy - 0.03, oz + 0.68), (0.09, 0.52, 0.05), "wood", bevel=False)              # armrest
            b.box((ox + x, oy - 0.2, oz + 0.58), (0.06, 0.06, 0.2), "trim", bevel=False)                # armrest post
    for y in (-0.16, 0.0, 0.16):
        b.box((ox, oy + y, oz + 0.5), (BENCH_L - 0.08, 0.14, 0.05), "wood", bevel=False)                # seat slats
    for z in (0.7, 0.9):   # backrest boards, on the front face of the leaning back legs
        y = 0.24 + (z - 0.5) * math.tan(tilt) - 0.065
        b.box((ox, oy + y, oz + z), (BENCH_L - 0.08, 0.05, 0.15), "wood", rx=-tilt, bevel=False)

def bench(name, p, face_deg, z=None):
    b = B(); bench_parts(b)
    o = at(name, b, p, facing(face_deg))
    if z is not None:
        o.location.z = z
    return o

bi = 0
for a in (45, 135, 210, 320):   # around the plaza, facing the tree
    bi += 1; p = V((PLAZA_R + 1.3) * math.cos(math.radians(a)), (PLAZA_R + 1.3) * math.sin(math.radians(a)))
    bench(f"block_bench_{bi:02d}", p, a + 180)
for off in (V(-0.4, 3.6), V(-0.4, -3.6)):   # either side of the notice board
    bi += 1; bench(f"block_bench_{bi:02d}", BOARD + off, 180)

# Lake lookout: a small deck over the shore with two benches facing the water.
look_dir = angle_to(LOOKOUT, POND); fwd = (POND - LOOKOUT).normalized(); side = V(-fwd.y, fwd.x)
LW, LD = 4.4, 3.2                     # deck width (along the shore) and depth (towards the water)
look_rz = math.radians(facing(look_dir))
def look_pt(u, v):
    """A point on the lookout deck (local u across, v towards the back) in world x, y."""
    c_, s_ = math.cos(look_rz), math.sin(look_rz)
    return V(LOOKOUT.x + u * c_ - v * s_, LOOKOUT.y + u * s_ + v * c_)
# High enough that nothing under it pokes through: the ground (and the sand path, 5 cm over it) stays at least
# 5 cm under the planks across the whole deck and its floor's margin.
ground_max = max(H(p.x, p.y) for p in (look_pt(u, v) for u in np.linspace(-LW / 2 - 0.15, LW / 2 + 0.15, 11)
                                        for v in np.linspace(-LD / 2 - 0.15, LD / 2 + 0.15, 9)))
deck_z = max(H(LOOKOUT.x, LOOKOUT.y) + 0.12, ground_max + 0.06)
b = B()
for k in range(int(LD / 0.31)):       # planks across, front (water side) is local -Y
    b.box((0, -LD / 2 + 0.16 + k * 0.31, 0), (LW, 0.28, 0.08), "wood_light" if k % 2 else "wood")
for sx in (-LW / 2 + 0.1, LW / 2 - 0.1):
    b.box((sx, 0, -0.1), (0.12, LD, 0.14), "trim", bevel=False)                 # side beams under the planks
for (px_, py_) in [(-LW / 2 + 0.1, -LD / 2 + 0.1), (LW / 2 - 0.1, -LD / 2 + 0.1), (-LW / 2 + 0.1, LD / 2 - 0.1), (LW / 2 - 0.1, LD / 2 - 0.1)]:
    b.box((px_, py_, -0.6), (0.18, 0.18, 1.2), "trim")                          # posts down into the shore
for (x0_, y0_, x1_, y1_) in [(-LW / 2 + 0.1, -LD / 2 + 0.1, LW / 2 - 0.1, -LD / 2 + 0.1),
                             (-LW / 2 + 0.1, -LD / 2 + 0.1, -LW / 2 + 0.1, 0.2), (LW / 2 - 0.1, -LD / 2 + 0.1, LW / 2 - 0.1, 0.2)]:
    ln = math.hypot(x1_ - x0_, y1_ - y0_); rz_ = math.atan2(y1_ - y0_, x1_ - x0_)
    b.box(((x0_ + x1_) / 2, (y0_ + y1_) / 2, 0.62), (ln + 0.1, 0.09, 0.09), "wood", rz=rz_, bevel=False)   # rail
    for t_ in (0.0, 1.0):
        b.box((x0_ + (x1_ - x0_) * t_, y0_ + (y1_ - y0_) * t_, 0.33), (0.12, 0.12, 0.6), "wood", bevel=False)
# Skirt boards round the back and sides: the raised deck reads as built on the shore, not hovering over it.
b.box((0, LD / 2 - 0.04, -0.2), (LW, 0.06, 0.36), "trim", bevel=False)
for sx in (-LW / 2 + 0.03, LW / 2 - 0.03):
    b.box((sx, 0, -0.2), (0.06, LD, 0.36), "trim", bevel=False)
b.obj("walk_lookout", loc=(LOOKOUT.x, LOOKOUT.y, deck_z), rz=look_rz)
# Pots in the front corners, inside the rail: their own objects, so the walk grid keeps Folio out of them.
for k, sx in enumerate((-LW / 2 + 0.45, LW / 2 - 0.45)):
    bp = B(); pot(bp, (sx, -LD / 2 + 0.5, 0.04), seed=k)
    bp.obj(f"block_lookout_pot_{k + 1}", loc=(LOOKOUT.x, LOOKOUT.y, deck_z), rz=look_rz)
deck_top("walk_deck_lookout", [(-LW / 2 - DECK_E, -LD / 2 - DECK_E, LW / 2 + DECK_E, LD / 2 + DECK_E)], 0.04,
         loc=(LOOKOUT.x, LOOKOUT.y, deck_z), rz=look_rz)
fx, bx_ = LW / 2 - 0.1, -LD / 2 + 0.1   # rails: across the front, and the front half of both sides
for (u0, v0, u1, v1) in [(-fx, bx_, fx, bx_), (-fx, bx_, -fx, 0.2), (fx, bx_, fx, 0.2)]:
    p0, p1 = look_pt(u0, v0), look_pt(u1, v1); RAILS.append(((p0.x, p0.y), (p1.x, p1.y)))
bi += 1; bench(f"block_bench_{bi:02d}", LOOKOUT - fwd * 0.55, look_dir, z=deck_z + 0.04)   # towards the back, facing the water

def lamp(name, p):
    b = B()
    b.box((0, 0, 1.3), (0.12, 0.12, 2.6), "trim"); b.box((0, 0, 2.78), (0.34, 0.34, 0.36), "lamp_glow", bevel=False)
    b.box((0, 0, 3.0), (0.48, 0.48, 0.08), "trim", bevel=False); b.box((0, 0, 3.1), (0.2, 0.2, 0.12), "trim", bevel=False)
    b.box((0, 0, 0.1), (0.3, 0.3, 0.2), "trim")
    at(name, b, p)

# Lamps in pairs along the four main paths, at the same spacing on each.
li = 0; LAMP_POS = []
# Lamps never stand in or against anything already placed (benches, signs, tables): those are skipped.
bpy.context.view_layer.update()
TAKEN = [footprint(o, 0.3) for o in coll.objects if o.type == "MESH" and o.name.startswith(FOOT_PREFIX)]
for dense, w in DENSE[:5]:
    L = length(dense); d = 2.2
    while d < L - 1.5:
        p, t = lerp_along(dense, d); n = V(-t.y, t.x)
        for sgn in (-1, 1) if d < 3 else ((1,) if int(d / 5) % 2 else (-1,)):
            q = p + n * sgn * (w + 0.6)
            if q.length > PLAZA_R + 0.8:
                if any(overlaps(square(q.x, q.y, 0.2), t) for t in TAKEN):
                    continue
                li += 1; LAMP_POS.append(q); lamp(f"block_lamp_{li:02d}", q)
        d += 5.0
li += 1; lamp(f"block_lamp_{li:02d}", V(px1 - 0.1, py1 - 0.1)); bpy.data.objects[f"block_lamp_{li:02d}"].location.z = TOP + 0.04
li += 1; lamp(f"block_lamp_{li:02d}", LOOKOUT - fwd * (LD / 2 + 0.35) + side * (LW / 2 - 0.1))   # beside the deck, on the shore

# Welcome arch over the landing; a signpost at the plaza's south entry.
b = B()
for x in (-1.75, 1.75):
    b.box((x, 0, 1.6), (0.2, 0.2, 3.2), "wood")
b.box((0, 0, 3.15), (4.0, 0.22, 0.22), "trim")
b.box((0, -0.12, 2.72), (2.6, 0.08, 0.55), "cream"); b.box((0, -0.17, 2.72), (2.3, 0.03, 0.12), "hue_projects", bevel=False)
for x in (-1.75, 1.75):
    b.ico((x, -0.3, 0.3), (0.5, 0.45, 0.4), "leaf")
at("block_welcome_arch", b, LANDING + V(0, 1.1), 0)

b = B()
b.box((0, 0, 1.2), (0.16, 0.16, 2.4), "wood")
for z, ang in ((2.05, 90), (1.7, 180), (1.35, 0)):   # arrows to the café, the gallery, the board
    r = math.radians(ang); u = Vector((math.cos(r), math.sin(r), 0))
    b.box((u.x * 0.44, u.y * 0.44, z), (0.72, 0.06, 0.24), "wood_light", rz=r)
    b.box((u.x * 0.8, u.y * 0.8, z), (0.17, 0.06, 0.17), "wood_light", rz=r, ry=math.pi / 4)   # pointed tip
    b.box((u.x * 0.4, u.y * 0.4, z), (0.46, 0.075, 0.035), "trim", rz=r, bevel=False)          # a "lettering" line
b.box((0, 0, 2.45), (0.24, 0.24, 0.08), "trim", bevel=False)
at("block_signpost", b, plaza_pt(300, PLAZA_R + 0.9), 0)

def cafe_table(name, p):
    b = B()
    b.cone((0, 0, 0.74), 0.55, 0.55, 0.06, "wood_light", seg=12); b.box((0, 0, 0.37), (0.08, 0.08, 0.72), "trim", bevel=False)
    b.box((0, 0, 1.4), (0.05, 0.05, 1.4), "trim", bevel=False)
    for k in range(8):
        a0, a1 = 2 * math.pi * k / 8, 2 * math.pi * (k + 1) / 8
        b.face([(1.15 * math.cos(a0), 1.15 * math.sin(a0), 1.85), (1.15 * math.cos(a1), 1.15 * math.sin(a1), 1.85), (0, 0, 2.3)], "hue_projects" if k % 2 else "cream")
    for a in (0.6, 2.8, 4.4):
        b.cone((0.85 * math.cos(a), 0.85 * math.sin(a), 0.22), 0.2, 0.2, 0.44, "wood", seg=8)
    at(name, b, p)
cafe_table("block_cafe_table_01", STUDIO + V(-3.7, -4.6))
cafe_table("block_cafe_table_02", STUDIO + V(3.7, -4.6))
b = B()
b.box((0, -0.18, 0.5), (0.7, 0.06, 1.0), "trim", rx=-0.25, bevel=False); b.box((0, -0.22, 0.52), (0.58, 0.04, 0.8), "chalk", rx=-0.25, bevel=False)
b.box((0, 0.18, 0.5), (0.7, 0.06, 1.0), "trim", rx=0.25, bevel=False)
at("block_sign_01", b, STUDIO + V(1.6, -4.0), 15)

def bunting(name, p0, p1, h=3.0, sag=0.5, flags=10):
    b = B(); z0, z1 = H(p0.x, p0.y), H(p1.x, p1.y)
    for (p, z) in [(p0, z0), (p1, z1)]:
        b.box((p.x, p.y, z + h / 2), (0.14, 0.14, h), "wood")
    cols = ["hue_projects", "cream", "flower_purple", "flower_yellow"]
    d = p1 - p0; ln = d.length; u = d / ln
    def pt(f):
        return (p0.x + d.x * f, p0.y + d.y * f, z0 + (z1 - z0) * f + h - 0.1 - sag * 4 * f * (1 - f))
    for k in range(flags * 2):
        a, c = pt(k / (flags * 2)), pt((k + 1) / (flags * 2))
        b.box(((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), (math.dist(a, c), 0.02, 0.02), "trim", rz=math.atan2(u.y, u.x), bevel=False)
        if k % 2 == 0:
            w = ln / (flags * 2) * 0.9
            b.face([a, (a[0] + u.x * w * 1.6, a[1] + u.y * w * 1.6, a[2]), (a[0] + u.x * w * 0.8, a[1] + u.y * w * 0.8, a[2] - 0.45)], cols[(k // 2) % 4])
    b.obj(name)
bunting("deco_bunting_01", STUDIO + V(-5.2, -4.6), STUDIO + V(5.2, -4.6), h=3.3, sag=0.55, flags=12)
bunting("deco_bunting_02", COMMONS + V(-3.2, -3.7), COMMONS + V(3.0, -3.9), h=3.0, sag=0.35, flags=8)   # clear of the umbrella

# The commons: picnic table under an umbrella, campfire with log seats.
b = B()
b.box((0, 0, 0.75), (1.9, 0.95, 0.08), "wood_light")
for dy in (-0.72, 0.72):
    b.box((0, dy, 0.45), (1.9, 0.32, 0.07), "wood", bevel=False)
for dx in (-0.75, 0.75):
    b.box((dx, 0, 0.4), (0.1, 1.6, 0.08), "trim", bevel=False); b.box((dx, 0, 0.38), (0.1, 0.1, 0.76), "trim", bevel=False)
b.box((0, 0, 1.4), (0.05, 0.05, 1.5), "trim", bevel=False)
for k in range(10):
    a0, a1 = 2 * math.pi * k / 10, 2 * math.pi * (k + 1) / 10
    b.face([(1.5 * math.cos(a0), 1.5 * math.sin(a0), 1.9), (1.5 * math.cos(a1), 1.5 * math.sin(a1), 1.9), (0, 0, 2.45)], "hue_projects" if k % 2 else "cream")
at("block_picnic_table", b, COMMONS + V(0.5, -0.5), 10)
b = B()
for k in range(9):
    a = 2 * math.pi * k / 9; b.ico((0.55 * math.cos(a), 0.55 * math.sin(a), 0.1), (0.2, 0.17, 0.14), "stone")
for a in (0.3, 1.9, 3.5):
    b.cone((0, 0, 0.14), 0.07, 0.07, 0.8, "trim", seg=6, rot=Matrix.Rotation(a, 4, "Z") @ Matrix.Rotation(math.pi / 2, 4, "Y"))
b.cone((0, 0, 0.42), 0.26, 0.02, 0.6, "flame", seg=6); b.cone((0.12, 0.05, 0.36), 0.14, 0.02, 0.4, "lamp_glow", seg=5)
for a in (0.9, 2.6, 4.6):
    b.cone((1.35 * math.cos(a), 1.35 * math.sin(a), 0.2), 0.2, 0.2, 1.1, "wood", seg=8, rot=Matrix.Rotation(a + math.pi / 2, 4, "Z") @ Matrix.Rotation(math.pi / 2, 4, "Y"))
def D_at(p):
    i = int(round((p.y + LIM) / RES)); j = int(round((p.x + LIM) / RES))
    return D[i, j] if 0 <= i < D.shape[0] and 0 <= j < D.shape[1] else 99.0
def grass_spot(p, need=2.0):
    """The nearest point to p that is on grass, at least `need` metres from any path."""
    for r in (0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0):
        for k in range(16):
            q = p + V(r * math.cos(k * math.pi / 8), r * math.sin(k * math.pi / 8))
            if D_at(q) > need and (q - POND).length > POND_R + 3:
                return q
    return p
CAMPFIRE = grass_spot(COMMONS + V(1.0, 4.4))
at("block_campfire", b, CAMPFIRE)

# Kitchen garden behind the café: a picket fence with an open gate facing the path, four beds, stepping stones.
b = B(); FX, FY = 3.0, 2.2; GATE = (-1.9, -0.6)        # gate gap on the south side, between these x values
def pickets(x0, y0, x1, y1, skip=None):
    n = max(1, int(math.hypot(x1 - x0, y1 - y0) / 0.3)); rz = math.atan2(y1 - y0, x1 - x0)
    for k in range(n + 1):
        x, y = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
        if skip and skip[0] < x < skip[1]:
            continue
        b.box((x, y, 0.33), (0.07, 0.05, 0.66), "cream", rz=rz, bevel=False)
        b.box((x, y, 0.68), (0.05, 0.05, 0.05), "cream", rz=rz, ry=math.pi / 4, bevel=False)
    for z in (0.2, 0.5):
        if skip:
            for a0, a1 in ((x0, skip[0]), (skip[1], x1)):
                b.box(((a0 + a1) / 2, y0, z), (abs(a1 - a0), 0.04, 0.06), "cream", bevel=False)
        else:
            b.box(((x0 + x1) / 2, (y0 + y1) / 2, z), (math.hypot(x1 - x0, y1 - y0), 0.04, 0.06), "cream", rz=rz, bevel=False)
pickets(-FX, -FY, FX, -FY, skip=GATE); pickets(-FX, FY, FX, FY); pickets(-FX, -FY, -FX, FY); pickets(FX, -FY, FX, FY)
for (cx, cy) in [(-FX, -FY), (FX, -FY), (-FX, FY), (FX, FY), (GATE[0], -FY), (GATE[1], -FY)]:
    b.box((cx, cy, 0.42), (0.13, 0.13, 0.85), "wood")
ga = math.radians(-70)   # the gate, swung open outwards from its west post
for k in range(4):
    r = 0.16 + k * 0.3
    b.box((GATE[0] + r * math.cos(ga), -FY + r * math.sin(ga), 0.33), (0.07, 0.05, 0.66), "cream", rz=ga, bevel=False)
for z in (0.2, 0.5):
    b.box((GATE[0] + 0.6 * math.cos(ga), -FY + 0.6 * math.sin(ga), z), (1.2, 0.04, 0.06), "cream", rz=ga, bevel=False)
BEDS = {(-1.45, 0.95): "cabbage", (1.45, 0.95): "carrot", (-1.45, -0.95): "tomato", (1.45, -0.95): "sunflower"}
for (x, y), crop in BEDS.items():
    b.box((x, y, 0.18), (2.2, 1.0, 0.36), "wood"); b.box((x, y, 0.37), (2.0, 0.82, 0.03), "soil", bevel=False)
    for row in (-0.2, 0.2):
        for k in range(5):
            px_, py_ = x - 0.8 + k * 0.4, y + row
            if crop == "cabbage":
                b.ico((px_, py_, 0.5), (0.16, 0.16, 0.13), "leaf" if k % 2 else "grass")
            elif crop == "carrot":
                b.cone((px_, py_, 0.5), 0.07, 0.01, 0.22, "leaf_dark", seg=4); b.cone((px_, py_, 0.4), 0.05, 0.05, 0.03, "hue_projects", seg=5)
            elif crop == "tomato" and k % 2 == 0:
                b.box((px_, py_, 0.75), (0.03, 0.03, 0.8), "wood_light", bevel=False)
                b.ico((px_, py_, 0.7), (0.17, 0.17, 0.28), "leaf_dark")
                for dz in (0.55, 0.8):
                    b.ico((px_ + 0.1, py_ - 0.06, dz), (0.06, 0.06, 0.06), "tomato")
            elif crop == "sunflower" and k % 2 == 0:
                b.box((px_, py_, 0.75), (0.03, 0.03, 0.8), "leaf_dark", bevel=False)
                b.cone((px_, py_ - 0.03, 1.15), 0.16, 0.16, 0.04, "flower_yellow", seg=10, rot=Matrix.Rotation(math.pi / 2, 4, "X"))
                b.cone((px_, py_ - 0.06, 1.15), 0.07, 0.07, 0.04, "trim", seg=8, rot=Matrix.Rotation(math.pi / 2, 4, "X"))
for (sx, sy) in [(-1.25, -1.85), (-0.6, -1.8), (0, -1.55), (0, -0.95), (0, -0.35), (0, 0.25), (0, 0.85), (0, 1.45)]:
    b.cone((sx, sy, 0.03), 0.2, 0.2, 0.06, "stone_light", seg=8)   # stepping stones from the gate up the middle aisle
b.cone((2.55, 1.75, 0.38), 0.3, 0.3, 0.76, "wood", seg=10); b.cone((2.55, 1.75, 0.6), 0.32, 0.32, 0.05, "trim", seg=10)
b.cone((2.5, -1.7, 0.15), 0.14, 0.14, 0.3, "hue_graphics", seg=10)
b.box((2.68, -1.7, 0.22), (0.25, 0.04, 0.04), "hue_graphics", ry=-0.6, bevel=False)
at("block_garden", b, GARDEN, 0)

# Bike rack beside the gallery.
b = B()
for (x, y) in [(-1.2, -0.6), (1.2, -0.6), (-1.2, 0.6), (1.2, 0.6)]:
    b.box((x, y, 1.1), (0.12, 0.12, 2.2), "wood")
for s in (-1, 1):                                                            # a small gable roof, tiles like the café's
    b.box((0, s * 0.5, 2.36), (3.1, 1.12, 0.07), "roof", rx=-s * 0.36, bevel=False)
b.box((0, 0, 2.56), (3.16, 0.14, 0.09), "roof_dark", bevel=False)            # ridge cap
b.box((0, 0, 2.2), (2.56, 1.32, 0.08), "trim", bevel=False)                  # the frame the roof sits on
b.box((0, 0.5, 0.33), (1.5, 0.04, 0.04), "metal", bevel=False)               # the wheel rack the bikes stand in
for x in (-0.75, 0.75):
    b.box((x, 0.5, 0.17), (0.04, 0.04, 0.34), "metal", bevel=False)
def bike(b, x, col):
    """A bicycle along local Y in the plane at x: spoked wheels, diamond frame, saddle, handlebars."""
    WR = 0.32
    def bar(p, q, t, n):
        dy, dz = q[0] - p[0], q[1] - p[1]
        b.box((x, (p[0] + q[0]) / 2, (p[1] + q[1]) / 2), (t, math.hypot(dy, dz), t), n, rx=math.atan2(dz, dy), bevel=False)
    for yc in (-0.5, 0.5):
        segs = 16
        for k in range(segs):
            am = 2 * math.pi * (k + 0.5) / segs
            b.box((x, yc + WR * math.cos(am), WR + WR * math.sin(am)), (0.05, 2 * WR * math.sin(math.pi / segs) + 0.02, 0.05), "tire", rx=am + math.pi / 2, bevel=False)
        for k in range(4):
            b.box((x, yc, WR), (0.012, 2 * WR - 0.06, 0.012), "metal", rx=k * math.pi / 4, bevel=False)
        b.box((x, yc, WR), (0.07, 0.07, 0.07), "metal", bevel=False)
    rear, front, bb, seat, head_t, head_b = (-0.5, WR), (0.5, WR), (-0.06, 0.3), (-0.22, 0.82), (0.34, 0.84), (0.38, 0.68)
    for p, q in [(bb, seat), (seat, head_t), (bb, head_b), (bb, rear), ((-0.21, 0.76), rear), (head_b, front), (head_b, head_t)]:
        bar(p, q, 0.045, col)
    b.box((x, seat[0] - 0.02, seat[1] + 0.05), (0.13, 0.24, 0.05), "tire", bevel=False)
    bar(head_t, (0.3, 0.97), 0.035, "metal")
    b.box((x, 0.3, 0.97), (0.46, 0.035, 0.035), "metal", bevel=False)
    for sx in (-0.21, 0.21):
        b.box((x + sx, 0.3, 0.97), (0.09, 0.05, 0.05), "tire", bevel=False)
    b.cone((x + 0.03, bb[0], bb[1]), 0.1, 0.1, 0.02, "metal", seg=10, rot=Matrix.Rotation(math.pi / 2, 4, "Y"))
RACK = GALLERY + V(3.8, 6.4)
at("block_bike_rack", b, RACK, 0)
# The bikes are their own objects (ride_bike_*), origin on the ground between the wheels, front along local +Y,
# so the site can roll one out and ride it. The rack's shelter covers them, so the walk grid is unchanged.
for k, col in enumerate(["hue_graphics", "hue_projects"]):
    bb = B(); bike(bb, 0.0, col)
    at(f"ride_bike_{k + 1}", bb, RACK + V(-0.35 + k * 0.7, 0), 0)
# Where a visitor stands to take a bike: in front of the rack's open side nearest a path.
bike_side = min((1, -1), key=lambda s: D_at(RACK + V(0, s * 1.9)))
e = bpy.data.objects.new("door_bikes", None); e.empty_display_type = "PLAIN_AXES"; e.empty_display_size = 0.6
p_ = RACK + V(0, bike_side * 1.9); e.location = (p_.x, p_.y, H(p_.x, p_.y)); coll.objects.link(e)

# ---------------------------------------------------------------- props for the interactions
# phys_*: each crate, barrel and pot is its own object so the site can give it a physics body (knock-over).
def make_crate(name, p, z, rz, s=0.6):
    b = B(); h = s / 2
    b.box((0, 0, h), (s - 0.04, s - 0.04, s - 0.04), "wood_light")
    for ex, ey in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
        b.box((ex * (h - 0.03), ey * (h - 0.03), h), (0.07, 0.07, s), "wood", bevel=False)
    for zz in (0.035, s - 0.035):
        for e in (-1, 1):
            b.box((0, e * (h - 0.03), zz), (s, 0.07, 0.07), "wood", bevel=False)
            b.box((e * (h - 0.03), 0, zz), (0.07, s, 0.07), "wood", bevel=False)
    for e in (-1, 1):   # a diagonal brace on two faces
        b.box((0, e * (h - 0.005), h), (s * 1.2, 0.03, 0.07), "wood", ry=math.pi / 4, bevel=False)
    o = b.obj(name, loc=(p.x, p.y, z), rz=rz); return s
def make_barrel(name, p, z, rz=0.0):
    b = B()
    b.cone((0, 0, 0.36), 0.27, 0.27, 0.72, "wood", seg=12)
    b.cone((0, 0, 0.36), 0.3, 0.3, 0.3, "wood", seg=12)   # the belly
    for zz in (0.12, 0.6):
        b.cone((0, 0, zz), 0.295, 0.295, 0.05, "trim", seg=12)
    b.cone((0, 0, 0.725), 0.25, 0.25, 0.02, "trim", seg=12)
    b.obj(name, loc=(p.x, p.y, z), rz=rz)
def make_pot(name, p, z, r=0.2):
    b = B(); h = r * 1.4
    b.cone((0, 0, h / 2), r * 0.72, r, h, "terracotta", seg=10); b.cone((0, 0, h - 0.03), r * 1.1, r * 1.1, 0.07, "terracotta", seg=10)
    b.obj(name, loc=(p.x, p.y, z))

STACK_CAFE = STUDIO + V(-5.6, -1.4)
STACK_COMMONS = COMMONS + V(-1.9, -3.0)
for base, tag, rz in ((STACK_CAFE, "a", 0.15), (STACK_COMMONS, "b", -0.3)):
    z0 = H(base.x, base.y); right = V(math.cos(rz), math.sin(rz))
    nc = len([o for o in coll.objects if o.name.startswith("phys_crate")])
    make_crate(f"phys_crate_{nc + 1:02d}", base - right * 0.32, z0, rz)
    make_crate(f"phys_crate_{nc + 2:02d}", base + right * 0.32, z0, rz + 0.1)
    make_crate(f"phys_crate_{nc + 3:02d}", base, z0 + 0.6, rz - 0.2)
    nb = len([o for o in coll.objects if o.name.startswith("phys_barrel")])
    make_barrel(f"phys_barrel_{nb + 1:02d}", base + right * 1.15 + V(-right.y, right.x) * 0.2, z0)
    if tag == "a":
        make_barrel(f"phys_barrel_{nb + 2:02d}", base + right * 1.2 - V(-right.y, right.x) * 0.45, z0)
        for k in range(3):
            make_pot(f"phys_pot_{k + 1:02d}", base - right * 1.1 + V(-right.y, right.x) * (k - 1) * 0.42, z0)

# collect_*: paper planes hidden around the island (the site makes them bob and spin).
def make_plane(name, p, z, yaw):
    b = B()
    nose, tl, tr, tk = (0.24, 0, 0.02), (-0.2, 0.17, 0.05), (-0.2, -0.17, 0.05), (-0.2, 0, -0.05)
    b.face([nose, tl, (-0.2, 0.015, 0.0)], "paper_plane"); b.face([nose, (-0.2, -0.015, 0.0), tr], "paper_plane")
    b.face([nose, (-0.2, 0.015, 0.0), tk], "paper_plane"); b.face([nose, tk, (-0.2, -0.015, 0.0)], "paper_plane")
    b.face([(0.1, 0.05, 0.03), (0.02, 0.09, 0.035), (0.0, 0.08, 0.035)], "hue_projects")   # a little fold mark
    o = b.obj(name, loc=(p.x, p.y, z), rz=yaw); o.rotation_euler.x = 0.12
PLANES = [STUDIO + V(2.2, 3.5), GARDEN + V(3.7, 0.4), GALLERY + V(-3.0, -1.8), CAMPFIRE + V(1.7, 0.9),
          V(0.8 * R(math.radians(55)) * math.cos(math.radians(55)), 0.8 * R(math.radians(55)) * math.sin(math.radians(55)))]
for k, p in enumerate(PLANES):
    make_plane(f"collect_plane_{k + 1:02d}", p, H(p.x, p.y) + 0.8, random.uniform(0, 6.28))
make_plane(f"collect_plane_{len(PLANES) + 1:02d}", PLATFORM + V(-1.25, -1.25), TOP + 0.75, 0.8)

# Photo spot: a big wooden frame on the grass by the plaza, facing the tree; stand in it for a picture.
PHOTO_A = math.radians(112); PHOTO = V(8.7 * math.cos(PHOTO_A), 8.7 * math.sin(PHOTO_A))
b = B()
for x in (-1.25, 1.25):
    b.box((x, 0, 1.3), (0.18, 0.18, 2.6), "wood"); b.box((x, 0, 0.12), (0.4, 0.4, 0.24), "stone")
b.box((0, 0, 2.6), (2.9, 0.2, 0.2), "wood")
for (cx, cz, sx, sz) in [(0, 2.44, 2.3, 0.07), (-1.13, 1.3, 0.07, 2.3), (1.13, 1.3, 0.07, 2.3)]:
    b.box((cx, -0.06, cz), (sx, 0.04, sz), "cream", bevel=False)                  # inner border
for x in (-1.13, 1.13):
    b.box((x, -0.09, 2.44), (0.16, 0.03, 0.16), "hue_projects", bevel=False)       # corner studs
b.box((0, -0.02, 2.95), (1.1, 0.08, 0.45), "cream"); b.box((0, -0.07, 2.95), (0.32, 0.03, 0.22), "trim", bevel=False)
b.cone((0, -0.09, 2.95), 0.07, 0.07, 0.02, "hue_graphics", seg=10, rot=Matrix.Rotation(math.pi / 2, 4, "X"))   # a lens
b.box((0, 0, 2.95 - 0.28), (0.08, 0.08, 0.12), "wood", bevel=False)
at("block_photo_frame", b, PHOTO, facing(angle_to(PHOTO, V(0, 0))))
b = B(); b.cone((0, 0, 0.03), 0.55, 0.55, 0.05, "paver_light", seg=14)
at("deco_photo_spot", b, PHOTO)
e = bpy.data.objects.new("door_photo", None); e.empty_display_type = "PLAIN_AXES"; e.empty_display_size = 0.6
e.location = (PHOTO.x, PHOTO.y, H(PHOTO.x, PHOTO.y)); coll.objects.link(e)
# The photo camera: on the plaza side of the frame, at about eye height for a 1.3 m Folio, looking through it.
cam_dir = (V(0, 0) - PHOTO).normalized(); cp = PHOTO + cam_dir * 3.6
e = bpy.data.objects.new("cam_photo", None); e.empty_display_type = "SINGLE_ARROW"; e.empty_display_size = 0.5
e.location = (cp.x, cp.y, H(PHOTO.x, PHOTO.y) + 1.35)
e.rotation_euler = (Vector((PHOTO.x, PHOTO.y, H(PHOTO.x, PHOTO.y) + 1.1)) - e.location).to_track_quat("Z", "Y").to_euler()
coll.objects.link(e)

def fence(name, a0, a1):
    b = B(); n = max(3, int(math.radians(abs(a1 - a0)) * R(math.radians(a0)) / 1.4)); prv = None
    for k in range(n + 1):
        t = math.radians(a0 + (a1 - a0) * k / n); r = R(t) * 0.93
        x, y = r * math.cos(t), r * math.sin(t); z = H(x, y)
        b.box((x, y, z + 0.45), (0.14, 0.14, 0.9), "wood", rz=t)
        if prv:
            px_, py_, pz = prv; ln = math.hypot(x - px_, y - py_); ang = math.atan2(y - py_, x - px_)
            for hz in (0.35, 0.7):
                b.box(((x + px_) / 2, (y + py_) / 2, (z + pz) / 2 + hz), (ln, 0.07, 0.09), "wood", rz=ang, bevel=False)
        prv = (x, y, z)
    b.obj(name)
fence("block_fence_01", 200, 236)
fence("block_fence_02", 30, 62)
fence("block_fence_03", 118, 150)

# ---------------------------------------------------------------- water decoration
def on_dock(x, y, pad=0.4):
    return (x0 - pad < x < x1 + pad and y_plat - pad < y < y_start + pad) or (px0 - pad < x < px1 + pad and py0 - pad < y < py1 + pad) \
        or (V(x, y) - (PLATFORM + V(2.6, -0.2))).length < 1.6 + pad
# Lily pads 4 cm over the water (closer flickers against it at a distance), each flower a small bud standing on
# its pad, and none within 0.6 m of the dock, the lookout or the boat. The random draws stay exactly as before,
# so nothing placed after this moves.
bpy.context.view_layer.update()
keep_clear = [footprint(bpy.data.objects[n], 0.6) for n in ("walk_dock", "walk_lookout", "deco_boat")]
b = B()
for k in range(26):
    a = random.uniform(0, 6.28); r = random.uniform(0.8, POND_R - 0.5)
    x, y = POND.x + r * math.cos(a), POND.y + r * math.sin(a)
    if on_dock(x, y):
        continue
    rad = random.uniform(0.25, 0.45)
    if any(overlaps(square(x, y, rad), f) for f in keep_clear):
        continue
    b.disc((x, y, -0.28), rad, "lily", seg=7)
    if k % 4 == 0:
        b.cone((x + 0.08, y, -0.255), 0.09, 0.04, 0.05, "flower_white", seg=6)
b.obj("deco_lilies")
b = B(); a = 0.0
while a < 2 * math.pi:   # shore stones in small clusters with gaps, not an even ring
    if random.random() < 0.55:
        for k in range(random.randint(1, 3)):
            aa = a + random.uniform(-0.06, 0.06); e = pond_edge(aa) + random.uniform(0.2, 0.9)
            x, y = POND.x + e * math.cos(aa), POND.y + e * math.sin(aa)
            if not on_dock(x, y, 0.3):
                s = random.uniform(0.18, 0.42); b.ico((x, y, H(x, y) + s * 0.2), (s, s * 0.9, s * 0.65), random.choice(["stone", "stone_light"]))
    a += random.uniform(0.25, 0.45)
b.obj("deco_shore")

# ---------------------------------------------------------------- planting
def on_path(p, gap):
    i = int(round((p.y + LIM) / RES)); j = int(round((p.x + LIM) / RES))
    if 0 <= i < D.shape[0] and 0 <= j < D.shape[1]:
        return D[i, j] < gap
    return False
def reach(o):   # how far an object spreads from its origin, from its real bounding box
    xs = [c[0] * o.scale.x for c in o.bound_box]; ys = [c[1] * o.scale.y for c in o.bound_box]
    return max(1.2, max(abs(v) for v in xs + ys) + 0.4)
FEATURES = [(o.location.x, o.location.y, reach(o)) for o in coll.objects
            if o.name.startswith(("block_", "lm_", "phys_", "deco_bunting", "deco_photo", "walk_lookout")) and not o.name.startswith("block_fence")]
def blocked(p, gap):
    if on_path(p, gap) or (p - POND).length < POND_R + 1.2 + gap * 0.2 or on_dock(p.x, p.y, 0.6):
        return True
    return any((p - V(x, y)).length < r + gap * 0.25 for x, y, r in FEATURES)

# Bushes block Folio and the knock-over props (added to the walk grid below).
BUSH_OBS = []
placed = []
def ok(p, gap, spacing):
    return not blocked(p, gap) and all((p - q).length >= spacing for q in placed)

def tree(name, p, sc, pine=False):
    b = B(); leaf = random.choice(["leaf", "leaf", "leaf_dark"])
    if pine:
        b.cone((0, 0, 0.5 * sc), 0.22 * sc, 0.18 * sc, 1.0 * sc, "trim")
        for z, r in [(1.4, 1.25), (2.25, 0.98), (3.0, 0.68)]:
            b.cone((0, 0, z * sc), r * sc, 0.04, 1.3 * sc, "leaf_dark", seg=7)
    else:
        b.cone((0, 0, 1.0 * sc), 0.32 * sc, 0.2 * sc, 2.0 * sc, "trim", seg=7)
        b.ico((0, 0, 2.9 * sc), (1.55 * sc, 1.5 * sc, 1.4 * sc), leaf)
        b.ico((0.8 * sc, 0.45 * sc, 2.45 * sc), (0.9 * sc, 0.9 * sc, 0.8 * sc), leaf)
        b.ico((-0.6 * sc, -0.55 * sc, 3.5 * sc), (0.75 * sc, 0.75 * sc, 0.7 * sc), "leaf_dark" if leaf == "leaf" else "leaf")
        for k in range(2):
            a = random.uniform(0, 6.28); b.ico((0.5 * math.cos(a), 0.5 * math.sin(a), 0.18), (0.3, 0.3, 0.22), "grass_dark")
    b.obj(name, loc=(p.x, p.y, H(p.x, p.y) - 0.05), rz=random.uniform(0, 6.28))
    placed.append(p)

nt = 0
# A belt of trees around the rim: denser at the back (north), thin at the front so the camera sees in.
t = 0.0
while t < 2 * math.pi:
    deg = math.degrees(t) % 360
    front = 230 < deg < 350
    for row, frac in enumerate((0.86, 0.74)):
        if front and (row == 1 or random.random() < 0.45):
            continue
        if not (30 < deg < 160) and row == 1 and random.random() < 0.5:
            continue
        r = R(t) * frac; p = V(r * math.cos(t + row * 0.06), r * math.sin(t + row * 0.06))
        if ok(p, 1.6, 3.4) and (p - POND).length > POND_R + 3.0:   # keep the lake and dock in view
            nt += 1; tree(f"block_tree_{nt:02d}", p, random.uniform(0.85, 1.3), pine=(nt % 6 == 0))
    t += 3.6 / R(t)
# A pair of trees framing each building, at the same offsets.
for c, ang, off in ((STUDIO, 270, 5.8), (GALLERY, 0, 7.0), (BOARD, 180, 4.4)):
    r = math.radians(ang + 90)
    for sgn in (-1, 1):
        p = c + V(math.cos(r), math.sin(r)) * sgn * off + V(math.cos(math.radians(ang)), math.sin(math.radians(ang))) * -1.0
        if ok(p, 1.0, 2.5):
            nt += 1; tree(f"block_tree_{nt:02d}", p, 1.1)

for i in range(9):   # rock clusters in the grass
    for _ in range(300):
        t = random.uniform(0, 6.28); p = V(*(random.uniform(0.35, 0.8) * R(t) * Vector((math.cos(t), math.sin(t)))))
        if ok(p, 1.6, 2.6):
            break
    else:
        continue
    placed.append(p); b = B(); s = random.uniform(0.7, 1.15)
    b.ico((0, 0, 0.2 * s), (0.9 * s, 0.75 * s, 0.6 * s), "stone"); b.ico((0.8 * s, 0.4 * s, 0.1 * s), (0.45 * s, 0.4 * s, 0.32 * s), "stone_light")
    if i % 2:
        b.ico((-0.6 * s, 0.5 * s, 0.05 * s), (0.3 * s, 0.28 * s, 0.22 * s), "stone")
    b.obj(f"block_rock_{i + 1:02d}", loc=(p.x, p.y, H(p.x, p.y)), rz=random.uniform(0, 6.28))
for i, a in enumerate((215, 300)):
    t = math.radians(a); r = R(t) * 0.97; b = B()
    b.ico((0, 0, 0), (1.6, 1.3, 1.5), "stone"); b.ico((1.2, 0.6, -0.6), (0.8, 0.7, 0.7), "stone_light")
    b.obj(f"deco_boulder_{i + 1:02d}", loc=(r * math.cos(t), r * math.sin(t), -0.9), rz=t)

# Flower beds along both sides of the café and gallery approaches; bushes against the buildings.
b = B()
for dense, w in (DENSE[1], DENSE[2]):
    L = length(dense); d = 1.5
    while d < L - 1.0:
        p, tv = lerp_along(dense, d); n = V(-tv.y, tv.x)
        for sgn in (-1, 1):
            q = p + n * sgn * (w + 0.75)
            if not blocked(q, 0.2):
                z = H(q.x, q.y); col = ["flower_white", "flower_purple", "flower_yellow"][int(d) % 3]
                b.ico((q.x, q.y, z + 0.18), (0.38, 0.38, 0.26), "leaf"); BUSH_OBS.append((q.x, q.y, 0.38))
                flowers_on(b, (q.x, q.y, z + 0.18), 0.38, 0.26, (col,), n=4, seed=int(d * 10) + sgn)
        d += 1.1
for c, ang, hw in ((STUDIO, 270, 3.4), (GALLERY, 0, 4.8)):
    r = math.radians(ang + 90); back = V(math.cos(math.radians(ang)), math.sin(math.radians(ang)))
    for k in range(-3, 4):
        if abs(k) < 1:
            continue
        q = c + V(math.cos(r), math.sin(r)) * (k / 3 * hw) + back * (-0.2 if ang == 270 else 2.3)
        z = H(q.x, q.y); b.ico((q.x, q.y, z + 0.3), (0.45, 0.4, 0.38), "leaf_dark" if k % 2 else "leaf"); BUSH_OBS.append((q.x, q.y, 0.45))
b.obj("deco_beds")

b = B()
for i in range(55):
    for _ in range(200):
        t = random.uniform(0, 6.28); p = V(*(random.uniform(0.3, 0.95) * R(t) * Vector((math.cos(t), math.sin(t)))))
        if ok(p, 1.2, 1.6):
            break
    else:
        continue
    placed.append(p); s = random.uniform(0.4, 0.8); z = H(p.x, p.y)
    b.ico((p.x, p.y, z + s * 0.35), (s, s, s * 0.72), random.choice(["leaf", "leaf_dark", "grass_dark"])); BUSH_OBS.append((p.x, p.y, s))
    if random.random() < 0.4:
        b.ico((p.x + s * 0.7, p.y, z + s * 0.2), (s * 0.55, s * 0.55, s * 0.45), "leaf")
b.obj("deco_bushes")

b = B(); cols = ["flower_white", "flower_white", "flower_purple", "flower_yellow", "hue_projects"]
for i in range(80):
    t = random.uniform(0, 6.28); c = V(*(random.uniform(0.3, 0.95) * R(t) * Vector((math.cos(t), math.sin(t)))))
    if blocked(c, 1.0):
        continue
    col = random.choice(cols)
    for k in range(random.randint(3, 6)):
        p = c + V(random.uniform(-0.45, 0.45), random.uniform(-0.45, 0.45)); z = H(p.x, p.y)
        if random.random() < 0.5:   # a tulip: stem and cup
            b.cone((p.x, p.y, z + 0.16), 0.025, 0.025, 0.32, "grass_dark", seg=4); b.cone((p.x, p.y, z + 0.36), 0.09, 0.07, 0.16, col, seg=5)
        else:                       # a daisy: short stem, a flat head on top of it, leaves at the foot
            b.cone((p.x, p.y, z + 0.09), 0.02, 0.02, 0.18, "grass_dark", seg=4)
            b.cone((p.x, p.y, z + 0.19), 0.1, 0.1, 0.025, col, seg=7)
            b.cone((p.x, p.y, z + 0.205), 0.035, 0.035, 0.02, "flower_yellow", seg=6)
            b.ico((p.x, p.y, z + 0.03), (0.09, 0.09, 0.05), "grass_dark")
b.obj("deco_flowers")

b = B(); gd = b.mi("grass_dark")
for i in range(800):
    t = random.uniform(0, 6.28); p = V(*(random.uniform(0.25, 0.97) * R(t) * Vector((math.cos(t), math.sin(t)))))
    if blocked(p, 0.6):
        continue
    z = H(p.x, p.y)
    for k in range(4):
        a = random.uniform(0, 6.28); hgt = random.uniform(0.2, 0.42)
        dx, dy = math.cos(a) * 0.06, math.sin(a) * 0.06; lx, ly = math.cos(a + 1.3) * 0.12, math.sin(a + 1.3) * 0.12
        f = b.bm.faces.new([b.bm.verts.new((p.x - dx, p.y - dy, z)), b.bm.verts.new((p.x + dx, p.y + dy, z)), b.bm.verts.new((p.x + lx, p.y + ly, z + hgt))])
        f.material_index = gd
b.obj("deco_grass")

# ---------------------------------------------------------------- preview (not exported)
sd = bpy.data.lights.new("preview_sun", "SUN"); sd.energy = 3.2; sd.angle = math.radians(8); sd.color = (1.0, 0.95, 0.86)
sun = bpy.data.objects.new("preview_sun", sd); sun.rotation_euler = (math.radians(52), math.radians(8), math.radians(40)); prev.objects.link(sun)
cd = bpy.data.cameras.new("preview_cam"); cd.lens = 40
cam = bpy.data.objects.new("preview_cam", cd); cam.location = (31 * S, -31 * S, 25 * S)
cam.rotation_euler = (Vector((0, 0, -1.5)) - cam.location).to_track_quat("-Z", "Y").to_euler(); prev.objects.link(cam)
scene = bpy.context.scene; scene.camera = cam
try:
    scene.view_settings.view_transform = "Standard"
except Exception:
    pass

# ---------------------------------------------------------------- remember generated transforms; apply hand moves
for o in coll.objects:
    o["gen_loc"] = list(o.location); o["gen_rot"] = list(o.rotation_euler); o["gen_scale"] = list(o.scale)
ov_path = os.path.join(HERE, "overrides.json"); applied = 0
if os.path.exists(ov_path):
    with open(ov_path, encoding="utf-8") as fh:
        for name, tr in json.load(fh).items():
            o = bpy.data.objects.get(name)
            if not o:
                continue
            o.location = tr["location"]; o.rotation_euler = tr["rotation"]; o.scale = tr["scale"]; applied += 1
    moved_ = set(json.load(open(ov_path, encoding="utf-8")))
else:
    moved_ = set()
# Moved sideways only (height untouched): sit it on the ground at its new spot, as high above it as it was.
resat = []
for name in moved_:
    o = bpy.data.objects.get(name)
    if not o or "gen_loc" not in o or abs(o.location.z - o["gen_loc"][2]) > 1e-4:
        continue
    gx_, gy_, gz_ = o["gen_loc"]
    if math.hypot(o.location.x - gx_, o.location.y - gy_) > 1e-3 and not name.startswith(("deco_bushes", "deco_flowers", "deco_grass")):
        o.location.z = H(o.location.x, o.location.y) + (gz_ - H(gx_, gy_)); resat.append(name)
# What belongs to a moved object goes with it (unless it was moved by hand too): a landmark's door, the bikes and
# the bike door with the rack, the photo spot's door, camera and paving with the frame.
FOLLOW = {"door_studio": "lm_studio", "door_gallery": "lm_gallery", "door_board": "lm_board", "door_poster": "lm_poster",
          "door_bikes": "block_bike_rack", "ride_bike_1": "block_bike_rack", "ride_bike_2": "block_bike_rack",
          "door_photo": "block_photo_frame", "cam_photo": "block_photo_frame", "deco_photo_spot": "block_photo_frame",
          "fx_chimney": "lm_studio"}
def gen_matrix(o):
    return Matrix.LocRotScale(Vector(o["gen_loc"]), Euler(o["gen_rot"]), Vector(o["gen_scale"]))
followed = []
for child, parent in FOLLOW.items():
    c, p = bpy.data.objects.get(child), bpy.data.objects.get(parent)
    if not c or not p or child in moved_ or parent not in moved_:
        continue
    delta = Matrix.LocRotScale(p.location, p.rotation_euler, p.scale) @ gen_matrix(p).inverted()
    loc, rot, sc = (delta @ gen_matrix(c)).decompose()
    c.location = loc; c.rotation_euler = rot.to_euler(); c.scale = sc; followed.append(child)
# Hand additions (additions.json, from capture_overrides.py): copies of generated objects, made again from the
# object they copy under the next free name, sharing its mesh's materials.
add_path = os.path.join(HERE, "additions.json"); added_ = []
if os.path.exists(add_path):
    with open(add_path, encoding="utf-8") as fh:
        for a in json.load(fh):
            src = bpy.data.objects.get(a["source"])
            if not src or src.type != "MESH":
                continue
            stem = re.sub(r"_\d+$", "", src.name); k = 1
            while bpy.data.objects.get(f"{stem}_{k:02d}"):
                k += 1
            o = src.copy(); o.data = src.data.copy(); o.name = f"{stem}_{k:02d}"; o.data.name = o.name
            o.location = a["location"]; o.rotation_euler = a["rotation"]; o.scale = a["scale"]
            o["added_from"] = src.name
            o["gen_loc"], o["gen_rot"], o["gen_scale"] = list(o.location), list(o.rotation_euler), list(o.scale)
            coll.objects.link(o); added_.append(o.name)
bpy.context.view_layer.update()
# A prop put down by hand a few cm over the ground rests on it (props sleep exactly where they are placed);
# one stacked on another (well above the ground) stays where it is.
for name in added_:
    o = bpy.data.objects[name]
    if not name.startswith("phys_"):
        continue
    bottom = min((o.matrix_world @ Vector(c)).z for c in o.bound_box); g_ = ground_z(o.location.x, o.location.y)
    if 0 < bottom - g_ < 0.1:
        o.location.z -= bottom - g_
bpy.context.view_layer.update()

# ---------------------------------------------------------------- overlap audit
# Every obstacle's real footprint is checked against every other. A lamp that overlaps anything is removed (lamps are
# placed by spacing along the paths and can land on a bench or a sign); other overlaps are reported in ISLAND_STATS so
# they get fixed in the layout. Expected overlaps: the pieces of one knock-over stack, the bench on the lookout deck.
bpy.context.view_layer.update()
def foot_objs():
    return [o for o in coll.objects if o.type == "MESH" and o.name.startswith(FOOT_PREFIX)]
removed = []
for o in [o for o in foot_objs() if o.name.startswith("block_lamp")]:
    mine = footprint(o, 0.05)
    if any(overlaps(mine, footprint(x, 0.05)) for x in foot_objs() if x is not o):
        removed.append(o.name); me = o.data; bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(me)
# Nothing tall between the photo camera and the frame (a lamp there would block every picture).
cam_o = bpy.data.objects["cam_photo"]
for o in [o for o in foot_objs() if o.name.startswith("block_lamp")]:
    a_, c_ = Vector((cam_o.location.x, cam_o.location.y)), Vector((PHOTO.x, PHOTO.y))
    t_ = max(0.0, min(1.0, (Vector(o.location.xy) - a_).dot(c_ - a_) / (c_ - a_).length_squared))
    if (Vector(o.location.xy) - (a_ + (c_ - a_) * t_)).length < 1.3:
        removed.append(o.name); me = o.data; bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(me)
def foot_of(o, pad):
    """Footprint for the audit: trees by their trunk, everything else by its turned bounding box."""
    if o.name.startswith("block_tree"):
        return square(o.location.x, o.location.y, 0.3 + pad)
    return footprint(o, pad)
def crown(o):
    xs = [c[0] * o.scale.x for c in o.bound_box]
    return square(o.location.x, o.location.y, max(abs(v) for v in xs) * 0.85)
for o in [o for o in foot_objs() if o.name.startswith(("block_tree", "block_rock"))]:
    others = [x for x in foot_objs() if x is not o and not x.name.startswith(("block_tree", "block_fence"))]
    hit = any(overlaps(foot_of(o, 0.05), foot_of(x, 0.05)) for x in others)
    if o.name.startswith("block_tree"):   # and crowns stay out of the buildings
        hit = hit or any(overlaps(crown(o), footprint(x)) for x in foot_objs() if x.name.startswith("lm_"))
    if hit:
        removed.append(o.name); me = o.data; bpy.data.objects.remove(o, do_unlink=True); bpy.data.meshes.remove(me)
OVERLAPS = []
objs = [o for o in foot_objs() if not o.name.startswith("block_fence")]
feet = {o.name: foot_of(o, -0.03) for o in objs}
for i_, a_ in enumerate(objs):
    for b_ in objs[i_ + 1:]:
        pair = {a_.name, b_.name}
        if all(n.startswith("phys_") for n in pair) or ("walk_lookout" in pair and any(n.startswith(("block_bench", "block_lookout_pot")) for n in pair)):
            continue
        if overlaps(feet[a_.name], feet[b_.name]):
            if not all(n.startswith("block_tree") for n in pair):   # crowns meeting is fine; trunks are tested
                OVERLAPS.append(sorted(pair))

# ---------------------------------------------------------------- walk rules: a grid the site uses for pathing
# A cell is walkable when it is on the island (inside 92% of the rim), not water (unless it is on the dock or
# the lookout deck), and not inside an obstacle: buildings, benches, props by their real (rotated) footprint,
# fences by their posts and rails, trees by their trunk. Doors and the spawn are always walkable.
# Coordinates are the site's (three.js, Y up): x = Blender x, z = -Blender y.
NAV_RES, NAV_LIM = 0.5, 26.0
FOLIO_R = 0.4   # Folio is about 0.8 m across: obstacles are blocked out this far, so its body never pokes into them
bpy.context.view_layer.update()   # objects made in this run need their world matrices before the footprint tests
decks = [bpy.data.objects[n] for n in ("walk_dock", "walk_lookout")]
def inside_local(o, x, y, pad):
    lp = o.matrix_world.inverted() @ Vector((x, y, o.location.z + 0.3))
    bb = o.bound_box; xs = [c[0] for c in bb]; ys = [c[1] for c in bb]
    sx, sy = o.scale.x or 1, o.scale.y or 1
    return min(xs) - pad / sx <= lp.x <= max(xs) + pad / sx and min(ys) - pad / sy <= lp.y <= max(ys) + pad / sy
def plank_under(d, x, y):
    """Is there a deck plank right under (x, y)? Rays down onto the deck's own mesh, counting only upward faces
    at deck height (not the rails above or the posts below). Five rays 5 cm apart, so the gaps between planks
    don't count as water."""
    inv = d.matrix_world.inverted(); dr = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
    for ox, oy in ((0, 0), (0.05, 0), (-0.05, 0), (0, 0.05), (0, -0.05)):
        hit, loc, nrm, _ = d.ray_cast(inv @ Vector((x + ox, y + oy, d.location.z + 3.0)), dr)
        if not hit:
            continue
        wl = d.matrix_world @ loc; wn = (d.matrix_world.to_3x3() @ nrm).normalized()
        if wn.z > 0.7 and d.location.z - 0.2 < wl.z < d.location.z + 0.3:
            return True
    return False
def on_deck(x, y, m=0.22):
    """On a deck with room for Folio: the cell's centre and four points m around it are all over planks."""
    return any(all(plank_under(d, x + ox, y + oy) for ox, oy in ((0, 0), (m, 0), (-m, 0), (0, m), (0, -m))) for d in decks)
round_obs, box_obs, vert_obs = [], [], set()
for o in coll.objects:
    n = o.name
    if not n.startswith(("block_", "lm_")) or o.type != "MESH":
        continue
    if n.startswith("block_tree"):
        round_obs.append((o.location.x, o.location.y, 0.32 + FOLIO_R))
    elif n.startswith(("block_lamp", "block_signpost")):
        round_obs.append((o.location.x, o.location.y, 0.18 + FOLIO_R))
    elif n == "block_planter":
        round_obs.append((o.location.x, o.location.y, 2.3 + FOLIO_R))   # the stone ring, not the tree's canopy
    elif n in ("block_welcome_arch", "block_photo_frame"):    # walk through: only the two posts block
        for sx in ((-1.75, 1.75) if n == "block_welcome_arch" else (-1.25, 1.25)):
            p = o.matrix_world @ Vector((sx, 0, 0)); round_obs.append((p.x, p.y, 0.12 + FOLIO_R))
    elif n.startswith("block_fence"):
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            vert_obs.add((int(round((p.x + NAV_LIM) / NAV_RES)), int(round((-p.y + NAV_LIM) / NAV_RES))))
    else:
        box_obs.append(o)
round_obs += [(x, y, r * 1.1 + 0.25) for x, y, r in BUSH_OBS]   # brushing a bush is fine, walking into it isn't
round_obs += [(x, y, 0.09 + FOLIO_R) for x, y in POSTS]          # deck railing posts
def seg_dist(x, y, a, c):
    ax_, ay_ = a; cx_, cy_ = c; dx_, dy_ = cx_ - ax_, cy_ - ay_; l2 = dx_ * dx_ + dy_ * dy_ or 1e-9
    t = max(0.0, min(1.0, ((x - ax_) * dx_ + (y - ay_) * dy_) / l2))
    return math.hypot(x - (ax_ + dx_ * t), y - (ay_ + dy_ * t))
RAIL_R = 0.05 + FOLIO_R                                          # deck rails, as capsules
n_cells = int(2 * NAV_LIM / NAV_RES) + 1
grid = []
for i in range(n_cells):             # rows: site z
    row = []
    for j in range(n_cells):         # cols: site x
        x = -NAV_LIM + j * NAV_RES; y = NAV_LIM - i * NAV_RES     # Blender y = -z
        ok_ = math.hypot(x, y) < 0.92 * R(math.atan2(y, x))
        if ok_:
            dx, dy = x - POND.x, y - POND.y
            # Water: anywhere in the lake's basin where the ground is under the water line, unless it's deck.
            if math.hypot(dx, dy) < pond_edge(math.atan2(dy, dx)) + 2.0 and H(x, y) < -0.2:
                ok_ = on_deck(x, y)
        if ok_ and (j, i) in vert_obs:
            ok_ = False
        if ok_ and any(math.hypot(x - ox, y - oy) < r for ox, oy, r in round_obs):
            ok_ = False
        if ok_ and any(inside_local(o, x, y, FOLIO_R) for o in box_obs):
            ok_ = False
        if ok_ and any(seg_dist(x, y, a, c) < RAIL_R for a, c in RAILS):
            ok_ = False
        row.append("1" if ok_ else "0")
    grid.append(row)
DOOR_NAMES = list(DOORS) + ["door_poster", "door_photo", "door_bikes"]
def cell_of(x, y):
    return int(round((NAV_LIM - y) / NAV_RES)), int(round((x + NAV_LIM) / NAV_RES))   # (row, col)
for name in DOOR_NAMES:
    o = bpy.data.objects.get(name)
    if o:
        i, j = cell_of(o.location.x, o.location.y)
        if 0 <= i < n_cells and 0 <= j < n_cells:
            grid[i][j] = "1"
# Riding: bikes stay on the paths and the plaza (inside the path field, D < 0.1), never on a deck or in water.
deck_cells = set()
ride = []
for i in range(n_cells):
    row = []
    for j in range(n_cells):
        x = -NAV_LIM + j * NAV_RES; y = NAV_LIM - i * NAV_RES
        dx, dy = x - POND.x, y - POND.y
        wet = math.hypot(dx, dy) < pond_edge(math.atan2(dy, dx)) + 2.0 and H(x, y) < -0.2
        if grid[i][j] == "1" and wet:
            deck_cells.add((i, j))
        on_look = inside_local(bpy.data.objects["walk_lookout"], x, y, 0.3)
        row.append("1" if grid[i][j] == "1" and not wet and not on_look and D_at(V(x, y)) < 0.1 else "0")
    ride.append(row)
bi_, bj_ = cell_of(*bpy.data.objects["door_bikes"].location.xy)
ride[bi_][bj_] = "1"
# The rack stands on the grass: a ride lane from its door to the nearest path, along walkable cells.
prev_ = {(bi_, bj_): None}; todo_ = [(bi_, bj_)]; end_ = None
while todo_ and end_ is None:
    nxt_ = []
    for c_ in todo_:
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k_ = (c_[0] + di, c_[1] + dj)
            if k_ in prev_ or not (0 <= k_[0] < n_cells and 0 <= k_[1] < n_cells) or grid[k_[0]][k_[1]] != "1":
                continue
            prev_[k_] = c_
            if ride[k_[0]][k_[1]] == "1" and math.dist(k_, (bi_, bj_)) > 1.5:
                end_ = k_; break
            nxt_.append(k_)
        if end_:
            break
    todo_ = nxt_
lane = 0
while end_ is not None:
    ride[end_[0]][end_[1]] = "1"; end_ = prev_[end_]; lane += 1
def flood(g, start):
    seen = {start}; todo = [start]
    while todo:
        i, j = todo.pop()
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            k = (i + di, j + dj)
            if k not in seen and 0 <= k[0] < n_cells and 0 <= k[1] < n_cells and g[k[0]][k[1]] == "1":
                seen.add(k); todo.append(k)
    return seen
ride_reach = flood(ride, (bi_, bj_))       # keep only the rideable area joined to the rack (drop scraps)
ride = [["1" if (i, j) in ride_reach else "0" for j in range(n_cells)] for i in range(n_cells)]
nav = {"res": NAV_RES, "x0": -NAV_LIM, "z0": -NAV_LIM, "size": n_cells,
       "note": "rows run along +z (site), columns along +x; '1' walkable (rows) or rideable by bike (ride). "
               "Generated by art/island/build_island.py.",
       "rows": ["".join(r) for r in grid], "ride": ["".join(r) for r in ride]}
with open(r"C:/Projects/joko-portfolio/public/playground/island-nav.json", "w", encoding="utf-8") as fh:
    json.dump(nav, fh, separators=(",", ":"))

# A hidden preview of the blocked cells (red), for checking the rules in Blender.
b = B(); red = b.mi("hue_projects")
for i, row in enumerate(grid):
    for j, c in enumerate(row):
        x = -NAV_LIM + j * NAV_RES; y = NAV_LIM - i * NAV_RES
        if c == "0" and math.hypot(x, y) < R(math.atan2(y, x)):
            h = NAV_RES * 0.45; z = 1.6
            b.bm.faces.new([b.bm.verts.new((x - h, y - h, z)), b.bm.verts.new((x + h, y - h, z)), b.bm.verts.new((x + h, y + h, z)), b.bm.verts.new((x - h, y + h, z))]).material_index = red
dbg = b.obj("debug_nav"); coll.objects.unlink(dbg); prev.objects.link(dbg); dbg.hide_viewport = True; dbg.hide_render = True

# ---------------------------------------------------------------- audits (all expected empty or true)
reach_ = flood(grid, cell_of(*bpy.data.objects["spawn"].location.xy))
def reachable_near(x, y, r):
    return any(math.hypot(x - (-NAV_LIM + j * NAV_RES), y - (NAV_LIM - i * NAV_RES)) <= r for i, j in reach_)
floors_ = [o for o in coll.objects if o.type == "MESH" and o.name.startswith("walk_")
           and not o.name.startswith(("walk_dock", "walk_lookout"))]   # what the site stands Folio on
def floor_hits(x, y):
    """Every floor under (x, y), highest first, as (z, name)."""
    out = []
    for o in floors_:
        inv = o.matrix_world.inverted(); dr = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
        ok, loc, nrm, _ = o.ray_cast(inv @ Vector((x, y, 8.0)), dr)
        if ok:
            out.append(((o.matrix_world @ loc).z, o.name))
    return sorted(out, reverse=True)
AUDIT = {"unreachable_doors": [], "unreachable_planes": [], "unreachable_benches": [], "doors_off_floor": [],
         "deck_pokes": [], "deck_cells_without_floor": 0, "phys_home_blocked": []}
for name in DOOR_NAMES:
    o = bpy.data.objects.get(name)
    if not o:
        continue
    if cell_of(*o.location.xy) not in reach_:
        AUDIT["unreachable_doors"].append(name)
    h = floor_hits(o.location.x, o.location.y)
    if not h or abs(h[0][0] - o.location.z) > 0.15:
        AUDIT["doors_off_floor"].append((name, round(o.location.z, 2), round(h[0][0], 2) if h else None))
for o in coll.objects:
    if o.name.startswith("collect_plane") and not reachable_near(o.location.x, o.location.y, 1.7):
        AUDIT["unreachable_planes"].append(o.name)
    if o.name.startswith("block_bench") and not reachable_near(o.location.x, o.location.y, 1.6):
        AUDIT["unreachable_benches"].append(o.name)
    if o.name.startswith("phys_"):   # a prop's home must be free ground (props bounce off blocked cells)
        ci, cj = cell_of(*o.location.xy)
        if grid[ci][cj] != "1":
            AUDIT["phys_home_blocked"].append(o.name)
look_o = bpy.data.objects["walk_lookout"]
for i in range(n_cells):
    for j in range(n_cells):
        x = -NAV_LIM + j * NAV_RES; y = NAV_LIM - i * NAV_RES
        if grid[i][j] != "1" or not ((i, j) in deck_cells or inside_local(look_o, x, y, 0.0)):
            continue
        h = floor_hits(x, y)
        if not h or not h[0][1].startswith("walk_deck"):
            if not h:
                AUDIT["deck_cells_without_floor"] += 1
            else:
                AUDIT["deck_pokes"].append((round(x, 1), round(-y, 1), h[0][1]))
AUDIT["ride_cells"] = sum(r.count("1") for r in ride); AUDIT["ride_reachable_from_rack"] = len(ride_reach)
AUDIT["ride_lane_cells"] = lane
AUDIT["deck_pokes"] = AUDIT["deck_pokes"][:10]

ISLAND_STATS = {
    "lamps_removed": removed, "overlaps": OVERLAPS, "audit": AUDIT,
    "walkable_cells": sum(r.count("1") for r in nav["rows"]),
    "objects": len(coll.objects),
    "triangles": sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in coll.objects if o.type == "MESH"),
    "trees": nt, "lamps": li, "overrides": applied, "resat": resat, "followed": followed, "added": added_,
}
