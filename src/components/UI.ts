import * as THREE from 'three'

import App, {UpdateEvent} from '@/App'
import WebLayer3D from 'three-web-layer'
import Treadmill from './Treadmill'
import PrideAPI from '../lib/PrideAPI'
import PrideVue from './Pride.vue'
import {vectors, vectors2, Q_IDENTITY, V_001} from '@/lib/SpatialUtils'
import {SpatialMetrics} from '@/lib/SpatialMetrics'
import {SpatialLayout} from '@/lib/SpatialLayout'
import {SpatialTransitioner as SpatialTransitioner} from '@/lib/SpatialTransitioner'
// import {SpatialPlacement, CameraSurface} from '@/lib/SpatialPlacement'
import AdaptiveProperty from '@/lib/AdaptiveProperty'
import { MeshBasicMaterial } from 'three';

const cursorGeometry = new THREE.SphereGeometry(0.008)

export default class UI {

    data = {
        pride: PrideAPI.data,
        xrMode: false
    }

    augmentations: {[name: string]: THREE.Object3D} = {}

    prideVue = new PrideVue({
        data: this.data
    }).$mount()

    pride = new WebLayer3D( this.prideVue.$el, {
        pixelRatio: 3, 
        layerSeparation: 0.0001,
        onLayerCreate: (layer) => {
            layer.layoutIgnore = true
            // layer.cursor.add(new THREE.Mesh(cursorGeometry))
            // layer.cursor.layoutIgnore = true
            // ;(layer.mesh.material as MeshBasicMaterial).depthTest = false
            // layer.mesh.onBeforeRender = function( renderer ) { renderer.clearDepth() }
        }
    })
    procedure = this.pride.getObjectByName('procedure')! as WebLayer3D
    step = this.pride.getObjectByName('step')! as WebLayer3D
    instruction = this.pride.getObjectByName('instruction')! as WebLayer3D
    content = this.pride.getObjectByName('content')! as WebLayer3D
    media = this.pride.getObjectByName('media')! as WebLayer3D
    image = this.pride.getObjectByName('image')! as WebLayer3D
    video = this.pride.getObjectByName('video')! as WebLayer3D
    model = this.pride.getObjectByName('model')! as WebLayer3D
    backButton = this.pride.getObjectByName('back') as WebLayer3D
    doneButton = this.pride.getObjectByName('done') as WebLayer3D
    yesButton = this.pride.getObjectByName('yes') as WebLayer3D
    noButton = this.pride.getObjectByName('no') as WebLayer3D
    xrButton = this.pride.getObjectByName('xr-toggle')! as WebLayer3D

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

        setTimeout(() => (this.video.element as HTMLVideoElement).play(), 5000)

        // this.treadmill.snubberObject.add(
        // app.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), 0.1)

        let transitioner = SpatialTransitioner.get(this.pride)
        transitioner.parent = app.camera
        transitioner.align.set(0,0,-0.5)
        transitioner.origin.set(0,0,-1)
        transitioner.size.set(NaN, 1, NaN)
        
        
        // SpatialLayout.getSizeToFit(this.p/ride, transitioner.size)
        this.pride.layout!.align.copy(transitioner.align)
        this.pride.layout!.origin.copy(transitioner.origin)
        this.pride.layout!.size.copy(transitioner.size)

        this.app.registerWebLayer(this.pride)

        this.backButton.element.addEventListener('click', async () => {
            await PrideAPI.back()
            PrideAPI.get()
        })

        this.doneButton.element.addEventListener('click', async () => {
            await PrideAPI.done()
            PrideAPI.get()
        })

        this.yesButton.element.addEventListener('click', async () => {
            await PrideAPI.done('yes')
            PrideAPI.get()
        })

        this.noButton.element.addEventListener('click', async () => {
            await PrideAPI.done('no')
            PrideAPI.get()
        })

        this.xrButton.element.addEventListener('click', async () => {
            this.data.xrMode = !this.data.xrMode
            this.app.enterXR()
        })


        // transformer = SpatialTransformer.get(this.video)
        // transformer.parent = app.camera
        // transformer.align.set(-1,1,-0.1)
        // transformer.origin.set(-1,1,-1)
        // transformer.size.set(1, NaN, NaN)


        // const axes = new THREE.AxesHelper(0.1)
        // axes.layout = new SpatialLayout()
        // axes.layout!.align.set(0,-1,0)
        // axes.layout!.origin.set(-1,-1,-1)
        // axes.layout!.size.set(1,1,1)
        // this.pride.add(axes)



        // var radius = 100;
        // var segments = 50;
        // var rings = 30;

        // var geometry = new THREE.SphereGeometry(radius, segments, rings);
        // var material = new THREE.MeshBasicMaterial({
        //     color: 0xF3A2B0,
        //     wireframe: true,
        // });
        // var sphere = new THREE.Mesh(geometry, material);
        // app.camera.add(sphere);

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
        
        this.pride.options.autoRefresh = this.app.timeSinceLastResize > 500
        
        let transitioner = SpatialTransitioner.get(this.pride)
        // transitioner.align.set(0,0,this.data.xrMode ? -1 : -10)
        SpatialLayout.getSizeToFit(this.pride, transitioner.size)
        this.pride.contentTargetOpacity = this.data.xrMode ? 0 : 1
        transitioner.update(lerpFactor)


        // transitioner = SpatialTransitioner.get(this.pride.content)
        // transitioner.align.set(0,0,-100)
        // transitioner.origin.set(0,0,1)
        // transitioner.size.set(NaN, 1, NaN)
        // transitioner.update(lerpFactor)

        transitioner = SpatialTransitioner.get(this.treadmill.snubberObject)
        if (this.data.xrMode) { 
            transitioner.reset()
            transitioner.parent = this.treadmill.treadmillObject
            transitioner.position.copy(this.treadmill.snubberTargetPosition)
            transitioner.quaternion.setFromAxisAngle(V_001, Math.PI)
        } else {
            transitioner.reset()
            transitioner.parent = this.model
            SpatialLayout.getSizeToFit(this.treadmill.snubberObject, transitioner.size).multiplyScalar(0.8)
            transitioner.scale.set(1,1,0.3)
            transitioner.origin.set(0,0,-1)
        }
        transitioner.update(lerpFactor)

        transitioner = SpatialTransitioner.get(this.content)
        if (this.data.xrMode) {
            transitioner.reset()
            transitioner.parent = this.treadmill.treadmillObject
            transitioner.size.set(NaN,0.5,NaN)
            transitioner.quaternion.setFromAxisAngle(V_001, Math.PI)
        } else {
            transitioner.setFromObject(this.content.target)
            transitioner.parent = this.content.parentLayer!
        }
        transitioner.update(lerpFactor)

        // transitioner = SpatialTransitioner.get(this.instruction)
        // if (this.data.xrMode) {
        //     transitioner.reset()
        //     transitioner.parent = this.treadmill.snubberObject
        //     transitioner.origin.set(1,0,0)
        //     transitioner.align.set(-1,0,0)
        //     transitioner.size.set(NaN,1,NaN)
        // } else {
        //     transitioner.setFromObject(this.instruction.target)
        //     transitioner.parent = this.instruction.parentLayer!
        // }
        // transitioner.update(lerpFactor)


        // transitioner = SpatialTransitioner.get(this.media)
        // if (this.data.xrMode) {
        //     transitioner.reset()
        //     transitioner.parent = this.treadmill.snubberObject
        //     transitioner.origin.set(-1,0,0)
        //     transitioner.align.set(1,0,0)
        //     transitioner.size.set(NaN,1,NaN)
        // } else {
        //     transitioner.setFromObject(this.media.target)
        //     transitioner.parent = this.media.parentLayer!
        // }
        // transitioner.update(lerpFactor)

        if (this.treadmillDirection.is('forward')) {
        //     this.instructionPanel.contentTargetOpacity = 0

        //     let transition = SpatialTransitioner.get(this.video).reset()
        //     transition.parent = this.treadmill.treadmillObject
        //     transition.align.setScalar(0)
        //     transition.origin.setScalar(0)
        //     transition.size.setScalar(0.5)
        //     transition.update(lerpFactor)

        //     SpatialTransitioner.get(this.procedure).update(lerpFactor)
        } else {
        //     let transition = SpatialTransitioner.get(this.video)
        //     transition.setFromObject(this.video.target)
        //     transition.parent = this.video.parentLayer!
        //     transition.update(lerpFactor)

        //     transition = SpatialTransitioner.get(this.procedure).reset()
        //     transition.parent = this.procedure.parentLayer!
        //     transition.update(lerpFactor)
        }

        // this.video.shouldApplyTargetLayout = false
        // this.pride.traverseLayers(this._toggleLayoutBounds)
        
        this.pride.traverseChildLayers(this._setRenderOrder)
        this.pride.update(lerpFactor)
        // this.pride.update(lerpFactor, (layer, lerp) => {
        //     // layer.texture && (layer.bounds.width = layer.texture.image.videoWidth || layer.texture.image.width)
        //     // layer.texture && (layer.bounds.height = layer.texture.image.videoHeight || layer.texture.image.height)
            
        //     WebLayer3D.UPDATE_DEFAULT(layer, lerp)
        //     // layer.contentTarget.scale.set(
        //     //     layer.bounds.width * WebLayer3D.PIXEL_SIZE,
        //     //     layer.bounds.height * WebLayer3D.PIXEL_SIZE,
        //     //     1
        //     // )
        //     const parentLayer = layer.parentLayer
        //     if (parentLayer) {
        //         let layerSize = layer.userData.layerSize as THREE.Vector3
        //         let layerSizeTarget = layer.userData.layerSizeTarget as THREE.Vector3
        //         if (!layerSize) {
        //             layerSize = layer.userData.layerSize = new THREE.Vector3
        //             layerSize.x = layer.bounds.width / parentLayer.bounds.width || 10e-6
        //             layerSize.y = layer.bounds.height / parentLayer.bounds.height || 10e-6
        //             layerSize.z = 1
        //             layerSizeTarget = layer.userData.layerSizeTarget = new THREE.Vector3
        //         }
        //         layerSizeTarget.x = layer.bounds.width / parentLayer.bounds.width || 10e-6
        //         layerSizeTarget.y = layer.bounds.height / parentLayer.bounds.height || 10e-6
        //         layerSizeTarget.z = 1
        //         layerSize.lerp(layerSizeTarget, lerp)
        //         layer.content.scale.copy(layerSize)
        //         layer.content.scale.x *= parentLayer.content.scale.x
        //         layer.content.scale.y *= parentLayer.content.scale.y
        //         layer.content.scale.z = 1
        //         layer.content.scale.clampScalar(10e-6, Infinity)
        //     } else {
        //         layer.content.scale.lerp(layer.contentTarget.scale, lerp)
        //     }
        // })

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

    _toggleLayoutBounds(layer:WebLayer3D) {
        // layer.layoutIgnore = (layer.contentTargetOpacity === 0) 
    }

    _setRenderOrder(layer:WebLayer3D) {
        if (!layer.parentLayer) return
        const index = layer.parentLayer.childLayers.indexOf(layer)
        layer.mesh.renderOrder = layer.level + index*0.001
    }
}