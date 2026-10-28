import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_STATIONS, type StationDef } from '../data/stations.ts';
import { StationEntity, type TableGuest } from './Station.ts';

function tableDef(seats: number): StationDef {
  return {
    id: `test_table_${seats}`,
    name: 'Test Masası',
    kind: 'table',
    visual: 'table',
    location: 'kose',
    zone: 'a1',
    x: 0,
    z: 0,
    rot: 0,
    time: 10,
    outputCap: 0,
    capCost: 100,
    seats,
    dept: 'salon',
  };
}

describe('table service and capacity', () => {
  it('gives every physical table a stable, branch-unique service code', () => {
    for (const location of ['kose', 'sahil']) {
      const tables = ALL_STATIONS.filter((st) => st.location === location && st.kind === 'table');
      const codes = tables.map((st) => st.serviceCode);
      assert.equal(codes.every(Boolean), true);
      assert.equal(new Set(codes).size, tables.length);
    }
  });
  it('gives two-seat tables two meaningful chair upgrades and caps at four', () => {
    const table = new StationEntity(tableDef(2));
    assert.equal(table.capMax, 2);
    table.capLevel = 2;
    assert.equal(table.seats, 4);

    const full = new StationEntity(tableDef(4));
    assert.equal(full.capMax, 0);
    assert.equal(full.canUpgradeCap, false);

    const beach = new StationEntity(tableDef(6));
    assert.equal(beach.seats, 6);
    assert.equal(beach.capMax, 0);
  });

  it('accepts only a product requested by a seated guest', () => {
    let remaining = 1;
    const guest: TableGuest = {
      needsItem: (item) => item === 'cay' && remaining > 0,
      receiveItem: (item) => {
        if (item !== 'cay' || remaining <= 0) return false;
        remaining--;
        return true;
      },
    };
    const table = new StationEntity(tableDef(2));
    table.locked = false;
    table.seatedGuests.push(guest);

    assert.equal(table.accept('latte'), false);
    assert.equal(table.accept('cay'), true);
    assert.equal(table.takeLastServedGuest(), guest);
    assert.equal(table.accept('cay'), false);
  });

  it('stays unavailable until dishes and surface soil are both cleared', () => {
    const table = new StationEntity(tableDef(2));
    table.locked = false;
    table.dishes = 1;
    table.soil = 0.65;
    assert.equal(table.canSeat, false);
    table.dishes = 0;
    assert.equal(table.canSeat, false);
    table.soil = 0;
    assert.equal(table.canSeat, true);
  });
});

describe('player access around tables and bins',()=>{
  it('uses the near exposed edge from every direction and rotation',()=>{
    for(const rot of [0,90,180,270]) {
      const t=new StationEntity({...tableDef(2),x:3,z:-2,rot});
      for(let angle=0;angle<360;angle+=15) {
        const a=angle*Math.PI/180,x=t.x+Math.sin(a)*1.85,z=t.z+Math.cos(a)*1.85;
        const point={x:0,z:0};t.playerPoint(x,z,point);
        assert.ok(Math.hypot(point.x-x,point.z-z)<1.05);
        assert.ok(Math.max(Math.abs(point.x-t.x),Math.abs(point.z-t.z))>.72);
      }
    }
  });
  it('provides accessible player interaction point for machines, counters and shelves',()=>{
    for(const def of ALL_STATIONS.filter(s=>!['table','bin'].includes(s.kind))) {
      const t=new StationEntity(def),a={x:0,z:0};
      t.playerPoint(t.x,t.z,a);
      assert.ok(Number.isFinite(a.x) && Number.isFinite(a.z));
    }
  });
});
