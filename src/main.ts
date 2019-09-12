import AppBase from './app'
import Treadmill from './components/Treadmill'
import UI from './components/UI'
import PrideAPI from './lib/PrideAPI'

import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh'
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast
declare module 'three/src/core/BufferGeometry' {
    interface BufferGeometry {
        computeBoundsTree() : void
        disposeBoundsTree() : void
        boundsTree?: any
    }
}

PrideAPI.get()
setInterval(() => PrideAPI.get(), 5000)

// TODO: switch to A-Frame
class App extends AppBase {
    treadmill = new Treadmill(this)
    ui = new UI(this, this.treadmill)
    pride = PrideAPI
}

const app = (window as any).app = new App({
    onUpdate: (event) => {
        app.treadmill.update(event)
        app.ui.update(event)
    },
    onEnterXR: (event) => {
        app.treadmill.enterXR(event)
    },
    onExitXR: (event) => {
        app.ui.data.xrMode = false
    }
})

app.start().catch((e: Error) => {
    console.error(e)
    alert(e)
})


// var x = 0

// Object.defineProperty(app.treadmill.snubberObject.position, 'x', {
//     get: function () {
//         return x
//     },

//     set: function (value) {
//         if (isNaN(value)) debugger; // sets breakpoint
//         x = value
//     }
// });


import * as THREE from 'three'
(window as any).THREE = THREE

import {SpatialMetrics} from './lib/SpatialMetrics'
import {SpatialLayout} from './lib/SpatialLayout'
;(window as any).SpatialMetrics = SpatialMetrics
;(window as any).SpatialLayout = SpatialLayout
