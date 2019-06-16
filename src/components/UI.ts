import * as THREE from 'three'

import App, {UpdateEvent} from '@/App'
import Pride from '../lib/PRIDEClient'
import WebLayer3D from 'three-web-layer'
import Treadmill from './Treadmill'
import InstructionPanel from './InstructionPanel.vue'
import {vectors2, Q_IDENTITY} from '@/lib/SpatialUtils'
import {SpatialMetrics} from '@/lib/SpatialMetrics'
import {SpatialLayout} from '@/lib/SpatialLayout'
import {SpatialTransformer as SpatialTransformer} from '@/lib/SpatialTransitioner'
// import {SpatialPlacement, CameraSurface} from '@/lib/SpatialPlacement'
import AdaptiveProperty from '@/lib/AdaptiveProperty'

export default class UI {

    augmentations: {[name: string]: THREE.Object3D} = {}

    instructionPanelVue = new InstructionPanel({
        data: this.pride.data,
    }).$mount()

    instructionPanel = new WebLayer3D( this.instructionPanelVue.$el, {
        windowWidth: 300, pixelRatio: 3, layerSeparation: 0.001
    })
    procedure = this.instructionPanel.getObjectByName('procedure')! as WebLayer3D
    step = this.instructionPanel.getObjectByName('step')! as WebLayer3D
    instruction = this.instructionPanel.getObjectByName('instruction')! as WebLayer3D
    image = this.instructionPanel.getObjectByName('image')! as WebLayer3D
    video = this.instructionPanel.getObjectByName('video')! as WebLayer3D

    // doneButton = new HTMLElement3D('')
    // skipButton = new HTMLElement3D('')
    // clearButton = new HTMLElement3D('')
    // yesButton = new HTMLElement3D('')
    // noButton = new HTMLElement3D('')
    // commentButton = new HTMLElement3D('')

    snubberVisualSize = new AdaptiveProperty({
        metric: () => SpatialMetrics.get(this.app.camera).getVisualFrustumOf(this.treadmill.snubberObject!).diagonal,
        zones: [
            {state: 'small', threshold: 15, delay: 100},
            40,
            {state: 'large', threshold: 15, delay: 100},
        ],
    })

    treadmillDirection = new AdaptiveProperty({
        metric: () => SpatialMetrics.get(this.app.camera).getVisualOffsetOf(this.treadmill.treadmillObject!),
        zones: [
            {state: 'left', threshold: 15, delay: 100},
            -60,
            {state: 'forward', threshold: 15, delay: 100},
            60,
            {state: 'right', threshold: 15, delay: 100},
        ],
    })

    box = new THREE.BoxHelper(this.instructionPanel)

    constructor(private app: App, private pride:Pride, private treadmill: Treadmill) {

        // this.treadmill.snubberObject.add(
        // app.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), 0.1)

        let transformer = SpatialTransformer.get(this.instructionPanel)
        transformer.parent = app.camera
        transformer.align.set(0,0,-0.1)
        transformer.origin.set(0,0,-1)
        transformer.size.set(0.5, NaN, NaN)
        this.instructionPanel.layout!.align.copy(transformer.align)
        this.instructionPanel.layout!.origin.copy(transformer.origin)


        // transformer = SpatialTransformer.get(this.video)
        // transformer.parent = app.camera
        // transformer.align.set(-1,1,-0.1)
        // transformer.origin.set(-1,1,-1)
        // transformer.size.set(1, NaN, NaN)


        const axes = new THREE.AxesHelper(0.1)
        axes.layout = new SpatialLayout()
        axes.layout!.align.set(0,-1,0)
        axes.layout!.origin.set(-1,-1,-1)
        axes.layout!.size.set(1,1,1)
        this.instructionPanel.add(axes)

        setInterval(() => this.pride.get(), 5000)


        var radius = 100;
        var segments = 50;
        var rings = 30;

        var geometry = new THREE.SphereGeometry(radius, segments, rings);
        var material = new THREE.MeshBasicMaterial({
            color: 0xF3A2B0,
            wireframe: true
        });
        var sphere = new THREE.Mesh(geometry, material);
        app.camera.add(sphere);

        // Argon quirk (tofix): move outside of body so it is visible in XR mode
        document.documentElement.appendChild(this.instructionPanelVue.$el.parentElement!)

        this.prepare()
    }

    async prepare() {
        const result = await this.pride.get()
        // const steplist = result.procedureElementInfo.steplist
        // this.instructionPanel.vue.step = steplist[steplist.length - 1].title
        // this.instructionPanel.vue.instruction = result.text
    }

    update(event: UpdateEvent) {

        const prideObjects = this.pride.data.objects
        for (const name in prideObjects) {
            const prideObject = prideObjects[name]
            let augmentation = this.augmentations[name]
            if (!augmentation) {
                switch (prideObject.type) {
                    case 'box':
                        const size = prideObject.size
                        augmentation = new THREE.Mesh(new THREE.BoxGeometry(
                            size.x * 0.01,
                            size.y * 0.01,
                            size.z * 0.01,
                        ))
                        break
                    case 'sphere':
                        augmentation = new THREE.Mesh(new THREE.SphereGeometry(prideObject.radius * 0.01))
                        break
                    default:
                        augmentation = new THREE.Object3D
                        break
                }
                this.augmentations[name] = augmentation
            }
            augmentation.position.copy(prideObject.position as any).multiplyScalar(0.01)
            augmentation.rotation.x = prideObject.rotation.x * THREE.Math.DEG2RAD
            augmentation.rotation.y = prideObject.rotation.y * THREE.Math.DEG2RAD
            augmentation.rotation.z = prideObject.rotation.z * THREE.Math.DEG2RAD
        }

        // for (const name in this.augmentations) {
        //     const augmentation = this.augmentations[name]
        //     if (prideObjects[name]) {
        //         this.snubber.snubberObject.add(augmentation)
        //     } else {
        //         this.snubber.snubberObject.remove(augmentation)
        //     }
        // }

        const lerpFactor = THREE.Math.clamp(event.deltaTime * 5, 0, 1)


        this.snubberVisualSize.update(event.deltaTime)
        this.treadmillDirection.update(event.deltaTime)
        
        // SpatialTransitioner.get(this.video).update(lerpFactor)
        SpatialTransformer.get(this.instructionPanel).update(lerpFactor)

        if (this.treadmillDirection.is('forward')) {
            this.instructionPanel.contentTargetOpacity = 0
            this.video.target.position.setScalar(0)

            let transformer = SpatialTransformer.get(this.video)
            transformer.position.setScalar(0)
            transformer.quaternion.set(0,0,0,1)
            transformer.scale.setScalar(1)
            transformer.align.setScalar(0)
            transformer.origin.setScalar(0)
            transformer.size.setScalar(0.5)
            transformer.parent = this.treadmill.treadmillObject
            transformer.update(lerpFactor)

            SpatialTransformer.get(this.procedure).update(lerpFactor)
        } else {
            let transformer = SpatialTransformer.get(this.video)
            transformer.parent = this.video.parentLayer!
            transformer.position.copy(this.video.target.position)
            transformer.quaternion.copy(this.video.target.quaternion)
            transformer.scale.copy(this.video.target.scale)
            transformer.align.setScalar(NaN)
            transformer.origin.setScalar(NaN)
            transformer.size.setScalar(NaN)
            transformer.update(lerpFactor)

            transformer = SpatialTransformer.get(this.procedure)
            transformer.parent = this.procedure.parentLayer!
            transformer.align.setScalar(NaN)
            transformer.origin.setScalar(NaN)
            transformer.size.setScalar(NaN)
            transformer.update(lerpFactor)
        }

        this.instructionPanel.update(lerpFactor)

        // const videoLayer = this.instructionPanel.getObjectByName('video') as WebLayer3D
        // if (videoLayer) {
        //     const videoEl = (videoLayer.element as HTMLVideoElement)
        //     // if (videoEl.paused) videoEl.play()
        // }

        // if (this.snubberVisualSize.is('large')) {

        //     SpatialLayout.setParent(this.instructionPanel, this.app.camera)
        //     this.instructionPanel.position.lerp(vec.set(0,0,0), lerpFactor)
        //     this.instructionPanel.quaternion.slerp(Q_IDENTITY, lerpFactor)
        //     this.instructionPanel.layout!.align.lerp(vec.set(-1,0,-0.5), lerpFactor)
        //     this.instructionPanel.layout!.origin.lerp(vec.set(-1,0,-1), lerpFactor)
    
        // } else {
        //     // if far, attach UI to world
        //     SpatialLayout.setParent(this.instructionPanel, this.treadmill.treadmillObject)
        //     this.instructionPanel.position.lerp(vec.set(0,0,0), lerpFactor)
        //     this.instructionPanel.quaternion.slerp(Q_IDENTITY, lerpFactor)
        // }
    }

    // proceedToNextStep(step) {
    //     this.procedureTitle.object = replaceObject(
    //         this.procedureTitle.object,
    //         makeTextSprite(step.procedureTitle, {})
    //     )
    // }

    attachToScreen() {
        const transitioner = SpatialTransformer.get(this.instructionPanel)
        transitioner.parent = this.app.camera
        transitioner.align.set(-1,0,-0.5)
        transitioner.origin.set(-1,0,-1)
        transitioner.size.set(NaN,1,NaN)
    }

    attachToWorld() {
        const transitioner = SpatialTransformer.get(this.instructionPanel)
        transitioner.parent = this.treadmill.snubberObject
        transitioner.align.set(0,0,1)
        transitioner.origin.set(0,0,0)
        transitioner.size.set(1,NaN,NaN)
    }
}