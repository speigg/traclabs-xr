import * as THREE from 'three'
import {matrices, vectors} from './SpatialUtils';

export class SpatialLayoutTarget {

    parent?: THREE.Object3D|null

    position = new THREE.Vector3().set(0,0,0)
    quaternion = new THREE.Quaternion().set(0,0,0,1)
    scale = new THREE.Vector3().set(1,1,1)

    align = new THREE.Vector3().set(NaN,NaN,NaN)
    origin = new THREE.Vector3().set(NaN,NaN,NaN)
    size = new THREE.Vector3().set(NaN,NaN,NaN)

    constructor() {
        this.reset()
    }

    reset() {
        this.position.setScalar(0)
        this.quaternion.set(0,0,0,1)
        this.scale.setScalar(1)
        this.align.setScalar(NaN)
        this.origin.setScalar(NaN)
        this.size.setScalar(NaN)
        return this
    }

    static count = 10

    static lerp(o: THREE.Object3D, target:SpatialLayoutTarget, lerpFactor:number) {
        const layout = o.layout
        const parent = target.parent

        const parentChanged = parent !== undefined && parent !== o.parent
        if (parentChanged ||
            isNaN(target.size.x) !== isNaN(layout.size.x) ||
            isNaN(target.size.y) !== isNaN(layout.size.y) ||
            isNaN(target.size.z) !== isNaN(layout.size.z) ||
            isNaN(target.align.x) !== isNaN(layout.align.x) ||
            isNaN(target.align.y) !== isNaN(layout.align.y) ||
            isNaN(target.align.z) !== isNaN(layout.align.z) ||
            isNaN(target.origin.x) !== isNaN(layout.origin.x) ||
            isNaN(target.origin.y) !== isNaN(layout.origin.y) ||
            isNaN(target.origin.z) !== isNaN(layout.origin.z)) {
            // make sure we save an accurate original world matrix
            o.updateWorldMatrix(true, true)
            const originalMatrixWorld = matrices.get().copy(o.matrixWorld)
            if (parentChanged) {
                o.parent && o.parent.remove(o)
                parent && parent.add(o)
            }
            // apply layout changes
            o.position.setScalar(0)
            o.scale.setScalar(1)
            o.quaternion.set(0,0,0,1)
            SpatialLayoutTarget._lerpToLayoutTarget(layout.align, target.align, lerpFactor)
            SpatialLayoutTarget._lerpToLayoutTarget(layout.origin, target.origin, lerpFactor)
            SpatialLayoutTarget._lerpToLayoutTarget(layout.size, target.size, lerpFactor)
            // compute the new matrix based on latest layout properties, and then 
            // modify the position/quaterion/scale in order to maintain the original pose
            // in the new layout
            o.updateWorldMatrix(true, true)
            const inverseMatrixWorld = parent ? matrices.get().getInverse(parent.matrixWorld) : matrices.get().identity()
            o.matrix.copy(inverseMatrixWorld.multiply(originalMatrixWorld))
            o.matrix.decompose(o.position, o.quaternion, o.scale)
            // modify the scale to negate the layout scale
            o.scale.divide(layout.computedSizeScale)
            // changing the scale affects computed origin and align, so calculate again
            o.updateWorldMatrix(true, true)
            // modify position to negate the align/origin positions
            o.position.sub(layout.computedAlignPosition).sub(layout.computedOriginPosition)
            matrices.poolAll()
        } else {
            SpatialLayoutTarget._lerpToLayoutTarget(layout.align, target.align, lerpFactor)
            SpatialLayoutTarget._lerpToLayoutTarget(layout.origin, target.origin, lerpFactor)
            SpatialLayoutTarget._lerpToLayoutTarget(layout.size, target.size, lerpFactor)
            o.position.lerp(target.position, lerpFactor)
            o.scale.lerp(target.scale, lerpFactor)
            o.quaternion.slerp(target.quaternion, lerpFactor)
        }

        // if (o.name === 'snubber' && this.count > 0) {
        //     console.log(this.count)
        //     console.log('world position: ', o.getWorldPosition(new THREE.Vector3))
        //     console.log('world scale: ',  o.getWorldScale(new THREE.Vector3))
        //     console.log('position: ', o.position)
        //     console.log('scale: ', o.scale)
        //     console.log('align: ', layout.align)
        //     console.log('origin: ', layout.origin)
        //     console.log('size: ', layout.size)
        //     console.log('computedAlignPosition: ', layout.computedAlignPosition)
        //     console.log('computedOriginPosition: ', layout.computedOriginPosition)
        //     console.log('computedSizeScale: ', layout.computedSizeScale)
        //     console.log('computedParentBounds: ', layout.computedParentBounds.getSize(vectors.get()))
        //     console.log('computedBounds: ', layout.computedBounds.getSize(vectors.get()))
        //     this.count--
        // }
    }

    private static _lerpToLayoutTarget(vector:THREE.Vector3, target:THREE.Vector3, lerpFactor:number) {
        vector.lerp(target, lerpFactor)
        if (!isFinite(vector.x)) vector.x = target.x
        if (!isFinite(vector.y)) vector.y = target.y
        if (!isFinite(vector.z)) vector.z = target.z
    }
}