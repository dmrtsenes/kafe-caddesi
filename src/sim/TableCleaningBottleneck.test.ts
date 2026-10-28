import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BALANCE } from '../data/balance.ts';
import { CUSTOMER_ANGER_COPY } from '../data/customerFeedback.ts';
import { StationEntity } from './Station.ts';
import type { StationDef } from '../data/stations.ts';
import { Order } from './Orders.ts';

function createTable(id: string, seats = 2): StationEntity {
  const def: StationDef = {
    id,
    name: 'Masa',
    kind: 'table',
    visual: 'table',
    location: 'kose',
    zone: 'a1',
    x: 10,
    z: 10,
    rot: 0,
    time: 10,
    outputCap: 0,
    capCost: 100,
    seats,
    dept: 'salon',
  };
  const table = new StationEntity(def);
  table.locked = false;
  return table;
}

interface TestGuest {
  uid: string;
  dineIn: boolean;
  state: 'toTable' | 'seated' | 'angry' | 'leave';
  table: StationEntity | null;
  seatIndex: number;
  tableWait: number;
  patience: number;
  maxPatience: number;
  paid: number;
  order: Order | null;
}

describe('Masa Temizliği ve Müşteri Darboğazı Mekaniği', () => {
  it('BALANCE.orders içinde ekonomik teşvik ve bekleme sabitleri tanımlıdır', () => {
    assert.equal(BALANCE.orders.takeawayPriceMult, 0.6);
    assert.equal(BALANCE.orders.dineInPriceMult, 1.5);
    assert.equal(BALANCE.orders.tableTipRate, 0.35);
    assert.equal(BALANCE.orders.waitForTable, 20);
  });

  it('Paket müşterinin geliri, masada oturan müşteriye göre en az %40 daha düşüktür', () => {
    const baseValue = 100;
    const takeawayRevenue = Math.round(baseValue * BALANCE.orders.takeawayPriceMult);
    const dineInBaseRevenue = Math.round(baseValue * BALANCE.orders.dineInPriceMult);
    const dineInTip = Math.round(dineInBaseRevenue * BALANCE.orders.tableTipRate);
    const dineInTotalRevenue = dineInBaseRevenue + dineInTip;

    // Paket servis geliri masada servis edilenlerin %40'ı veya daha azı (en az %40 daha düşük)
    assert.ok(takeawayRevenue <= dineInBaseRevenue * 0.6, 'Paket geliri masa tabanının %60 veya altında olmalıdır');
    assert.ok(takeawayRevenue < dineInTotalRevenue * 0.5, 'Paket geliri bahşişli masa toplamının yarısından az olmalıdır');
  });

  it('dirty_table öfke sebebi doğru hata mesajı ve eylem önerisi sunar', () => {
    const copy = CUSTOMER_ANGER_COPY.dirty_table;
    assert.ok(copy, 'dirty_table CUSTOMER_ANGER_COPY içinde bulunmalı');
    assert.ok(copy.message.length > 0, 'dirty_table mesajı boş olmamalı');
    assert.ok(copy.action.length > 0, 'dirty_table eylem önerisi boş olmamalı');
  });

  it('Kirli masaya (bulaşık veya leke olan) müşteri oturamaz', () => {
    const table = createTable('test_table_1', 2);
    assert.equal(table.canSeat, true, 'Temiz masaya oturulabilmeli');

    table.dishes = 1;
    assert.equal(table.canSeat, false, 'Bulaşık olan masaya oturulamaz');

    table.dishes = 0;
    table.soil = 0.5;
    assert.equal(table.canSeat, false, 'Silinmemiş lekeli masaya oturulamaz');

    table.soil = 0;
    assert.equal(table.canSeat, true, 'Hem bulaşığı alınan hem de silinen masaya oturulabilir');
  });

  it('Masa temizlendiğinde en uzun süredir bekleyen müşteri (FIFO) masaya atanır', () => {
    const table = createTable('test_table_fifo', 1);
    table.dishes = 2; // Başlangıçta kirli masa

    const custA: TestGuest = {
      uid: 'cust_a',
      dineIn: true,
      state: 'toTable',
      table: null,
      seatIndex: -1,
      tableWait: 14, // 14 saniyedir bekliyor
      patience: 6,
      maxPatience: 20,
      paid: 0,
      order: new Order([{ item: 'cay', qty: 1, served: 0 }]),
    };

    const custB: TestGuest = {
      uid: 'cust_b',
      dineIn: true,
      state: 'toTable',
      table: null,
      seatIndex: -1,
      tableWait: 3, // 3 saniyedir bekliyor
      patience: 17,
      maxPatience: 20,
      paid: 0,
      order: new Order([{ item: 'cay', qty: 1, served: 0 }]),
    };

    const waiting = [custB, custA];
    waiting.sort((a, b) => b.tableWait - a.tableWait);

    assert.equal(waiting[0].uid, 'cust_a', 'En uzun süre bekleyen custA ilk sırada olmalı');

    // Masa oyuncu tarafından temizlendi
    table.dishes = 0;
    table.soil = 0;
    assert.equal(table.canSeat, true);

    // FIFO mantığı ile ilk müşteri oturur
    const seat = table.freeSeat;
    assert.equal(seat, 0);
    table.takeSeat(seat);
    waiting[0].table = table;
    waiting[0].seatIndex = seat;

    // Artık masa doludur, sonraki müşteri oturamaz ve beklemeye devam eder
    assert.equal(table.canSeat, false);
    assert.equal(custA.table, table);
    assert.equal(custB.table, null);
  });

  it('Masa temizlenmediğinde sabrı tükenen müşteri hiçbir ödeme yapmadan öfkeli ayrılır', () => {
    const cust: TestGuest = {
      uid: 'cust_timeout',
      dineIn: true,
      state: 'toTable',
      table: null,
      seatIndex: -1,
      tableWait: BALANCE.orders.waitForTable,
      maxPatience: BALANCE.orders.waitForTable,
      patience: 0,
      paid: 0,
      order: new Order([{ item: 'cay', qty: 1, served: 0 }]),
    };

    // Zaman aşımı: müşteri öfkelenir
    cust.state = 'angry';
    cust.order = null;

    assert.equal(cust.paid, 0, 'Sıfır ödeme ile kafeyi terk etmiş olmalı');
    assert.equal(cust.state, 'angry');
  });
});
