# Supplemental upgrade requirements

Sources: user-provided upg_res_0.4.0.csv (archived in docs/data) and the S4 pet EXP screenshot supplied with this task.

- CSV Level/TO is the destination level: the supplied example says equipment 99 -> 100 needs 9,280 ore. Application rows are transitions L -> L + 1, so the loader evaluates the formula at L + 1.
- Requirements are step * round((Base + Slope * Level) / step), with step 5 for equipment, skills and relics, and step 10 for pets. A zero slope or base is a valid formula parameter; a zero computed upgrade cost is missing data.
- Each category's first CSV block is its normal-level curve through the selected season cap. Earlier normal-level segments remain available. The second block is the selected season's extension beyond that cap; it must not be substituted for an unknown first-block segment.
- S4 pet destination levels 167 through 190 use all 24 EXP values from the screenshot. They replace the question-mark segment, not the adjacent measured/formula ranges.
- The loader adds missing transition rows within the supplied ranges and fills missing, nonnumeric or zero main requirements: equipment ore, skill essence, relic sand and pet EXP. Positive values already in the live Google Sheet remain authoritative.
- The user confirmed that one freeze-dried food supplies 50 EXP in every season. Missing pet food costs use cost_exp / 50, preserving exact equivalents without rounding each transition. Positive food costs from the live sheet are preserved; absent EXP remains unavailable.
- The CSV does not specify Rola or other secondary-material formulas. Missing secondary costs remain unavailable; no fixed ratio is inferred from isolated rows.
- This supplements the website at load time. It does not modify the external Google Sheet.

Upgrade availability is checked per material over the requested transitions only. Blank, zero, nonnumeric, missing rows and unavailable tables must not appear as satisfied requirements. Earlier missing transitions must not prevent a later fully known range from being calculated. Equal current/target levels require no materials.

## Screenshot observations recorded on 2026-10-19

The canonical Google workbook now preserves the two user-provided screenshots in separate source tabs:

- [S6升級需求](https://docs.google.com/spreadsheets/d/1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E/edit#gid=106190601), `A1:L18`: 14 progression milestones, material requirements in units of 10,000, original blanks, and source notes. The two level-220 rows are distinct milestones and must both be retained.
- [小推車升級需求](https://docs.google.com/spreadsheets/d/1boxKipNVI-tCaJEaX-AoOTijEgKcxKfilhbtxkLbX-E/edit#gid=106190602), `A1:E14`: seven cart types for the 342-to-432 upgrade interval. The screenshot total is retained alongside formula-based item sums and differences; the supplied totals do not match the item sums.

The user confirmed that each S6 material figure is the total for all items in that category upgrading from the previous milestone to the current milestone. The cart figures are each cart type's total construction requirements for the entire 342-to-432 interval.

These are source observations, not single-level transition rows. They are not loaded by the current calculator. Do not apply a full-category total to each individual item, spread interval totals evenly across levels, or treat blank cells as zero. Cart construction requirements must not be used as hourly production rates. Existing canonical transition tables and append-only history were left unchanged.
