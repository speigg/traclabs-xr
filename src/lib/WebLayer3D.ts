import * as THREE from 'three/src/Three'
import Vue, { VueConstructor } from 'vue'
import html2canvas from 'html2canvas'
import ResizeObserverPolyfill from '@juggle/resize-observer'
const ResizeObserver: typeof ResizeObserverPolyfill = (window as any).ResizeObserver || ResizeObserverPolyfill

// const hiddenIFrame = document.createElement('iframe')
// hiddenIFrame.style.border = '0'
// hiddenIFrame.style.position = 'absolute'
// hiddenIFrame.style.width = '0'
// hiddenIFrame.style.height = '0'
// hiddenIFrame.style.top = '0'
// document.documentElement.appendChild(hiddenIFrame)
// hiddenIFrame.contentDocument!.body.style.margin = '0'

export function getElement(element: HTMLElement|Vue|string): HTMLElement {
    if (element instanceof Vue) {
        const elementAsVue = element as Vue
        if (!elementAsVue.$el) {
            elementAsVue.$mount()
        }
        return elementAsVue.$el as HTMLElement
    }
    element = element as HTMLElement|string

    if (typeof element === 'string') {
        const div = document.createElement('div')
        div.outerHTML = element
        return div
    }

    return element
}

function ensureElementIsInDocument(element: HTMLElement, options: WebLayer3DOptions): HTMLElement {
    const document = element.ownerDocument!
    if (document.contains(element)) { return element }

    const container = document.createElement('div')
    container.style.position = 'absolute'
    container.style.width = 'windowWidth' in options ?
        options.windowWidth + 'px' : '300px'
    container.style.height = 'windowHeight' in options ?
        options.windowHeight + 'px' : '150px'
    container.style.pointerEvents = 'none'
    container.style.top = '0'

    element.style.visibility = 'hidden'
    container.appendChild(element)
    document.documentElement.appendChild(container)
    return element
}

function traverse(node: Node, each: (node: Element) => boolean) {
    for (let child: Node|null = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as Element
            if (each(el)) { traverse(el, each) }
        }
    }
}

function isNumeric(val: any) {
    return Number(parseFloat(val)) === val
}

export interface WebLayer3DOptions {
    pixelRatio?: number
    layerSeparation?: number
    windowWidth?: number
    windowHeight?: number
}

/**
 * Transform an Element into 3D layers (only
 * elements with an 'id' attribute are included).
 *
 * Elements with non-empty 'id' attributes
 * become child WebLayer3D instances, which can
 * be retrieved by calling getObjectByName('element-id')
 *
 * Pixel-ratio can be changed on a per-layer basis, by
 * setting a custom CSS property `--layer-pixel-ratio` on each layer element:
 *
 * ```
 * #element-id {
 *   --layer-pixel-ratio: 0.5;
 * }
 * ```
 *
 * Dimensions: 1px = 0.001 world dimensions = 1mm (assuming meters)
 *     e.g., 500px width means 0.5meters
 */
export default class WebLayer3D<T extends Vue = Vue> extends THREE.Object3D {

    static DEFAULT_LAYER_SEPARATION = 0.005
    static DEFAULT_PIXEL_DIMENSIONS = 0.001

    static GEOMETRY = new THREE.PlaneGeometry(1, 1, 2, 2) as THREE.Geometry

    mesh = new THREE.Mesh(
        WebLayer3D.GEOMETRY,
        new THREE.MeshBasicMaterial({ transparent: true }),
    )

    vue!: T
    element: HTMLElement
    rootLayer: WebLayer3D
    childLayers = new Map<string, WebLayer3D>()
    boundingRect: DOMRect = new DOMRect
    defaultPosition = new THREE.Vector3()
    elementIdentifier = 'data-weblayer3D-' + this.uuid
    canvas?: HTMLCanvasElement

    content = new THREE.Object3D

    // private _rootOrigin: THREE.Object3D

    constructor(element: HTMLElement|string|T,
                public options: WebLayer3DOptions= {},
                rootLayer?: WebLayer3D,
                public level = 0,
                private scope: Element|null = null) {
        super()

        if (element instanceof Vue) {
            this.vue = (element as T)
        }
        this.element = element = getElement(element)
        this.element.setAttribute(this.elementIdentifier, '')

        if (!document.contains(element)) {
            scope = scope || element
            ensureElementIsInDocument(element, options)
        }

        this.rootLayer = rootLayer || this
        this.scope = scope
        this.name = element.id

        this.add(this.content)

        setTimeout(() => this.refresh())

        element.addEventListener('load', () => {
            this.refresh()
        }, {capture: true})

        // const resizeObserver = new ResizeObserver((records, observer) => {
        //     this.refresh()
        // })
        // resizeObserver.observe(element)

        const mutationObserver = new MutationObserver((records, observer) => {
            this.refresh()
        })
        mutationObserver.observe(element, {
            characterData: true,
            attributes: true,
            childList: true,
            subtree: true,
        })
    }

    updateBoundingRect() {
        const myBoundingRect = this.boundingRect = this.element.getBoundingClientRect() as DOMRect

        if (this.rootLayer === this) {
            return
        }

        const pixelSize = WebLayer3D.DEFAULT_PIXEL_DIMENSIONS
        const layerSeparation = this.options.layerSeparation || WebLayer3D.DEFAULT_LAYER_SEPARATION

        const parentBoundingRect = this.parent instanceof WebLayer3D ?
            this.parent.boundingRect : undefined
        const parentCenterX = parentBoundingRect ?
            pixelSize * (parentBoundingRect.left + parentBoundingRect.width / 2) : 0
        const parentCenterY = parentBoundingRect ?
            pixelSize * (parentBoundingRect.top + parentBoundingRect.height / 2) : 0

        const myCenterX = pixelSize * (myBoundingRect.left + myBoundingRect.width / 2)
        const myCenterY = pixelSize * (myBoundingRect.top + myBoundingRect.height / 2)

        const myOffsetX = myCenterX - parentCenterX
        const myOffsetY = myCenterY - parentCenterY

        this.defaultPosition.set(
            myOffsetX,
            - myOffsetY,
            layerSeparation * this.level,
        )
    }

    refresh() {
        const element = this.element
        const options = this.options
        const scope = this.scope
        const childLayers = this.childLayers

        this.updateBoundingRect()
        const newChildLayerList = new Set<WebLayer3D>()
        traverse(element, (el: Element) => {
            const hasID = !!el.id
            if (hasID) {
                let child = childLayers.get(el.id)
                if (child) {
                    child.updateBoundingRect()
                } else {
                    child = new WebLayer3D(el as HTMLElement, options, this.rootLayer, this.level + 1, scope)
                    this.add(child)
                }
                newChildLayerList.add(child)
                return false
            }
            return true
        })

        for (const [childID, child] of childLayers) {
            if (!newChildLayerList.has(child)) {
                childLayers.delete(childID)
                this.remove(child)
            }
        }

        for (const child of newChildLayerList) {
            childLayers.set(child.element.id, child)
        }


        const boundingRect = this.boundingRect

        const window = element.ownerDocument!.defaultView!
        const computedStyle = window.getComputedStyle(element)
        const layerPixelRatioValue = computedStyle.getPropertyValue('--layer-pixel-ratio').trim()
        const pixelSize = WebLayer3D.DEFAULT_PIXEL_DIMENSIONS
        const pixelRatio = layerPixelRatioValue === 'default' || isNumeric(layerPixelRatioValue) === false ?
            'pixelRatio' in options ? options.pixelRatio || window.devicePixelRatio : window.devicePixelRatio :
            parseFloat(layerPixelRatioValue)

        html2canvas(element, {
            canvas: this.canvas,
            width: boundingRect.width,
            height: boundingRect.height,
            windowWidth: 'windowWidth' in options ? options.windowWidth : window.innerWidth,
            windowHeight: 'windowHeight' in options ? options.windowHeight : window.innerHeight,
            scale: pixelRatio,
            backgroundColor: null,
            ignoreElements: (el: Element) => {
                if (element === el) { return false }
                if (!scope) { return false }
                if (el.contains(scope) || scope.contains(el) || element === scope) {
                    return false
                }
                return false
            },
            onclone: (document: HTMLDocument) => {
                const clonedRootEl = document.querySelector<HTMLElement>(`[${this.rootLayer.elementIdentifier}]`)
                clonedRootEl!.style.visibility = 'visible'
                childLayers.forEach((child) => {
                    const clonedEl = document.querySelector<HTMLElement>(`[${child.elementIdentifier}]`)
                    if (clonedEl && clonedEl.style) {
                        clonedEl.style.visibility = 'hidden'
                    }
                })
            },
        }).then((canvas: HTMLCanvasElement) => {
            this.canvas = canvas
            const texture = new THREE.Texture(canvas)
            texture.minFilter = THREE.LinearFilter
            texture.needsUpdate = true
            const mesh = this.mesh
            const material = this.mesh.material as THREE.MeshBasicMaterial
            material.map = texture
            material.needsUpdate = true
            mesh.scale.x = Math.max(pixelSize * boundingRect.width, 10e-6)
            mesh.scale.y = Math.max(pixelSize * boundingRect.height, 10e-6)
            this.content.add(mesh)
        }, (e: Error) => {
            throw e
        })
    }

    setToDOMLayout(children: true, alpha = 1) {
        this.content.position.lerp(this.defaultPosition, alpha)
        this.traverse((child) => {
            if (child instanceof WebLayer3D) {
                child.content.position.lerp(child.defaultPosition, alpha)
            }
        })
    }
}
