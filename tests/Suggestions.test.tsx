import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Suggestions } from "@/app/dashboard/components/Suggestions";
import { buildSuggestionItems } from "@/lib/dashboard-helpers";

describe("buildSuggestionItems", () => {
  it("returns up to 3 items when setup incomplete + alerts present", () => {
    const setup = { alumnos: true, planes: true, landing: false, whatsapp: false, pagos: true };
    const items = buildSuggestionItems(setup, 2, [{ id: "1", full_name: "John", next_expiration_date: null }, { id: "2", full_name: "Jane", next_expiration_date: null }]);
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items.some((i) => i.key === "landing")).toBe(true);
    expect(items.some((i) => i.key === "whatsapp")).toBe(true);
  });

  it("returns only 'Todo en orden' when setup complete + no alerts", () => {
    const setup = { alumnos: true, planes: true, landing: true, whatsapp: true, pagos: true };
    const items = buildSuggestionItems(setup, 0, []);
    expect(items.length).toBe(1);
    expect(items[0].key).toBe("ok");
    expect(items[0].title).toBe("Todo en orden");
  });

  it("respects max 3 items limit", () => {
    const setup = { alumnos: true, planes: true, landing: false, whatsapp: false, pagos: true };
    const items = buildSuggestionItems(setup, 5, [{ id: "1", full_name: "John", next_expiration_date: null }, { id: "2", full_name: "Jane", next_expiration_date: null }, { id: "3", full_name: "Bob", next_expiration_date: null }]);
    expect(items.length).toBeLessThanOrEqual(3);
  });

  it("includes morosos item when morososCount > 0", () => {
    const setup = { alumnos: true, planes: true, landing: true, whatsapp: true, pagos: true };
    const items = buildSuggestionItems(setup, 3, []);
    expect(items.some((i) => i.key === "morosos")).toBe(true);
    expect(items[0].title).toContain("3");
  });

  it("includes expirations item when length > 0 and items.length < 3", () => {
    const setup = { alumnos: true, planes: true, landing: true, whatsapp: true, pagos: true };
    const items = buildSuggestionItems(setup, 0, [{ id: "1", full_name: "John", next_expiration_date: null }, { id: "2", full_name: "Jane", next_expiration_date: null }]);
    expect(items.some((i) => i.key === "expirations")).toBe(true);
  });

  it("verifies each item has correct key", () => {
    const setup = { alumnos: true, planes: true, landing: false, whatsapp: false, pagos: true };
    const items = buildSuggestionItems(setup, 2, [{ id: "1", full_name: "John", next_expiration_date: null }]);
    const validKeys = ["landing", "whatsapp", "morosos", "expirations", "ok"];
    items.forEach((item) => {
      expect(validKeys).toContain(item.key);
    });
  });
});

describe("Suggestions component", () => {
  it("returns null when loading is true", () => {
    const { container } = render(
      <Suggestions
        setup={{ alumnos: true, planes: true, landing: true, whatsapp: true, pagos: true }}
        morososCount={0}
        upcomingExpirations={[]}
        loading={true}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
