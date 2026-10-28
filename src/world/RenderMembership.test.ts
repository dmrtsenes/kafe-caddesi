import {it} from 'node:test';
import assert from 'node:assert/strict';
import {Group} from 'three';
import {syncRenderMembership} from './RenderMembership';

it('keeps offscreen actor state but removes bone traversal, then restores its current pose',()=>{
 const world=new Group(),actor=new Group(),bone=new Group();actor.add(bone);world.add(actor);
 let updates=0;const original=bone.updateMatrixWorld.bind(bone);bone.updateMatrixWorld=force=>{updates++;original(force);};
 world.updateMatrixWorld(true);assert.equal(updates,1);
 syncRenderMembership(actor,world,false);actor.position.set(4,0,7);bone.rotation.x=.7;
 world.updateMatrixWorld(true);assert.equal(updates,1);assert.equal(actor.children[0],bone);
 syncRenderMembership(actor,world,true);world.updateMatrixWorld(true);
 assert.equal(updates,2);assert.equal(actor.matrixWorld.elements[12],4);assert.equal(actor.matrixWorld.elements[14],7);
 assert.equal(bone.rotation.x,.7);assert.equal(actor.visible,true);
 syncRenderMembership(actor,world,true);assert.equal(world.children.length,1);
});
