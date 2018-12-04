import * as THREE from 'three'

const EMA_PERIOD = 5

const IDENTITY_ROTATION = new THREE.Quaternion

export default class KinematicMetrics {

    private _vectorLastPosition = new THREE.Vector3
    private _vectorA = new THREE.Vector3
    private _vectorB = new THREE.Vector3
    private _quatLastOrientation = new THREE.Quaternion
    private _quatA = new THREE.Quaternion
    private _quatB = new THREE.Quaternion
    private _quatA2 = new THREE.Quaternion
    private _quatB2 = new THREE.Quaternion

    private _lastObjectPosition = new THREE.Vector3
    private _lastOriginPosition = new THREE.Vector3
    private _lastObjectOrientation = new THREE.Quaternion
    private _lastOriginOrientation = new THREE.Quaternion
    
    private _linearVelocityX = new ExponentialMovingAverage(EMA_PERIOD)
    private _linearVelocityY = new ExponentialMovingAverage(EMA_PERIOD)
    private _linearVelocityZ = new ExponentialMovingAverage(EMA_PERIOD)
    
    private _angularVelocityX = new ExponentialMovingAverage(EMA_PERIOD)
    private _angularVelocityY = new ExponentialMovingAverage(EMA_PERIOD)
    private _angularVelocityZ = new ExponentialMovingAverage(EMA_PERIOD)
    private _angularVelocityW = new ExponentialMovingAverage(EMA_PERIOD)

    /**
     * Linear velocity is meters per second
     */

    public linearVelocity = new THREE.Vector3

    /**
     * Linear speed is meters per second
     */
    public linearSpeed = 0

    /**
     * Angular velocity is radians per second
     */
    public angularVelocity = new THREE.Quaternion

    /**
     * Angular speed is radians per second
     */
    public angularSpeed = 0

    constructor(public object:THREE.Object3D, public origin:THREE.Object3D) {
        this.object.getWorldPosition(this._lastObjectPosition)
        this.origin.getWorldPosition(this._lastOriginPosition)
    }

    update(deltaTime:number) {
        const lastObjectPosition = this._vectorLastPosition.copy(this._lastObjectPosition)
        const objectPosition = this.object.getWorldPosition(this._vectorA)
        this._lastObjectPosition.copy(objectPosition)
        const deltaObjectPosition = objectPosition.sub(lastObjectPosition)
        const objectVelocity = deltaObjectPosition.divideScalar(deltaTime)

        const lastOriginPosition = this._vectorLastPosition.copy(this._lastOriginPosition)
        const originPosition = this.origin.getWorldPosition(this._vectorB)
        this._lastOriginPosition.copy(originPosition)
        const deltaOriginPosition = originPosition.sub(lastOriginPosition)
        const originVelocity = deltaOriginPosition.divideScalar(deltaTime)
        
        const relativeVelocity = originVelocity.sub(objectVelocity)
        this._linearVelocityX.update(relativeVelocity.x)
        this._linearVelocityY.update(relativeVelocity.y)
        this._linearVelocityZ.update(relativeVelocity.z)

        this.linearVelocity.set(this._linearVelocityX.mean, this._linearVelocityY.mean, this._linearVelocityZ.mean)
        this.linearSpeed = this.linearVelocity.length()

        const lastObjectOrientation = this._quatLastOrientation.copy(this._lastObjectOrientation)
        const objectOrientation = this.object.getWorldQuaternion(this._quatA)
        this._lastObjectOrientation.copy(objectOrientation)
        const deltaObjectOrientation = lastObjectOrientation.inverse().multiply(objectOrientation)
        const objectAngularVelocity = THREE.Quaternion.slerpUnclamped(IDENTITY_ROTATION, deltaObjectOrientation, this._quatA2, 1 / deltaTime )
        objectAngularVelocity.normalize()
        
        const lastOriginOrientation = this._quatLastOrientation.copy(this._lastOriginOrientation)
        const originOrientation = this.origin.getWorldQuaternion(this._quatB)
        this._lastOriginOrientation.copy(originOrientation)
        const deltaOriginOrientation = lastOriginOrientation.inverse().multiply(originOrientation)
        const originAngularVelocity = THREE.Quaternion.slerpUnclamped(IDENTITY_ROTATION, deltaOriginOrientation, this._quatB2, 1 / deltaTime )
        originAngularVelocity.normalize()

        const relativeAngularVelocity = originAngularVelocity.inverse().multiply(objectAngularVelocity).normalize()
        this._angularVelocityX.update(relativeAngularVelocity.x)
        this._angularVelocityY.update(relativeAngularVelocity.y)
        this._angularVelocityZ.update(relativeAngularVelocity.z)
        this._angularVelocityW.update(relativeAngularVelocity.w)

        this.angularVelocity.set(
            this._angularVelocityX.mean,
            this._angularVelocityY.mean,
            this._angularVelocityZ.mean,
            this._angularVelocityW.mean
        )
        this.angularVelocity.normalize()
        this._angularVelocityX.mean = this._angularVelocityX.mean
        this._angularVelocityY.mean = this._angularVelocityY.mean
        this._angularVelocityZ.mean = this._angularVelocityZ.mean
        this._angularVelocityW.mean = this._angularVelocityW.mean
        this.angularSpeed = angleTo(IDENTITY_ROTATION, this.angularVelocity)
    }
}


function angleTo(q1:THREE.Quaternion,q2:THREE.Quaternion) {
    return 2 * Math.acos( Math.abs( THREE.Math.clamp( q1.dot( q2 ), - 1, 1 ) ) );
}


declare module 'three/three-core' {
    interface Quaternion {
        _w:number;_x:number;_y:number;_z:number;
        slerpUnclamped (q:Quaternion, t:number) : Quaternion
    }

    namespace Quaternion {
        export function slerpUnclamped (qa:Quaternion, ab:Quaternion, qm:Quaternion, t:number) : Quaternion
    }
}

THREE.Quaternion.slerpUnclamped = function (qa, qb, qm, t) {
    return qm.copy( qa ).slerpUnclamped( qb, t );
}


THREE.Quaternion.prototype.slerpUnclamped = function ( this:THREE.Quaternion, qb, t ) {

    if ( t === 0 ) return this;
    if ( t === 1 ) return this.copy( qb );

    var x = this._x, y = this._y, z = this._z, w = this._w;

    // http://www.euclideanspace.com/maths/algebra/realNormedAlgebra/quaternions/slerp/

    var cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;

    if ( cosHalfTheta < 0 ) {

        this._w = - qb._w;
        this._x = - qb._x;
        this._y = - qb._y;
        this._z = - qb._z;

        cosHalfTheta = - cosHalfTheta;

    } else {

        this.copy( qb );

    }

    // if ( cosHalfTheta >= 1.0 ) {

    //     this._w = w;
    //     this._x = x;
    //     this._y = y;
    //     this._z = z;

    //     return this;

    // }

    var sqrSinHalfTheta = 1.0 - cosHalfTheta * cosHalfTheta;

    if ( sqrSinHalfTheta <= Number.EPSILON ) {

        var s = 1 - t;
        this._w = s * w + t * this._w;
        this._x = s * x + t * this._x;
        this._y = s * y + t * this._y;
        this._z = s * z + t * this._z;

        return this.normalize();

    }

    var sinHalfTheta = Math.sqrt( sqrSinHalfTheta );
    var halfTheta = Math.atan2( sinHalfTheta, cosHalfTheta );
    var ratioA = Math.sin( ( 1 - t ) * halfTheta ) / sinHalfTheta,
        ratioB = Math.sin( t * halfTheta ) / sinHalfTheta;

    this._w = ( w * ratioA + this._w * ratioB );
    this._x = ( x * ratioA + this._x * ratioB );
    this._y = ( y * ratioA + this._y * ratioB );
    this._z = ( z * ratioA + this._z * ratioB );

    this.onChangeCallback();

    return this;

}




class ExponentialMovingAverage {

    public mean:number
    public multiplier:number

    constructor(timePeriods = 10, startingMean = 0) {
        this.mean = startingMean
        this.multiplier = 2 / (timePeriods + 1)
    }

    update(newValue) {
        const meanIncrement = this.multiplier * (newValue - this.mean)
        const newMean = this.mean + meanIncrement
        this.mean = newMean
    }
}