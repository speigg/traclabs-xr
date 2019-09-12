import * as THREE from 'three'
import {matrices, vectors} from './SpatialUtils'
import {SpatialMetrics} from './SpatialMetrics'
import {SpatialLayoutTarget} from './SpatialLayoutTarget'

declare module 'three/src/core/Object3D' {
    interface Object3D {
        layout: SpatialLayout
        updateWorldMatrix(updateParents:boolean, updateChildren:boolean, updateLayout?:boolean) : void
    }
}

// const originalUpdateMatrix = THREE.Object3D.prototype.updateMatrix
// THREE.Object3D.prototype.updateMatrix = function() {
//     originalUpdateMatrix.call(this)
//     const o = this
//     const layout = o.layout
//     const isBoundingContext = layout.isBoundingContext()

//     let bounds:THREE.Box3|undefined = undefined
//     if (isBoundingContext) {
//         bounds = SpatialLayout.getBounds(o, layout.computedBounds) 
//         const cameraParent = o.parent as THREE.Camera
//         if (cameraParent && cameraParent.isCamera) {
//             SpatialLayout.getCameraBounds(cameraParent, o, layout.computedParentBounds)
//         } else if (o.parent) {
//             layout.computedParentBounds.copy(o.parent.layout.computedBounds)
//         } else {
//             layout.computedParentBounds.makeEmpty()
//         }
//         const parentBounds = layout.computedParentBounds
//         // update computed size
//         const sizeScale = SpatialLayout.getScaleForSize(o, layout.size, layout.computedSizeScale)
//         const scale = vectors.get().copy(o.scale).multiply(sizeScale)
//         // update computed align & origin
//         const alignPosition = parentBounds.getPositionForOffset(layout.align, layout.computedAlignPosition)
//         if (o.parent && (o.parent as THREE.Camera).isCamera) alignPosition.z = layout.align.z || 0
//         const originPosition = bounds!.getPositionForOffset(layout.origin, layout.computedOriginPosition)
//         originPosition.negate().multiply(scale)
//         // update matrix
//         const translate = vectors.get().copy(o.position).add(alignPosition).add(originPosition)
//         o.matrix.compose(translate, o.quaternion, scale)
//         vectors.poolAll()
//     } else {
//         layout.computedAlignPosition.setScalar(0)
//         layout.computedOriginPosition.setScalar(0)
//         layout.computedSizeScale.setScalar(1)
//         layout.computedParentBounds.makeEmpty()
//         let hasNonPassiveChildren = false
//         for (let i = 0; i < this.children.length; ++i) {
//             const child = this.children[i]
//             if (!child.layout.isPassive()) {
//                 hasNonPassiveChildren = true
//                 break
//             }
//         }
//         if (hasNonPassiveChildren) {
//             SpatialLayout.getBounds(o, layout.computedBounds) 
//         } else {
//             layout.computedBounds.makeEmpty()
//         }
//     }
// }

THREE.Object3D.prototype.updateMatrixWorld = function(force) {
    this.updateWorldMatrix(false, true, true)
}

// const originalUpdateWorldMatrix = THREE.Object3D.prototype.updateWorldMatrix
THREE.Object3D.prototype.updateWorldMatrix = function(updateParents:boolean, updateChildren:boolean, updateLayout:boolean=updateChildren) {
    
    const o = this
    const layout = o.layout
    if (updateLayout) layout._boundsValid = false


    const parent = this.parent;

    if ( updateParents === true && parent !== null ) {

        parent.updateWorldMatrix( true, false, false );

    }

    if ( updateLayout && this.matrixAutoUpdate ) this.updateMatrix();

    if ( this.parent === null ) {

        this.matrixWorld.copy( this.matrix );

    } else {

        this.matrixWorld.multiplyMatrices( this.parent.matrixWorld, this.matrix );

    }

    // update children

    if ( updateChildren === true ) {

        var children = this.children;

        for ( var i = 0, l = children.length; i < l; i ++ ) {

            children[ i ].updateWorldMatrix( false, true, updateLayout );

        }

    }
    
    // originalUpdateWorldMatrix.call(this, updateParents, updateChildren)

    if (!updateLayout) return

    const isBoundingContext = layout.isBoundingContext()
    

    let bounds:THREE.Box3|undefined = undefined
    if (isBoundingContext) {
        bounds = SpatialLayout.getBounds(o, layout.computedBounds) 
        layout._boundsValid = true

        const cameraParent = o.parent as THREE.Camera
        if (cameraParent && cameraParent.isCamera) {
            SpatialLayout.getCameraBounds(cameraParent, o, layout.computedParentBounds)
        } else if (o.parent) {
            if (!o.parent.layout._boundsValid) {
                SpatialLayout.getBounds(o.parent, o.parent.layout.computedBounds)
                o.parent.layout._boundsValid = true
            }
            layout.computedParentBounds.copy(o.parent.layout.computedBounds)
        } else {
            layout.computedParentBounds.makeEmpty()
        }

        const parentBounds = layout.computedParentBounds
        // update computed size
        const sizeScale = SpatialLayout.getScaleForSize(o, layout.size, layout.computedSizeScale)
        const scale = vectors.get().copy(o.scale).multiply(sizeScale)
        // update computed align & origin
        const alignPosition = parentBounds.getPositionForOffset(layout.align, layout.computedAlignPosition)
        if (o.parent && (o.parent as THREE.Camera).isCamera) alignPosition.z = layout.align.z || 0
        const originPosition = bounds!.getPositionForOffset(layout.origin, layout.computedOriginPosition)
        originPosition.negate().multiply(scale)
        // update matrices
        const translate = vectors.get().copy(o.position).add(alignPosition).add(originPosition)
        o.matrix.compose(translate, o.quaternion, scale)
        o.parent ? o.matrixWorld.multiplyMatrices( o.parent.matrixWorld, o.matrix ) : o.matrixWorld.copy(o.matrix)
        // update child world positions without recalculating layout
        const children = o.children
        for ( var i = 0, l = o.children.length; i < l; i ++ ) {
            children[ i ].updateWorldMatrix( false, true, false );
        }
        vectors.poolAll()
    } else {
        layout.computedAlignPosition.setScalar(0)
        layout.computedOriginPosition.setScalar(0)
        layout.computedSizeScale.setScalar(1)
        layout.computedParentBounds.makeEmpty()
    }
}

const layoutMap = new WeakMap<THREE.Object3D, SpatialLayout>()
Object.defineProperty(THREE.Object3D.prototype, 'layout', {
    get: function getLayout(this:THREE.Object3D) {
        let layout = layoutMap.get(this)
        if (!layout) {
            layout = new SpatialLayout(this)
            layoutMap.set(this, layout)
        }
        return layout
    }
})

export class SpatialLayout {

    _boundsValid = false
    forceBoundsExclusion = false

    align = new THREE.Vector3().set(NaN,NaN,NaN)
    origin = new THREE.Vector3().set(NaN,NaN,NaN)
    size = new THREE.Vector3().set(NaN,NaN,NaN)

    minBounds = new THREE.Vector3().set(-Infinity, -Infinity, -Infinity)
    maxBounds = new THREE.Vector3().set(Infinity, Infinity, Infinity)

    computedAlignPosition = new THREE.Vector3(0,0,0)
    computedOriginPosition = new THREE.Vector3(0,0,0)
    computedSizeScale = new THREE.Vector3(1,1,1)

    computedBounds = new THREE.Box3
    computedParentBounds = new THREE.Box3
    
    target = new SpatialLayoutTarget()

    constructor(public object:THREE.Object3D) {
        this.computedBounds.objectFilter = SpatialMetrics.objectFilter
        this.computedParentBounds.objectFilter = SpatialMetrics.objectFilter
    }

    isPassive() {
        return isNaN(this.align.x) && isNaN(this.align.y) && isNaN(this.align.z) &&
            isNaN(this.origin.x) && isNaN(this.origin.y) && isNaN(this.origin.z) && 
            isNaN(this.size.x) && isNaN(this.size.y) && isNaN(this.size.z)
    }

    isBoundingContext() {
        if (this.forceBoundsExclusion) return true
        if (!this.isPassive()) {
            this.forceBoundsExclusion = true
            return true
        }
        return false
    }

    update(lerp:number) {
        SpatialLayoutTarget.lerp(this.object, this.target, lerp)
    }

    public static getBounds(o:THREE.Object3D, box:THREE.Box3) {
        return SpatialMetrics.get(o).getBoundsOf(o, box)
    }
    
    public static getCameraBounds(camera:THREE.Camera, child:THREE.Object3D, box:THREE.Box3) {
        const alignZ = child.layout.align.z
        const projectionMatrixInverse = matrices.get().getInverse(camera.projectionMatrix)
        const near = box.min.set(0,0,-1).applyMatrix4(projectionMatrixInverse).z
        const projectionZ = box.min.set(0,0,near + alignZ).applyMatrix4(camera.projectionMatrix).z
        box.min.set(-1, -1, projectionZ)
        box.max.set(1, 1, projectionZ)
        box.min.applyMatrix4(projectionMatrixInverse)
        box.max.applyMatrix4(projectionMatrixInverse)
        box.min.z = near + alignZ
        box.max.z = near
        matrices.pool(projectionMatrixInverse)
        return box
    }

    private static _boundsSize = new THREE.Vector3
    private static _parentSize = new THREE.Vector3
    public static getScaleForSize(o:THREE.Object3D, size:THREE.Vector3, out:THREE.Vector3) {
        if (!o) {
            return out.setScalar(1)
        }
        const bounds = o.layout.computedBounds
        const parentBounds = o.layout.computedParentBounds
        if (bounds.isEmpty() || parentBounds.isEmpty()) return out.setScalar(1)

        const boundsSize = bounds.getSize(this._boundsSize).clampScalar(10e-6, Infinity)
        const parentSize = parentBounds.getSize(this._parentSize).clampScalar(10e-6, Infinity)
        out.copy(parentSize).multiply(size).divide(boundsSize)

        const x = out.x
        const y = out.y
        const z = out.z
        if (x === 0) out.x = Number.MIN_SAFE_INTEGER
        if (y === 0) out.y = Number.MIN_SAFE_INTEGER
        if (z === 0) out.z = Number.MIN_SAFE_INTEGER
        // if any dimenions is not defined, scale it by the average of defined dimensions
        const isValidX = !isNaN(x)
        const isValidY = !isNaN(y)
        const isValidZ = !isNaN(z)
        const validDimensions = +isValidX + +isValidY + +isValidZ
        const averageScale = (x||0 + y||0 + z||0)/validDimensions || 1
        if (!isValidX) out.x = averageScale
        if (!isValidY) out.y = averageScale
        if (!isValidZ) out.z = averageScale
        return out
    }

    public static getSizeForScale(o:THREE.Object3D, scale:THREE.Vector3, out:THREE.Vector3) {
        if (!o || !o.layout) throw new Error('Expected an Object3D with `layout` property')
        const bounds = o.layout.computedBounds
        const parentBounds = o.layout.computedParentBounds
        if (bounds.isEmpty() || parentBounds.isEmpty()) return out.setScalar(NaN)

        const boundsSize = bounds.getSize(vectors.get())
        const parentSize = parentBounds.getSize(vectors.get())
        out.copy(scale).multiply(boundsSize).divide(parentSize)
        vectors.pool(parentSize)
        
        const x = out.x
        const y = out.y
        const z = out.z
        if (x === 0) out.x = Number.MIN_SAFE_INTEGER
        if (y === 0) out.y = Number.MIN_SAFE_INTEGER
        if (z === 0) out.z = Number.MIN_SAFE_INTEGER
        return out
    }

    public static getSizeToFit(o:THREE.Object3D, size:THREE.Vector3, fit:'contain'|'fill'|'cover' = 'contain') {
        if (!o || !o.layout) throw new Error('Expected an Object3D with `layout` property')
        const parentBounds = o.layout.computedParentBounds
        const bounds = o.layout.computedBounds
        const parentSize = parentBounds.getSize(vectors.get())
        const boundsSize = bounds.getSize(vectors.get())
        const parentAspectRatio = parentSize.x / parentSize.y
        const boundsAspectRatio = boundsSize.x / boundsSize.y
        if (boundsAspectRatio < parentAspectRatio) {
            if (fit === 'contain') {
                size.set(NaN, 1, NaN)
            }  else if (fit === 'cover') {
                size.set(1, NaN, NaN)
            } else {
                size.set(1,1,NaN)
            }
        } else {
            size.set(1, NaN, NaN)
        }
        return size
    }

    // public static convertOffset(offset:THREE.Vector3, start:THREE.Object3D, end:THREE.Object3D) {
    //     const startReferenceFrame = SpatialLayout.getReferenceFrame(start)
    //     const endReferenceFrame = SpatialLayout.getReferenceFrame(end)
    //     const startTranslate = SpatialLayout.getPositionForOffset(start, startReferenceFrame, offset, offset)
    //     const endInverseMatrixWorld = matrices.get().getInverse(end.matrixWorld)
    //     const endTranslate = startTranslate.applyMatrix4(start.matrixWorld).applyMatrix4(endInverseMatrixWorld)
    //     const endAlign = SpatialLayout.getOffsetForPosition(end, endReferenceFrame, endTranslate, endTranslate)
    //     return endAlign
    // }

    // public static setReferenceFrame(object:THREE.Object3D, referenceFrame:THREE.Object3D|null|undefined) {
    //     if (object.layoutReferenceFrame === referenceFrame) return
    //     // object.matrix.decompose(object.position, object.quaternion, object.scale)
    //     object.layoutReferenceFrame = referenceFrame
    //     const layout = object.layout
    //     if (layout) {
    //         const resolvedReferenceFrame = SpatialLayout.getReferenceFrame(object)
    //         SpatialLayout.getOffsetForPosition(object.parent, resolvedReferenceFrame, layout.computedAlignTranslate, layout.align)
    //         SpatialLayout.getOffsetForPosition(object, resolvedReferenceFrame, layout.computedOriginTranslate, layout.origin)
    //     }
    // }

    public static setParent(child:THREE.Object3D, parent:THREE.Object3D) {
        if (child.parent === parent) return
        
        child.updateWorldMatrix(true, false)
        parent.updateWorldMatrix(true, false)
        if (child.parent) child.parent.remove(child)
        const parentMatrixWorldInverse = matrices.get().getInverse(parent.matrixWorld) 
        child.matrix.copy(child.matrixWorld)
        child.applyMatrix(parentMatrixWorldInverse)
        matrices.pool(parentMatrixWorldInverse)
        parent.add(child)
        parent.updateMatrixWorld(true)
        
        const layout = child.layout
        if (layout) {
            child.position.sub(layout.computedAlignPosition)
            child.position.sub(layout.computedOriginPosition)
            child.scale.divide(layout.computedSizeScale)
            parent.updateMatrixWorld(true)
        }
    }
}