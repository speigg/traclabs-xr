import AppBase from './app'
import Treadmill from './components/Treadmill'
import UI from './components/UI'
import PrideAPI from './lib/PrideAPI'

PrideAPI.get()
setInterval(() => PrideAPI.get(), 5000)

class App extends AppBase {
    treadmill = new Treadmill(this)
    ui = new UI(this, this.treadmill)
    pride = PrideAPI
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
