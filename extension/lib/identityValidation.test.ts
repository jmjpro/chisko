import { expect, test } from "vitest";
import { isValidIsraeliId, isValidPassportNumber } from "./identityValidation";

test("accepts a 9-digit ID with a valid checksum", () => {
  expect(isValidIsraeliId("123456782")).toBe(true);
});

test("rejects a 9-digit ID with an invalid checksum", () => {
  expect(isValidIsraeliId("123456789")).toBe(false);
});

test("rejects an ID with fewer than 9 digits", () => {
  expect(isValidIsraeliId("12345674")).toBe(false);
});

test("rejects input containing non-digit characters", () => {
  expect(isValidIsraeliId("12345-782")).toBe(false);
});

test("accepts an 8-digit passport number", () => {
  expect(isValidPassportNumber("12345678")).toBe(true);
});

test("rejects a passport number that isn't exactly 8 digits", () => {
  expect(isValidPassportNumber("1234567")).toBe(false);
  expect(isValidPassportNumber("123456789")).toBe(false);
  expect(isValidPassportNumber("1234567a")).toBe(false);
});
