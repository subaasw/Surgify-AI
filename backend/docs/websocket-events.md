# WebSocket events

Channel: `ws://localhost:8000/ws/sessions/{session_id}` (returned as `websocket_channel`
when creating a session). Unknown session ids are closed with code `4404`.

## Envelope

Every server message:

```json
{
  "type": "session.updated",
  "session_id": "session_123",
  "timestamp": "2026-07-10T10:30:00Z",
  "payload": {}
}
```

## Server → client

| type | payload | when |
|---|---|---|
| `session.started` / `session.paused` / `session.resumed` / `session.updated` | full `SimulationSession` state | lifecycle + after every event |
| `step.completed` | `{ completed_step_id, next_step }` | a step is completed |
| `checklist.updated` | full checklist object | checklist key flips |
| `tool.selected` | `{ tool_id }` | tool selection events |
| `coach.message` | `FeedbackItem` | every coaching message |
| `metrics.updated` | `SessionMetrics` | after events / vision metrics |
| `vision.updated` | `{ tracking_confidence, tool_tip }` | vision-metrics submissions |
| `safety.warning` | `FeedbackItem` | safety zone entered / violation |
| `vitals.updated` | `PatientVitals` | every ~4 s while session is active |
| `scenario.completed` | `{ final_score, grade }` | last step done or `/complete` called |
| `pong` | `{}` | reply to `ping` |
| `error` | error body | invalid client message / rejected event |

## Client → server

| type | payload | effect |
|---|---|---|
| `ping` | — | heartbeat, answered with `pong` |
| `subscribe` | — | immediate `session.updated` snapshot |
| `session.event` | `SimulationEventRequest` | same as POST `/sessions/{id}/events` |
| `tool.pose` | free-form | acknowledged (no-op placeholder) |
| `camera.changed` | `{ camera_mode }` | updates session camera mode |
| `vision.metrics` | `VisionMetricsRequest` | acknowledged (use the REST endpoint for scoring) |

Disconnected clients are cleaned up automatically; the vitals loop stops when the last
listener disconnects or the session completes.
