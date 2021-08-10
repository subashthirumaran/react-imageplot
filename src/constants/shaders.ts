export const VERTEX_SHADER = `/**
* The vertex shader's main() function must define \`gl_Position\`,
* which describes the position of each vertex in screen coordinates.
*
* To do so, we can use the following variables defined by Three.js:
*   uniform mat4 projectionMatrix - maps camera space into screen space
*   uniform mat4 modelViewMatrix - combines:
*     model matrix: maps a point's local coordinate space into world space
*     view matrix: maps world space into camera space
*
* \`attributes\` can vary from vertex to vertex and are defined as arrays
*   with length equal to the number of vertices. Each index in the array
*   is an attribute for the corresponding vertex. Each attribute must
*   contain n_vertices * n_components, where n_components is the length
*   of the given datatype (e.g. for a vec2, n_components = 2; for a float,
*   n_components = 1)
* \`uniforms\` are constant across all vertices
* \`varyings\` are values passed from the vertex to the fragment shader
*
* For the full list of uniforms defined by three, see:
*   https://threejs.org/docs/#api/renderers/webgl/WebGLProgram
**/

#version 100
#define SHADER_NAME instancedVertex
#define SELECTING

// set float precision
precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 cameraPosition;
uniform float scale;
uniform float targetScale;
uniform float scaleTransitionPercent;
uniform float transitionPercent;
uniform float borderWidth;
uniform float cellAtlasPxPerSide;
uniform float lodAtlasPxPerSide;

attribute vec2 uv;                // u v blueprint 0:1 in each axis
attribute vec3 position;          // x y z positional blueprint 0:1 in x, y axes
attribute vec3 translation;       // x y z position of point currently
attribute vec3 targetTranslation; // x y z position to which we're transitioning
attribute vec3 color;             // unique color for cell; used for raycasting
attribute float width;            // px width of cell in lod texture
attribute float height;           // px height of cell in lod texture
attribute vec2 offset;            // px offset in tex from left, top
attribute float opacity;          // opacity value for cell
attribute float selected;         // 1 if the cell is selected else 0
attribute float clusterSelected;  // 1 if the cell is cluster selected else 0
attribute float textureIndex;     // index of instance's texture among all textures

varying vec2 vUv;                 // u v blueprint 0:1 in each axis
varying vec3 vColor;              // cell color
varying vec2 vOffset;             // px of cell offset left, top in texture
varying float vWidth;             // px width of cell in lod texture
varying float vHeight;            // px height of cell in lod texture
varying float vOpacity;           // cell opacity
varying float vSelected;          // 1 if this cell is selected else 0
varying float vTextureIndex;      // cell texture idx (varyings can't be int)
varying float vClusterSelected;   // 1 if this cell is cluster selected else 0
varying vec2 vBorderPercent;      // the percent of the cell width, height comprised of border

void main() {
  // pass varyings to fragment shader
  vUv = uv;
  vColor = color;
  vWidth = width;
  vHeight = height;
  vOffset = offset;
  vOpacity = opacity;
  vSelected = selected;
  vTextureIndex = textureIndex;
  vClusterSelected = clusterSelected;

  // determine the interpolation point in the current transition
  float percent = clamp(transitionPercent, 0.0, 1.0);

  // determine if this cell is bordered
  bool bordered = selected > 0.5 || clusterSelected > 0.5;

  // get the border width and height
  float borderW = borderWidth * width;
  float borderH = borderWidth * height;

  // get the total cell width and height
  float w = bordered ? width  + (borderW * 2.0) : width;
  float h = bordered ? height + (borderH * 2.0) : height;

  // pass the border width/height as a percent of cell width/height to the fragment shader
  vBorderPercent = vec2(borderW / w, borderH / h);

  // create a variable to store the vertex positions
  vec3 p = position;

  // scale the blueprint by the target dimensions
  p.x *= w;
  p.y *= h;

  // make the cell's position the center of the cell
  p.x -= w/2.0;
  p.y -= h/2.0;

  // determine the scale to apply to the cell
  float s = mix(scale, targetScale, percent) * 0.00001;

  // scale the cell
  p = p * s;

  // translate the cell; translation = current; targetTranslation = destination
  vec3 p0 = p + translation;
  vec3 p1 = p + targetTranslation;
  vec3 pos = mix(p0, p1, percent);

  // get the ultimate cell position
  vec4 world = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * world;
}
`;

export const FRAGMENT_SHADER = `/**
* The fragment shader's main() function must define \`gl_FragColor\`,
* which describes the pixel color of each pixel on the screen.
*
* To do so, we can use uniforms passed into the shader and varyings
* passed from the vertex shader.
*
* Attempting to read a varying not generated by the vertex shader will
* throw a warning but won't prevent shader compiling.
**/

#version 100
#define SHADER_NAME instancedFragment
#define SELECTING

precision highp float;

uniform float useColor;
uniform float cellAtlasPxPerSide;
uniform float lodAtlasPxPerSide;
uniform float cellPxHeight;
uniform float lodPxHeight;
uniform float borderWidth;
uniform vec3 selectedBorderColor;
uniform vec3 clusterBorderColor;
uniform float display;

varying vec2 vUv;               // u v texture blueprint scaled 0:1 in each axis
varying vec3 vColor;            // cell's color (for gpu picking)
varying vec2 vOffset;           // cell's offset in px from left, top of tex
varying float vWidth;           // cell's width in lod tex in px
varying float vHeight;          // cell's height in lod tex in px
varying float vOpacity;         // cell's opacity
varying float vSelected;        // cell is selected if > 0.5
varying float vTextureIndex;    // cell's texture index
varying float vClusterSelected; // cell is cluster selected if > 0.5
varying vec2 vBorderPercent;

#ifndef SELECTING
  uniform sampler2D textures[N_TEXTURES]; // array of sampler2Ds
  uniform sampler2D lodTexture; // single sampler2D
#endif

void main() {

  if (display < 0.5) {

    discard;

  } else {

    // if this shader is using vColor attributes skip texture processing
    if (int(useColor) == 1) {

      gl_FragColor = vec4(vColor, 1.0);

    // this cell should be textured
    } else {

      // determine if pixel is selected, cluster selected, & inside border
      bool isSelected = vSelected > 0.5;

      bool isClusterSelected = vClusterSelected > 0.5;

      bool hasBorder = isSelected || isClusterSelected;

      bool isInBorder =
        vUv.x > 1.0 - vBorderPercent.x ||
        vUv.x < vBorderPercent.x ||
        vUv.y > 1.0 - vBorderPercent.y ||
        vUv.y < vBorderPercent.y;

      // check if the current pointcoord position is within the border
      if (hasBorder && isInBorder) {

        // draw a border around lasso'd cells
        if (isSelected) gl_FragColor = vec4(selectedBorderColor, 1.0);

        if (isClusterSelected) gl_FragColor = vec4(clusterBorderColor, 1.0);

      // pixel is outside the border; paint with the provided texture
      } else {

        // determine if this cell needs a LOD texture or standard atlas texture
        bool isLod = vTextureIndex < -0.5;

        // start with blueprint uvs scaled 0:1 in each axis
        vec2 uv = vUv;

        // flip the texture right side up
        uv.y = 1.0 - uv.y;

        // if this cell has a border make the image constant size regardless of border size
        if (hasBorder) {

          // the percent of the cell in the y/x axis to be textured (in decimal form)
          float texturedPercentY = vBorderPercent.y * 2.0;
          float texturedPercentX = vBorderPercent.x * 2.0;

          // slide the region of the cell to be textured up & right one border width
          uv.y = uv.y - (texturedPercentY / 2.0);
          uv.x = uv.x - (texturedPercentX / 2.0);

          // make the texture to be used a fraction as tall
          uv.y = uv.y / (1.0 - texturedPercentY);
          uv.x = uv.x / (1.0 - texturedPercentX);
        }

        // scale the unit uvs to the size of this cell in px
        uv.x *= isLod ? vWidth : vWidth / vHeight * cellPxHeight;
        uv.y *= isLod ? vHeight : cellPxHeight;

        // vOffset is a translation of the cell in px
        uv += vOffset;

        // scale the uvs from px coords to 0:1 for shading
        uv = uv / (isLod ? lodAtlasPxPerSide : cellAtlasPxPerSide);

        // get the index for the selected texture
        int textureIndex = isLod ? -1 : int(vTextureIndex);

        // target to be replaced by texture tree
        TEXTURE_LOOKUP_TREE

        gl_FragColor = mix(gl_FragColor, vec4(0.0), 1.0-vOpacity);
        gl_FragColor.a = 1.0;

        // add a wash if the cell is selected
        if (vSelected > 0.5) {
          gl_FragColor = mix(gl_FragColor, vec4(selectedBorderColor, 1.0), 0.15);
        }

        // add a wash if the cell is cluster selected
        if (vClusterSelected > 0.5) {
          gl_FragColor = mix(gl_FragColor, vec4(clusterBorderColor, 1.0), 0.30);
        }
      }
    }
  }
}`;
