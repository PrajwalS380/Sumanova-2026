"""
Offline hair bake (step 2) — free & open source: Blender (bpy) only.

    python -I tools/hair-bake/bake.py tools/hair-bake/guides/<id>.json public/hair/<id>.glb

For one hairstyle:
  1. every lock guide becomes a smooth tube with a lens-shaped cross-section and a tapered tip;
  2. locks + scalp layer are fused into ONE clay-like sculpt (voxel remesh) and smoothed — roots
     melt into a single mass, tips stay separate, like a hand-sculpted stylised groom;
  3. a detailed copy gets strand grooves carved along each lock (high poly);
  4. a light copy is made for phones (decimated, UV-unwrapped);
  5. the grooves are baked into a normal map, soft occlusion into vertex colour;
  6. per-vertex hair data for the app's hair shader is transferred from the nearest guide:
     strand direction (_HAIRT), root→tip and clump id (COLOR_0 = occlusion, t, random);
  7. exported as .glb (WebP normal map), loaded on demand by the app.
Coordinates: the guides are head-local (y up, z forward); Blender is z up, so we store
(x, -z, y) and the glTF exporter converts back to y-up.
"""
import json
import math
import sys

import bpy  # noqa: E402  (must come first: it provides bmesh / mathutils)
import bmesh
from mathutils import Vector
from mathutils.kdtree import KDTree

src, dst = sys.argv[-2], sys.argv[-1]
TEX = 1024
data = json.load(open(src))
head = data["head"]
R = head["rx"]


def to_b(x, y, z):
    return Vector((x, -z, y))


# ------------------------------------------------------------------ scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16


def link(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    return ob


def activate(ob):
    for o in scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


# ------------------------------------------------------------------ 1. lock tubes (+ guide samples for later lookups)
RAD = 16
GROOVES = 3.0  # strand bundles across each lock
bm = bmesh.new()
samples = []  # (point, tangent, out, binormal, width, t, rand)
for g in data["guides"]:
    p = g["pts"]
    pts = [to_b(p[i], p[i + 1], p[i + 2]) for i in range(0, len(p), 3)]
    n = len(pts)
    if n < 2:
        continue
    rings = []
    for i in range(n):
        a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
        T = (b - a)
        if T.length < 1e-9:
            T = Vector((0, 0, -1))
        T.normalize()
        N = pts[i].copy()
        N -= T * N.dot(T)
        if N.length < 1e-9:
            N = Vector((T.y, -T.x, 0.3))
        N.normalize()
        B = T.cross(N).normalized()
        w = max(1e-4, g["w"][i])
        th = w * g["flat"]
        t = g["t0"] + (g["t1"] - g["t0"]) * i / (n - 1)
        samples.append((pts[i].copy(), T, N, B, w, t, g["rand"]))
        ring = []
        tt = i / (n - 1)
        for j in range(RAD):
            ang = j / RAD * math.tau
            # lens profile: full in the middle, thinning to soft edges
            c, s = math.cos(ang), math.sin(ang)
            out = th * (0.55 + 0.45 * abs(s))
            if s > 0:
                # strand grooves carved along this lock (top side), deeper toward the tip
                phase = (c + 1) * 0.5 * GROOVES * math.pi + g["rand"] * 5.0
                groove = (1 - abs(math.cos(phase))) ** 2
                out -= groove * th * 0.45 * s * (0.35 + 0.65 * min(1.0, tt * 2.2))
            ring.append(bm.verts.new(pts[i] + B * (c * w) + N * (s * out)))
        rings.append(ring)
    for i in range(n - 1):
        for j in range(RAD):
            k = (j + 1) % RAD
            bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]))
    for ring, rev in ((rings[0], True), (rings[-1], False)):
        c = bm.verts.new(sum((v.co for v in ring), Vector()) / RAD)
        for j in range(RAD):
            k = (j + 1) % RAD
            bm.faces.new((ring[k], ring[j], c) if rev else (ring[j], ring[k], c))

# scalp layer
if data.get("base"):
    bp, bi = data["base"]["pos"], data["base"]["idx"]
    vs = [bm.verts.new(to_b(bp[i], bp[i + 1], bp[i + 2])) for i in range(0, len(bp), 3)]
    for i in range(0, len(bi), 3):
        try:
            bm.faces.new((vs[bi[i]], vs[bi[i + 1]], vs[bi[i + 2]]))
        except ValueError:
            pass
locks = link("locks", bm)

kd = KDTree(len(samples))
for i, s in enumerate(samples):
    kd.insert(s[0], i)
kd.balance()

# ------------------------------------------------------------------ 2. fuse into one sculpt
activate(locks)
m = locks.modifiers.new("remesh", "REMESH")
m.mode = "VOXEL"
m.voxel_size = 0.0024 * R / 0.35
m.adaptivity = 0
bpy.ops.object.modifier_apply(modifier=m.name)
m = locks.modifiers.new("smooth", "CORRECTIVE_SMOOTH")
m.iterations = 3
m.smooth_type = "LENGTH_WEIGHTED"
m.use_only_smooth = True
bpy.ops.object.modifier_apply(modifier=m.name)

# ------------------------------------------------------------------ 4. light copy for phones (before carving)
low = locks.copy()
low.data = locks.data.copy()
low.name = "hair"
scene.collection.objects.link(low)
activate(low)
m = low.modifiers.new("dec", "DECIMATE")
target = 14000
m.ratio = min(1.0, target / max(1, len(low.data.polygons)))
bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.shade_smooth()

# 3. (grooves are carved per lock above, before fusing)
high = locks
high.name = "high"

# ------------------------------------------------------------------ 5. UVs, normal map, occlusion
activate(low)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
bpy.ops.object.mode_set(mode="OBJECT")

img = bpy.data.images.new("hair_normal", TEX, TEX, alpha=False, float_buffer=False)
img.colorspace_settings.name = "Non-Color"
mat = bpy.data.materials.new("hair")
mat.use_nodes = True
nt = mat.node_tree
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = img
nmap = nt.nodes.new("ShaderNodeNormalMap")
bsdf = nt.nodes["Principled BSDF"]
nt.links.new(tex.outputs["Color"], nmap.inputs["Color"])
nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
nt.nodes.active = tex
low.data.materials.append(mat)

high.select_set(True)
low.select_set(True)
bpy.context.view_layer.objects.active = low
bake = scene.render.bake
bake.use_selected_to_active = True
bake.cage_extrusion = 0.006 * R / 0.35
bake.max_ray_distance = 0.02 * R / 0.35
bake.margin = 6
bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT")

# occlusion into a colour attribute (between locks, under layers)
col = low.data.color_attributes.new("ao", "FLOAT_COLOR", "POINT")
low.data.color_attributes.active_color = col
activate(low)
high.hide_render = True
bake.use_selected_to_active = False
bake.target = "VERTEX_COLORS"
scene.cycles.samples = 32
bpy.ops.object.bake(type="AO")
ao = [c.color[0] for c in col.data]

# ------------------------------------------------------------------ 6. hair-shader data from the nearest guide
me = low.data
n = len(me.vertices)
cols = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
tang = me.attributes.new("_HAIRT", "FLOAT_VECTOR", "POINT")
for i, v in enumerate(me.vertices):
    co, idx, _ = kd.find(v.co)
    P, T, N, B, w, t, rnd = samples[idx]
    shade = 0.55 + 0.45 * ao[i]
    cols.data[i].color = (shade, t, rnd, 1.0)
    # head-local (y up) direction: Blender (x, y, z) → head (x, z, -y)
    tang.data[i].vector = (T.x, T.z, -T.y)
me.color_attributes.remove(me.color_attributes["ao"])
me.color_attributes.active_color = cols
me.color_attributes.render_color_index = 0

# ------------------------------------------------------------------ 7. export
bpy.data.objects.remove(high)
img.pack()
activate(low)
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_attributes=True,
    export_vertex_color="ACTIVE",
    export_normals=True,
    export_tangents=False,
    export_materials="EXPORT",
    export_image_format="WEBP",
    export_draco_mesh_compression_enable=False,
)
print("baked", data["name"], "verts", n)
