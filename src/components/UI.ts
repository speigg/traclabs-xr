import * as THREE from 'three'

import App, {UpdateEvent} from '@/App'
import WebLayer3D from 'three-web-layer'
import Treadmill from './Treadmill'
import PrideAPI from '../lib/PrideAPI'
import PrideVue from './Pride.vue'
import {vectors2, Q_IDENTITY} from '@/lib/SpatialUtils'
import {SpatialMetrics} from '@/lib/SpatialMetrics'
import {SpatialLayout} from '@/lib/SpatialLayout'
import {SpatialTransitioner as SpatialTransitioner} from '@/lib/SpatialTransitioner'
// import {SpatialPlacement, CameraSurface} from '@/lib/SpatialPlacement'
import AdaptiveProperty from '@/lib/AdaptiveProperty'

export default class UI {

    augmentations: {[name: string]: THREE.Object3D} = {}

    prideVue = new PrideVue({
        data: PrideAPI.data,
    }).$mount()

    pride = new WebLayer3D( this.prideVue.$el, {
        windowWidth: 300, pixelRatio: 3, layerSeparation: 0.001
    })
    procedure = this.pride.getObjectByName('procedure')! as WebLayer3D
    step = this.pride.getObjectByName('step')! as WebLayer3D
    instruction = this.pride.getObjectByName('instruction')! as WebLayer3D
    image = this.pride.getObjectByName('image')! as WebLayer3D
    video = this.pride.getObjectByName('video')! as WebLayer3D
    xrButton = this.pride.getObjectByName('xr')! as WebLayer3D

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

    box = new THREE.BoxHelper(this.pride)

    constructor(private app: App, private treadmill: Treadmill) {

        const containerElement = this.prideVue.$el.parentElement!
        // Argon quirk (tofix): move outside of body so it is visible in XR mode
        document.documentElement.appendChild(containerElement)
        // make it dynmically resize
        containerElement.style.width = '100%'
        containerElement.style.height = '100%'

        // this.treadmill.snubberObject.add(
        // app.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), 0.1)

        let transformer = SpatialTransitioner.get(this.pride)
        transformer.parent = app.camera
        transformer.align.set(0,0,-0.1)
        transformer.origin.set(0,0,-1)
        transformer.size.set(NaN, 1, NaN)
        this.pride.layout!.align.copy(transformer.align)
        this.pride.layout!.origin.copy(transformer.origin)
        this.pride.layout!.size.copy(transformer.size)


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
        this.pride.add(axes)



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

        this.prepare()
    }

    async prepare() {
        const result = await PrideAPI.get()
        // const steplist = result.procedureElementInfo.steplist
        // this.instructionPanel.vue.step = steplist[steplist.length - 1].title
        // this.instructionPanel.vue.instruction = result.text
    }

    update(event: UpdateEvent) {

        const prideObjects = PrideAPI.data.objects
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
        
        
        SpatialTransitioner.get(this.pride).update(lerpFactor)

        // if (this.treadmillDirection.is('forward')) {
        //     this.instructionPanel.contentTargetOpacity = 0

        //     let transition = SpatialTransitioner.get(this.video).reset()
        //     transition.parent = this.treadmill.treadmillObject
        //     transition.align.setScalar(0)
        //     transition.origin.setScalar(0)
        //     transition.size.setScalar(0.5)
        //     transition.update(lerpFactor)

        //     SpatialTransitioner.get(this.procedure).update(lerpFactor)
        // } else {
        //     let transition = SpatialTransitioner.get(this.video)
        //     transition.setFromObject(this.video.target)
        //     transition.parent = this.video.parentLayer!
        //     transition.update(lerpFactor)

        //     transition = SpatialTransitioner.get(this.procedure).reset()
        //     transition.parent = this.procedure.parentLayer!
        //     transition.update(lerpFactor)
        // }

        // this.video.shouldApplyTargetLayout = false
        this.pride.update(lerpFactor)

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
        const transitioner = SpatialTransitioner.get(this.pride)
        transitioner.parent = this.app.camera
        transitioner.align.set(-1,0,-0.5)
        transitioner.origin.set(-1,0,-1)
        transitioner.size.set(NaN,1,NaN)
    }

    attachToWorld() {
        const transitioner = SpatialTransitioner.get(this.pride)
        transitioner.parent = this.treadmill.snubberObject
        transitioner.align.set(0,0,1)
        transitioner.origin.set(0,0,0)
        transitioner.size.set(1,NaN,NaN)
    }
}