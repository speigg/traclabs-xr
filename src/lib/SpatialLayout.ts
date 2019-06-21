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

const neededReferenceFrames = new Set<THREE.Object3D|null>()
const originalUpdateMatrix = THREE.Object3D.prototype.updateMatrix
THREE.Object3D.prototype.updateMatrix = function() {
    originalUpdateMatrix.call(this)
    const o = this

    // determine needed layout bounds
    let needsBoundsUpdate = !!o.layout
    for (const child of this.children) {
        if (child.layout) {
            needsBoundsUpdate = true
            neededReferenceFrames.add(SpatialLayout.getReferenceFrame(child) || o)
        }
    }
    if (!needsBoundsUpdate) return

    // update bounds
    const referenceFrame = SpatialLayout.getReferenceFrame(o)
    neededReferenceFrames.add(referenceFrame)
    for (const frame of neededReferenceFrames) {
        SpatialMetrics.get(frame||o).getBoundsOf(o, SpatialLayout.getBounds(o, frame))
    }
    neededReferenceFrames.clear()

    // update layout
    const layout = o.layout
    if (layout) {
        layout.computedParentBounds = o.parent ? SpatialLayout.getBounds(o.parent, referenceFrame) : null
        layout.computedBounds = SpatialLayout.getBounds(o, referenceFrame)
        // update computed size
        const sizeScale = SpatialLayout.getScaleForSize(o, referenceFrame, layout.size, layout.computedSizeScale)
        const scale = vectors.get().copy(o.scale).multiply(sizeScale)
        // update computed align & origin
        const alignPosition = SpatialLayout.getPositionForOffset(o.parent, referenceFrame, layout.align, layout.computedAlignPosition)
        const originPosition = SpatialLayout.getPositionForOffset(o, referenceFrame, layout.origin, layout.computedOriginPosition)
        originPosition.negate().multiply(scale)
        // update matrix
        const translate = vectors.get().copy(o.position).add(alignPosition).add(originPosition)
        o.matrix.compose(translate, o.quaternion, scale)
        vectors.pool(translate, scale)
    }
}

export class SpatialLayout {

    align = new THREE.Vector3().set(NaN,NaN,NaN)
    origin = new THREE.Vector3().set(NaN,NaN,NaN)
    size = new THREE.Vector3().set(NaN,NaN,NaN)
    computedAlignPosition = new THREE.Vector3(0,0,0)
    computedOriginPosition = new THREE.Vector3(0,0,0)
    computedSizeScale = new THREE.Vector3(1,1,1)
    referenceFrame: THREE.Object3D|null = null

    computedBounds = new THREE.Box3
    computedParentBounds = new THREE.Box3 as THREE.Box3 | null
    
    private _transformer?: SpatialTransitioner

    constructor(config?:{align?:THREE.Vector3,origin?:THREE.Vector3,size?:THREE.Vector3}) {
        if (config) {
            if (config.align) this.align = config.align
            if (config.origin) this.origin = config.origin
            if (config.size) this.size = config.size
        }
    }

    public static bounds = new WeakMap<THREE.Object3D, WeakMap<THREE.Object3D, THREE.Box3>>()

    public static getBounds(o:THREE.Object3D, referenceFrame:THREE.Object3D|null) {
        if (!referenceFrame) referenceFrame = o
        if (!this.bounds.has(o)) this.bounds.set(o, new WeakMap)
        const bounds = this.bounds.get(o)!
        if (!bounds.has(referenceFrame)) {
            const box = new THREE.Box3
            box.objectFilter = SpatialMetrics.objectFilter
            bounds.set(referenceFrame, box)
        }
        return bounds.get(referenceFrame)!
    }

    public static getReferenceFrame(o:THREE.Object3D) {
        return o.layout ? o.layout.referenceFrame : null
    }

    public static getPositionForOffset(o:THREE.Object3D|null, referenceFrame:THREE.Object3D|null, offset:THREE.Vector3, out:THREE.Vector3) {
        if (!o) return out.setScalar(0)
        const camera = o as THREE.Camera
        if (camera.isCamera) {
            const projectionMatrixInverse = matrices.get().getInverse(camera.projectionMatrix)
            const translateZ = -offset.z
            out.copy(offset)
            out.z = -1
            out.applyMatrix4(projectionMatrixInverse)
            out.normalize().multiplyScalar(translateZ)
            matrices.pool(projectionMatrixInverse)
        } else {
            const bounds = SpatialLayout.getBounds(o, referenceFrame)
            if (!bounds.isEmpty()) {
                const center = bounds.getCenter(vectors.get())
                const size = bounds.getSize(vectors.get())
                out.copy(offset).multiplyScalar(0.5).multiply(size).add(center)
                if (referenceFrame) {
                    referenceFrame.localToWorld(out)
                    o.worldToLocal(out)
                }
                vectors.pool(center, size)
            } else {
                out.setScalar(0)
            }
        }
        if (!isFinite(out.x)) out.x = 0
        if (!isFinite(out.y)) out.y = 0
        if (!isFinite(out.z)) out.z = 0
        return out
    }

    public static getOffsetForPosition(o:THREE.Object3D|null, referenceFrame:THREE.Object3D|null, position:THREE.Vector3, out:THREE.Vector3) {
        if (!o) return out.setScalar(0)
        const camera = o as THREE.Camera
        if (camera.isCamera) {
            if (position.z === 0) {
                return out.setScalar(0)
            }
            const zTranslate = -position.length()
            out.copy(position).normalize().applyMatrix4(camera.projectionMatrix)
            out.z = zTranslate
        } else {
            const bounds = SpatialLayout.getBounds(o, referenceFrame)
            if (!bounds.isEmpty()) {  
                const center = bounds.getCenter(vectors.get())
                const size = bounds.getSize(vectors.get())
                out.copy(position)
                if (referenceFrame) {
                    o.localToWorld(out)
                    referenceFrame.worldToLocal(out)
                }
                out.sub(center).divide(size).multiplyScalar(2)
                vectors.pool(center, size)
            } else {
                out.setScalar(0)
            }
        }
        if (!isFinite(out.x)) out.x = 0
        if (!isFinite(out.y)) out.y = 0
        if (!isFinite(out.z)) out.z = 0
        return out
    }

    public static getScaleForSize(o:THREE.Object3D, referenceFrame:THREE.Object3D|null, size:THREE.Vector3, out:THREE.Vector3) {
        const parent = o.parent
        if (!o || !parent) return out.setScalar(1)
        const parentBounds = SpatialLayout.getBounds(parent, referenceFrame)
        if (parentBounds.isEmpty()) return out.setScalar(1)
        const bounds = SpatialLayout.getBounds(o, referenceFrame)
        if (bounds.isEmpty()) return out.setScalar(1)

        const boundsSize = bounds.getSize(vectors.get())
        const camera = o.parent as THREE.Camera
        if (camera.isCamera) {
            const position = vectors.get().setFromMatrixPosition(o.matrixWorld)
            camera.worldToLocal(position)
            position.applyMatrix4(camera.projectionMatrix)
            const invProjection = matrices.get().getInverse(camera.projectionMatrix)
            const left = vectors.get().set(-1, position.y, position.z).applyMatrix4(invProjection)
            const right = vectors.get().set(1, position.y, position.z).applyMatrix4(invProjection)
            const top = vectors.get().set(position.x, 1, position.z).applyMatrix4(invProjection)
            const bottom = vectors.get().set(position.x, -1, position.z).applyMatrix4(invProjection)
            const near = vectors.get().set(0, 0, -1).applyMatrix4(invProjection)
            const far = vectors.get().set(0, 0, 1).applyMatrix4(invProjection)
            const parentSize = position.set(right.distanceTo(left), top.distanceTo(bottom), far.distanceTo(near))
            out.copy(parentSize).multiply(size).divide(boundsSize)
            matrices.pool(invProjection)
            vectors.pool(position, left, right, top, bottom, near, far)
        } else {
            const parentBounds = SpatialLayout.getBounds(parent, referenceFrame)
            if (!parentBounds.isEmpty()) {
                const parentSize = parentBounds.getSize(vectors.get())
                out.copy(parentSize).multiply(size).divide(boundsSize)
                if (referenceFrame) {
                    referenceFrame.localToWorld(out)
                    o.worldToLocal(out)
                }
                vectors.pool(parentSize)
            } else {
                out.setScalar(1)
            }
        }
        vectors.pool(boundsSize)

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

    public static getSizeForScale(o:THREE.Object3D, referenceFrame:THREE.Object3D|null, scale:THREE.Vector3, out:THREE.Vector3) {
        const parent = o.parent
        if (!o || !parent) return out.setScalar(NaN)
        const bounds = SpatialLayout.getBounds(o, referenceFrame)
        if (bounds.isEmpty()) return out.setScalar(NaN)

        const boundsSize = bounds.getSize(vectors.get())
        const camera = o.parent as THREE.Camera
        if (camera.isCamera) {
            const position = vectors.get().setFromMatrixPosition(o.matrixWorld)
            camera.worldToLocal(position)
            position.applyMatrix4(camera.projectionMatrix)
            const invProjection = matrices.get().getInverse(camera.projectionMatrix)
            const left = vectors.get().set(-1, position.y, position.z).applyMatrix4(invProjection)
            const right = vectors.get().set(1, position.y, position.z).applyMatrix4(invProjection)
            const top = vectors.get().set(position.x, 1, position.z).applyMatrix4(invProjection)
            const bottom = vectors.get().set(position.x, -1, position.z).applyMatrix4(invProjection)
            const near = vectors.get().set(0, 0, -1).applyMatrix4(invProjection)
            const far = vectors.get().set(0, 0, 1).applyMatrix4(invProjection)
            const parentSize = position.set(right.distanceTo(left), top.distanceTo(bottom), far.distanceTo(near))
            out.copy(scale).multiply(boundsSize).divide(parentSize)
            matrices.pool(invProjection)
            vectors.pool(position, left, right, top, bottom, near, far)
        } else {
            const parentBounds = SpatialLayout.getBounds(parent, referenceFrame)
            if (!parentBounds.isEmpty()) {
                const parentSize = parentBounds.getSize(vectors.get())
                if (referenceFrame) {
                    o.localToWorld(scale)
                    referenceFrame.worldToLocal(scale)
                }
                out.copy(scale).multiply(boundsSize).divide(parentSize)
                vectors.pool(parentSize)
            } else {
                out.setScalar(NaN)
            }
        }
        vectors.pool(boundsSize)
        if (!isFinite(out.x) || out.x === 0) out.x = NaN
        if (!isFinite(out.y) || out.y === 0) out.y = NaN
        if (!isFinite(out.z) || out.z === 0) out.z = NaN
        return out
    }

    public static convertOffset(offset:THREE.Vector3, start:THREE.Object3D, end:THREE.Object3D) {
        const startReferenceFrame = SpatialLayout.getReferenceFrame(start)
        const endReferenceFrame = SpatialLayout.getReferenceFrame(end)
        const startTranslate = SpatialLayout.getPositionForOffset(start, startReferenceFrame, offset, offset)
        const endInverseMatrixWorld = matrices.get().getInverse(end.matrixWorld)
        const endTranslate = startTranslate.applyMatrix4(start.matrixWorld).applyMatrix4(endInverseMatrixWorld)
        const endAlign = SpatialLayout.getOffsetForPosition(end, endReferenceFrame, endTranslate, endTranslate)
        return endAlign
    }

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