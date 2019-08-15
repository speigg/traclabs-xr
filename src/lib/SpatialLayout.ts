import * as THREE from 'three'
import {matrices, vectors} from './SpatialUtils'
import {SpatialMetrics} from './SpatialMetrics'
import {SpatialTransitioner} from './SpatialTransitioner'

declare module 'three/src/core/Object3D' {
    interface Object3D {
        layout?: SpatialLayout
        layoutIgnore?: boolean
    }
}

const originalUpdateMatrix = THREE.Object3D.prototype.updateMatrix
THREE.Object3D.prototype.updateMatrix = function() {
    originalUpdateMatrix.call(this)
    if ((this as THREE.Camera).isCamera) return
    const o = this
    const layout = o.layout

    let bounds = layout ? SpatialLayout.getBounds(o, layout.computedBounds) : undefined
    for (let i = 0; i < this.children.length; ++i) {
        const child = this.children[i]
        if (child.layout) {
            if (!bounds) {
                bounds = SpatialLayout.getBounds(o, child.layout.computedParentBounds)
            } else {
                child.layout.computedParentBounds.copy(bounds)
            }
        }
    }

    if (layout) {
        const cameraParent = o.parent as THREE.Camera
        if (cameraParent && cameraParent.isCamera) {
            SpatialLayout.getCameraBounds(cameraParent, o, layout.computedParentBounds)
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
        // update matrix
        const translate = vectors.get().copy(o.position).add(alignPosition).add(originPosition)
        o.matrix.compose(translate, o.quaternion, scale)
        vectors.poolAll()
    }
}

export class SpatialLayout {

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
    
    private _transformer?: SpatialTransitioner

    constructor(config?:{align?:THREE.Vector3,origin?:THREE.Vector3,size?:THREE.Vector3}) {
        if (config) {
            if (config.align) this.align = config.align
            if (config.origin) this.origin = config.origin
            if (config.size) this.size = config.size
        }
        this.computedBounds.objectFilter = SpatialMetrics.objectFilter
        this.computedParentBounds.objectFilter = SpatialMetrics.objectFilter
    }

    public static getBounds(o:THREE.Object3D, box:THREE.Box3) {
        return SpatialMetrics.get(o).getBoundsOf(o, box)
    }
    
    public static getCameraBounds(camera:THREE.Camera, child:THREE.Object3D, box:THREE.Box3) {
        if (!child.layout) throw new Error('Expected an Object3D with `layout` property')
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
        if (!o || !o.layout) {
            return out.setScalar(1)
        }//throw new Error('Expected an Object3D with `layout` property')

        const bounds = o.layout.computedBounds
        const parentBounds = o.layout.computedParentBounds
        if (bounds.isEmpty() || parentBounds.isEmpty()) return out.setScalar(1)

        const boundsSize = bounds.getSize(this._boundsSize).clampScalar(10e-6, Infinity)
        const parentSize = parentBounds.getSize(this._parentSize).clampScalar(10e-6, Infinity)
        out.copy(parentSize).multiply(size).divide(boundsSize)

        if (isFinite(out.x)) {
            if (!isFinite(out.y)) out.y = out.x
            if (!isFinite(out.z)) out.z = out.x
        }
        
        if (isFinite(out.y)) {
            if (!isFinite(out.x)) out.x = out.y
            if (!isFinite(out.z)) out.z = out.y
        }
        
        if (isFinite(out.z)) {
            if (!isFinite(out.x)) out.x = out.z
            if (!isFinite(out.y)) out.y = out.z
        }

        if (!isFinite(out.x) || out.x === 0) out.x = 1
        if (!isFinite(out.y) || out.y === 0) out.y = 1
        if (!isFinite(out.z) || out.z === 0) out.z = 1
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
        
        if (!isFinite(out.x) || out.x === 0) out.x = NaN
        if (!isFinite(out.y) || out.y === 0) out.y = NaN
        if (!isFinite(out.z) || out.z === 0) out.z = NaN
        return out
    }

    public static getSizeToFit(o:THREE.Object3D, size:THREE.Vector3) {
        if (!o || !o.layout) throw new Error('Expected an Object3D with `layout` property')
        const parentBounds = o.layout.computedParentBounds
        const bounds = o.layout.computedBounds
        const parentSize = parentBounds.getSize(vectors.get())
        const boundsSize = bounds.getSize(vectors.get())
        const parentAspectRatio = parentSize.x / parentSize.y
        const boundsAspectRatio = boundsSize.x / boundsSize.y
        if (boundsAspectRatio < parentAspectRatio) {
            size.set(NaN, 1, NaN)
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