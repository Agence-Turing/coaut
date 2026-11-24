import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserTheme, normaliserThemes } from "./themes.ts";

test("un thème garde sa forme, première lettre en majuscule", () => {
  assert.equal(normaliserTheme("aventure"), "Aventure");
  assert.equal(normaliserTheme("  science-Fiction "), "Science-Fiction");
  assert.equal(normaliserTheme("Dark   Romance"), "Dark Romance");
  assert.equal(normaliserTheme("écologie"), "Écologie");
});

test("faute connue corrigée", () => {
  assert.equal(normaliserTheme("Amitiè"), "Amitié");
});

test("doublons selon la casse retirés, ordre gardé", () => {
  assert.deepEqual(normaliserThemes("aventure, Aventure, Amitiè,, fantastique"), [
    "Aventure",
    "Amitié",
    "Fantastique",
  ]);
  assert.deepEqual(normaliserThemes(["Horreur", "horreur"]), ["Horreur"]);
});
