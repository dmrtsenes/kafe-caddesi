import {writeFileSync} from 'node:fs';
import {LOCATIONS} from '../src/data/layouts.ts';
import {GOALS} from '../src/data/goals.ts';
import {PLAYER_UPGRADES,upgradeCost} from '../src/data/upgrades.ts';
import {STAFF_ROLES,hireCost} from '../src/data/staff.ts';
const lines=['# Koddan üretilen ekonomi tablosu','','Kaynak: src/data/economy.ts, goals.ts, upgrades.ts, staff.ts. Tasarım v2; otomatik süre ölçümleri ayrı rapordadır.','','| Şube | Bölüm | Bedel | Alan ödülü | Ödül oranı |','|---|---|---:|---:|---:|'];
for(const loc of Object.values(LOCATIONS))for(const zone of loc.zones){const goal=GOALS.find(g=>g.kind==='zone'&&g.zone===zone.id);lines.push('| '+[loc.name,zone.name,zone.cost,goal?.reward??'—',goal?Math.round(goal.reward/zone.cost*100)+'%':'—'].join(' | ')+' |');}
lines.push('','| Geliştirme | Seviye | Gerçek etki | Sonraki bedel |','|---|---:|---|---:|');
for(const def of PLAYER_UPGRADES)for(let level=0;level<=def.maxLevel;level++)lines.push('| '+[def.name,level,def.format(level),level<def.maxLevel?upgradeCost(def,level):'Azami'].join(' | ')+' |');
lines.push('','| Personel | İlk bedel | İkinci bedel |','|---|---:|---:|');for(const def of STAFF_ROLES)lines.push('| '+[def.name,hireCost(def,0),hireCost(def,1)].join(' | ')+' |');
writeFileSync('docs/EKONOMI-TABLOSU-2026-09-06.md',lines.join('\n')+'\n');
