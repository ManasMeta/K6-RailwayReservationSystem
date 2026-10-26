import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api/client";
import { BookingPage } from "./ReservationPages";

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>Search page</p>} />
          <Route path="/book" element={<BookingPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(api, "get").mockResolvedValue({ data: [] });
});

describe("BookingPage", () => {
  it("returns to search when no train was chosen", () => {
    renderAt("/book");
    expect(screen.getByText("Search page")).toBeInTheDocument();
  });

  it("books the train and stations picked from search results", () => {
    renderAt("/book?train=12301&name=Howrah+Rajdhani&from=NDLS&to=HWH&date=2026-11-10");
    expect(screen.getByText(/Howrah Rajdhani/)).toBeInTheDocument();
    expect(screen.getByText(/NDLS/)).toBeInTheDocument();
  });
});
