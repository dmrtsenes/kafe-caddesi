import assert from 'node:assert/strict';
import {it} from 'node:test';
import {chooseUpgradePressure,type UpgradePressure} from './UpgradeAdvice';
const station=(p:Partial<UpgradePressure>):UpgradePressure=>({id:'s',kind:'machine',upgradeableSpeed:true,upgradeableCap:true,stock:0,capacity:6,demand:0,queue:0,seats:0,usedSeats:0,...p});
it('does not suggest speed for full machines even under demand',()=>assert.equal(chooseUpgradePressure([station({stock:6,demand:9})]),null));
it('does not suggest chairs while the cafe has free seating',()=>assert.equal(chooseUpgradePressure([station({kind:'table',seats:4,usedSeats:0}),station({kind:'table',seats:4,usedSeats:2})]),null));
it('prioritizes an actual counter queue then a demanded empty machine',()=>{const machine=station({id:'coffee',demand:4});const counter=station({id:'register',kind:'counter',queue:3});assert.deepEqual(chooseUpgradePressure([machine,counter]),{id:'register',kind:'speed',reason:'queue'});assert.deepEqual(chooseUpgradePressure([machine]),{id:'coffee',kind:'speed',reason:'production'});});
it('does not recommend capped stations or capacity changes under seated guests',()=>{assert.equal(chooseUpgradePressure([station({demand:4,upgradeableSpeed:false})]),null);assert.equal(chooseUpgradePressure([station({kind:'table',seats:4,usedSeats:4})]),null);});
