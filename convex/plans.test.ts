import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedSupplierAndPlan } from "./testHelpers.shared";

const modules = import.meta.glob("./**/*.ts");

test("listActive includes the supplierId for each row, for lead-capture CTA wiring", async () => {
  const t = convexTest(schema, modules);
  const { supplierId } = await seedSupplierAndPlan(t);

  const rows = await t.query(api.plans.listActive, {});

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ supplierId, supplierName: "Test Supplier" });
});
