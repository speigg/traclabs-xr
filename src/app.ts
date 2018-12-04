
import * as THREE from 'three'
import SpatialMetrics from './lib/SpatialMetrics'

export default class App {

    scene = new THREE.Scene
    camera = new THREE.PerspectiveCamera
    cameraCenteredMetrics = new SpatialMetrics(this.camera)
    renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true
    })

    // a map of XRCoordinateSystem instances and their Object3D proxies to be updated each frame
    xrObjects = new Map // XRCoordinateSystem -> Three.js Object3D Map

    lastFrameTime = -1

    constructor() {
        this.renderer.vr.enabled = false // manage xr setup manually for now
        // this.renderer.setAnimationLoop(this.onAnimate)

        // const box = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.1), new THREE.MeshNormalMaterial)
        // this.scene.add(box)
    }

    requestVuforiaTrackableFromDataSet() {

    }

    getXRObject3D(xrCoordinateSystem) {
		let xrObject = this.xrObjects.get(xrCoordinateSystem)
		if (xrObject) return xrObject
		xrObject = new THREE.Object3D()
		xrObject.xrCoordinateSystem = xrCoordinateSystem
		this.xrObjects.set(xrCoordinateSystem, xrObject)
		return xrObject
    }

    startXR() {
        if (!navigator.xr) Promise.reject(new Error('WebXR is not supported by this browser'))
        return navigator.xr.requestDevice().then((device) => {
            device.requestSession({immersive:true, type:'augmentation'}).then(this.onSession)
        })
    }

    onSession = (session) => {
        const gl = this.renderer.getContext()
        session.baseLayer = new XRWebGLLayer(session, gl);
        session.requestFrameOfReference('eye-level').then((eyeLevelFrameOfReference) => {
            const onAnimate = (frame) => {
                session.requestAnimationFrame(onAnimate)
                const devicePose = frame.getDevicePose(eyeLevelFrameOfReference)
                this.onUpdate(frame, eyeLevelFrameOfReference, devicePose)
                this.onRender(frame, eyeLevelFrameOfReference, devicePose)
            }
            session.requestAnimationFrame(onAnimate)
        })
        session.requestTracker('ARGON_vuforia', {encryptedLicenseData:VUFORIA_LICENSE_DATA}).then((vuforia) => {
            this.scene.dispatchEvent({type:'xr-start', session, vuforia})
        }).catch(()=>{
            this.scene.dispatchEvent({type:'xr-start', session})
        })
    }

    onUpdate = (frame, frameOfRef, devicePose) => {

        if (!devicePose) return

        // update camera
        this.camera.matrix.fromArray(devicePose.poseModelMatrix)
        this.camera.updateMatrixWorld(false)

		// update xr objects in the scene graph
		for (let xrObject of this.xrObjects.values()) {
			const transform = xrObject.xrCoordinateSystem.getTransformTo(frameOfRef)
			if (transform) {
				xrObject.matrixAutoUpdate = false
				xrObject.matrix.fromArray(transform)
				xrObject.updateMatrixWorld(true)
				if (xrObject.parent !== this.scene) {
					this.scene.add(xrObject)
					console.log('added xrObject ' + xrObject.xrCoordinateSystem.uid || '')
				}
			} else {
				if (xrObject.parent) {
					this.scene.remove(xrObject)
					console.log('removed xrObject ' + xrObject.xrCoordinateSystem.uid || '')
				}
			}
		}

        // emit update event
        const now = performance.now()
        const deltaTime = Math.min(Math.max((now - this.lastFrameTime)/1000, 0.001),1/60)
        this.lastFrameTime = now
        this.scene.dispatchEvent({type:'update', deltaTime, frame, frameOfRef, devicePose})
    }

    onRender = (frame, frameOfRef, devicePose) => {
        if (!devicePose) return // nothing to do

		// Prep THREE.js for the render of each XRView
        const baseLayer = frame.session.baseLayer
        this.renderer.autoClear = false
		this.renderer.setSize(baseLayer.framebufferWidth, baseLayer.framebufferHeight, false)
		this.renderer.clear()
		this.camera.matrixAutoUpdate = false
        
		// Render each view into this.session.baseLayer.context
		for(const view of frame.views){
			// Each XRView has its own projection matrix, so set the camera to use that
			const viewMatrix = devicePose.getViewMatrix(view)
			this.camera.matrix.fromArray(viewMatrix).getInverse(this.camera.matrix)
			this.camera.projectionMatrix.fromArray(view.projectionMatrix)

			// Set up the renderer to the XRView's viewport and then render
			this.renderer.clearDepth()
			const viewport = view.getViewport(baseLayer)
			this.renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
		    this.renderer.render(this.scene, this.camera)
		}
    }

}

declare global {
    interface Navigator {
        xr:any;
    }
    const XRWebGLLayer:any
}

declare module 'three/three-core' {
    interface WebVRManager {
        setFrameOfReferenceType(type:string):void
        setSession(session):void
        getSession()
    }
}

const VUFORIA_LICENSE_DATA = 
`-----BEGIN PGP MESSAGE-----
Version: OpenPGP.js v2.3.2
Comment: http://openpgpjs.org

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
TDne/ON+Rnj/EKokFOU=
=kmoQ
-----END PGP MESSAGE-----
`;