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
        // pixelRatio: 3, 
        layerSeparation: 0.0001,
        onLayerCreate: (layer) => {
            layer.layout.forceBoundsExclusion = true
            layer.shouldApplyTargetLayout = false
            layer.shouldApplyContentTargetLayout = false
            const refresh = layer['_refreshTargetLayout']
            layer['_refreshTargetLayout'] = () => {
                refresh.call(layer)
                layer.layout.reset()
                if (layer.parentLayer) {
                    layer.layout.targetParent = layer.parentLayer
                    layer.position.copy(layer.target.position)
                }
                layer.content.layout.reset()
                layer.layout.minBounds.min.set(-layer.bounds.width*WebLayer3D.PIXEL_SIZE/2, -layer.bounds.height*WebLayer3D.PIXEL_SIZE/2, 0)
                layer.layout.minBounds.max.set(layer.bounds.width*WebLayer3D.PIXEL_SIZE/2, layer.bounds.height*WebLayer3D.PIXEL_SIZE/2, 0)
                layer.content.layout.size.set(1,1,NaN)
                layer.content.layout.fit = 'fill'
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
    controls = this.pride.getObjectByName('controls') as WebLayer3D
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
            if (this.data.xrMode) this.app.enterXR()
        })

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

        this.xrMode.update(event.deltaTime)
        this.snubberVisualSize.update(event.deltaTime)
        this.snubberDirection.update(event.deltaTime)

        const snubberObject = this.treadmill.snubberObject

        const lerpFactor = THREE.Math.clamp(event.deltaTime * 5, 0, 1)

        
        // only refresh the UI if it's been more than 500ms since the last window resize
        this.pride.options.autoRefresh = this.app.timeSinceLastResize > 500
        // change to: this.pride.options.autoRasterize, and rename autoRefresh to autoLayout
        // `autoLayout` option will ensure that the layout is automatically set
        // to match the DOM layout by the time each frame begins
        
        // setup UI layout
        if (this.app.interactionSpace === 'world' && snubberObject.parent === this.app.scene) {
            this.pride.layout.targetParent = this.data.xrMode ? this.treadmill.snubberObject : this.app.scene
            this.pride.layout.size.setScalar(3)
            this.pride.layout.align.set(0,0,-1)
            this.pride.layout.fit = 'cover'
        } else {
            this.pride.layout.targetParent = this.app.camera // attach the UI to the camera
            this.pride.layout.size.set(1,1,1) // size to entire screen 
            this.pride.layout.fit = 'contain' // scale content to fit ('contain' is the default fit mode)
            this.pride.position.set(0,0,-0.2) // position -0.2 meters away
        }
        // this.pride.layout.update() will be called for this and all child layers 
        // when `this.pride.update()` is called

        // pull out the background div and place 10 meters away from the camera
        this.pride.content.layout.targetParent = this.app.camera
        this.pride.content.layout.size.set(1,1,1)
        this.pride.content.layout.fit = 'fill' // fill the view
        this.pride.content.position.set(0,0,-10)
        this.pride.contentTargetOpacity = this.data.xrMode ? 0 : 1
        // this.pride.contentTargetOpacity = 0


        if (this.data.xrMode) {
            if (this.treadmill.treadmillAnchorObject && this.treadmill.treadmillAnchorObject.parent) {
                snubberObject.layout.reset()
                snubberObject.layout.targetParent = this.treadmill.treadmillAnchorObject
                snubberObject.position.copy(this.treadmill.snubberTargetPosition)
                snubberObject.quaternion.setFromAxisAngle(V_001, Math.PI)
            } else if (snubberObject.parent !== this.app.scene) {
                if (this.app.interactionSpace === 'screen' || 
                    this.app.interactionSpace === 'world' && this.app.camera.position.y > 0.1) {
                    snubberObject.layout.reset()
                    snubberObject.layout.targetParent = this.app.scene
                    snubberObject.position.set(0,0,-1)
                    snubberObject.scale.setScalar(4)
                    snubberObject.quaternion.copy(this.app.camera.quaternion)
                    this.app.camera.localToWorld(snubberObject.position)
                }
            }
        } else if (this.pride.parent === this.app.camera) {
            snubberObject.layout.reset()
            snubberObject.layout.setTargetParent(this.model)
            snubberObject.layout.setAnchor(0,0,-1)
            snubberObject.layout.size.setScalar(0.8)
            snubberObject.scale.set(1,1,0.3)
        } 
        // since snubberObject is not a WebLayer3D instance, we should update it's layout directly
        snubberObject.layout.update(lerpFactor)
        

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

        if (this.xrMode.is('true')) {
            const instructionLayout = this.instruction.layout
            instructionLayout.reset()
            instructionLayout.targetParent = this.treadmill.snubberObject
            instructionLayout.setAnchor('right',0,0)
            instructionLayout.setAlign('left',0,0)
            instructionLayout.size.set(1,1,1)
        }

        if (this.xrMode.is('true')) {
            const mediaLayout = this.media.layout
            mediaLayout.reset()
            mediaLayout.targetParent = this.treadmill.snubberObject
            mediaLayout.setAnchor('left',0,0)
            mediaLayout.setAlign('right',0,0)
            mediaLayout.setSize(1, 1, 1)
            // mediaLayout.sizeToFit('contain', this.app.camera, [obstacles])

            // mediaLayout.align.set(0,0,0)
            // mediaLayout.alignToObject(this.app.camera)
            // mediaLayout.alignSnapToEdge()
            // mediaLayout.origin.copy(mediaLayout.align).negate()
            // mediaLayout.origin.multiplyScalar(1.1)
            // mediaLayout.align
            // mediaLayout.sizeToFit('contain', this.app.camera)
            // mediaLayout.minSize(1,1,1)


            // const snubberContentSurface = new SpatialContentSurface(this.app.camera)
            // surface.autoClip = true
            // surface.autoRotate = true
            // surface.layout.minBounds
            // surface.getClosestRegion('left', 'right', 'top', 'bottom', 'center')
            // surface.getLargestRegion('')


            // this.treadmill.snubberObject.add(surface)
            // this.media.layout.targetParent = surface.closestArea
            
            // // SpatialLayout.get
            // // this.media.layout.targetParent = largestArea
            // const mediaSize = this.media.layout.bounds.getSize(vectors.get())
            // const rightSurfaceSize = rightSurface.getSize(vectors.get())
            // if (Math.abs(mediaSize.x - rightSurfaceSize.x) > 100 || Math.abs(mediaSize.y - rightSurfaceSize.y) > 100) {

            // }
        }

        if (this.xrMode.changedTo('true')) {
            this.media.element
        }

        if (this.snubberDirection.is('forward')) {
        //     this.instructionPanel.contentTargetOpacity = 0

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
        layer.content.layout.update(lerp)
    }

    _setRenderOrder(layer:WebLayer3D) {
        if (!layer.parentLayer) return
        const index = layer.parentLayer.childLayers.indexOf(layer)
        layer.mesh.renderOrder = layer.level + index*0.001
    }
}