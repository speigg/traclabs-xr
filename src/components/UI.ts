import * as THREE from 'three'

import App, {UpdateEvent} from '@/App'
import WebLayer3D from 'three-web-layer'
import Treadmill from './Treadmill'
import PrideAPI from '../lib/PrideAPI'
import PrideVue from './Pride.vue'
import {vectors, vectors2, Q_IDENTITY, V_001} from '@/lib/SpatialUtils'
import {SpatialMetrics} from '@/lib/SpatialMetrics'
import {SpatialLayout} from '@/lib/SpatialLayout'
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
            layer.layout.forceBoundsExclusion = true
            layer.shouldApplyTargetLayout = false
            const refresh = layer['_refreshTargetLayout']
            layer['_refreshTargetLayout'] = () => {
                refresh.call(layer)
                if (layer.parentLayer && layer.parentLayer === layer.parent) {
                    layer.layout.target.reset()
                    layer.layout.target.parent = layer.parentLayer || undefined
                    layer.layout.target.position.copy(layer.target.position)
                    layer.layout.target.quaternion.copy(layer.target.quaternion)
                    layer.layout.target.scale.copy(layer.target.scale)
                }
            }
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

    xrMode = new AdaptiveProperty({
        metric: () => +this.data.xrMode,
        zones: [
            {state: 'false'},  
            0.5, 
            {state: 'true'}
        ]
    })

    snubberVisualSize = new AdaptiveProperty({
        metric: () => SpatialMetrics.get(this.app.camera).getVisualFrustumOf(this.treadmill.snubberObject!).diagonal,
        zones: [
            {state: 'small', threshold: 15, delay: 100},
            40,
            {state: 'large', threshold: 15, delay: 100},
        ],
    })

    snubberDirection = new AdaptiveProperty({
        metric: () => SpatialMetrics.get(this.app.camera).getVisualOffsetOf(this.treadmill.snubberObject!),
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

        // ;(this.media.mesh.material as MeshBasicMaterial).transparent = false
        // ;(this.instruction.mesh.material as MeshBasicMaterial).transparent = false
        // ;(this.video.mesh.material as MeshBasicMaterial).transparent = false
        
        setTimeout(() => (this.video.element as HTMLVideoElement).play(), 5000)

        // this.treadmill.snubberObject.add(
        // app.camera.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), 0.1)

        // let transitioner = SpatialTransitioner.get(this.pride)
        // transitioner.parent = app.camera
        // transitioner.align.set(0,0,-0.5)
        // transitioner.origin.set(0,0,-1)
        // transitioner.size.set(NaN, 1, NaN)
        this.pride.layout.target.parent = app.camera
        this.pride.layout.target.align.set(0,0,-0.5)
        this.pride.layout.target.origin.set(0,0,-1)
        this.pride.layout.target.size.set(NaN, 1, NaN)
        this.pride.layout.update(1)
        
        
        // SpatialLayout.getSizeToFit(this.p/ride, transitioner.size)
        // this.pride.layout!.align.copy(transitioner.align)
        // this.pride.layout!.origin.copy(transitioner.origin)
        // this.pride.layout!.size.copy(transitioner.size)
        

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


        this.xrMode.update(event.deltaTime)
        this.snubberVisualSize.update(event.deltaTime)
        this.snubberDirection.update(event.deltaTime)
        
        // only refresh the UI if it's been more than 500ms since the last window resize
        this.pride.options.autoRefresh = this.app.timeSinceLastResize > 500
        
        // size the UI to fit the screen
        SpatialLayout.getSizeToFit(this.pride, this.pride.layout.target.size)
        // this.pride.contentTargetOpacity = this.data.xrMode ? 0 : 1
        this.pride.contentTargetOpacity = 0
        // this.pride.layout.update(lerpFactor)


        // transitioner = SpatialTransitioner.get(this.pride.content)


        // transitioner = SpatialTransitioner.get(this.pride.content)
        // transitioner.align.set(0,0,-100)
        // transitioner.origin.set(0,0,1)
        // transitioner.size.set(NaN, 1, NaN)
        // transitioner.update(lerpFactor)


        let layout = this.treadmill.snubberObject.layout
        if (this.data.xrMode) { 
            if (this.treadmill.treadmillAnchorObject && this.treadmill.treadmillAnchorObject.parent) {
                layout.target.reset()
                layout.target.parent = this.treadmill.treadmillAnchorObject
                layout.target.position.copy(this.treadmill.snubberTargetPosition)
                layout.target.quaternion.setFromAxisAngle(V_001, Math.PI)
            } else if (layout.target.parent !== this.app.scene) {
                layout.target.reset()
                layout.target.parent = this.app.scene
                layout.target.position.set(0,0,-0.5)
                layout.target.quaternion.copy(this.app.camera.quaternion)
                this.app.camera.localToWorld(layout.target.position)
            }
        } else {
            layout.target.reset()
            layout.target.parent = this.model
            // TODO: the following has a bug. Size to fit is based on previous parent for one frame
            SpatialLayout.getSizeToFit(this.treadmill.snubberObject, layout.target.size).multiplyScalar(0.8)
            // layout.target.size.set(NaN, 1, NaN)
            layout.target.scale.set(1,1,0.3)
            layout.target.origin.set(0,0,-1)
        }
        layout.update(lerpFactor)
        // transitioner.update(lerpFactor)

        // transitioner = SpatialTransitioner.get(this.content)
        // if (this.data.xrMode) {
        //     transitioner.reset()
        //     transitioner.parent = this.treadmill.treadmillObject
        //     transitioner.size.set(NaN,0.5,NaN)
        //     transitioner.quaternion.setFromAxisAngle(V_001, Math.PI)
        // } else {
        //     transitioner.setFromObject(this.content.target)
        //     transitioner.parent = this.content.parentLayer!
        // }
        // transitioner.update(lerpFactor)

        // this.instruction.shouldApplyTargetLayout = false
        layout = this.instruction.layout
        if (this.xrMode.changedTo('true')) {
            layout.target.reset()
            layout.target.parent = this.treadmill.snubberObject
            layout.target.origin.set(1,0,0)
            layout.target.align.set(-1,0,0)
            layout.target.size.set(NaN,1,NaN)
        } else if (this.xrMode.is('false')) {
            layout.target.parent = this.instruction.parentLayer!
        }

        // this.media.shouldApplyTargetLayout = false
        layout = this.media.layout
        // transitioner = SpatialTransitioner.get(this.media)
        if (this.xrMode.changedTo('true')) {
            layout.target.reset()
            layout.target.parent = this.treadmill.snubberObject
            layout.target.origin.set(-1,0,0)
            layout.target.align.set(1,0,0)
            layout.target.size.set(NaN,1,NaN)
        } else if (this.xrMode.is('false')) {
            layout.target.parent = this.media.parentLayer!
        }

        
        if (this.xrMode.is('true')) {
            layout = this.media.layout
            layout.target.reset()
            layout.target.parent = this.treadmill.snubberObject
            layout.target.origin.set(-1,0,0)
            layout.target.align.set(1,0,0)
            layout.target.size.set(NaN,1,NaN)
        }


        if (this.snubberDirection.is('forward')) {
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
        this.pride.update(lerpFactor, this._updateLayout)
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

    _updateLayout(layer:WebLayer3D, lerp:number) {
        WebLayer3D.UPDATE_DEFAULT(layer, lerp)
        layer.layout.update(lerp)
    }

    _toggleLayoutBounds(layer:WebLayer3D) {
        // layer.layoutIgnore = (layer.contentTargetOpacity === 0) 
    }

    _setRenderOrder(layer:WebLayer3D) {
        if (!layer.parentLayer) return
        const index = layer.parentLayer.childLayers.indexOf(layer)
        layer.mesh.renderOrder = layer.level + index*0.001
    }
}