import * as THREE from 'three'
import {yeux} from 'yeux'

export const V_00 = Object.freeze(new THREE.Vector2)
export const V_11 = Object.freeze(new THREE.Vector2)
export const V_000 = Object.freeze(new THREE.Vector3)
export const V_010 = Object.freeze(new THREE.Vector3(0,1,0))
export const V_111 = Object.freeze(new THREE.Vector3(1,1,1))
export const Q_IDENTITY = Object.freeze(new THREE.Quaternion)

export const vectors2 = yeux<THREE.Vector2>(
  () => new THREE.Vector2, 
  (vec) => vec.set(0,0)
)

export const vectors = yeux<THREE.Vector3>(
    () => new THREE.Vector3, 
    (vec) => vec.set(0,0,0)
)

export const quaternions = yeux<THREE.Quaternion>(
    () => new THREE.Quaternion, 
    (quat) => quat.set(0,0,0,1)
)

export const matrices3 = yeux<THREE.Matrix3>(
  () => new THREE.Matrix3, 
  (mat) => mat.identity()
)

export const matrices = yeux<THREE.Matrix4>(
    () => new THREE.Matrix4, 
    (mat) => mat.identity()
)

export function traverse(
  object: THREE.Object3D,
  each: (node: THREE.Object3D) => boolean,
  bind?: any
) {
  if (!each.call(bind, object)) return
  for (let child of object.children) {
    traverse(child, each, bind)
  }
}