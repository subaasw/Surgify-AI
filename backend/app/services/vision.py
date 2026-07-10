"""Vision adapters: mock (default, deterministic), opencv (ArUco/color markers), mediapipe (optional).

Every adapter returns the same result shape and never raises on bad frames —
low confidence + a warning instead.
"""
import hashlib
import uuid

from ..config import get_settings

settings = get_settings()


def _frame_id() -> str:
    return f"frame_{uuid.uuid4().hex[:10]}"


class MockAdapter:
    """Deterministic pseudo-detections derived from the frame bytes hash."""
    mode = "mock"

    def process(self, data: bytes, session_id: str | None) -> dict:
        h = hashlib.sha256(data).digest()
        f = [b / 255 for b in h[:8]]
        return {
            "frame_id": _frame_id(),
            "session_id": session_id,
            "processed": True,
            "mode": self.mode,
            "tracking_confidence": round(0.90 + f[0] * 0.09, 2),
            "hands": [],
            "tools": [{
                "class_id": "needle_holder",
                "confidence": round(0.88 + f[1] * 0.11, 2),
                "bbox": {"x": round(0.35 + f[2] * 0.2, 2), "y": round(0.15 + f[3] * 0.2, 2),
                         "width": 0.18, "height": 0.35},
                "tip": {"x": round(0.45 + f[4] * 0.15, 2), "y": round(0.40 + f[5] * 0.15, 2)},
            }],
            "metrics": {
                "entry_error_mm": round(2 + f[6] * 6, 1),
                "tool_angle_deg": round(45 + f[7] * 15),
                "stability": round(75 + f[0] * 20),
                "motion_efficiency": round(70 + f[1] * 25),
            },
            "warnings": [],
        }


class OpenCVAdapter:
    """ArUco + HSV color-marker tool-tip detection. Degrades gracefully."""
    mode = "opencv"

    def process(self, data: bytes, session_id: str | None) -> dict:
        result = {
            "frame_id": _frame_id(), "session_id": session_id, "processed": True,
            "mode": self.mode, "tracking_confidence": 0.0, "hands": [], "tools": [],
            "metrics": {}, "warnings": [],
        }
        try:
            import cv2
            import numpy as np
        except ImportError:
            result["warnings"].append("OpenCV is not installed; no detection performed.")
            return result

        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            result["warnings"].append("Frame could not be decoded as an image.")
            return result
        h, w = img.shape[:2]

        # ArUco markers (training-board corners / tool markers)
        try:
            aruco = cv2.aruco
            dictionary = aruco.getPredefinedDictionary(getattr(aruco, settings.aruco_dictionary))
            corners, ids, _ = aruco.ArucoDetector(dictionary, aruco.DetectorParameters()).detectMarkers(img)
            if ids is not None and len(ids):
                result["tracking_confidence"] = 0.9
                for marker_corners, marker_id in zip(corners, ids.flatten()):
                    c = marker_corners[0]
                    result["tools"].append({
                        "class_id": f"aruco_{int(marker_id)}", "confidence": 0.9,
                        "bbox": {"x": float(c[:, 0].min() / w), "y": float(c[:, 1].min() / h),
                                 "width": float((c[:, 0].max() - c[:, 0].min()) / w),
                                 "height": float((c[:, 1].max() - c[:, 1].min()) / h)},
                        "tip": {"x": float(c[:, 0].mean() / w), "y": float(c[:, 1].mean() / h)},
                    })
        except Exception:
            result["warnings"].append("ArUco detection unavailable in this OpenCV build.")

        # Color-marker centroid (tool tip)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, (settings.tool_marker_h_min, 80, 80), (settings.tool_marker_h_max, 255, 255))
        moments = cv2.moments(mask)
        if moments["m00"] > 500:
            cx, cy = moments["m10"] / moments["m00"] / w, moments["m01"] / moments["m00"] / h
            result["tracking_confidence"] = max(result["tracking_confidence"], 0.8)
            result["tools"].append({
                "class_id": "color_marker_tool", "confidence": 0.8,
                "bbox": {"x": max(0.0, cx - 0.05), "y": max(0.0, cy - 0.05), "width": 0.1, "height": 0.1},
                "tip": {"x": cx, "y": cy},
            })

        if not result["tools"]:
            result["tracking_confidence"] = 0.1
            result["warnings"].append("No marker detected. Check lighting and marker visibility.")
        return result


class MediaPipeAdapter:
    """Optional hand tracking. Falls back to mock if mediapipe is unavailable."""
    mode = "mediapipe"

    def process(self, data: bytes, session_id: str | None) -> dict:
        try:
            import cv2
            import mediapipe as mp
            import numpy as np
        except ImportError:
            result = MockAdapter().process(data, session_id)
            result["mode"] = self.mode
            result["warnings"].append("MediaPipe not installed; returned mock detections.")
            return result

        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        result = {
            "frame_id": _frame_id(), "session_id": session_id, "processed": True,
            "mode": self.mode, "tracking_confidence": 0.0, "hands": [], "tools": [],
            "metrics": {}, "warnings": [],
        }
        if img is None:
            result["warnings"].append("Frame could not be decoded as an image.")
            return result
        with mp.solutions.hands.Hands(static_image_mode=True, max_num_hands=2) as hands:
            detection = hands.process(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        if detection.multi_hand_landmarks:
            result["tracking_confidence"] = 0.9
            for lm in detection.multi_hand_landmarks:
                result["hands"].append({
                    "landmarks": [{"x": p.x, "y": p.y, "z": p.z} for p in lm.landmark],
                })
        else:
            result["tracking_confidence"] = 0.2
            result["warnings"].append("No hands detected in frame.")
        return result


_ADAPTERS = {"mock": MockAdapter, "opencv": OpenCVAdapter, "mediapipe": MediaPipeAdapter}


def get_adapter(mode: str | None = None):
    return _ADAPTERS.get(mode or settings.vision_mode, MockAdapter)()
