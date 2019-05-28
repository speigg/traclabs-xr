import * as THREE from 'three'
import {matrices, vectors, V_000} from './SpatialUtils'
import {SpatialMetrics, VisualFrustum} from './SpatialMetrics'

declare module 'three/src/core/Object3D' {
    interface Object3D {
        layout?: SpatialLayout
        layoutIgnore?: boolean
        layoutReferenceFrame?: THREE.Object3D|null
    }
}

const childReferenceFrames = new Set<THREE.Object3D>()
const originalUpdateMatrix = THREE.Object3D.prototype.updateMatrix
THREE.Object3D.prototype.updateMatrix = function() {
    originalUpdateMatrix.call(this)
    const o = this
    let referenceFrame: THREE.Object3D|null|undefined

    // determine needed layout bounds
    let needsBoundsUpdate = !!o.layout
    if (needsBoundsUpdate) referenceFrame = SpatialLayout.resolveReferenceFrame(o)
    for (const child of this.children) {
        if (child.layout) {
            needsBoundsUpdate = true
            if (referenceFrame === undefined) referenceFrame = SpatialLayout.resolveReferenceFrame(o)
            const childFrame = SpatialLayout.resolveReferenceFrame(child, referenceFrame)
            childFrame && childReferenceFrames.add(childFrame)
        }
    }
    if (!needsBoundsUpdate) return

    // update bounds && frustums
    SpatialMetrics.get(o).getBoundsOf(o, SpatialLayout.getBounds(o))
    if (referenceFrame) SpatialMetrics.get(referenceFrame).getVisualFrustumOf(o, SpatialLayout.getFrustum(o, referenceFrame))
    for (const childFrame of childReferenceFrames) {
        SpatialMetrics.get(childFrame).getVisualFrustumOf(o, SpatialLayout.getFrustum(o, childFrame))
    }
    childReferenceFrames.clear()

    // update layout
    if (o.layout) {
        // update align & origin
        SpatialLayout.getPositionForOffset(o.parent, referenceFrame, o.layout.align, o.layout.computedAlignTranslate)
        SpatialLayout.getPositionForOffset(o, referenceFrame, o.layout.origin, o.layout.computedOriginTranslate)
        o.layout.computedOriginTranslate.negate()
        // update matrix
        if (isFinite(o.layout.computedAlignTranslate.x) && isFinite(o.layout.computedOriginTranslate.x)) {
            const translate = vectors.get()
            const translateMatrix = matrices.get()
            translate.addVectors(o.layout.computedAlignTranslate, o.layout.computedOriginTranslate)
            translateMatrix.setPosition(translate)
            o.matrix.multiply(translateMatrix)
            vectors.pool(translate)
            matrices.pool(translateMatrix)
        }
    }
}

export class SpatialLayout {

    align = new THREE.Vector3(0,0,0)
    origin = new THREE.Vector3(0,0,0)
    computedAlignTranslate = new THREE.Vector3(0,0,0)
    computedOriginTranslate = new THREE.Vector3(0,0,0)

    constructor(config?:{align?:THREE.Vector3,origin?:THREE.Vector3}) {
        if (config) {
            if (config.align) this.align = config.align
            if (config.origin) this.origin = config.origin
        }
    }

    public static bounds = new WeakMap<THREE.Object3D, THREE.Box3>()

    public static getBounds(o:THREE.Object3D) {
        if (!this.bounds.has(o)) {
            const bounds = new THREE.Box3
            bounds.objectFilter = SpatialLayout.objectFilter
            this.bounds.set(o, bounds)
        }
        return this.bounds.get(o)!
    }

    public static frustums = new WeakMap<THREE.Object3D, WeakMap<THREE.Object3D, VisualFrustum>>()

    public static getFrustum(o:THREE.Object3D, referenceFrame=SpatialLayout.resolveReferenceFrame(o)) {
        if (!referenceFrame) throw new Error('Getting a visual frustum requires a reference frame')
        if (!this.frustums.has(o)) this.frustums.set(o, new WeakMap)
        const frustums = this.frustums.get(o)!
        if (!frustums.has(referenceFrame)) {
            const frustum = new VisualFrustum
            frustum.objectFilter = SpatialLayout.objectFilter
            frustums.set(referenceFrame, frustum)
        }
        return frustums.get(referenceFrame)!
    }

    public static objectFilter = (o:THREE.Object3D) => !o.layout && !o.layoutIgnore

    public static resolveReferenceFrame(o:THREE.Object3D, inherited?:THREE.Object3D|null) {
        if (inherited !== undefined && o.layoutReferenceFrame === undefined) return inherited
        let currObject = o as THREE.Object3D|null
        while (currObject) {
            if (currObject && currObject.layoutReferenceFrame !== undefined) 
                return currObject.layoutReferenceFrame
            currObject = currObject.parent
        }
        return null
    }

    public static getPositionForOffset(o:THREE.Object3D|null, referenceFrame:THREE.Object3D|null|undefined, offset:THREE.Vector3, out:THREE.Vector3) {
        if (!o) return out.setScalar(0)
        const camera = o as THREE.Camera
        if (camera.isCamera) {
            const boundsMatrix = matrices.get().getInverse(camera.projectionMatrix)
            const translateZ = -offset.z
            out.copy(offset)
            out.z = -1
            out.applyMatrix4(boundsMatrix)
            out.normalize().multiplyScalar(translateZ)
            matrices.pool(boundsMatrix)
        } else if (referenceFrame) {
            const frustum = SpatialLayout.getFrustum(o, referenceFrame)
            if (!frustum.isEmpty()) {
                const center = frustum.getCenter(vectors.get())
                const size = frustum.getSize(vectors.get())
                out.copy(offset).multiplyScalar(0.5).multiply(size).add(center)
                SpatialMetrics.getCartesianForSphericalPosition(out, out)
                referenceFrame.localToWorld(out)
                o.worldToLocal(out)
                vectors.pool(center, size)
            } else {
                out.setScalar(0)
            }
        } else {
            const bounds = SpatialLayout.getBounds(o)
            if (!bounds.isEmpty()) {
                const center = bounds.getCenter(vectors.get())
                const size = bounds.getSize(vectors.get())
                out.copy(offset).multiplyScalar(0.5).multiply(size).add(center)
                vectors.pool(center, size)
            } else {
                out.setScalar(0)
            }
        }
        return out
    }

    public static getOffsetForPosition(o:THREE.Object3D|null, referenceFrame:THREE.Object3D|null|undefined, position:THREE.Vector3, out:THREE.Vector3) {
        if (!o) return out.setScalar(0)
        const camera = o as THREE.Camera
        if (camera.isCamera) {
            if (position.z === 0) {
                return out.setScalar(0)
            }
            const zTranslate = -position.length()
            out.copy(position).normalize().applyMatrix4(camera.projectionMatrix)
            out.z = zTranslate
        } else if (referenceFrame) {
            const frustum = SpatialLayout.getFrustum(o, referenceFrame)
            if (!frustum.isEmpty()) {  
                const center = frustum.getCenter(vectors.get())
                const size = frustum.getSize(vectors.get())
                o.localToWorld(out.copy(position))
                referenceFrame.worldToLocal(out)
                SpatialMetrics.getSphericalPositionForCartesian(out, out)
                out.sub(center).divide(size).multiplyScalar(2)
                vectors.pool(center, size)
            } else {
                out.setScalar(0)
            }
        } else {
            const bounds = SpatialLayout.getBounds(o)
            if (!bounds.isEmpty()) {
                const center = bounds.getCenter(vectors.get())
                const size = bounds.getSize(vectors.get())
                out.copy(position).sub(center).divide(size).multiplyScalar(2)
                vectors.pool(center, size)
            } else {
                out.setScalar(0)
            }
        }
        return out
    }

    public static convertOffset(offset:THREE.Vector3, start:THREE.Object3D, end:THREE.Object3D) {
        const startReferenceFrame = SpatialLayout.resolveReferenceFrame(start)
        const endReferenceFrame = SpatialLayout.resolveReferenceFrame(end)
        const startTranslate = SpatialLayout.getPositionForOffset(start, startReferenceFrame, offset, offset)
        const endInverseMatrixWorld = matrices.get().getInverse(end.matrixWorld)
        const endTranslate = startTranslate.applyMatrix4(start.matrixWorld).applyMatrix4(endInverseMatrixWorld)
        const endAlign = SpatialLayout.getOffsetForPosition(end, endReferenceFrame, endTranslate, endTranslate)
        return endAlign
    }

    public static setReferenceFrame(object:THREE.Object3D, referenceFrame:THREE.Object3D|null|undefined) {
        if (object.layoutReferenceFrame === referenceFrame) return
        object.matrix.decompose(object.position, object.quaternion, object.scale)
        object.layoutReferenceFrame = referenceFrame
        const layout = object.layout
        if (layout) {
            const resolvedReferenceFrame = SpatialLayout.resolveReferenceFrame(object)
            SpatialLayout.getOffsetForPosition(object.parent, resolvedReferenceFrame, V_000, layout.align)
            SpatialLayout.getOffsetForPosition(object, resolvedReferenceFrame, V_000, layout.origin)
        }
    }

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
        
        const layout = child.layout
        if (layout) {
            const referenceFrame = SpatialLayout.resolveReferenceFrame(child)
            SpatialLayout.getOffsetForPosition(parent, referenceFrame, V_000, layout.align)
            SpatialLayout.getOffsetForPosition(child, referenceFrame, V_000, layout.origin)
        }

        parent.updateMatrixWorld(true)
    }
}