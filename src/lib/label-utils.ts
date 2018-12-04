import * as THREE from 'three'

export function makeTextSprite( message:string, parameters:{
        fontface?:string,
		fontsize?:number,
		padding?:number
        borderThickness?:number,
		borderColor?:{r:number, g:number, b:number, a:number},
		pixelRatio?:number
    } )
{
	if ( parameters === undefined ) parameters = {}

	var pixelRatio = parameters.hasOwnProperty('pixelRatio') ? 
		parameters["pixelRatio"] : window.devicePixelRatio
	
	var fontface = parameters.hasOwnProperty("fontface") ? 
		parameters["fontface"] : "Arial";
	
	var fontsize = (parameters.hasOwnProperty("fontsize") ? 
		parameters["fontsize"] : 18) * pixelRatio;

	var padding = (parameters.hasOwnProperty("padding") ? 
		parameters["padding"] : 3) * pixelRatio;
	
	var borderThickness = (parameters.hasOwnProperty("borderThickness") ? 
		parameters["borderThickness"] : 2) * pixelRatio;
	
	var borderColor = parameters.hasOwnProperty("borderColor") ?
		parameters["borderColor"] : { r:0, g:0, b:0, a:1.0 };
	
	var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?
		parameters["backgroundColor"] : { r:255, g:255, b:255, a:1.0 };
		
	var canvas = document.createElement('canvas');
	var context = canvas.getContext('2d');
	context.font = "Bold " + fontsize + "px " + fontface;
    
	// get size data (height depends only on font size)
	var metrics = context.measureText( message );
	var textWidth = metrics.width + padding * 2;
	var textHeight = fontsize * 1.2 + padding * 2; 
	// 1.4 is extra height factor for text below baseline: g,j,p,q.
	
	canvas.width = textWidth + borderThickness * 2
	canvas.height = textHeight + borderThickness * 2
	
	// background color
	context.fillStyle   = "rgba(" + backgroundColor.r + "," + backgroundColor.g + ","
								  + backgroundColor.b + "," + backgroundColor.a + ")";
	// border color
	context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + ","
								  + borderColor.b + "," + borderColor.a + ")";

	context.lineWidth = borderThickness;
	roundRect(context, borderThickness, borderThickness, canvas.width - 2 * borderThickness, canvas.height - 2 * borderThickness, 5);
	
	// draw text
	context.font = "Bold " + fontsize + "px " + fontface;
	context.fillStyle = "rgba(0, 0, 0, 1.0)";
	context.textAlign = 'center'
	context.textBaseline = 'top'
	context.fillText( message, canvas.width / 2, borderThickness + padding, canvas.width );
	
	// canvas contents will be used for a texture
	var texture = new THREE.Texture(canvas)
	texture.minFilter = THREE.LinearFilter
	texture.needsUpdate = true;

	var geometry = <THREE.Geometry>new THREE.PlaneGeometry(0.01 * canvas.width, 0.01 * canvas.height, 2, 2)
	var material = new THREE.MeshBasicMaterial({ map: texture, alphaTest:0.5 })
	var mesh = new THREE.Mesh(geometry, material)
	mesh.scale.set(0.01 * canvas.width, 0.01 * canvas.height, 0.01)
	return mesh
	// var spriteMaterial = new THREE.SpriteMaterial( { map: texture } );
	// var sprite = new THREE.Sprite( spriteMaterial );
	// sprite.scale.set(0.01 * canvas.width / pixelRatio, 0.01 * canvas.height / pixelRatio, 0.01)
	// sprite.center.set(0.5,0.5)
	// return sprite;
}

// function for drawing rounded rectangles
function roundRect(ctx:CanvasRenderingContext2D, x, y, width, height, radius, fill=true, stroke=true) {
	if (typeof stroke == 'undefined') {
	  stroke = true;
	}
	if (typeof radius === 'undefined') {
	  radius = 5;
	}
	if (typeof radius === 'number') {
	  radius = {tl: radius, tr: radius, br: radius, bl: radius};
	} else {
	  var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
	  for (var side in defaultRadius) {
		radius[side] = radius[side] || defaultRadius[side];
	  }
	}
	ctx.beginPath();
	ctx.moveTo(x + radius.tl, y);
	ctx.lineTo(x + width - radius.tr, y);
	ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
	ctx.lineTo(x + width, y + height - radius.br);
	ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
	ctx.lineTo(x + radius.bl, y + height);
	ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
	ctx.lineTo(x, y + radius.tl);
	ctx.quadraticCurveTo(x, y, x + radius.tl, y);
	ctx.closePath();
	if (fill) {
	  ctx.fill();
	}
	if (stroke) {
	  ctx.stroke();
	}
  
  }