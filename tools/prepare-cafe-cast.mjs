/** Deterministic offline conversion of the CC0 source archives already in this workspace. */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
const source = resolve('_paketler/retired-quaternius-web');
const output = resolve('public/packs/quaternius');
const modelClips = new Set(['Idle_Neutral','Idle_Gun','Walk','Run','Interact','Wave','HitRecieve_2']);
const serviceClips = new Set(['Sitting_Idle_Loop','Sitting_Talking_Loop','Push_Loop','PickUp_Table','Idle_Talking_Loop']);
const models = ['female-casual','female-formal','female-suit','female-worker','male-casual','male-hoodie','male-suit'];
function convert(path, clips, animationOnly = false) {
 const file = join(source,path), model = JSON.parse(readFileSync(file,'utf8'));
 const buffers = model.buffers.map(buffer => buffer.uri.startsWith('data:') ? Buffer.from(buffer.uri.split(',')[1],'base64') : readFileSync(join(dirname(file),buffer.uri)));
 model.animations = model.animations.filter(animation => clips.has(animation.name));
 if (animationOnly) { delete model.meshes; delete model.materials; delete model.images; delete model.textures; delete model.samplers; delete model.skins; for(const node of model.nodes){delete node.mesh;delete node.skin;} }
 const used = new Set(), keep = id => {if(typeof id === 'number')used.add(id);};
 for(const mesh of model.meshes??[])for(const primitive of mesh.primitives){keep(primitive.indices);Object.values(primitive.attributes).forEach(keep);for(const target of primitive.targets??[])Object.values(target).forEach(keep);}
 for(const skin of model.skins??[])keep(skin.inverseBindMatrices);
 for(const animation of model.animations)for(const sampler of animation.samplers){keep(sampler.input);keep(sampler.output);}
 const accessorMap = new Map([...used].sort((a,b)=>a-b).map((old,id)=>[old,id]));
 const accessors=[...accessorMap.keys()].map(id=>model.accessors[id]);
 const chunks=[],views=[];let offset=0;
 const writeView=(data,target)=>{const id=views.length;views.push({buffer:0,byteOffset:offset,byteLength:data.length,...(target?{target}:{})});chunks.push(data);offset+=data.length;const pad=(4-offset%4)%4;if(pad){chunks.push(Buffer.alloc(pad));offset+=pad;}return id;};
 const componentBytes={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
 const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
 for(const accessor of accessors){
  if(accessor.sparse)throw Error('Sparse accessor needs explicit preservation');
  if(accessor.bufferView===undefined)continue;
  const sourceView=model.bufferViews[accessor.bufferView],size=componentBytes[accessor.componentType]*components[accessor.type],stride=sourceView.byteStride??size;
  const start=(sourceView.byteOffset??0)+(accessor.byteOffset??0),sourceBuffer=buffers[sourceView.buffer],data=Buffer.alloc(accessor.count*size);
  for(let element=0;element<accessor.count;element++)sourceBuffer.copy(data,element*size,start+element*stride,start+element*stride+size);
  accessor.bufferView=writeView(data,sourceView.target);delete accessor.byteOffset;
 }
 for(const image of model.images??[])if(image.bufferView!==undefined){const v=model.bufferViews[image.bufferView];image.bufferView=writeView(buffers[v.buffer].subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength));}
 for(const mesh of model.meshes??[])for(const primitive of mesh.primitives){if(primitive.indices!==undefined)primitive.indices=accessorMap.get(primitive.indices);for(const key in primitive.attributes)primitive.attributes[key]=accessorMap.get(primitive.attributes[key]);for(const target of primitive.targets??[])for(const key in target)target[key]=accessorMap.get(target[key]);}
 for(const skin of model.skins??[])if(skin.inverseBindMatrices!==undefined)skin.inverseBindMatrices=accessorMap.get(skin.inverseBindMatrices);
 for(const animation of model.animations)for(const sampler of animation.samplers){sampler.input=accessorMap.get(sampler.input);sampler.output=accessorMap.get(sampler.output);}
 model.accessors=accessors;model.bufferViews=views;model.buffers=[{byteLength:offset}];
 const json=Buffer.from(JSON.stringify(model));const padded=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]),binary=Buffer.concat(chunks);
 const header=Buffer.alloc(20),binHeader=Buffer.alloc(8);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+padded.length+8+binary.length,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
 const target=join(output,path.replace(/\.gltf$/,'.glb'));mkdirSync(dirname(target),{recursive:true});writeFileSync(target,Buffer.concat([header,padded,binHeader,binary]));return {file:relative(output,target).replaceAll('\\','/'),bytes:20+padded.length+8+binary.length,clips:model.animations.map(a=>a.name)};
}
const records=models.map(name=>convert('characters/'+name+'.gltf',modelClips));records.push(convert('animations/library.gltf',serviceClips,true));
for(const name of ['QUATERNIUS-MEN-LICENSE.txt','QUATERNIUS-WOMEN-LICENSE.txt','QUATERNIUS-ANIMATIONS-LICENSE.txt'])copyFileSync(join(source,name),join(output,name));
writeFileSync(join(output,'README.md'),'# Fincan cafe cast\n\nCC0 assets by Quaternius: Ultimate Modular Men, Ultimate Modular Women and Universal Animation Library.\nSources: https://quaternius.com/packs/ultimatemodularcharacters.html , https://quaternius.com/packs/ultimatemodularwomen.html , https://quaternius.com/packs/universalanimationlibrary.html\n\nSelected casual/formal models share a compact cafe silhouette, petrol/cream/copper uniforms, vertex-color materials, and contact-aware carrying poses. No private comparison asset is included. Source geometry remains authored pack geometry. Unused animations are stripped, skeleton and retained tracks are unchanged.\n\nReproduce: node tools/prepare-cafe-cast.mjs\n');
writeFileSync(join(output,'manifest.json'),JSON.stringify({author:'Quaternius',license:'CC0-1.0',generatedBy:'tools/prepare-cafe-cast.mjs',records},null,2)+'\n');
// These exact obsolete copies belong solely to this task's conversion directory.
for(const path of [...models.map(name=>'characters/'+name+'.gltf'),'animations/library.gltf','animations/AnimationLibrary_Godot_Standard.bin']){const file=resolve(output,path);if(!file.startsWith(output+'\\')&&!file.startsWith(output+'/'))throw Error('Output boundary');rmSync(file,{force:true});}
console.log(JSON.stringify({records,totalBytes:records.reduce((sum,r)=>sum+r.bytes,0)},null,2));
