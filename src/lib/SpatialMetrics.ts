import * as THREE from 'three/src/Three'

declare module 'three/src/Three' {
    interface Box3 {
        setFromObjectBoxes(object: THREE.Object3D, transform?: THREE.Matrix4): Box3
    }
}

/**
 * Compute the bounding box of an object (including its children),
 * based on the union of child bounding boxes. This is much more efficient
 * than `setFromObject`, which traverses through all child geometry
 * each time it is called.
 */
THREE.Box3.prototype.setFromObjectBoxes = function() {
    // Computes the world-axis-aligned bounding box of an object (including its children),
    // accounting for both the object's, and children's, world transforms
    // based on child bounding boxes
    const box = new THREE.Box3()
    const _mat4 = new THREE.Matrix4
    return function( this: THREE.Box3, object: THREE.Object3D, transform?: THREE.Matrix4 ) {
        this.makeEmpty()
        object.updateWorldMatrix( true, true )
        object.traverse( ( node ) => {
            const geometry = (node as THREE.Mesh).geometry
            if ( geometry !== undefined ) {
                if ( geometry.boundingBox === null ) {
                    geometry.computeBoundingBox()
                }
                box.copy( geometry.boundingBox )
                if (transform) {
                    _mat4.multiplyMatrices( transform, node.matrixWorld )
                    box.applyMatrix4( _mat4 )
                } else {
                    box.applyMatrix4( node.matrixWorld )
                }
                this.union( box )
            }
        })
        return this
    }

}()

export class VisualDirection {
    constructor(
        /**
         * The angle around the horizontal plane (in DEGREES)
         * Increases from left to right (-180 to 180), with 0deg being forward
         */
        public azimuth: number = 0,
        /**
         * The angle above or below the horzontal plane (in DEGREES)
         * Increases from below to above (-90 to 90)
         *  0deg is forward
         *  -90deg is down
         *  90deg is up
         */
        public elevation: number = 0,
    ) {}
}

// class VisualPosition {
//     direction = new VisualDirection
//     distance: number = 0
// }

const FORWARD = new THREE.Vector3(0, 0, -1)

/**
 * Calculate spatial metrics between a primary object and a target object.
 *
 * The results are always in one of two *local* coordinate systems:
 * `object-space` -
 *      Local cartesian coordinate system [X,Y,Z]. By convention, this local coordinate system is
 *      interpreted in two different ways, depending on whether or not the object is a camera:
 *          Typical objects: [+X = left, +Y = up, +Z = forward]
 *          Camera objects: [+X = right, +Y = up, -Z = forward]
 * `visual-space` -
 *      Local spherical coordinate system where:
 *          `azimuth` (-180 to 180 DEGREES) an angle around the horizontal plane
 *              (increasing from left to right, with 0deg being aligned with this object's natural `forward` vector)
 *          `elevation` (-90 to 90 DEGREES ) an angle above or below the horizontal plane
 *              (increases from below to above, with 0deg at the horizon)
 *          `distance` is distance along the direction defined by the azimuth and elevation
 *      Visual space is consistent for camera and non-camera objects.
 */
export default class SpatialMetrics {

    static VisualDirection = VisualDirection

    // getVisualWidthOfSurface(target:Surface, mode:'average'|'max'|'min'='average') {

    // }

    // getVisualHeightOfSurface(target:Surface, mode:'average'|'max'|'min'='average') {

    // }

    private _fovs?: CameraFOVs

    constructor(public object: THREE.Object3D) {}

    visualToObjectDirection(visualDirection: VisualDirection, out: THREE.Vector3) {
        const visualElevationRadians = THREE.Math.DEG2RAD * visualDirection.elevation
        const visualAzimuthRadians = THREE.Math.DEG2RAD * visualDirection.azimuth
        const y = Math.sin(visualElevationRadians)
        const x = Math.cos(visualElevationRadians) * Math.sin(visualAzimuthRadians)
        const z = - Math.cos(visualElevationRadians) * Math.cos(visualAzimuthRadians)
        out.set(x, y, z).normalize()
        if (!(this.object as THREE.Camera).isCamera) { out.negate() }
        return out
    }

    objectToVisualDirection(objectDirection: THREE.Vector3, out: VisualDirection) {
        if (!(this.object as THREE.Camera).isCamera) { objectDirection.negate() }
        out.elevation = Math.asin(objectDirection.y) * THREE.Math.RAD2DEG
        out.azimuth = Math.atan2(objectDirection.x, -objectDirection.z) * THREE.Math.RAD2DEG
        return out
    }

    /**
     * Calculate the local position of target in `object space`
     */
    getPositionOf(target: THREE.Object3D, out: THREE.Vector3) {
        return this.object.worldToLocal(target.getWorldPosition(out))
    }

    /**
     * Calculate the local distance of the target object
     * (Note: this is the same for both `object-space` and `visual-space`)
     */
    getDistanceOf(target: THREE.Object3D) {
        return this.getPositionOf(target, _getDistanceOf_Vector3).length()
    }

    /**
     * Calculate the local direction of the target object in `object-space`
     *
     * Remember, by convention:
     *     Normal objects: [+X = left, +Y = up, +Z = forward]
     *     Camera objects: [+X = right, +Y = up, -Z = forward]
     * Special Case: if both objects are at the same *exact* position,
     *      the result is a `backward` vector ([0,0,1] for cameras, [0,0,-1] for other objects)
     */
    getDirectionOf(target: THREE.Object3D, out: THREE.Vector3) {
        const position = this.getPositionOf(target, out)
        if (position.lengthSq() === 0) { // if distance is 0
            if ((this.object as THREE.Camera).isCamera) { return out.set(0, 0, 1) }
            return out.set(0, 0, -1)
        }
        return position.normalize()
    }

    /**
     * Get the world direction of the target object.
     *
     * Special Case: if both objects are at the same *exact* position,
     *      the result is a `backward` vector ([0,0,1] for cameras, [0,0,-1] for other objects),
     *      transformed into world coordinates
     */
    getWorldDirectionOf(target: THREE.Object3D, out: THREE.Vector3) {
        return this.getDirectionOf(target, out).transformDirection(this.object.matrixWorld)
    }

    /**
     * Set a position for the *target object*,
     * based on the visual-space of *this object*.
     *
     * If the object has no bounding sphere, or if a visualSize is not specified,
     * then the current distance will be assumed.
     *
     * @param target
     * @param visualDirection the desired visual direction to the target
     * @param visualSize the desired visual size of the target (in DEGREES)
     * @param alpha a linear interpolation value (default is 1)
     */
    setPositionFor( target: THREE.Object3D,
                    visualDirection: VisualDirection,
                    visualSize?: number,
                    alpha = 1) {
        let distance: number
        if (typeof visualSize === 'number' && visualSize > 0) {
            distance = this.computeDistanceFor(target, visualSize)
        } else {
            distance = this.getDistanceOf(target)
        }
        const start = _setPositionFor_Vector3.copy(target.position)
        const end = target.position
        this.visualToObjectDirection(visualDirection, end).multiplyScalar(distance)
        this.object.localToWorld(end)
        target.parent && target.parent.worldToLocal(end)
        target.position.copy(start.lerp(end, alpha))
    }

    /**
     * Set a new scale for the target that
     * would make it have the desired visual size
     * in this object's `visual-space`.
     *
     * @param target
     * @param visualSize the desired visual size of the target (in DEGREES)
     * @param alpha a linear interpolation value (default is 1)
     */
    setScaleFor(target: THREE.Object3D, visualSize: number, alpha = 1) {
        const idealDistance = this.computeDistanceFor(target, visualSize)
        const currentDistance = this.getDistanceOf(target)
        const distanceScale = idealDistance / currentDistance
        const start = _setScaleFor_Vector3.copy(target.scale)
        const end = target.scale
        if (isFinite(distanceScale)) { end.multiplyScalar(distanceScale) }
        target.scale.copy(start.lerp(end, alpha))
    }

    /**
     * Perform a look-at operation on the target object, based
     * on this object's local up direction.
     * @param target
     */
    setOrientationFor(target: THREE.Object3D, alpha = 1) {
        const localObjectUp = _performLookAtFor_Vector3.set(0, 1, 0)
        const savedTargetUp = _performLookAtFor_Vector3_2.copy(target.up)
        const globalObjectUp = localObjectUp.transformDirection(this.object.matrixWorld)
        target.up.copy(globalObjectUp)
        const start = _setOrientationFor_Quaternion.copy(target.quaternion)
        target.lookAt(this.object.getWorldPosition(_performLookAtFor_Vector3))
        target.up.copy(savedTargetUp)
        const end = target.quaternion
        target.quaternion.copy(start.slerp(end, alpha))
    }

    /**
     * Calculate the distance at which the target would have the given visual size.
     * As the visual size increases, the distance decreases.
     * If the object has no bounding sphere, the current distance is returned.
     *
     * If the desired visual size is between 180 and 360, the returned distance
     * would place this object within the target's bounding sphere, with no distance
     * at 360 deg, for the center of the target bounding sphere.
     */
    computeDistanceFor(target: THREE.Object3D, visualSize: number): number {
        if (visualSize < 0 || visualSize > 360) { throw new Error('Invalid visualSize, must be between [0-360]') }
        target.updateWorldMatrix(true, false)
        const targetMatrixWorldInverse = _computeDistanceFor_Matrix4.getInverse(target.matrixWorld)
        const sphereRadius = _box.setFromObjectBoxes(target, targetMatrixWorldInverse)
            .getBoundingSphere(_sphere).radius

        if (sphereRadius === 0) { return this.getDistanceOf(target) }

        if (visualSize > 180) {
            // special case: linearly decrease distance with increasing visual size within the bounding sphere.
            return (360 - visualSize / 180) * sphereRadius
        }

        // see https://stackoverflow.com/questions/21648630/radius-of-projected-sphere-in-screen-space
        return sphereRadius / Math.sin( THREE.Math.DEG2RAD * visualSize / 2 )
    }

    /**
     * Calculate the visual direction towards the target object.
     * Assumes that a normal object faces +Z, and a camera faces -Z.
     *
     * If pointing directly towards the target object, the direction is [0,0,-1] (forward)
     * If pointing directly opposite of the target object, the direction is [0,0,1] (backwards)
     * Special Case: if both are at the same exact position, the direction is [0,0,1]
     */
    getVisualDirectionOf(target: THREE.Object3D, out: VisualDirection) {
        const direction = this.getDirectionOf(target, _getVisualDirectionOf_Vector3)
        return this.objectToVisualDirection(direction, out)
    }

    /**
     * Calculate the angular offset (in DEGREES) between this object's forward vector,
     * and the direction towards the target object (as calculated by getDirectionOf).
     * Assumes that a normal object faces +Z, and a camera faces -Z.
     *
     * If pointing directly towards the target object, the visual offset is 0
     * If pointing directly opposite of the target object, the visual offset is 180
     * Special Case: if both are at the same position, the visual offset is 180
     */
    getVisualOffsetOf(target: THREE.Object3D): number {
        const direction = this.getDirectionOf(target, _getVisualOffsetOf_Vector3)
        if (!(this.object as THREE.Camera).isCamera) { direction.negate() }
        return FORWARD.angleTo(direction) * THREE.Math.RAD2DEG
    }

    /**
     * Calculate the field of view of the target object as seen by this object.
     *
     * The `visual size` grows from 0 to 180 as the bouding sphere of the target grows in our
     * field of view.
     * Once we are inside the boudning sphere, the `visual size` continues to
     * increase linearly, from 180 to 360 at the center of the bounding sphere.
     * If the target object has no bounding sphere defined, the result is 0.
     *
     * @returns visual size of the target object in DEGREES, from [0-360]
     */
    getVisualSizeOf(target: THREE.Object3D) {
        target.updateWorldMatrix(true, false)
        const targetMatrixWorldInverse = _getVisualSizeOf_Matrix4.getInverse(target.matrixWorld)
        _box.setFromObjectBoxes(target, targetMatrixWorldInverse)
        const sphere = _box.getBoundingSphere(_sphere)
        const sphereRadius = sphere.radius
        if (sphereRadius <= 0) { return 0 }
        const sphereDistance = this.getDistanceOf(target)
        if (sphereDistance <= sphereRadius) {
            return 180 + (180 * sphereDistance / sphereRadius)
        } // we are inside the bounding sphere
        // see https://stackoverflow.com/questions/21648630/radius-of-projected-sphere-in-screen-space
        return 2 * Math.asin(sphereRadius / sphereDistance) * 180 / Math.PI
    }

    /**
     * Get the left, right, top, and bottom FOV for this object, in DEGREES.
     * Assumes this object is a camera with perspective projection matrix.
     *
     * If this object is not a camera, this method will throw an error.
     */
    getFovs(): CameraFOVs {
        const camera = this.object as THREE.Camera
        if (!camera.isCamera) { throw new Error('getFovs() requires a THREE.Camera object') }
        if (!this._fovs) { this._fovs =  {} as CameraFOVs }
        const out = this._fovs
        const invProjection = _getFovs_Matrix4.getInverse(camera.projectionMatrix, true)
        const vec = _getFovs_Vector3
        out.left = vec.set(-1, 0, -1).applyMatrix4(invProjection).angleTo(FORWARD) * THREE.Math.RAD2DEG
        out.right = vec.set(1, 0, -1).applyMatrix4(invProjection).angleTo(FORWARD) * THREE.Math.RAD2DEG
        out.top = vec.set(0, 1, -1).applyMatrix4(invProjection).angleTo(FORWARD) * THREE.Math.RAD2DEG
        out.bottom = vec.set(0, -1, -1).applyMatrix4(invProjection).angleTo(FORWARD) * THREE.Math.RAD2DEG
        return out
    }

}

const _box = new THREE.Box3
const _sphere = new THREE.Sphere
const _getDistanceOf_Vector3 = new THREE.Vector3
const _performLookAtFor_Vector3 = new THREE.Vector3
const _performLookAtFor_Vector3_2 = new THREE.Vector3
const _getVisualDirectionOf_Vector3 = new THREE.Vector3
const _getVisualOffsetOf_Vector3 = new THREE.Vector3
const _getVisualSizeOf_Matrix4 = new THREE.Matrix4
const _getFovs_Matrix4 = new THREE.Matrix4
const _getFovs_Vector3 = new THREE.Vector3
const _setPositionFor_Vector3 = new THREE.Vector3
const _setScaleFor_Vector3 = new THREE.Vector3
const _setOrientationFor_Quaternion = new THREE.Quaternion
const _computeDistanceFor_Matrix4 = new THREE.Matrix4


interface CameraFOVs {
    top: number, left: number, bottom: number, right: number
}
