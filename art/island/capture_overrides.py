"""Saves your hand changes so build_island.py keeps them.

After moving, rotating or scaling objects in Blender, or adding copies of them, run this from the Scripting tab
(or ask Claude):
    exec(open(r"C:/Projects/joko-portfolio/art/island/capture_overrides.py").read())

- Moves: each island object is compared with the transform build_island.py gave it; the ones you changed go to
  art/island/overrides.json (merged with what is already there).
- Additions: a copy of a generated object (Shift+D, or copy and paste: named like "phys_crate_05.001"), anywhere
  in the scene, goes to art/island/additions.json with the object it copies and where you put it. The build makes
  it again from that object, under the next free name (phys_crate_07, ...), so it is exported, gets its physics,
  and shares the island's materials. This file is rewritten each time: it is the full list of additions.
Mesh edits (Tab mode) are not captured.
"""
import bpy, json, os, re

HERE = r"C:/Projects/joko-portfolio/art/island"
path = os.path.join(HERE, "overrides.json")
data = {}
if os.path.exists(path):
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)

def differs(a, b, eps=1e-4):
    return any(abs(x - y) > eps for x, y in zip(a, b))

changed = []
island = bpy.data.collections["island"]
for o in island.objects:
    if "gen_loc" not in o:
        continue
    loc, rot, sc = list(o.location), list(o.rotation_euler), list(o.scale)
    if differs(loc, o["gen_loc"]) or differs(rot, o["gen_rot"]) or differs(sc, o["gen_scale"]):
        data[o.name] = {"location": loc, "rotation": rot, "scale": sc}
        changed.append(o.name)
with open(path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)

# Additions: copies of generated objects (name "<generated>.<number>"), wherever they are in the scene. Copies the
# build already made from additions.json carry "added_from" and are kept too, at their current place.
added = []
for o in bpy.context.scene.objects:
    src = o.get("added_from")
    if not src:
        m = re.fullmatch(r"(.+)\.\d{3}", o.name)
        s = bpy.data.objects.get(m.group(1)) if m else None
        src = s.name if s and "gen_loc" in s else None
    if src and o.type == "MESH":
        added.append({"source": src, "location": list(o.location), "rotation": list(o.rotation_euler), "scale": list(o.scale)})
with open(os.path.join(HERE, "additions.json"), "w", encoding="utf-8") as fh:
    json.dump(added, fh, indent=2)

CAPTURED = {"moved": changed, "total_overrides": len(data), "additions": [a["source"] for a in added]}
print("Saved:", CAPTURED)
