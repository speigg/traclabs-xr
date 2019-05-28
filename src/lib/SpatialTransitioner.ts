import * as THREE from 'three'
import {SpatialLayout} from './SpatialLayout'
import {vectors, V_000} from './SpatialUtils';

export class SpatialTransitioner {

    static transitioners = new WeakMap<THREE.Object3D, SpatialTransitioner>()

    static get(o:THREE.Object3D) {
        if (this.transitioners.has(o)) return this.transitioners.get(0)
        const transitioner = new SpatialTransitioner(o)
        this.transitioners.set(o, transitioner)
        return transitioner
    }

    parent?: THREE.Object3D
    position = new THREE.Vector3
    quaternion = new THREE.Quaternion
    scale = new THREE.Vector3
    align = new THREE.Vector3
    origin = new THREE.Vector3

    constructor(public object:THREE.Object3D) {
        this.position.copy(object.position)
        this.quaternion.copy(object.quaternion)
        this.scale.copy(object.scale)
        if (object.layout) {
            this.align.copy(object.layout.align)
            this.origin.copy(object.layout.origin)
        } else {
            this.align.setScalar(NaN)
            this.origin.setScalar(NaN)
        }
        if (!object.layout) object.layout = new SpatialLayout
    }

    update(lerpFactor:number) {
        const o = this.object
        this.parent && SpatialLayout.setParent(o, this.parent)
        o.position.lerp(this.position, lerpFactor)
        o.quaternion.slerp(this.quaternion, lerpFactor)
        o.scale.lerp(this.scale, lerpFactor)
        const referenceFrame = SpatialLayout.resolveReferenceFrame(o)
        if (isNaN(this.align.x) || isNaN(this.align.y) || isNaN(this.align.z)) {
            const align = SpatialLayout.getOffsetForPosition(o.parent, referenceFrame, V_000, vectors.get())
            if (!isNaN(this.align.x)) align.x = this.align.x
            if (!isNaN(this.align.y)) align.y = this.align.y
            if (!isNaN(this.align.z)) align.z = this.align.z
            o.layout!.align.lerp(align, lerpFactor)
            vectors.pool(align)
        } else {
            o.layout!.align.lerp(this.align, lerpFactor)
        }
        if (isNaN(this.origin.x) || isNaN(this.origin.y) || isNaN(this.origin.z)) {
            const origin = SpatialLayout.getOffsetForPosition(o, referenceFrame, V_000, vectors.get())
            if (!isNaN(this.origin.x)) origin.x = this.origin.x
            if (!isNaN(this.origin.y)) origin.y = this.origin.y
            if (!isNaN(this.origin.z)) origin.z = this.origin.z
            o.layout!.origin.lerp(origin, lerpFactor)
            vectors.pool(origin)
        } else {
            o.layout!.origin.lerp(this.origin, lerpFactor)
        }
    }
}