import App from './App'
import Treadmill from './components/Treadmill'
import UI from './components/UI'
// import * as THREE from 'three/src/Three'
import PRIDEClient from './lib/PRIDEClient'

// (window as any).THREE = THREE
const app = (window as any).app = new App(new PRIDEClient)
const treadmill = (window as any).treadmill = new Treadmill(app)
const ui = (window as any).ui = new UI(app, treadmill)

app.start({
    onUpdate(event) {
        treadmill.update(event)
        ui.update(event)
    },
}).then((startEvent) => {
    treadmill.start(startEvent)
}).catch((e: Error) => {
    console.error(e)
    alert(e)
})
