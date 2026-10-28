import type {Object3D} from 'three';

/** Keep offscreen actors in the simulation without walking their bone hierarchy
 * on every renderer matrix update. A culled actor retains its model and state. */
export function syncRenderMembership(root:Object3D, parent:Object3D, visible:boolean):void {
  root.visible=visible;
  if(visible){
    if(root.parent!==parent)parent.add(root);
  } else if(root.parent===parent)root.removeFromParent();
}
