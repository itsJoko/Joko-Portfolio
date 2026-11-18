# Blender for the Studio island: a beginner's guide

Everything you need to look around the island, walk it like a visitor, and move things. Blender 5.3.
Keep the mouse over the 3D view (the big middle area) when using shortcuts: Blender sends keys to whatever
panel is under the pointer.

## 1. Open the island

File → Open → `C:\Projects\joko-portfolio\art\island\island.blend`. Save with **Ctrl S**.

The screen: the **3D view** in the middle, the **Outliner** (a list of every object) top right, the
**Properties** panel (materials, settings) bottom right, and the **toolbar** on the left of the 3D view.

## 2. Look around (orbit, pan, zoom)

| Do this | To |
|---|---|
| Hold the **middle mouse button** (press the scroll wheel) and drag | Orbit around |
| **Shift** + middle mouse drag | Pan (slide sideways) |
| **Scroll** the wheel | Zoom |
| Select something, then numpad **.** (or View → Frame Selected) | Zoom to it |
| **Home** (or View → Frame All) | See the whole island |
| Numpad **0** | Look through the preview camera |
| Numpad **7** / **1** / **3** | Top / front / side view (numpad **5** toggles perspective) |

No numpad or no middle button (laptop)? Edit → Preferences → Input → tick **Emulate Numpad** and
**Emulate 3 Button Mouse** (then **Alt** + left drag orbits). The axis gizmo at the top right of the 3D view
also works: click its X / Y / Z balls to snap the view, drag it to orbit.

## 3. Walk the island like Folio will

View → Navigation → **Walk Navigation** (shortcut **Shift `**, the key left of 1).

| Key | Does |
|---|---|
| Move the mouse | Look around |
| **W A S D** | Walk forward / left / back / right |
| **E** / **Q** | Up / down |
| **Tab** | Gravity on/off: on, you walk on the ground like a visitor |
| **Shift** (hold) | Faster |
| Scroll | Change speed |
| Left click / **Enter** | Stop here |
| Right click / **Esc** | Cancel and jump back |

On the site the camera will follow Folio from behind and above, a little higher than walk mode's eye level.

## 4. See it with colours and light

Press **Z** in the 3D view and pick **Material Preview** (colours) or **Rendered** (lights and shadows,
slower). **Solid** is the fastest for moving things around.

## 5. Select

| Do this | To |
|---|---|
| **Left click** an object | Select it (the outline turns orange) |
| **Shift** + click | Add to / remove from the selection |
| **A** / **Alt A** | Select all / nothing |
| Click a name in the **Outliner** | Select by name (easiest for small things) |
| **H** / **Alt H** | Hide the selection / show everything again |

## 6. Move, rotate, scale

Select an object, then:

| Press | Then |
|---|---|
| **G** | Move with the mouse. Click to place, right click to cancel |
| **R** | Rotate |
| **S** | Scale |
| After G, R or S: **X**, **Y** or **Z** | Lock to that axis (**Z** for rotating things to face another way) |
| After that, type a number | Exact amount: **R Z 90 Enter** turns it 90° |
| **Ctrl Z** | Undo (as many times as you like) |

Prefer handles? Press **T** for the toolbar and pick the Move, Rotate or Scale tool: arrows appear on
the object to drag. **N** opens the sidebar with exact Location, Rotation and Scale numbers you can type into.

To duplicate: **Shift D**, move, click. To delete: **X** → Delete.

## 7. Keep your changes when Claude rebuilds the island

The island comes from a script (`art/island/build_island.py`), and rebuilding replaces the scene. Your moves
are kept like this:

1. Move, rotate or scale whatever you like, then **Ctrl S**.
2. Tell Claude "save my moves" (or run `art/island/capture_overrides.py` from the **Scripting** tab:
   open the file there and press the ▶ button).
3. Your changes go into `art/island/overrides.json`, and every rebuild puts them back.

Kept: position, rotation, scale. Not kept: shape edits (Tab mode), new objects you add, colour changes;
describe those to Claude and they go into the script. Objects are matched by name, so don't rename them.

## 8. Change a colour (to try ideas)

Select an object → Properties panel → the red sphere tab (**Material**) → **Base Color**. Materials are
shared, so changing `grass` recolours all grass. A rebuild resets colours; tell Claude the ones to keep.

## 9. Rules that keep the site working

- Don't rename objects or materials (`lm_studio`, `walk_path`, `door_studio`, `grass`...).
- No image textures.
- Keep the island centred where it is.
- Ask Claude to export when you're done; the site loads `public/playground/island.glb`.
