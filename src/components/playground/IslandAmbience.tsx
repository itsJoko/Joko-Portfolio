"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * The island's light and life (docs/studio.md, Ambience): day and night follow the site theme, and small things
 * keep moving. Dark mode is evening: moonlight and a dim sky, the lamps and the gallery's windows glow warm, each
 * lamp lights the ground round it, and fireflies come out. By day butterflies visit the flowers. Always: trees,
 * bushes and grass sway in the wind, the water ripples, the lily pads bob, the café's chimney smokes.
 * Animations run on the frames the scene already draws (about 30 a second while walking, none when still), so
 * this adds no frames of its own except while day turns to night.
 */

const DAY = { sky: new THREE.Color("#fff4e0"), ground: new THREE.Color("#7d8f5c"), hemi: 1.6, sun: new THREE.Color("#fff1d6"), sunI: 2.4 };
const NIGHT = { sky: new THREE.Color("#8597d6"), ground: new THREE.Color("#262d44"), hemi: 0.62, sun: new THREE.Color("#b3c1ff"), sunI: 0.75 };
const WARM = new THREE.Color("#ffc874");
const FIREFLIES = 26;
const PUFFS = 6;

type Props = { root: THREE.Object3D; night: boolean; lite: boolean };

/** Wind for the leaves and grass, ripples for the water (each material once; they are shared island-wide). */
function tweakMaterials(mats: Map<string, THREE.MeshStandardMaterial>) {
  for (const k of ["leaf", "leaf_dark", "grass_dark"]) {
    const m = mats.get(k);
    if (m) addWind(m);
  }
  const water = mats.get("water");
  if (water) addRipples(water);
}

/** Uniforms shared by the shader tweaks below. */
const shared = { uTime: { value: 0 }, uWind: { value: 1 } };

/** Leaves and grass lean with the wind: the higher above its object's base, the more a vertex moves. */
function addWind(m: THREE.Material) {
  if (m.userData.wind) return;
  m.userData.wind = true;
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.uniforms.uWind = shared.uWind;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nuniform float uWind;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec4 wp = modelMatrix * vec4(transformed, 1.0);
          float h = clamp(transformed.y, 0.0, 4.0);
          float g = sin(uTime * 1.6 + wp.x * 0.35 + wp.z * 0.27) + 0.45 * sin(uTime * 2.7 + wp.x * 0.9 - wp.z * 0.6);
          transformed.x += g * uWind * min(h * 0.018, 0.06);
          transformed.z += cos(uTime * 1.3 + wp.z * 0.31) * uWind * min(h * 0.012, 0.04);
        }`,
      );
  };
  m.needsUpdate = true;
}

/** Slow light bands drifting over the water. */
function addRipples(m: THREE.Material) {
  if (m.userData.ripples) return;
  m.userData.ripples = true;
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = shared.uTime;
    s.vertexShader = s.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRipple;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvRipple = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    s.fragmentShader = s.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec3 vRipple;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        {
          float r = sin(vRipple.x * 1.6 + uTime * 0.9) * sin(vRipple.z * 1.25 - uTime * 0.7)
                  + 0.5 * sin((vRipple.x + vRipple.z) * 2.3 + uTime * 1.4);
          diffuseColor.rgb *= 1.0 + 0.055 * r;
        }`,
      );
  };
  m.needsUpdate = true;
}

export function IslandAmbience({ root, night, lite }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sun = useRef<THREE.DirectionalLight>(null);
  const fireflies = useRef<THREE.Points>(null);
  const butterflies = useRef<THREE.Group>(null);
  const smoke = useRef<THREE.Group>(null);
  const lampLights = useRef<(THREE.PointLight | null)[]>([]);
  const n = useRef(night ? 1 : 0);               // 0 day to 1 night, eased

  // What the island offers: materials to tweak, lamp heads, the chimney, the lilies, places for butterflies.
  const found = useMemo(() => {
    const mats = new Map<string, THREE.MeshStandardMaterial>();
    root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if ((o as THREE.Mesh).isMesh && m?.name && !mats.has(m.name)) mats.set(m.name, m);
    });
    const lamps: THREE.Vector3[] = [];
    root.children.forEach((o) => {
      if (/^block_lamp_\d+$/.test(o.name)) lamps.push(o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 2.78, 0)));
    });
    const chimney = root.getObjectByName("fx_chimney")?.getWorldPosition(new THREE.Vector3()) ?? null;
    const lilies = root.getObjectByName("deco_lilies") ?? null;
    const garden = root.getObjectByName("block_garden")?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(8.6, 0, -12.8);
    const planter = root.getObjectByName("block_planter")?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
    const pond = root.getObjectByName("water_pond")?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3(3, -0.3, 15);
    return { mats, lamps, chimney, lilies, lilyY: lilies?.position.y ?? 0, garden, planter, pond };
  }, [root]);

  // The lamps' daytime glow, kept to blend towards night.
  const baseGlow = useMemo(() => found.mats.get("lamp_glow")?.emissiveIntensity ?? 1, [found]);
  // Shader tweaks: wind in the leaves and grass, ripples on the water.
  useEffect(() => tweakMaterials(found.mats), [found]);

  // Fireflies drift round the garden, the lake and the plaza; butterflies loop over flowers.
  const fly = useMemo(() => {
    const homes = [found.garden, found.pond, found.planter];
    const seeds = Array.from({ length: FIREFLIES }, (_, k) => {
      const h = homes[k % homes.length];
      return { x: h.x + Math.sin(k * 2.3) * 5, z: h.z + Math.cos(k * 1.7) * 5, y: 0.6 + (k % 5) * 0.25, a: k * 0.7, s: 0.3 + (k % 7) * 0.07 };
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(FIREFLIES * 3), 3));
    return { seeds, g };
  }, [found]);
  const bflyHomes = useMemo(() => [found.garden, found.planter, found.garden.clone().add(new THREE.Vector3(-3, 0, 2)), found.planter.clone().add(new THREE.Vector3(4, 0, -3))], [found]);
  useEffect(() => () => fly.g.dispose(), [fly]);
  // Frames reach these through a ref: they change the island's materials and objects, which render must not.
  const live = useRef<{ found: typeof found; baseGlow: number; fly: typeof fly; homes: THREE.Vector3[] } | null>(null);
  useEffect(() => {
    live.current = { found, baseGlow, fly, homes: bflyHomes };
    invalidate();
  }, [found, baseGlow, fly, bflyHomes, invalidate]);

  // A theme change: draw frames until the light has turned.
  useEffect(() => invalidate(), [night, invalidate]);

  useFrame(({ clock }, delta) => {
    const L = live.current;
    if (!L) return;
    const { found, fly } = L;
    const t = clock.elapsedTime;
    const dt = Math.min(delta, 1 / 20);
    shared.uTime.value = t;
    const target = night ? 1 : 0;
    n.current += (target - n.current) * (1 - Math.exp(-3.2 * dt));
    if (Math.abs(n.current - target) < 0.002) n.current = target;
    else invalidate();
    const k = n.current;

    if (hemi.current) {
      hemi.current.color.lerpColors(DAY.sky, NIGHT.sky, k);
      hemi.current.groundColor.lerpColors(DAY.ground, NIGHT.ground, k);
      hemi.current.intensity = THREE.MathUtils.lerp(DAY.hemi, NIGHT.hemi, k);
    }
    if (sun.current) {
      sun.current.color.lerpColors(DAY.sun, NIGHT.sun, k);
      sun.current.intensity = THREE.MathUtils.lerp(DAY.sunI, NIGHT.sunI, k);
    }
    const glow = found.mats.get("lamp_glow");
    // At night the lamps and windows glow *less* strongly than by day: against the dark they still read as lit,
    // and without tone mapping a strong glow clips to white instead of staying warm.
    if (glow) glow.emissiveIntensity = THREE.MathUtils.lerp(L.baseGlow, 0.95, k);
    const glass = found.mats.get("glass");
    if (glass) {
      glass.emissive.copy(WARM);
      glass.emissiveIntensity = 0.85 * k;
    }
    lampLights.current.forEach((l, i) => {
      if (l) l.intensity = k * (4.2 + Math.sin(t * 3 + i) * 0.15);
    });

    // Fireflies: out at night, each wandering and blinking on its own.
    if (fireflies.current) {
      fireflies.current.visible = k > 0.05;
      const pos = fly.g.getAttribute("position") as THREE.BufferAttribute;
      fly.seeds.forEach((s, i) => {
        pos.setXYZ(i, s.x + Math.sin(t * s.s + s.a) * 1.6, s.y + Math.sin(t * s.s * 1.7 + s.a) * 0.35, s.z + Math.cos(t * s.s * 0.8 + s.a) * 1.6);
      });
      pos.needsUpdate = true;
      (fireflies.current.material as THREE.PointsMaterial).opacity = k * (0.65 + 0.35 * Math.sin(t * 2.1));
    }
    // Butterflies: by day, looping over flowers with flapping wings.
    if (butterflies.current) {
      butterflies.current.visible = k < 0.95;
      butterflies.current.children.forEach((b, i) => {
        const h = L.homes[i % L.homes.length], s = 0.45 + i * 0.07, a = i * 1.9;
        b.position.set(h.x + Math.sin(t * s + a) * 1.8, h.y + 0.8 + Math.sin(t * s * 2.3 + a) * 0.3, h.z + Math.sin(t * s * 1.6 + a) * 1.4);
        b.rotation.y = Math.atan2(Math.cos(t * s + a) * 1.8, Math.cos(t * s * 1.6 + a) * 2.2);
        const flap = Math.sin(t * 18 + i * 2) * 0.9;
        b.children[0].rotation.z = 0.3 + flap;
        b.children[1].rotation.z = -0.3 - flap;
        b.scale.setScalar(1 - k);
      });
    }
    // Chimney smoke: soft puffs rising and drifting with the wind.
    if (smoke.current && found.chimney) {
      const c = found.chimney;
      smoke.current.children.forEach((puff, i) => {
        const life = (t * 0.16 + i / PUFFS) % 1;
        puff.position.set(c.x + life * 1.1 + Math.sin(t * 0.6 + i) * 0.15, c.y + life * 2.6, c.z + life * 0.4);
        puff.scale.setScalar(0.18 + life * 0.55);
        ((puff as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.42 * (1 - life) * Math.min(1, life * 6);
      });
    }
    // Lily pads: a slow bob on the water.
    if (found.lilies) found.lilies.position.y = found.lilyY + Math.sin(t * 1.2) * 0.006;
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[DAY.sky, DAY.ground, DAY.hemi]} />
      <directionalLight
        ref={sun}
        position={[26, 42, 14]}
        intensity={DAY.sunI}
        color={DAY.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
      />
      {/* Each lamp lights the ground round it in the evening (left out of the light island). */}
      {!lite &&
        found.lamps.map((p, i) => (
          <pointLight key={i} ref={(l) => { lampLights.current[i] = l; }} position={p} color="#ffc66e" intensity={0} distance={7} decay={1.7} />
        ))}
      <points ref={fireflies} geometry={fly.g} visible={false}>
        <pointsMaterial color="#ffe788" size={0.13} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <group ref={butterflies}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i}>
            {/* Two wings, each hinged at the body (its pivot group flaps about the body's length). */}
            {[1, -1].map((side) => (
              <group key={side}>
                <mesh position={[side * 0.13, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[0.26, 0.2]} />
                  <meshBasicMaterial color={["#f2c443", "#ffffff", "#b58be0", "#f2c443"][i]} side={THREE.DoubleSide} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
      {found.chimney && (
        <group ref={smoke}>
          {Array.from({ length: PUFFS }, (_, i) => (
            <mesh key={i}>
              <icosahedronGeometry args={[0.5, 1]} />
              <meshBasicMaterial color="#ebe5dc" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
}
