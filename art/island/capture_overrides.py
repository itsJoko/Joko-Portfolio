"""Saves your hand moves so build_island.py keeps them.

After moving, rotating or scaling objects in Blender, run this from the Scripting tab (or ask Claude):
    exec(open(r"C:/Projects/joko-portfolio/art/island/capture_overrides.py").read())

It compares each island object with the transform build_island.py gave it and writes the ones you changed
to art/island/overrides.json (merged with what is already there). Mesh edits are not captured.
"""
import bpy, json, os

HERE = r"C:/Projects/joko-portfolio/art/island"
path = os.path.join(HERE, "overrides.json")
data = {}
if os.path.exists(path):
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)

def differs(a, b, eps=1e-4):
    return any(abs(x - y) > eps for x, y in zip(a, b))

changed = []
for o in bpy.data.collections["island"].objects:
    if "gen_loc" not in o:
        continue
    loc, rot, sc = list(o.location), list(o.rotation_euler), list(o.scale)
    if differs(loc, o["gen_loc"]) or differs(rot, o["gen_rot"]) or differs(sc, o["gen_scale"]):
        data[o.name] = {"location": loc, "rotation": rot, "scale": sc}
        changed.append(o.name)

with open(path, "w", encoding="utf-8") as fh:
    json.dump(data, fh, indent=2)
CAPTURED = {"changed": changed, "total_overrides": len(data)}
print("Saved overrides:", CAPTURED)
