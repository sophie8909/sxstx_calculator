# Experience Data Contract

This document defines the level-experience data used by the Gift Calculator. Keep these rules in sync with every experience calculation, formatter, ETA calculation, and level selector.

## Meaning of `cost_exp`

Each character experience row describes the transition starting at that row's level:

```text
level = L
cost_exp = experience required to go from level L to level L + 1
```

Therefore, `level = 160` and `cost_exp = 468,000,000` means the experience required to advance from level 160 to level 161. It is not the amount required to reach level 160, and it must not be read from the level-161 row when calculating level 160's next-level requirement.

## Cumulative experience definition

Let `C(L)` be the sum of transition costs for rows 1 through `L`:

```text
C(L) = cost_exp(1) + cost_exp(2) + ... + cost_exp(L)
C(0) = 0
```

The total experience required to reach the start of level `L` is `C(L - 1)`. The calculator must use these formulas:

```text
currentLevelBase = C(currentLevel - 1)
nextLevelCost    = C(currentLevel) - C(currentLevel - 1)
targetLevelCost  = C(targetLevel - 1) - C(currentLevel - 1)
remainingExp     = max(requiredExp - currentExp, 0)
```

For example, if the level-160 row contains `468,000,000`:

```text
level 160 -> 161 = C(160) - C(159) = 468,000,000
```

Any implementation that uses `C(currentLevel + 1)` for the next-level cost is off by one and must be corrected.

## Current EXP and units

Current EXP input is a display value and must be converted to an absolute value before subtraction. For S4, `0.4345` (displayed in 億) means:

```text
0.4345 * 100,000,000 = 43,450,000
```

The required EXP, current EXP, remaining EXP, and all comparisons must use absolute values. Unit formatting is allowed only after all arithmetic is complete.

## Missing S5 data

For S5 character experience data, `cost_exp = 0` means the source data is missing. It is not a real zero-cost transition. Such rows must be excluded from cumulative calculations and reported as missing data. A zero value must never make a level transition appear free or allow the calculator to silently continue through an unknown range.

## Validation cases

The calculation pipeline must satisfy these cases before a related change is considered complete:

| Required EXP | Current EXP | Expected remaining EXP |
| ---: | ---: | ---: |
| 468,000,000 | 43,450,000 | 424,550,000 |
| 468,000,000 | 100,000,000 | 368,000,000 |
| 468,000,000 | 468,000,000 | 0 |
| 468,000,000 | greater than 468,000,000 | 0 |

