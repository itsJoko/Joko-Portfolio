// Toy physics for the Studio island's knock-over props (phys_* objects: crates, barrels, pots).
// Not a general physics engine: enough for a handful of boxes to tumble, bounce, bump into each other,
// settle on a face and hop back home. No library: the Playground stays light (CLAUDE.md).
//
// Every body sleeps at its place until Folio bumps it; a bump wakes it and its neighbours (so a stack comes
// down together). Awake bodies fall under gravity, bounce off the ground with friction, push each other apart
// as spheres, and bounce off walls and the island's edge (via `blocked`). Once everything has been still for a
// while and Folio has walked away, the props hop back to where they started.

import * as THREE from "three";

const GRAVITY = 9.8;
const SLEEP_SPEED = 0.06;
const RESET_AFTER = 7;        // seconds of stillness before the props go home
const RESET_TIME = 1.3;       // seconds the hop home takes

type Body = {
  obj: THREE.Object3D;
  centre: THREE.Vector3;      // bounding-box centre in the object's local space (its origin is at the base)
  half: THREE.Vector3;        // half extents
  radius: number;             // for bumping into other bodies and into Folio
  pos: THREE.Vector3;         // world centre of mass
  q: THREE.Quaternion;
  vel: THREE.Vector3;
  spin: THREE.Vector3;        // angular velocity (rad/s)
  awake: boolean;
  still: number;              // seconds below the sleep speed
  home: { pos: THREE.Vector3; q: THREE.Quaternion };
  going: null | { t: number; pos: THREE.Vector3; q: THREE.Quaternion };
};

export type Pusher = { x: number; y: number; z: number; vx: number; vz: number; radius: number };

const ax = new THREE.Vector3(), ay = new THREE.Vector3(), az = new THREE.Vector3();
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class ToyWorld {
  bodies: Body[] = [];
  /** Knocks since the last drain (s: 0 to 1, where): ground hits, bumps between props, Folio's kicks. */
  impacts: { s: number; x: number; z: number }[] = [];
  private quiet = 0;

  /** Add an object as a body; its current transform is its home. */
  add(obj: THREE.Object3D) {
    const box = new THREE.Box3();
    // Local bounds: measure with the object's transform removed.
    const saved = { p: obj.position.clone(), q: obj.quaternion.clone(), s: obj.scale.clone() };
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    obj.position.copy(saved.p);
    obj.quaternion.copy(saved.q);
    obj.updateMatrixWorld(true);
    const centre = box.getCenter(new THREE.Vector3());
    const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const pos = centre.clone().applyQuaternion(obj.quaternion).add(obj.position);
    this.bodies.push({
      obj, centre, half,
      radius: (half.x + half.y + half.z) / 3 * 1.05,
      pos, q: obj.quaternion.clone(), vel: new THREE.Vector3(), spin: new THREE.Vector3(),
      awake: false, still: 0,
      home: { pos: pos.clone(), q: obj.quaternion.clone() },
      going: null,
    });
  }

  private wake(b: Body, kick?: THREE.Vector3) {
    b.awake = true;
    b.still = 0;
    b.going = null;
    if (kick) {
      b.vel.add(kick);
      // Spin about an axis across the push, so it tips over rather than sliding.
      tmpV.set(kick.z, 0, -kick.x).normalize().multiplyScalar(4 + Math.random() * 4);
      b.spin.add(tmpV);
    }
    // Neighbours come down too (a stack doesn't stay hanging in the air).
    for (const o of this.bodies) {
      if (o === b || o.awake) continue;
      if (o.pos.distanceTo(b.pos) < (o.radius + b.radius) * 1.6) this.wake(o);
    }
  }

  /** How far the body reaches below its centre, given how it's turned (a box's support along -Y). */
  private reachDown(b: Body) {
    ax.set(1, 0, 0).applyQuaternion(b.q);
    ay.set(0, 1, 0).applyQuaternion(b.q);
    az.set(0, 0, 1).applyQuaternion(b.q);
    return b.half.x * Math.abs(ax.y) + b.half.y * Math.abs(ay.y) + b.half.z * Math.abs(az.y);
  }

  /**
   * Advance the world. groundY gives the floor height under (x, z); blocked says whether (x, z) is somewhere a
   * prop can't go (walls, the island's edge). Returns true while anything is moving.
   */
  step(dt: number, pusher: Pusher | null, groundY: (x: number, z: number) => number, blocked: (x: number, z: number) => boolean): boolean {
    dt = Math.min(dt, 1 / 30);
    let active = false;

    // Folio bumps into props.
    if (pusher) {
      for (const b of this.bodies) {
        if (b.going) continue;
        const dx = b.pos.x - pusher.x, dz = b.pos.z - pusher.z, d = Math.hypot(dx, dz);
        const reach = b.radius + pusher.radius;
        if (d >= reach || b.pos.y > pusher.y + 1.5) continue;
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        const speed = Math.hypot(pusher.vx, pusher.vz);
        if (!b.awake) {
          if (speed < 0.4) continue;   // standing next to a stack doesn't knock it
          this.wake(b, tmpV2.set(nx * (2.2 + speed * 0.7), 1.6 + speed * 0.3, nz * (2.2 + speed * 0.7)));
          this.impacts.push({ s: Math.min(1, 0.4 + speed / 8), x: b.pos.x, z: b.pos.z });
        } else {
          b.pos.x = pusher.x + nx * reach;
          b.pos.z = pusher.z + nz * reach;
          b.vel.x += pusher.vx * 0.6;
          b.vel.z += pusher.vz * 0.6;
        }
      }
    }

    const steps = 3, h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const b of this.bodies) {
        if (!b.awake) continue;
        active = true;
        b.vel.y -= GRAVITY * h;
        const px = b.pos.x, pz = b.pos.z;
        b.pos.addScaledVector(b.vel, h);
        // Walls, bushes and the island's edge: bounce back (only when coming from free space, so a prop whose
        // home is next to a wall can still move out).
        if (blocked(b.pos.x, b.pos.z) && !blocked(px, pz)) {
          if (blocked(b.pos.x, pz)) { b.pos.x = px; b.vel.x *= -0.4; }
          if (blocked(px, b.pos.z)) { b.pos.z = pz; b.vel.z *= -0.4; }
          if (blocked(b.pos.x, b.pos.z)) { b.pos.x = px; b.pos.z = pz; }
        }
        // Rotation from the spin.
        const w = b.spin.length();
        if (w > 1e-5) {
          tmpQ.setFromAxisAngle(tmpV.copy(b.spin).divideScalar(w), w * h);
          b.q.premultiply(tmpQ).normalize();
        }
        // The ground.
        const gy = groundY(b.pos.x, b.pos.z), down = this.reachDown(b);
        if (b.pos.y - down < gy) {
          b.pos.y = gy + down;
          if (b.vel.y < -1) this.impacts.push({ s: Math.min(1, -b.vel.y / 6), x: b.pos.x, z: b.pos.z });
          if (b.vel.y < 0) b.vel.y = b.vel.y < -1 ? -b.vel.y * 0.25 : 0;
          const f = Math.exp(-7 * h);
          b.vel.x *= f;
          b.vel.z *= f;
          b.spin.multiplyScalar(Math.exp(-5 * h));
          // Settle onto the face that is closest to lying flat (no balancing on corners).
          ax.set(1, 0, 0).applyQuaternion(b.q); ay.set(0, 1, 0).applyQuaternion(b.q); az.set(0, 0, 1).applyQuaternion(b.q);
          let axis = ax;
          if (Math.abs(ay.y) > Math.abs(axis.y)) axis = ay;
          if (Math.abs(az.y) > Math.abs(axis.y)) axis = az;
          tmpQ2.setFromUnitVectors(tmpV.copy(axis), tmpV2.copy(UP).multiplyScalar(Math.sign(axis.y) || 1));
          tmpQ.copy(tmpQ2).multiply(b.q);
          b.q.slerp(tmpQ, Math.min(1, h * 6));
        }
      }
      // Bodies push each other apart (as spheres) and trade a little speed.
      for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) {
          const a = this.bodies[i], c = this.bodies[j];
          if (!a.awake && !c.awake) continue;
          tmpV.subVectors(c.pos, a.pos);
          const d = tmpV.length(), min = a.radius + c.radius;
          if (d >= min || d < 1e-5) continue;
          tmpV.divideScalar(d);
          const overlap = min - d;
          if (!a.awake) this.wake(a);
          if (!c.awake) this.wake(c);
          a.pos.addScaledVector(tmpV, -overlap / 2);
          c.pos.addScaledVector(tmpV, overlap / 2);
          const rel = tmpV2.subVectors(c.vel, a.vel).dot(tmpV);
          if (rel < 0) {
            if (rel < -1) this.impacts.push({ s: Math.min(1, -rel / 6), x: (a.pos.x + c.pos.x) / 2, z: (a.pos.z + c.pos.z) / 2 });
            const j_ = -rel * 0.6;
            a.vel.addScaledVector(tmpV, -j_);
            c.vel.addScaledVector(tmpV, j_);
          }
        }
      }
    }

    // Sleep when still; write transforms back to the objects.
    let anyAwake = false, anyAway = false;
    for (const b of this.bodies) {
      if (b.awake) {
        const moving = b.vel.length() > SLEEP_SPEED || b.spin.length() > 0.15;
        b.still = moving ? 0 : b.still + dt;
        if (b.still > 0.6) {
          b.awake = false;
          b.vel.set(0, 0, 0);
          b.spin.set(0, 0, 0);
        } else anyAwake = true;
      }
      if (b.pos.distanceToSquared(b.home.pos) > 1e-4 || b.going) anyAway = true;
    }

    // Everyone home, a while after it all went still and Folio walked off.
    const folioNear = pusher && this.bodies.some((b) => Math.hypot(b.home.pos.x - pusher.x, b.home.pos.z - pusher.z) < 3);
    this.quiet = anyAwake ? 0 : this.quiet + dt;
    if (anyAway && !anyAwake && this.quiet > RESET_AFTER && !folioNear) {
      for (const b of this.bodies) {
        if (!b.going && b.pos.distanceToSquared(b.home.pos) > 1e-4) b.going = { t: 0, pos: b.pos.clone(), q: b.q.clone() };
      }
    }
    for (const b of this.bodies) {
      if (!b.going) continue;
      active = true;
      b.going.t = Math.min(1, b.going.t + dt / RESET_TIME);
      const t = b.going.t, e = t * t * (3 - 2 * t);
      b.pos.lerpVectors(b.going.pos, b.home.pos, e);
      b.pos.y += Math.sin(Math.PI * t) * 0.7;
      b.q.slerpQuaternions(b.going.q, b.home.q, e);
      if (t >= 1) {
        b.pos.copy(b.home.pos);
        b.q.copy(b.home.q);
        b.going = null;
      }
    }

    for (const b of this.bodies) {
      b.obj.quaternion.copy(b.q);
      b.obj.position.copy(b.pos).sub(tmpV.copy(b.centre).applyQuaternion(b.q));
    }
    return active || anyAwake;
  }
}
