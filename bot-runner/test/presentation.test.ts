import assert from "node:assert/strict";
import test from "node:test";
import { PresentationValidationError, renderTemplate } from "../src/features/presentation.js";
import type { FeatureContext } from "../src/types.js";

function render(components: unknown[], nested = false) {
  return renderTemplate({ presentations: { set_1: {
    mode: "COMPONENTS_V2",
    ...(nested ? { components_v2: { components: [{ type: 17, accent_color: "#ff00ff", components }] } } : { components }),
  } } } as unknown as FeatureContext, "set_1", {});
}

for (const nested of [false, true]) {
  for (const components of [undefined, [], Array.from({ length: 6 }, () => ({ type: 2 }))]) {
    test(`rejects ${components?.length ?? "missing"} row children before sending (${nested ? "container" : "root"})`, () => {
      assert.throws(() => render([{ type: 10, content: "Body" }, { type: 1, components }], nested), (error) => {
        assert.ok(error instanceof PresentationValidationError);
        assert.ok(error.message.includes(nested ? "components[0].components[1].components" : "components[1].components"));
        return true;
      });
    });
  }
}
test("keeps one/five buttons and single selects unchanged while normalizing container color", () => {
  const rows = [1, 5].map((count) => ({ type: 1, components: Array.from({ length: count }, () => ({ type: 2, style: 5, label: "Link", url: "https://example.com" })) }));
  rows.push({ type: 1, components: [{ type: 3 }] } as typeof rows[number]);
  const result = render(rows, true);
  assert.deepEqual(result.components, [{ type: 17, accent_color: 0xff00ff, components: rows }]);
});
