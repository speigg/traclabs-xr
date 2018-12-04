import * as THREE from 'three'

export default class SpatialMetrics {

    constructor(public object:THREE.Object3D) {}

    _objectWorldDirection = new THREE.Vector3
    _objectWorldPosition = new THREE.Vector3
    _targetWorldPosition = new THREE.Vector3
    _targetDirectionRelativeToObject = new THREE.Vector3
    _scratchVector3 = new THREE.Vector3
    _box = new THREE.Box3
    _sphere = new THREE.Sphere

    /**
     * Calculate the distance to the target object
     */
    getDistanceOf(target:THREE.Object3D) {
        return this.object.getWorldPosition(this._objectWorldPosition).distanceTo(target.getWorldPosition(this._targetWorldPosition))
    }

    /**
     * Calculate the direction to the target object. If objects are at same position, 
     * returns Zero vector
     */
    getDirectionOf(target:THREE.Object3D, out:THREE.Vector3) {
        this.object.getWorldPosition(this._objectWorldPosition)
        target.getWorldPosition(this._targetWorldPosition)
        out.subVectors(this._targetWorldPosition, this._objectWorldPosition)
        out.normalize()
        return out
    }

    /**
     * Calculate the angular distance between the direction vector of the primary object, 
     * and the direction vector that would point towards the target object.
     * If this object is pointing directly towards the target object, the visual angle is 0
     * If this object is pointing directly opposite of the target object, the visual angle is Math.PI
     * Special Case: if this object is at the same position as the target object, the visual angle is Math.PI
     */
    getVisualAngleOf(target:THREE.Object3D) {
        if (this.getDistanceOf(target) === 0) return Math.PI
        this.object.getWorldDirection(this._objectWorldDirection)
        this.getDirectionOf(target, this._targetDirectionRelativeToObject)
        return this._objectWorldDirection.angleTo(this._targetDirectionRelativeToObject)
    }

    /**
     * Calculate the field of view of the target object as seen by this object
     * If this object is inside 
     * @returns visual size of the target object in radians
     */
    getVisualSizeOf(target:THREE.Object3D) {
        this.object.getWorldPosition(this._objectWorldPosition)
        this._box.setFromObject(target)
        const sphere = this._box.getBoundingSphere(this._sphere)
        const distance = sphere.distanceToPoint(this._objectWorldPosition)
        return 2 * Math.atan2(sphere.radius, distance)
    }

    // getVisualWidthOfSurface(target:Surface, mode:'average'|'max'|'min'='average') {
        
    // }

    // getVisualHeightOfSurface(target:Surface, mode:'average'|'max'|'min'='average') {
        
    // }

}