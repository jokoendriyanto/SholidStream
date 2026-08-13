'use strict';
function rotateMetadata(config,index){if(!Number.isInteger(index)||index<0)throw new TypeError('Rotation index must be a non-negative integer');const pick=(values)=>Array.isArray(values)&&values.length?values[index%values.length]:null;return{title:pick(config.titles),description:pick(config.descriptions),thumbnail:pick(config.thumbnails),tags:pick(config.tags)};}
module.exports={rotateMetadata};
