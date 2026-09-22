# MuscleMetrics Design System

> Source of truth: `ui/tokens/theme.ts` and reusable components under `ui/`. Do not invent a parallel visual system for new features.

## Brand palette
| Token | Value | Role |
|---|---|---|
| Metric Blue | `#2563EB` | Primary actions, selected/active state, core brand |
| Momentum Green | `#22C55E` | Success, positive progress |
| Peak Gold | `#F59E0B` | Warning/highlight/achievement emphasis |
| Controlled Red | `#EF4444` | Destructive/error state |

### Light
- Background: `#F9FAFB`
- Surface: `#FFFFFF`
- Text: `#0F172A`
- Muted text: `#475569`
- Border: `#E5E7EB`

### Dark
- Background: `#0B1220`
- Surface: `#111827`
- Text: `#F8FAFC`
- Muted text: `#94A3B8`
- Border: `#1F2937`

Use semantic theme values (`colors.primary`, `colors.surface`, etc.) in components rather than hard-coding palette values.

## Typography
The token system specifies Inter:
- Regular: Inter 400
- Medium: Inter 500
- Semibold: Inter 600
- Bold: Inter 700

Scale:
| Role | Size | Line height |
|---|---:|---:|
| Hero | 36 | 44 |
| H1 | 24 | 30 |
| H2 | 20 | 26 |
| H3 | 18 | 24 |
| Body | 16 | 22 |
| Sub | 14 | 20 |
| Meta | 12 | 16 |

## Spacing
- xs: 6
- sm: 10
- md: 14
- lg: 18
- xl: 24
- xxl: 32

## Radius
- sm: 10
- md: 14
- lg: 18
- xl: 22
- pill: 999

## Existing primitives
Before creating a new component, check `ui/`. Existing primitives cover:
- buttons and icon buttons;
- segmented controls;
- cards, rows, chips and stat pills;
- loading, empty, error and authentication states;
- progress indicators and pills/badges;
- form controls;
- screen/section/safe-scroll/sticky-footer layout;
- modal/action sheets;
- headers/back actions;
- workout media.

## Interaction rules
- Minimum interactions should remain comfortable for one-handed mobile use.
- Use `layout.hitSlop`/appropriate hit slop for compact icon actions.
- Pressed, loading, disabled, success and destructive states must be explicit.
- Respect safe areas.
- New screens must work in both light and dark schemes.
- Tablet/wide layouts should constrain readable content rather than stretching cards indefinitely.

## Product visual character
MuscleMetrics should feel:
- data-led but approachable;
- clean rather than decorative;
- athletic without bodybuilding clichés;
- premium without hiding core functionality behind artificial visual locks;
- consistent between workout logging and analytics.

Avoid:
- neon/gym-grunge visual language;
- excessive gradients;
- arbitrary colours for individual screens;
- inconsistent card radii or spacing;
- tiny analytics labels;
- recreating existing primitives locally.

## Charts and analytics
- Use semantic brand colours consistently.
- Always pair visual trends with understandable labels/insight text where useful.
- Charts should prioritise legibility over density.
- Explain non-obvious calculations (especially e1RM/predictions).
- Empty/insufficient-data states must explain what the user needs to log next.

## Development rule
New UI should consume `useAppTheme()` and existing tokens/components. A new token or primitive should be added centrally only when an existing semantic role cannot represent the design.
