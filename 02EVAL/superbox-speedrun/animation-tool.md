## Animation Tool

Develop an animation helper tool for Superbox.

RULES:
Face animation layer must contain 25 by 25 grid.
Inside grid will be placed pixels to animate face expression. 
All objects will be animated with the same grid.
Acharacter contains three layers: body, faceplate and face animation layer.
Body is a 4 point svg shape. Always on lowest z-axis.
Faceplate is a 4 point svg shape. Always on middle z-axis.
Face ßanimation layer is a 25 by 25 grid. Always on top z-axis.
Face animation layer is copy of faceplate location.

Check picture to understand visual representation of mascot.

Check superbox-storyboard-system.jsx for more information about types of animations.

TOOL:
It's a web application to help draw keyframes for morphing in "Linearity move" app
Output must be svg.
user can:
- See previous layer under new one with less opacity
- Add pixels for face animation layer
- move objects with x/y coordinates, with ability to drag values, blender alike
- save separate frames to svg files on export
ß