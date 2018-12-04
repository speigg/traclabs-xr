import App from '../app'
import * as THREE from 'three'
import AdaptiveProperty from '../lib/AdaptiveProperty'
import SpatialMetrics from '../lib/SpatialMetrics'
import KinematicMetrics from '../lib/KinematicMetrics'
import * as CANNON from 'cannon'
import {makeTextSprite} from '../lib/label-utils'
import { Line, Scene } from 'three';


interface Annotation {
    text:string,
    anchorPoint: [number,number,number]
}

export default class SnubberExampleA {

    targetObject = new THREE.Object3D
    annotationViewpoint = new THREE.Camera
    annotationViewpointMetrics = new SpatialMetrics(this.annotationViewpoint)
    cameraTargetKinematics = new KinematicMetrics(this.app.camera, this.targetObject)

    lineMaterial = new THREE.LineBasicMaterial({
        color: 0xffa500,
        depthTest: false
    })

    _scratchMatrix = new THREE.Matrix4
    

    annotations:Array<Annotation> = [
        {
            text: 'Part A',
            anchorPoint: [-0.23,0.1,0.2]
        },
        {
            text: 'Part B',
            anchorPoint: [0.1,0.1,0.2]
        },
        {
            text: 'Part C',
            anchorPoint: [-0.15,-0.05,0.1]
        },
        {
            text: 'Part D',
            anchorPoint: [0.25,-0.33,-0.2]
        },
        {
            text: 'Part E',
            anchorPoint: [0.12,0.1,0.01]
        },
        {
            text: 'Part F',
            anchorPoint: [0,-0.05,0.01]
        }
    ]

    annotationState:Map<Annotation, {
        spring: CANNON.Spring,
        anchorBody: CANNON.Body,
        annotationBody: CANNON.Body,
        anchorObject: THREE.Object3D,
        contentObject: THREE.Mesh,
        annotationObject: THREE.Object3D,
        lineDepthWriting: THREE.Line,
        line: THREE.Line
    }> = new Map

    facing = new AdaptiveProperty({
        metric: () => this.app.cameraCenteredMetrics.getVisualAngleOf(this.targetObject),
        zones: [
            {state:'true', threshold:Math.PI/16, delay:100},
            Math.PI/3, 
            {state:'false', threshold:Math.PI/16, delay:100}
        ]
    })

    visualSize = new AdaptiveProperty({
        metric: () => this.app.cameraCenteredMetrics.getVisualSizeOf(this.targetObject),
        zones: [
            {state:'small', threshold:Math.PI/8, delay:100}, 
            Math.PI/8, 
            {state:'medium', threshold:Math.PI/8, delay:100}, 
            Math.PI/4, 
            {state:'large', threshold:Math.PI/8, delay:100}
        ]
    })

    annotationOcclusions = new AdaptiveProperty({
        metric: () => this.physicsWorld.contacts.length,
        zones: [
            {state:'few', threshold:0, delay:100}, 
            this.annotations.length, 
            {state:'many', threshold:0, delay:100}
        ]
    })

    cameraLinearSpeed = new AdaptiveProperty({
        metric: () => this.cameraTargetKinematics.linearSpeed,
        zones: [
            {state:'still', threshold:0.05, delay:400}, 
            0.15, 
            {state:'moving', threshold:0.01, delay:100}
        ]
    })

    cameraAngularSpeed = new AdaptiveProperty({
        metric: () => this.cameraTargetKinematics.angularSpeed,
        zones: [
            {state:'still', threshold:THREE.Math.degToRad(1), delay:400}, 
            THREE.Math.degToRad(360/10), 
            {state:'moving', threshold:THREE.Math.degToRad(1), delay:100}
        ]
    })

    state = new AdaptiveProperty.CompositeState<SnubberExampleA>(this)

    treadmillObject?:THREE.Object3D

    stlLoader = new window['THREE'].STLLoader()
    snubberMeshPromise:Promise<THREE.Mesh>

    physicsWorld = new CANNON.World

    CENTRAL_REPULSION_FORCE = 20
    VIEW_DEPENDENT_REPULSION_FORCE = 40
    ANNOTATION_REPULSION_FACTOR = 0.4
    VIEW_DEPENDENT_ANNOTATION_REPULSION_FACTOR = 0.5
    
    constructor(public app:App) {

        this.annotationViewpoint.position.set(0,0,2)
        this.targetObject.add(this.annotationViewpoint)
        
        this.snubberMeshPromise = new Promise((resolve) => {
            this.stlLoader.load('/resources/fullSnubberSimplified.stl', (snubberGeometry) => {
                const snubberMaterial = new THREE.MeshNormalMaterial()
                const snubberMesh = new THREE.Mesh(snubberGeometry, snubberMaterial)
                // snubberMesh.position.set(0.3, -0.7, 0.1)
                // snubberMesh.scale.set(0.001,0.001,0.001)
                snubberMesh.scale.set(0.002,0.002,0.002)
                resolve(snubberMesh)
            })
        })
        
        // Create a physics bodies for each annotation
        for (const annotation of this.annotations) {
            const annotationObject = new THREE.Object3D()
            const contentObject = makeTextSprite(annotation.text, {pixelRatio: window.devicePixelRatio/2})
            annotationObject.add(contentObject)
            this.app.scene.add(annotationObject)

            const anchorObject = new THREE.Object3D()
            anchorObject.position.set(...annotation.anchorPoint)
            this.targetObject.add(anchorObject)

            const canvas = (contentObject.material as any).map.image
            const anchorBody = new CANNON.Body({
                mass:0,
                position: new CANNON.Vec3(0,0,0).set(...annotation.anchorPoint)
            })
            anchorBody.collisionResponse = false
            const annotationBody = new CANNON.Body({
                mass: 1,
                position: new CANNON.Vec3(0,0,0).set(...annotation.anchorPoint),
                shape: new CANNON.Box(new CANNON.Vec3(canvas.width*0.01, canvas.height*0.01, 1)),
                linearDamping: 1,
                angularDamping: 1,
            })
            annotationBody.collisionResponse = false
            this.physicsWorld.addBody(annotationBody)
            this.physicsWorld.addBody(anchorBody)

            const spring:CANNON.Spring = new (<any>CANNON.Spring)(anchorBody, annotationBody, <CANNON.ISpringOptions>{
                restLength: 0.15,
                stiffness: 200,
                damping: 1
            })

            const lineGeometry = new THREE.Geometry()
            lineGeometry.vertices.push(new THREE.Vector3)
            lineGeometry.vertices.push(new THREE.Vector3)
            const lineMaterial = new THREE.LineBasicMaterial( { color: Math.random() * 0xffffff, linewidth: 3 } );
            const line = new THREE.Line(lineGeometry, lineMaterial)
            lineMaterial.depthWrite = false
            line.frustumCulled = false
            this.app.scene.add(line)

            const lineGeometry2 = new THREE.Geometry()
            lineGeometry2.vertices.push(new THREE.Vector3)
            lineGeometry2.vertices.push(new THREE.Vector3)
            const lineMaterial2 = lineMaterial.clone()
            const lineDepthWriting = new THREE.Line(lineGeometry2, lineMaterial2)
            lineMaterial2.depthWrite = true
            lineDepthWriting.frustumCulled = false
            this.app.scene.add(lineDepthWriting)

            this.annotationState.set(annotation, {
                spring,
                anchorBody,
                annotationBody,
                anchorObject,
                contentObject,
                annotationObject,
                lineDepthWriting,
                line,
            })
        }

        app.scene.addEventListener('update', (event:any) => {

            this.updateAnnotations(event.deltaTime)
            this.cameraTargetKinematics.update(event.deltaTime)
            this.state.update(event.deltaTime)

            if (this.facing.changingTo('false')) {
                console.log('facing: false')
            } 
            
            if (this.facing.changingTo('true')) {
                console.log('facing: true')
            }
            
            if (this.visualSize.changingTo('small')) {
                console.log('visualSize: small')
            }
            
            if (this.visualSize.changingTo('medium')) {
                console.log('visualSize: medium')
            }
            
            if (this.visualSize.changingTo('large')) {
                console.log('visualSize: large')
            }

            if (this.cameraLinearSpeed.changingTo('still')) {
                console.log(`linear speed: still`)
            }
            if (this.cameraAngularSpeed.changingTo('still')) {
                console.log(`angular speed: still`)
            }

            if (this.cameraLinearSpeed.changingTo('moving')) {
                console.log(`linear speed: moving`)
            }
            if (this.cameraAngularSpeed.changingTo('moving')) {
                console.log(`angular speed: moving`)
            }
            
            // if (this.state.changingTo({cameraLinearSpeed:'still', cameraAngularSpeed:'still'})) {
                // console.log(`total speed: still`)
                this.targetObject.updateMatrixWorld(false)
                const worldToTargetSpace = this._scratchMatrix.getInverse(this.targetObject.matrixWorld)
                this.annotationViewpoint.copy(this.app.camera)
                this.annotationViewpoint.applyMatrix(worldToTargetSpace)
            // }
        })

        app.scene.addEventListener('xr-start', async (event:any) => {
            const vuforia = event.vuforia
            if (!vuforia) return
            
            const dataSetId = await vuforia.fetchDataSet('/resources/Treadmill.xml')
            const trackables = await vuforia.loadDataSet(dataSetId)
            
            const treadmillAnchor = trackables.get('treadmill')
            this.treadmillObject = this.app.getXRObject3D(treadmillAnchor)
            this.treadmillObject.add(this.targetObject)
        
            // Add a box to the trackable image
            const imageSize = treadmillAnchor.size
            const box = new THREE.Mesh(
                new THREE.BoxGeometry(imageSize.x, imageSize.y, 0.001),
                new THREE.MeshPhongMaterial({ 
                    color: '#DDFFDD', 
                    opacity:0.5,
                    transparent:true,
                })
            )
            this.treadmillObject.add(box)
            
            // scale the target object based on image size
            this.targetObject.scale.setScalar(imageSize.x)

            // Add snubber mesh
            this.targetObject.add(await this.snubberMeshPromise)

            vuforia.activateDataSet(dataSetId)
        })
    }

    _force = new CANNON.Vec3
    _cameraWorldPosition = new THREE.Vector3
    _directionA = new THREE.Vector3
    _directionB = new THREE.Vector3

    updateAnnotations(deltaTime:number) {

        // this.physicsWorld.step(1/60, deltaTime, 5)
        this.physicsWorld.step(deltaTime * 2)

        this.targetObject.updateMatrixWorld(false)
        const cameraWorldPosition = this.app.camera.getWorldPosition(this._cameraWorldPosition)

        for (const annotation of this.annotations) {
            
            const state = this.annotationState.get(annotation)
            const body = state.annotationBody
            const anchorBody = state.anchorBody

            // update annotation pose
            const annotationObject = state.annotationObject
            annotationObject.position.copy(<any>body.position)
            annotationObject.quaternion.copy(<any>body.quaternion)
            annotationObject.scale.setScalar(0.3)
            annotationObject.updateMatrix()
            annotationObject.applyMatrix(this.targetObject.matrixWorld)
            annotationObject.lookAt(cameraWorldPosition)

            // update line
            const line = state.line;
            const lineGeometry = line.geometry as THREE.Geometry
            const anchorObject = state.anchorObject
            anchorObject.getWorldPosition(lineGeometry.vertices[0])
            annotationObject.getWorldPosition(lineGeometry.vertices[1])
            lineGeometry.verticesNeedUpdate = true
            const lineDepthWriting = state.lineDepthWriting
            const lineDepthWritingGeometry = lineDepthWriting.geometry as THREE.Geometry
            lineDepthWritingGeometry.vertices[0].copy(lineGeometry.vertices[0])
            lineDepthWritingGeometry.vertices[1].copy(lineGeometry.vertices[0])
            lineDepthWritingGeometry.vertices[1].lerp(lineGeometry.vertices[1], 0.5)
            lineDepthWritingGeometry.verticesNeedUpdate = true
 
            // apply spring force from anchor point
            state.spring.applyForce()

            // apply global repulsion force away from target center
            const repulsionForce = this._force
            repulsionForce.copy(anchorBody.position).normalize()
            repulsionForce.mult(this.CENTRAL_REPULSION_FORCE, repulsionForce)
            body.applyForce(repulsionForce, body.position)

            // apply view-dependent global repulsion force
            const targetDirection = this.annotationViewpointMetrics.getDirectionOf(this.targetObject, this._directionA)
            const anchorDirection = this.annotationViewpointMetrics.getDirectionOf(state.anchorObject, this._directionB)
            repulsionForce.copy(<any>anchorDirection).vsub(<any>targetDirection, repulsionForce)
            repulsionForce.normalize()
            repulsionForce.scale(this.VIEW_DEPENDENT_REPULSION_FORCE, repulsionForce)
            body.applyForce(repulsionForce, body.position)

            // apply repulsion forces between annotations            
            const annotationDirection = this.annotationViewpointMetrics.getDirectionOf(annotationObject, this._directionA)
            for (const otherAnnotation of this.annotations) {
                if (annotation === otherAnnotation) continue
                const otherState = this.annotationState.get(otherAnnotation)
                const otherBody = otherState.annotationBody

                // apply distance-based repulsion force between annotations
                let linearDistance = body.position.distanceTo(otherBody.position)
                if (linearDistance > 0) {
                    body.position.vsub(otherBody.position, repulsionForce)
                    repulsionForce.normalize()
                    // linearDistance = Math.max(linearDistance, 0.01)
                    repulsionForce.scale(body.mass * otherBody.mass * this.ANNOTATION_REPULSION_FACTOR / (linearDistance), repulsionForce)
                    body.applyForce(repulsionForce, body.position)
                }

                // apply view-dependent distance-based repulsion force between annotations
                const otherAnnotationDirection = this.annotationViewpointMetrics.getDirectionOf(otherState.annotationObject, this._directionB)
                let angularDistance = annotationDirection.angleTo(otherAnnotationDirection)
                if (angularDistance > 0) {
                    repulsionForce.copy(<any>annotationDirection).vsub(<any>otherAnnotationDirection, repulsionForce)
                    repulsionForce.normalize()
                    // angularDistance = Math.max(angularDistance, 0.1)
                    repulsionForce.scale(body.mass * otherBody.mass * this.VIEW_DEPENDENT_ANNOTATION_REPULSION_FACTOR / (angularDistance), repulsionForce)
                    body.applyForce(repulsionForce, body.position)
                }
            }

        }

    }

}