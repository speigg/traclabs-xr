import App from '../app'

const MOCK_PROCEDURES = {

}

// const BASE_URL = 'http://defiant3.local:8025/AR_server/'
const BASE_URL = 'http://prideview-ar.traclabs.com:8025/AR_server/'


class InstructionType {
    static ManualInstruction = 'ManualInstruction' // value: none
    static Conditional = 'Conditional' // value: yes or no
    static ClarifyingInstruction = 'ClarifyingInstruction' // value: none
    static VerifyInstruction = 'VerifyInstruction' // value: none
    static RecordInstruction = 'RecordInstruction' // value: number
    static CallProcedureInstruction = 'CallProcedureInstruction' // value: none
}

interface Augmentation {
    type: string
    position: {x: number, y: number, z: number}  // "x y z"
    rotation: {x: number, y: number, z: number}  // "x y z"
}

interface LabelAugmentation extends Augmentation {
    type: 'label',
    text: string
}

interface BoxAugmentation extends Augmentation {
    type: 'box'
    size: {x: number, y: number, z: number} // "x y z"
}

interface SphereAugmentation extends Augmentation {
    type: 'sphere'
    radius: number
}

interface HighlightAugmentation extends Augmentation {
    type: 'highlight'
}

// annotation1 = `type: box; position: 5 5 5; rotation: 0 90 0; size: 2 4 1;`
// annotation2 = `type: sphere; position: 5 5 5; rotation: 0 90 0; radius: 2;`
// annotation3 = `type: label; position: 5 5 5; rotation: 0 90 0; text: "hello world";`
// annotation4 = `type: highlight; color: "blue";`



export default class PRIDE {

    static TREADMILL_PROCEDURE_NAME = 'T2_Monthly_Maintenance_Top_Level'
    
    data = {
        procedure: 'Treadmill Monthly Maintenance',
        step: '',
        instruction: 'test',
        image: '',
        video: '/armWiggleDemonstrated.mov',
        // video: 'https://prideview-ar.traclabs.com/a7e79a1a-acff-43df-a1dc-f12f6bfcd6c9/4529_T2_Monthly_Maintenance_Top_Level_files/armWiggleDemonstrated.mov',
        objects: {} as {[name: string]: LabelAugmentation|BoxAugmentation|SphereAugmentation|HighlightAugmentation}
    }
    constructor(private app:App) {
        setTimeout(() => {
            this.get()
        }, 5000)
    }

    // getProcedureList() {

    // }

    // selectProcedure() {

    // }

    async get() {
        const response = await fetch(BASE_URL + 'ARready', {mode: 'cors'}).catch()
        const json = await response.json().catch()
        const steplist = json && json.procedureElementInfo.steplist
        if (!steplist) return // sometimes this is missing after going back. 
        this.data.step = steplist[steplist.length - 1].title
        this.data.instruction = json.text
        const objectKeys = Object.keys(json).filter((key) => key.toLowerCase().includes('object'))
        for (const key of objectKeys) {
            const jsonObject = json[key]
            const realityAugmentation = jsonObject.properties.realityaugmentation as string
            if (!realityAugmentation) { continue }
            const object = this.data.objects[jsonObject.name] = {} as any
            const augmentationProperties = realityAugmentation.split(';')
            for (const prop of augmentationProperties) {
                if (!prop) { continue }
                let [name, value] = prop.split(':')
                name = name.trim()
                value = value.trim()
                if (name === 'position' || name === 'rotation' || name === 'size') {
                    const [x, y, z] = value.split(' ').map((v: string) => parseFloat(v))
                    object[name] = {x, y, z}
                } else {
                    object[name] = isNaN(value as any) ? value : parseFloat(value)
                }
            }
        }
        return json
    }


    async getText() {
        const response = await fetch(BASE_URL + 'ARready', {mode: 'cors'})
        return response.text()
    }

    async done(value = 'none') {
        const result = await fetch(BASE_URL + 'ARready', {
            mode: 'cors',
            method: 'POST',
            body: JSON.stringify({
                action: 'done',
                value,
            }),
        })
        return result.json()
    }


    async startProcedure(name: string) {
        const result = await fetch(BASE_URL + 'ARready', {
            mode: 'cors',
            method: 'POST',
            body: JSON.stringify({
                action: name,
            }),
        })
        return result.json()
    }

    async back() {
        const result = await fetch(BASE_URL + 'ARready', {
            mode: 'cors',
            method: 'POST',
            body: JSON.stringify({
                action: 'back',
                value: 'none',
            }),
        })
        return result.json()
    }

    async skip() {
        const result = await fetch(BASE_URL + 'ARready', {
            mode: 'cors',
            method: 'POST',
            body: JSON.stringify({
                action: 'skip',
                value: 'none',
            }),
        })
        return result.json()
    }

    async comment(value: string) {
        const result = await fetch(BASE_URL + 'ARready', {
            mode: 'cors',
            method: 'POST',
            body: JSON.stringify({
                action: 'comment',
                value,
            }),
        })
        return result.json()
    }
}
