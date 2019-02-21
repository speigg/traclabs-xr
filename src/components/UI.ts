import * as THREE from 'three/src/Three'

import App, {UpdateEvent} from '@/App'
import WebLayer3D from '@/lib/WebLayer3D'
import Treadmill from './Treadmill'
import InstructionPanel from './InstructionPanel.vue'
import { VisualDirection } from '@/lib/SpatialMetrics'
import AdaptiveProperty from '@/lib/AdaptiveProperty';

const ZERO = new THREE.Vector3
const IDENTITY = new THREE.Quaternion
const vec3 = new THREE.Vector3

export default class UI {

    augmentations: {[name: string]: THREE.Object3D} = {}

    // instructionPanelRoot = new THREE.Object3D
    instructionPanel = new WebLayer3D(new InstructionPanel({
        data: this.app.pride,
    }), {
        windowWidth: 300, pixelRatio: 3, layerSeparation: 0.01,
    })

    // doneButton = new HTMLElement3D('')
    // skipButton = new HTMLElement3D('')
    // previousButton = new HTMLElement3D('')
    // clearButton = new HTMLElement3D('')
    // yesButton = new HTMLElement3D('')
    // noButton = new HTMLElement3D('')
    // commentButton = new HTMLElement3D('')

    constructor(public app: App, public treadmill: Treadmill) {

        setInterval(() => app.pride.get(), 5000)

        // app.camera.add(this.procedureTitle.screenAnchor)
        // snubber.object.add(this.procedureTitle.worldAnchor)
        // snubber.object.add(this.instructionPanel)

        app.scene.add(this.instructionPanel)
        // this.instructionPanelRoot.add(this.instructionPanel)
        // this.instructionPanel.position.z = 0.2

        this.prepare()
    }

    async prepare() {
        const result = await this.app.pride.get()
        // const steplist = result.procedureElementInfo.steplist
        // this.instructionPanel.vue.step = steplist[steplist.length - 1].title
        // this.instructionPanel.vue.instruction = result.text
    }

    update(event: UpdateEvent) {

        const prideObjects = this.app.pride.objects
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

        const fovs = this.app.cameraMetrics.getFovs()

        // if (this.app.cameraMetrics.getVisualSizeOf(this.treadmill)) {
            
        // }

        this.instructionPanel.setToDOMLayout(true)
        this.app.cameraMetrics.setPositionFor(
            this.instructionPanel,
            new VisualDirection(0, 0),
            fovs.left + fovs.right,
        )
        this.app.cameraMetrics.setOrientationFor(
            this.instructionPanel,
        )
        // this.app.camera.getWorldPosition(_vec3)
        // this.snubber.object.getWorldPosition(vec3)
        // this.instructionPanel.position.copy(vec3)
        // this.instructionPanel.lookAt(_vec3)
        // this.updateElements()
        // layoutElement(this.app.scene, this.procedureTitle, event.deltaTime)
    }

    // updateElements() {
    //     const fovs = this.app.cameraFovs
    //     const facingSnubber = this.snubber.facing.is('true')
    //     if (facingSnubber) {
    //         this.procedureTitle.mode = 'world'
    //     } else {
    //         this.procedureTitle.mode = 'screen'
    //         this.app.cameraMetrics.computePositionFor(
    //             this.procedureTitle.object,
    //             this.procedureTitle.screenAnchor.position,
    //             fovs.left, fovs.top, fovs.right - fovs.left
    //         )
    //     }
    // }

    // proceedToNextStep(step) {
    //     this.procedureTitle.object = replaceObject(
    //         this.procedureTitle.object,
    //         makeTextSprite(step.procedureTitle, {})
    //     )
    // }
}

// function screenToCamera() {}

// function layoutElement(scene:THREE.Scene, element:HTMLElement3D, deltaTime:number) {
//     const anchor = getElementAnchor(element)
//     ensureObjectPlacement(this.app.scene, element.object, anchor)
//     const alpha = element.modeTransitionSpeedFactor * deltaTime
//     element.object.position.lerp(ZERO, alpha)
//     element.object.quaternion.slerp(IDENTITY, alpha)
// }

function replaceObject<T extends THREE.Object3D>(a: THREE.Object3D, b: T): T {
    a.parent!.add(b)
    a.parent!.remove(a)
    return b
}

function ensureObjectPlacement(scene: THREE.Scene, object: THREE.Object3D, parent: THREE.Object3D) {
    if (object.parent === parent) { return }
    THREE.SceneUtils.detach(object, object.parent!, scene)
    THREE.SceneUtils.attach(object, scene, parent)
}

// function getElementAnchor(element:Element) {
//     return element.anchor === 'world' ? element.worldAnchor : element.screenAnchor
// }
