# Scenario authoring

Scenarios are version-controlled JSON files in `app/data/scenarios/`, loaded at startup.
No database migration is needed to add or edit one — restart the server.

## File shape

Top-level fields: `id`, `slug`, `name`, `short_description`, `full_description`,
`difficulty` (Beginner|Intermediate|Advanced), `estimated_minutes`, `patient_id`
(must exist in `app/data/patients.json`), `objectives[]`, `required_tools[]`
(ids from `instruments.json`), `body_regions[]` (ids from `anatomy_regions.json`),
`scoring_weights` (must sum to 1.0), `is_available`, `steps[]`.

## Steps

```json
{
  "id": "select_right_forearm",
  "order": 3,
  "phase": "identify",
  "title": "Select the injured body region",
  "instruction": "Select the right forearm directly on the virtual patient.",
  "hint": "The patient reports pain around the right forearm.",
  "required_action": "select_body_region",
  "required_target": "right_forearm",
  "required_tool": null,
  "allowed_tools": [],
  "completion_rule": { "type": "exact_action", "action": "select_body_region", "target": "right_forearm" },
  "score_value": 4,
  "safety_critical": true,
  "checklist_key": "identify",
  "metric_category": "patient_assessment"
}
```

- `phase` — one of the frontend's 7 procedure phases (`review`, `identify`, `assess`,
  `prepare`, `instruments`, `suture`, `complete`).
- `checklist_key` — optional; flips that checklist entry when the step completes.
- `metric_category` — which scoring category the step primarily trains.
- `required_tool` — if set, the tool must be the session's selected tool when the
  completing action arrives (except for `select_tool` steps themselves).
- `safety_critical: true` steps appear in `critical_errors` if skipped.

## Completion rules

| type | fields | completes when |
|---|---|---|
| `exact_action` | `action`, optional `target` | event action (and target/body_region) match |
| `tool_selected` | `tool_id` | a `select_tool` event carries that tool |
| `metric_threshold` | `metric`, `operator` (`<=,<,>=,>,equals`), `value` | event metadata or stored engine state satisfies the comparison |
| `ordered_actions` | `actions[]` | the listed keys arrive in order (matched against event `target`, `metadata.throw`, or `action`); progress persists across events |
| `all_conditions` | `conditions[]` of `{field, operator, value}` | every condition holds; fields resolve from the event, its metadata, or session context (`selected_tool`, `selected_region`, `camera_mode`) |

## Language rules

All text must stay clearly framed as **simulation** ("training area", "virtual patient",
"simulated wound"). Never write medication doses, diagnoses, or real-patient guidance —
this is an educational prototype, and the disclaimer is attached to API responses.
