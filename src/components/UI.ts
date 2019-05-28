import * as THREE from 'three'

import App, {UpdateEvent} from '@/App'
import Pride from '../lib/PRIDEClient'
import WebLayer3D from 'three-web-layer'
import Treadmill from './Treadmill'
import InstructionPanel from './InstructionPanel.vue'
import {Q_IDENTITY} from '@/lib/SpatialUtils'
import {SpatialMetrics} from '@/lib/SpatialMetrics'
import {SpatialLayout} from '@/lib/SpatialLayout'
import {SpatialTransitioner} from '@/lib/SpatialTransitioner'
// import {SpatialPlacement, CameraSurface} from '@/lib/SpatialPlacement'
import AdaptiveProperty from '@/lib/AdaptiveProperty'

export default class UI {

    augmentations: {[name: string]: THREE.Object3D} = {}

    instructionPanelVue = new InstructionPanel({
        data: this.pride.data,
    }).$mount()

    instructionPanel = new WebLayer3D( this.instructionPanelVue.$el, {
        windowWidth: 300, pixelRatio: 3, layerSeparation: 0.001,
    })

    instructionPanelTransitioner = new SpatialTransitioner(this.instructionPanel)
    // procedureTransitioner = new SpatialTransitioner(this.instructionPanel.getObjectByName('procedure')!)

    snubberVisualSize = new AdaptiveProperty({
        metric: () => SpatialMetrics.get(this.app.camera).getVisualFrustumOf(this.treadmill.snubberObject!).diagonal,
        zones: [
            {state: 'small', threshold: 15, delay: 100},
            40,
            {state: 'large', threshold: 15, delay: 100},
        ],
    })

    box = new THREE.BoxHelper(this.instructionPanel)

    // doneButton = new HTMLElement3D('')
    // skipButton = new HTMLElement3D('')
    // previousButton = new HTMLElement3D('')
    // clearButton = new HTMLElement3D('')
    // yesButton = new HTMLElement3D('')
    // noButton = new HTMLElement3D('')
    // commentButton = new HTMLElement3D('')

    constructor(private app: App, private pride:Pride, private treadmill: Treadmill) {

        setInterval(() => this.pride.get(), 5000)
        this.treadmill.snubberObject.add(this.instructionPanel)

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

        // this.pride.data.instruction = JSON.stringify(fovs, null, '\n')
        // if (this.app.cameraMetrics.getVisualSizeOf(this.treadmill)) {
        // }

        const lerpFactor = THREE.Math.clamp(event.deltaTime * 8, 0, 1)


        this.snubberVisualSize.update(lerpFactor)

        this.instructionPanel.update(lerpFactor)
        this.instructionPanelTransitioner.update(lerpFactor)

        // const cameraFrustum = SpatialMetrics.get(this.app.camera).getVisualFrustum()
        // const {horizontal, vertical} = cameraFrustum
        // this.pride.data.instruction = JSON.stringify({horizontal,vertical},null,' ')

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

        // SpatialUtils.vectors.pool(offset)


        // this.app.cameraMetrics.setOrientationFor(
        //     this.instructionPanel,
        // )
        // this.instructionPanel.lookAt(this.app.camera.getWorldPosition(new THREE.Vector3))
        // this.app.camera.getWorldPosition(_vec3)
        // this.snubber.object.getWorldPosition(vec3)
        // this.instructionPanel.position.copy(vec3)
        // this.instructionPanel.lookAt(_vec3)
        // this.updateElements()
        // layoutElement(this.app.scene, this.procedureTitle, event.deltaTime)
    }

    // proceedToNextStep(step) {
    //     this.procedureTitle.object = replaceObject(
    //         this.procedureTitle.object,
    //         makeTextSprite(step.procedureTitle, {})
    //     )
    // }

    attachToScreen() {
        this.instructionPanelTransitioner.parent = this.app.camera
        this.instructionPanelTransitioner.position.set(0,0,0)
        this.instructionPanelTransitioner.quaternion.copy(Q_IDENTITY)
        this.instructionPanelTransitioner.scale.set(1,1,1)
        this.instructionPanelTransitioner.align.set(-1,0,-0.5)
        this.instructionPanelTransitioner.origin.set(-1,0,-1)
    }

    attachToWorld() {
        this.instructionPanelTransitioner.parent = this.treadmill.snubberObject
        this.instructionPanelTransitioner.position.set(0,0,0)
        this.instructionPanelTransitioner.quaternion.copy(Q_IDENTITY)
        this.instructionPanelTransitioner.scale.set(1,1,1)
        this.instructionPanelTransitioner.align.set(-1,0,1.5)
        this.instructionPanelTransitioner.origin.set(1,0,0)
    }
}