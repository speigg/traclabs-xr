import AppBase from './app'
import Treadmill from './components/Treadmill'
import UI from './components/UI'
import PRIDEClient from './lib/PRIDEClient'

class App extends AppBase {
    pride = new PRIDEClient(this)
    treadmill = new Treadmill(this)
    ui = new UI(this, this.pride, this.treadmill)
}

const app = (window as any).app = new App()
app.start({
    onUpdate: (event) => {
        app.treadmill.update(event)
        app.ui.update(event)
    },
}).then((startEvent) => {
    app.treadmill.start(startEvent)
}).catch((e: Error) => {
    console.error(e)
    alert(e)
})

import * as THREE from 'three'
(window as any).THREE = THREE

import {SpatialMetrics} from './lib/SpatialMetrics'
import {SpatialLayout} from './lib/SpatialLayout'
;(window as any).SpatialMetrics = SpatialMetrics
;(window as any).SpatialLayout = SpatialLayout
