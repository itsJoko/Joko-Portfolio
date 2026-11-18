"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { CREASE, FACE, FOLD, FRONT, H, LIMB_ON_LIGHT, PAPER, W, folioGeometries } from "@/components/shell/folioGeometry";

/** Where Folio is and how it moves; written by the walker in IslandScene every frame, read here. */
export type WalkerState = { pos: THREE.Vector3; yaw: number; speed: number };

// The mascot is about 3.2 units tall; on the island Folio is about 1.3 m.
const SCALE = 0.42;
const FEET = (H + 0.68) * SCALE; // from the body's centre down to the soles

/**
 * Folio walking on the island: the corner mascot's parts (folioGeometry.ts) with a walk cycle. Legs and arms
 * swing opposite each other with speed, the body bobs and leans a little; standing still, it breathes and blinks.
 */
export function IslandFolio({ walker }: { walker: RefObject<WalkerState> }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const blink = useRef(2);

  const parts = useMemo(() => {
    const matte = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.62 });
    return {
      g: folioGeometries(),
      m: { paper: matte(PAPER), fold: matte(FOLD), crease: matte(CREASE), limb: matte(LIMB_ON_LIGHT), face: matte(FACE) },
    };
  }, []);
  useEffect(
    () => () => {
      Object.values(parts.g).forEach((g) => g.dispose());
      Object.values(parts.m).forEach((m) => m.dispose());
    },
    [parts],
  );

  useFrame(({ clock }, delta) => {
    const w = walker.current;
    if (!root.current || !body.current || !w) return;
    const dt = Math.min(delta, 1 / 30);
    const t = clock.elapsedTime;
    const pace = Math.min(w.speed / 3.2, 1); // 0 standing, 1 full walk
    phase.current += dt * (4 + 6 * pace) * pace;
    const s = Math.sin(phase.current);

    root.current.position.set(w.pos.x, w.pos.y + FEET + Math.abs(s) * 0.07 * pace, w.pos.z);
    root.current.rotation.y = w.yaw;
    const breath = Math.sin(t * 1.6) * 0.012 * (1 - pace);
    body.current.rotation.set(0.08 * pace, 0, s * 0.04 * pace);
    body.current.scale.set(1 - breath * 0.5, 1 + breath, 1);

    const swing = 0.65 * pace;
    legL.current?.rotation.set(s * swing, 0, 0.04);
    legR.current?.rotation.set(-s * swing, 0, -0.04);
    armL.current?.rotation.set(-s * swing * 0.8, 0, -0.18 - 0.1 * (1 - pace));
    armR.current?.rotation.set(s * swing * 0.8, 0, 0.18 + 0.1 * (1 - pace));

    if (eyes.current) {
      if (t > blink.current + 0.13) blink.current = t + 2.4 + (Math.sin(t * 7.3) + 1) * 1.4;
      eyes.current.scale.y = t > blink.current ? 0.12 : 1;
    }
  });

  const { g, m } = parts;
  return (
    <group ref={root} scale={SCALE}>
      <group ref={body}>
        <mesh geometry={g.page} material={m.paper} castShadow />
        <mesh geometry={g.fold} material={m.fold} castShadow />
        <mesh geometry={g.crease} material={m.crease} position={[0, 0, FRONT + 0.002]} />
        <group position={[0, 0.03, FRONT + 0.004]}>
          <group ref={eyes} position={[0, 0.05, 0]}>
            <mesh geometry={g.eye} material={m.face} position={[-0.34, 0, 0]} />
            <mesh geometry={g.eye} material={m.face} position={[0.34, 0, 0]} />
          </group>
          <mesh geometry={g.smile} material={m.face} position={[0, -0.13, 0]} rotation={[0, 0, Math.PI]} />
        </group>
        <group ref={armL} position={[-W - 0.02, -0.28, 0.02]}>
          <mesh geometry={g.arm} material={m.limb} castShadow />
          <mesh geometry={g.hand} material={m.limb} castShadow />
        </group>
        <group ref={armR} position={[W + 0.02, -0.28, 0.02]}>
          <mesh geometry={g.arm} material={m.limb} castShadow />
          <mesh geometry={g.hand} material={m.limb} castShadow />
        </group>
      </group>
      <group ref={legL} position={[-0.42, -H, 0]}>
        <mesh geometry={g.leg} material={m.limb} castShadow />
        <mesh geometry={g.foot} material={m.limb} castShadow />
      </group>
      <group ref={legR} position={[0.42, -H, 0]}>
        <mesh geometry={g.leg} material={m.limb} castShadow />
        <mesh geometry={g.foot} material={m.limb} castShadow />
      </group>
    </group>
  );
}
