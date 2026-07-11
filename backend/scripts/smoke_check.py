"""End-to-end smoke check: full forearm-laceration run through the real app."""
import os, sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))
os.chdir(__import__("pathlib").Path(__file__).resolve().parents[1])
os.environ["DATABASE_URL"] = "sqlite:///./smoke_test.db"
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db

init_db()
c = TestClient(app)

def ok(r, code=200):
    assert r.status_code == code, f"{r.request.method} {r.request.url} -> {r.status_code}: {r.text[:300]}"
    return r.json()

# catalog
assert ok(c.get("/api/v1/health"))["status"] == "ok"
scenarios = ok(c.get("/api/v1/scenarios"))
assert len(scenarios) == 4, scenarios
detail = ok(c.get("/api/v1/scenarios/forearm-laceration"))
assert detail["id"] == "scenario_forearm_laceration" and len(detail["steps"]) == 21
patient = ok(c.get("/api/v1/scenarios/scenario_forearm_laceration/patient"))
assert patient["display_name"] == "Alex Morgan"
tools = ok(c.get("/api/v1/scenarios/forearm-laceration/tools"))
assert len(tools) == 9
ok(c.get("/api/v1/instruments/needle_holder/parts"))
assert ok(c.get("/api/v1/instruments/Needle%20holder"))["id"] == "needle_holder"  # label adapter
regions = ok(c.get("/api/v1/anatomy/regions"))
assert any(r["id"] == "right_forearm" for r in regions)
q = ok(c.post("/api/v1/patients/patient_forearm_01/questions", json={"question_id": "allergy_status"}))
assert "allergies" in q["answer"]
ok(c.post("/api/v1/patients/patient_forearm_01/questions", json={"question_id": "bogus"}), 404)

# real OpenCV pipeline initializes and safely handles a frame without a marker
import cv2, numpy as np
encoded, blank_frame = cv2.imencode(".jpg", np.zeros((256, 256, 3), dtype=np.uint8))
assert encoded
vision = ok(c.post("/api/v1/vision/frame", data={"mode": "opencv"},
                   files={"frame": ("frame.jpg", blank_frame.tobytes(), "image/jpeg")}))
assert vision["processed"] and vision["mode"] == "opencv" and isinstance(vision["hands"], list)

# session lifecycle
created = ok(c.post("/api/v1/sessions", json={"scenario_id": "forearm-laceration", "mode": "virtual_patient"}), 201)
sid = created["session"]["id"]
assert created["websocket_channel"] == f"/ws/sessions/{sid}"

# events before start -> 409
r = c.post(f"/api/v1/sessions/{sid}/events", json={"action": "review_patient"})
assert r.status_code == 409, r.text

ok(c.post(f"/api/v1/sessions/{sid}/start"))
ok(c.post(f"/api/v1/sessions/{sid}/pause"))
ok(c.post(f"/api/v1/sessions/{sid}/resume"))

def ev(action, **kw):
    return ok(c.post(f"/api/v1/sessions/{sid}/events", json={"action": action, **kw}))

# wrong region rejected
r = ev("select_body_region", target="Head", elapsed_ms=1000)
# step 1 is review_patient, so this is out-of-order/wrong — must be rejected
assert r["accepted"] is False

# out-of-order suture attempt rejected with assessment message
r = ev("begin_stitch", target="entry_zone")
assert r["accepted"] is False and r["feedback"][0]["code"] in ("ASSESSMENT_FIRST", "OUT_OF_ORDER")

steps = [
    ("review_patient", {}),
    ("ask_patient", {"target": "allergy_status"}),
    ("select_body_region", {"target": "Right arm"}),  # frontend label adapter
    ("inspect", {"target": "right_forearm"}),
    ("check_pulse", {}),
    ("check_sensation", {}),
    ("check_movement", {}),
]
for action, kw in steps:
    r = ev(action, elapsed_ms=5000, **kw)
    assert r["accepted"] and r["step_completed"], (action, r)

# gloves: requires selected tool
r = ev("apply_gloves", tool_id="gloves")
if not r["step_completed"]:
    ev("select_tool", tool_id="gloves"); r = ev("apply_gloves")
    assert r["step_completed"], r

ev("select_tool", tool_id="antiseptic")
assert ev("clean_training_area")["step_completed"]
ev("select_tool", tool_id="sterile_drape")
assert ev("apply_drape")["step_completed"]

# instrument selection with frontend label
r = ev("select_tool", tool_id="Needle holder")
assert r["step_completed"] and r["completed_step_id"] == "select_needle_holder", r
assert ev("select_tool", tool_id="forceps")["step_completed"]

# wrong tool for positioning
ev("select_tool", tool_id="forceps")
r = ev("position_tool", metadata={"entry_error_mm": 4.6})
assert not r["step_completed"] and any(f["code"] == "WRONG_TOOL" for f in r["feedback"]), r
ev("select_tool", tool_id="needle_holder")
assert ev("position_tool", metadata={"entry_error_mm": 4.6})["step_completed"]
assert ev("begin_stitch", target="entry_zone")["step_completed"]
assert ev("advance_needle", metadata={"position_variance": 0.1})["step_completed"]
assert ev("reach_exit", target="exit_zone", metadata={"exit_error_mm": 7.2})["step_completed"]
assert ev("pull_suture")["step_completed"]

# ordered knot throws
r = ev("knot_action", target="knot_throw_1"); assert not r["step_completed"]
r = ev("knot_action", target="knot_throw_2"); assert not r["step_completed"]
r = ev("knot_action", target="knot_throw_3"); assert r["step_completed"], r

ev("select_tool", tool_id="surgical_scissors")
assert ev("cut_suture")["step_completed"]
assert ev("inspect", target="right_forearm")["step_completed"]

# hint before final step
hint = ok(c.post(f"/api/v1/sessions/{sid}/coach/hint"))
assert hint["related_step_id"] == "complete_procedure"

# vision metrics + trajectory
ok(c.post(f"/api/v1/sessions/{sid}/vision-metrics", json={
    "timestamp_ms": 90000, "tracking_confidence": 0.96, "tool_angle_deg": 58,
    "entry_error_mm": 4.8, "path_length_px": 318, "ideal_path_length_px": 260,
    "position_variance": 0.12}))
ok(c.post(f"/api/v1/sessions/{sid}/trajectory", json={"points": [
    {"timestamp_ms": 1000 + i, "x": 0.4, "y": 0.3, "confidence": 0.95, "tool_id": "needle_holder"}
    for i in range(10)]}))
traj = ok(c.get(f"/api/v1/sessions/{sid}/trajectory"))
assert traj["point_count"] == 10

# final step completes scenario + auto-finalizes
r = ev("complete_step", elapsed_ms=600000)
assert r["scenario_completed"], r

result = ok(c.get(f"/api/v1/sessions/{sid}/results"))
assert result["grade"] and result["final_score"] > 0 and result["event_timeline"], result["final_score"]
assert result["metrics"]["entry_accuracy"] == 90  # 4.8mm -> 90 band
coach = ok(c.get(f"/api/v1/sessions/{sid}/coach"))
assert len(coach) > 5

# results listing
all_results = ok(c.get("/api/v1/results"))
assert any(res["session_id"] == sid for res in all_results)

# vision frame (mock)
frame = ok(c.post("/api/v1/vision/frame", files={"frame": ("f.jpg", b"\xff\xd8fakejpegdata", "image/jpeg")},
                  data={"session_id": sid, "mode": "mock"}))
assert frame["processed"] and frame["mode"] == "mock" and frame["tools"]

# websocket
with c.websocket_connect(f"/ws/sessions/{sid}") as ws:
    ws.send_json({"type": "ping"})
    assert ws.receive_json()["type"] == "pong"
    ws.send_json({"type": "subscribe"})
    msg = ws.receive_json()
    assert msg["type"] == "session.updated" and msg["payload"]["status"] == "completed"

# session state machine guards
ok(c.post(f"/api/v1/sessions/{sid}/start"), 409)
ok(c.get("/api/v1/sessions/nope"), 404)

print("SMOKE OK — final_score:", result["final_score"], "grade:", result["grade"])
print("metrics:", result["metrics"])
