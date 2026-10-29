import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { test } from "vitest";

import { retime, spanOf, vtt, vttTime, writeConcatList } from "./take.mjs";

test("vttTime writes WebVTT timestamps", () => {
  assert.equal(vttTime(0), "00:00:00.000");
  assert.equal(vttTime(62.5), "00:01:02.500");
  assert.equal(vttTime(3661.007), "01:01:01.007");
});

test("retime plays the marked waits faster and leaves the rest alone", () => {
  const spans = [[10, 30, 10]]; // a 20 s wait played at 10x lasts 2 s
  assert.equal(retime(5, spans), 5);
  assert.equal(retime(10, spans), 10);
  assert.equal(retime(20, spans), 11);
  assert.equal(retime(30, spans), 12);
  assert.equal(retime(40, spans), 22);
});

test("vtt gives each beat its sentence in the language asked, never a cue without words", () => {
  const words = { a: { en: "First.", fr: "D'abord." }, b: { en: "Then.", fr: "Ensuite." }, c: { en: "" } };
  const beats = [{ id: "a", at: 0 }, { id: "b", at: 4 }, { id: "c", at: 8 }];
  const en = vtt(beats, words, "en", 10);
  assert.match(en, /^WEBVTT/);
  assert.match(en, /00:00:00\.000 --> 00:00:03\.900\nFirst\./);
  assert.match(en, /00:00:04\.000 --> 00:00:07\.900\nThen\./);
  assert.doesNotMatch(en, /00:00:08/);
  assert.match(vtt(beats, words, "fr", 10), /D'abord\./);
});

test("spanOf is the time from the first frame to the last, 0 without frames", () => {
  assert.equal(spanOf([]), 0);
  assert.equal(spanOf([{ t: 10 }, { t: 10.5 }, { t: 12.25 }]), 2.25);
});

test("writeConcatList holds each frame until the next one and ends on the last file", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "take-"));
  try {
    const frames = [{ t: 1, data: Buffer.from("a").toString("base64") }, { t: 1.5, data: Buffer.from("b").toString("base64") }];
    const list = readFileSync(writeConcatList(frames, dir), "utf8").split("\n");
    assert.deepEqual(readdirSync(dir).sort(), ["00000.jpg", "00001.jpg", "list.txt"]);
    assert.equal(readFileSync(path.join(dir, "00001.jpg"), "utf8"), "b");
    assert.equal(list[0], `file '${path.join(dir, "00000.jpg")}'`);
    assert.equal(list[1], "duration 0.50000");
    assert.equal(list[3], `duration ${(1 / 30).toFixed(5)}`); // the last frame: one 30 fps tick
    assert.equal(list[4], `file '${path.join(dir, "00001.jpg")}'`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
