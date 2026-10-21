import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { searchStations } from "./api";
import type { Station } from "./types";
import { useDebouncedValue } from "./useDebouncedValue";

interface Props {
  label: string;
  value: Station | null;
  onChange: (station: Station | null) => void;
}

const display = (s: Station) => `${s.name} (${s.station_code})`;

export function StationAutocomplete({ label, value, onChange }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(value ? display(value) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Show the chosen station when the parent sets it (for example the swap button).
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (value) setText(display(value));
    else if (lastValue && text === display(lastValue)) setText("");
  }

  const query = useDebouncedValue(text.trim(), 250);
  const searching = open && !value && query.length >= 2;
  const { data, isFetching, isError } = useQuery({
    queryKey: ["stations", query],
    queryFn: () => searchStations(query),
    enabled: searching,
    staleTime: 60_000,
  });
  const options = searching ? (data?.items ?? []) : [];

  function choose(station: Station) {
    onChange(station);
    setText(display(station));
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && open && options[active]) {
      event.preventDefault();
      choose(options[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="field autocomplete">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={options[active] ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        placeholder="Station name or code"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setActive(0);
          if (value) onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" aria-label={`${label} suggestions`} hidden={options.length === 0}>
        {options.map((station, index) => (
          <li
            key={station.station_code}
            id={`${id}-opt-${index}`}
            role="option"
            aria-selected={index === active}
            className={index === active ? "active" : undefined}
            onMouseDown={(e) => {
              e.preventDefault(); // keep focus so blur does not close the list first
              choose(station);
            }}
          >
            <span>{station.name}</span>
            <code>{station.station_code}</code>
          </li>
        ))}
      </ul>
      {searching && !isFetching && !isError && options.length === 0 && (
        <p className="hint" role="status">No stations match “{query}”.</p>
      )}
      {isError && <p className="hint error" role="alert">Could not load stations.</p>}
    </div>
  );
}
