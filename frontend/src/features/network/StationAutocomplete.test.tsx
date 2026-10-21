import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import * as api from "./api";
import { StationAutocomplete } from "./StationAutocomplete";
import type { Station } from "./types";

vi.mock("./api");

function Harness({ onPick }: { onPick: (s: Station | null) => void }) {
  const [value, setValue] = useState<Station | null>(null);
  return (
    <StationAutocomplete
      label="From"
      value={value}
      onChange={(s) => {
        setValue(s);
        onPick(s);
      }}
    />
  );
}

function setup(onPick = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <Harness onPick={onPick} />
    </QueryClientProvider>,
  );
  return onPick;
}

describe("StationAutocomplete", () => {
  it("suggests stations and selects one with the keyboard", async () => {
    vi.mocked(api.searchStations).mockResolvedValue({
      items: [
        { station_code: "CNB", name: "KANPUR CENTRAL" },
        { station_code: "KNE", name: "KANPUR ANWARGANJ" },
      ],
      page: 1,
      page_size: 8,
      total: 2,
    });
    const onPick = setup();
    const input = screen.getByRole("combobox", { name: "From" });

    await userEvent.type(input, "kanp");
    expect(await screen.findByRole("option", { name: /KANPUR CENTRAL/ })).toBeInTheDocument();
    expect(api.searchStations).toHaveBeenCalledWith("kanp");

    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenLastCalledWith({ station_code: "KNE", name: "KANPUR ANWARGANJ" });
    expect(input).toHaveValue("KANPUR ANWARGANJ (KNE)");
  });

  it("does not search for a single character", async () => {
    vi.mocked(api.searchStations).mockClear();
    setup();

    await userEvent.type(screen.getByRole("combobox"), "k");
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));

    expect(api.searchStations).not.toHaveBeenCalled();
  });

  it("clears the selection when the user edits the text", async () => {
    vi.mocked(api.searchStations).mockResolvedValue({
      items: [{ station_code: "CNB", name: "KANPUR CENTRAL" }],
      page: 1,
      page_size: 8,
      total: 1,
    });
    const onPick = setup();

    await userEvent.type(screen.getByRole("combobox"), "kanp");
    await userEvent.click(await screen.findByRole("option"));
    await userEvent.type(screen.getByRole("combobox"), "x");

    expect(onPick).toHaveBeenLastCalledWith(null);
  });
});
