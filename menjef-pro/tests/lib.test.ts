import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, formatQty, variation } from "../src/lib/format.ts";
import { resolvePeriod } from "../src/lib/period.ts";
import { toCsv } from "../src/lib/csv.ts";
import { parseAmount, searchTerm, isUuid } from "../src/lib/utils.ts";

test("formatMoney affiche des francs CFA sans décimales", () => {
  assert.equal(formatMoney(12500), "12 500 F CFA");
  assert.equal(formatMoney("1000000.4"), "1 000 000 F CFA");
  assert.equal(formatMoney(null), "0 F CFA");
  assert.equal(formatMoney(2500, false), "2 500");
});

test("formatQty conserve jusqu'à 3 décimales", () => {
  assert.equal(formatQty(1.5), "1,5");
  assert.equal(formatQty("2.125"), "2,125");
});

test("variation renvoie null sans base de comparaison", () => {
  assert.equal(variation(100, 0), null);
  assert.equal(variation(150, 100), 50);
  assert.equal(variation(50, 100), -50);
});

test("resolvePeriod calcule des bornes [début, fin[ en UTC (= Dakar)", () => {
  const now = new Date("2026-10-29T15:30:00Z");
  const today = resolvePeriod("today", undefined, undefined, now);
  assert.equal(today.from.toISOString(), "2026-10-29T00:00:00.000Z");
  assert.equal(today.to.toISOString(), "2026-10-30T00:00:00.000Z");
  const lastMonth = resolvePeriod("last_month", undefined, undefined, now);
  assert.equal(lastMonth.from.toISOString(), "2026-09-01T00:00:00.000Z");
  assert.equal(lastMonth.to.toISOString(), "2026-10-01T00:00:00.000Z");
  const year = resolvePeriod("year", undefined, undefined, now);
  assert.equal(year.from.toISOString(), "2026-01-01T00:00:00.000Z");
  const custom = resolvePeriod("custom", "2026-10-01", "2026-10-15", now);
  assert.equal(custom.to.toISOString(), "2026-10-16T00:00:00.000Z");
  assert.equal(resolvePeriod("custom", "2026-10-15", "2026-10-01", now).key, "month", "période inversée refusée");
  assert.equal(resolvePeriod("inconnu", undefined, undefined, now).key, "month");
});

test("toCsv échappe les séparateurs et neutralise les formules", () => {
  const csv = toCsv(["a", "b"], [["x;y", '=HYPERLINK("x")'], [-12, null]]);
  assert.ok(csv.startsWith("﻿a;b\r\n"));
  assert.ok(csv.includes('"x;y"'));
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes("-12;\r\n"), "les nombres négatifs restent intacts");
});

test("parseAmount accepte la virgule et les espaces", () => {
  assert.equal(parseAmount("12 500"), 12500);
  assert.equal(parseAmount("1,5"), 1.5);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
});

test("searchTerm retire les caractères de syntaxe PostgREST", () => {
  assert.equal(searchTerm("riz,name.eq.x)"), "riz name.eq.x");
  assert.equal(searchTerm('%"*'), "");
  assert.ok(isUuid("00000000-0000-0000-0000-00000000000a"));
  assert.ok(!isUuid("abc"));
});
