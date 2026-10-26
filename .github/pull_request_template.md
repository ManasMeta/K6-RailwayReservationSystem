## What changed

<!-- One or two sentences. Keep PRs under about 400 changed lines. -->

## Group and module

- [ ] G1 Accounts  - [ ] G2 Network  - [ ] G3 Inventory  - [ ] G4 Reservations  - [ ] G5 Wallet  - [ ] G6 Operations  - [ ] Shared / platform

## Definition of done

- [ ] Any new migration applies on a fresh database and a rerun is a no-op (`python db/migrate.py up` twice)
- [ ] A merged migration was not edited: fixes are a new file in the group's number range
- [ ] At least one SQL test in `db/tests/` or a pytest case covers the happy path and one failure
- [ ] Endpoints are visible and tried in `/docs`, or a screenshot is attached for UI changes
- [ ] CI is green
- [ ] The module README is updated: endpoints, tables, and the SQL objects this change owns

## Screenshots (UI changes)

<!-- Before / after. -->

## API changes

<!-- Example request and response for new or changed endpoints. -->

## Depends on other groups

<!-- Any other group's code this relies on: tables, functions, endpoints. "None" is fine. -->
