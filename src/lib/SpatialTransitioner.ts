import * as THREE from 'three'
import {SpatialLayout} from './SpatialLayout'
import {matrices} from './SpatialUtils';

export class SpatialTransitioner {

    static map = new WeakMap<THREE.Object3D, SpatialTransitioner>()

    static get(o:THREE.Object3D) {
        if (this.map.has(o)) return this.map.get(o)!
        const transformer = new SpatialTransitioner(o)
        this.map.set(o, transformer)
        return transformer
    }

    parent?: THREE.Object3D

    position = new THREE.Vector3().set(0,0,0)
    quaternion = new THREE.Quaternion().set(0,0,0,1)
    scale = new THREE.Vector3().set(1,1,1)

    align = new THREE.Vector3().set(NaN,NaN,NaN)
    origin = new THREE.Vector3().set(NaN,NaN,NaN)
    size = new THREE.Vector3().set(NaN,NaN,NaN)

    private constructor(public object:THREE.Object3D) {
        if (!object.layout) object.layout = new SpatialLayout
        object.layout['_transformer'] = this
    }

    reset() {
        this.position.setScalar(0)
        this.quaternion.set(0,0,0,1)
        this.scale.setScalar(1)
        this.align.set(NaN,NaN,NaN)
        this.origin.set(NaN,NaN,NaN)
        this.size.set(NaN,NaN,NaN)
        return this
    }

    setFromObject(target:THREE.Object3D) {
        this.reset()
        this.position.copy(target.position)
        this.quaternion.copy(target.quaternion)
        this.scale.copy(target.scale)
        if (target.layout) {
            this.align.copy(target.layout.align)
            this.origin.copy(target.layout.origin)
            this.size.copy(target.layout.size)
        }
        return this
    }

    update(lerpFactor:number) {
        const o = this.object
        const layout = o.layout!
        const parent = this.parent

        const parentChanged = parent !== undefined && parent !== o.parent
        if (parentChanged ||
            isNaN(this.size.x) !== isNaN(layout.size.x) ||
            isNaN(this.size.y) !== isNaN(layout.size.y) ||
            isNaN(this.size.z) !== isNaN(layout.size.z) ||
            isNaN(this.align.x) !== isNaN(layout.align.x) ||
            isNaN(this.align.y) !== isNaN(layout.align.y) ||
            isNaN(this.align.z) !== isNaN(layout.align.z) ||
            isNaN(this.origin.x) !== isNaN(layout.origin.x) ||
            isNaN(this.origin.y) !== isNaN(layout.origin.y) ||
            isNaN(this.origin.z) !== isNaN(layout.origin.z)) {
            o.updateWorldMatrix(true, true)
            const matrixWorld = matrices.get().copy(o.matrixWorld)
            if (parentChanged) {
                o.parent && o.parent.remove(o)
                parent && parent.add(o)
            }
            this._lerpToLayoutTarget(layout.align, this.align, lerpFactor)
            this._lerpToLayoutTarget(layout.origin, this.origin, lerpFactor)
            this._lerpToLayoutTarget(layout.size, this.size, lerpFactor)
            parent ? parent.updateWorldMatrix(true, true) : o.updateWorldMatrix(true, true)
            const parentInverseWorld = parent ? matrices.get().getInverse(parent.matrixWorld) : matrices.get().identity()
            o.matrix.copy(matrixWorld)
            o.applyMatrix(parentInverseWorld)
            o.position.sub(layout.computedAlignPosition).sub(layout.computedOriginPosition)
            o.scale.divide(layout.computedSizeScale)
            matrices.poolAll()
        } else {
            this._lerpToLayoutTarget(layout.align, this.align, lerpFactor)
            this._lerpToLayoutTarget(layout.origin, this.origin, lerpFactor)
            this._lerpToLayoutTarget(layout.size, this.size, lerpFactor)
        }
        o.position.lerp(this.position, lerpFactor)
        o.scale.lerp(this.scale, lerpFactor)
        o.quaternion.slerp(this.quaternion, lerpFactor)
        // o.updateWorldMatrix(true, true)
    }

    private _lerpToLayoutTarget(vector:THREE.Vector3, target:THREE.Vector3, lerpFactor:number) {
        vector.lerp(target, lerpFactor)
        if (!isFinite(vector.x)) vector.x = target.x
        if (!isFinite(vector.y)) vector.y = target.y
        if (!isFinite(vector.z)) vector.z = target.z
    }
}