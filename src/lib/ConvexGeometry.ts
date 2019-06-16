/**
 * @author Mugen87 / https://github.com/Mugen87
 * 
 * adapted for Typescript by Gheric Speiginer
 */

import * as THREE from 'three'
import {QuickHull} from './QuickHull'
import {SimplifyModifier} from './SimplifyModifier'

// ConvexGeometry
export class ConvexGeometry extends THREE.Geometry {
    
    static hulls = new WeakMap<THREE.Geometry|THREE.BufferGeometry, THREE.Geometry>()
  
    static compute(geometry:THREE.Geometry|THREE.BufferGeometry, maxPoints:number) {
      const bufferGeometry = (geometry as THREE.BufferGeometry).type === 'BufferGeometry' ? 
        geometry as THREE.BufferGeometry : null
      const normalGeometry = bufferGeometry ? 
        new THREE.Geometry().fromBufferGeometry(bufferGeometry) : geometry as THREE.Geometry
      if (normalGeometry.vertices.length < 10) {
        this.hulls.set(geometry, normalGeometry)
        return normalGeometry
      }

      const modifier = new (SimplifyModifier as any)()
      let convexGeometry = new ConvexGeometry(normalGeometry.vertices) as THREE.Geometry
      const count = convexGeometry.vertices.length
      if (count > maxPoints) {
        const simplified = modifier.modify( convexGeometry, convexGeometry.vertices.length - maxPoints )
        convexGeometry = new THREE.Geometry().fromBufferGeometry(simplified)
      }
      this.hulls.set(geometry, convexGeometry)
      return convexGeometry
    } 
  
    static get(geometry:THREE.Geometry|THREE.BufferGeometry) {
      if (this.hulls.has(geometry)) return this.hulls.get(geometry)!
      return this.compute(geometry, 30)!
    }

    constructor(public points:THREE.Vector3[]) {
        super()
        this.fromBufferGeometry( new ConvexBufferGeometry( points ) );
        this.mergeVertices();
    }

}

// ConvexBufferGeometry

export class ConvexBufferGeometry extends THREE.BufferGeometry { 

    constructor(public points:THREE.Vector3[]) {
        super()

        // buffers

        var vertices = [];
        var normals = [];

        // execute QuickHull

        if ( QuickHull === undefined ) {

            console.error( 'THREE.ConvexBufferGeometry: ConvexBufferGeometry relies on THREE.QuickHull' );

        }

        var quickHull = new (QuickHull as any)().setFromPoints( points );

        // generate vertices and normals

        var faces = quickHull.faces;

        for ( var i = 0; i < faces.length; i ++ ) {

            var face = faces[ i ];
            var edge = face.edge;

            // we move along a doubly-connected edge list to access all face points (see HalfEdge docs)

            do {

                var point = edge.head().point;

                vertices.push( point.x, point.y, point.z );
                normals.push( face.normal.x, face.normal.y, face.normal.z );

                edge = edge.next;

            } while ( edge !== face.edge );

        }

        // build geometry

        this.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
        this.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
    }
}