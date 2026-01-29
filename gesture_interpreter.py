"""
Gesture Interpretation Agent

Interprets hand landmarks and motion data into high-level gestures.

Supported Gestures:
- STATIC: CLOSED_FIST
- DYNAMIC: SWIPE_LEFT, SWIPE_RIGHT, SWIPE_UP, SWIPE_DOWN
"""

import time
from typing import Optional
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
import json


class GestureType(Enum):
    NONE = "NONE"
    CLOSED_FIST = "CLOSED_FIST"
    SWIPE_LEFT = "SWIPE_LEFT"
    SWIPE_RIGHT = "SWIPE_RIGHT"
    SWIPE_UP = "SWIPE_UP"
    SWIPE_DOWN = "SWIPE_DOWN"


class Confidence(Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass
class LandmarkPoint:
    """Represents a single hand landmark point."""
    x: float
    y: float
    z: float
    timestamp: float = field(default_factory=time.time)


@dataclass
class HandLandmarks:
    """
    Hand landmarks following MediaPipe convention (21 landmarks).
    
    Key landmarks:
    - 0: WRIST
    - 4: THUMB_TIP
    - 8: INDEX_FINGER_TIP
    - 12: MIDDLE_FINGER_TIP
    - 16: RING_FINGER_TIP
    - 20: PINKY_TIP
    """
    landmarks: list[LandmarkPoint]
    timestamp: float = field(default_factory=time.time)
    
    @property
    def wrist(self) -> Optional[LandmarkPoint]:
        return self.landmarks[0] if len(self.landmarks) > 0 else None
    
    @property
    def thumb_tip(self) -> Optional[LandmarkPoint]:
        return self.landmarks[4] if len(self.landmarks) > 4 else None
    
    @property
    def index_tip(self) -> Optional[LandmarkPoint]:
        return self.landmarks[8] if len(self.landmarks) > 8 else None
    
    @property
    def middle_tip(self) -> Optional[LandmarkPoint]:
        return self.landmarks[12] if len(self.landmarks) > 12 else None
    
    @property
    def ring_tip(self) -> Optional[LandmarkPoint]:
        return self.landmarks[16] if len(self.landmarks) > 16 else None
    
    @property
    def pinky_tip(self) -> Optional[LandmarkPoint]:
        return self.landmarks[20] if len(self.landmarks) > 20 else None
    
    @property
    def palm_center(self) -> Optional[LandmarkPoint]:
        """Calculate approximate palm center from wrist and MCP joints."""
        if len(self.landmarks) < 13:
            return None
        # Average of wrist (0) and finger MCP joints (5, 9, 13, 17)
        relevant_indices = [0, 5, 9, 13, 17]
        x = sum(self.landmarks[i].x for i in relevant_indices if i < len(self.landmarks)) / len(relevant_indices)
        y = sum(self.landmarks[i].y for i in relevant_indices if i < len(self.landmarks)) / len(relevant_indices)
        z = sum(self.landmarks[i].z for i in relevant_indices if i < len(self.landmarks)) / len(relevant_indices)
        return LandmarkPoint(x, y, z, self.timestamp)


@dataclass
class GestureResult:
    """Output format for gesture interpretation."""
    gesture: str
    confidence: str
    isStable: bool
    
    def to_dict(self) -> dict:
        return {
            "gesture": self.gesture,
            "confidence": self.confidence,
            "isStable": self.isStable
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2)


class GestureInterpreter:
    """
    Gesture Interpretation Agent
    
    Interprets hand landmarks and motion into high-level gestures with strict rules:
    - CLOSED_FIST: Requires finger curl consistency and stability >= 500ms
    - SWIPE gestures: Require directional velocity threshold in short time window
    - Returns NONE with LOW confidence when ambiguous
    """
    
    # Configuration constants
    FIST_STABILITY_THRESHOLD_MS = 500  # Minimum stability time for fist detection
    SWIPE_TIME_WINDOW_MS = 300  # Maximum time window for swipe detection
    SWIPE_VELOCITY_THRESHOLD = 0.15  # Minimum velocity for swipe (normalized coords)
    CURL_THRESHOLD = 0.15  # Distance threshold for finger curl detection
    HISTORY_SIZE = 30  # Number of landmark frames to keep
    
    def __init__(self):
        self.landmark_history: deque[HandLandmarks] = deque(maxlen=self.HISTORY_SIZE)
        self.fist_start_time: Optional[float] = None
        self.last_gesture: GestureType = GestureType.NONE
        
    def update(self, landmarks: HandLandmarks) -> GestureResult:
        """
        Process new landmark data and return gesture interpretation.
        
        Args:
            landmarks: HandLandmarks object with current frame data
            
        Returns:
            GestureResult with gesture type, confidence, and stability
        """
        self.landmark_history.append(landmarks)
        
        # Check for static gestures first
        fist_result = self._detect_closed_fist(landmarks)
        if fist_result.gesture != GestureType.NONE.value:
            return fist_result
        
        # Check for dynamic gestures (swipes)
        swipe_result = self._detect_swipe()
        if swipe_result.gesture != GestureType.NONE.value:
            return swipe_result
        
        # No gesture detected
        self.fist_start_time = None
        self.last_gesture = GestureType.NONE
        return GestureResult(
            gesture=GestureType.NONE.value,
            confidence=Confidence.LOW.value,
            isStable=False
        )
    
    def _detect_closed_fist(self, landmarks: HandLandmarks) -> GestureResult:
        """
        Detect closed fist gesture.
        
        Requirements:
        - All fingers must be curled (fingertips close to palm)
        - Must maintain position for >= 500ms
        """
        if len(landmarks.landmarks) < 21:
            return self._none_result()
        
        # Check finger curl consistency
        curl_scores = self._calculate_finger_curls(landmarks)
        
        if curl_scores is None:
            return self._none_result()
        
        # All fingers must be curled
        all_curled = all(score < self.CURL_THRESHOLD for score in curl_scores)
        
        if not all_curled:
            self.fist_start_time = None
            return self._none_result()
        
        # Check stability duration
        current_time = landmarks.timestamp
        
        if self.fist_start_time is None:
            self.fist_start_time = current_time
            return GestureResult(
                gesture=GestureType.CLOSED_FIST.value,
                confidence=Confidence.LOW.value,
                isStable=False
            )
        
        duration_ms = (current_time - self.fist_start_time) * 1000
        
        if duration_ms >= self.FIST_STABILITY_THRESHOLD_MS:
            self.last_gesture = GestureType.CLOSED_FIST
            return GestureResult(
                gesture=GestureType.CLOSED_FIST.value,
                confidence=Confidence.HIGH.value,
                isStable=True
            )
        elif duration_ms >= self.FIST_STABILITY_THRESHOLD_MS / 2:
            return GestureResult(
                gesture=GestureType.CLOSED_FIST.value,
                confidence=Confidence.MEDIUM.value,
                isStable=False
            )
        else:
            return GestureResult(
                gesture=GestureType.CLOSED_FIST.value,
                confidence=Confidence.LOW.value,
                isStable=False
            )
    
    def _calculate_finger_curls(self, landmarks: HandLandmarks) -> Optional[list[float]]:
        """
        Calculate curl distance for each finger.
        
        Returns list of distances from fingertip to palm center.
        Lower values = more curled.
        """
        palm = landmarks.palm_center
        if palm is None:
            return None
        
        fingertips = [
            landmarks.thumb_tip,
            landmarks.index_tip,
            landmarks.middle_tip,
            landmarks.ring_tip,
            landmarks.pinky_tip
        ]
        
        if any(tip is None for tip in fingertips):
            return None
        
        # Calculate distance from each fingertip to palm center
        curl_distances = []
        for tip in fingertips:
            distance = ((tip.x - palm.x) ** 2 + 
                       (tip.y - palm.y) ** 2 + 
                       (tip.z - palm.z) ** 2) ** 0.5
            curl_distances.append(distance)
        
        return curl_distances
    
    def _detect_swipe(self) -> GestureResult:
        """
        Detect swipe gestures from motion history.
        
        Requirements:
        - Sufficient velocity in one dominant direction
        - Motion within short time window
        - Clear directional intent (no ambiguity)
        """
        if len(self.landmark_history) < 5:
            return self._none_result()
        
        # Get recent frames within time window
        current_time = self.landmark_history[-1].timestamp
        recent_frames = [
            lm for lm in self.landmark_history
            if (current_time - lm.timestamp) * 1000 <= self.SWIPE_TIME_WINDOW_MS
        ]
        
        if len(recent_frames) < 3:
            return self._none_result()
        
        # Calculate velocity from palm center movement
        start_palm = recent_frames[0].palm_center
        end_palm = recent_frames[-1].palm_center
        
        if start_palm is None or end_palm is None:
            return self._none_result()
        
        time_delta = recent_frames[-1].timestamp - recent_frames[0].timestamp
        if time_delta <= 0:
            return self._none_result()
        
        # Calculate velocity components
        velocity_x = (end_palm.x - start_palm.x) / time_delta
        velocity_y = (end_palm.y - start_palm.y) / time_delta
        
        abs_vel_x = abs(velocity_x)
        abs_vel_y = abs(velocity_y)
        
        # Check if velocity meets threshold
        if abs_vel_x < self.SWIPE_VELOCITY_THRESHOLD and abs_vel_y < self.SWIPE_VELOCITY_THRESHOLD:
            return self._none_result()
        
        # Determine dominant direction - must be clearly dominant (2x ratio)
        if abs_vel_x > abs_vel_y * 1.5:
            # Horizontal swipe
            if abs_vel_x < self.SWIPE_VELOCITY_THRESHOLD:
                return self._none_result()
            
            gesture = GestureType.SWIPE_RIGHT if velocity_x > 0 else GestureType.SWIPE_LEFT
            confidence = self._calculate_swipe_confidence(abs_vel_x, abs_vel_y)
            
        elif abs_vel_y > abs_vel_x * 1.5:
            # Vertical swipe
            if abs_vel_y < self.SWIPE_VELOCITY_THRESHOLD:
                return self._none_result()
            
            # Note: In screen coordinates, positive Y is typically down
            gesture = GestureType.SWIPE_DOWN if velocity_y > 0 else GestureType.SWIPE_UP
            confidence = self._calculate_swipe_confidence(abs_vel_y, abs_vel_x)
            
        else:
            # Ambiguous direction - return NONE
            return self._none_result()
        
        self.last_gesture = gesture
        # Clear history after swipe to prevent re-detection
        self.landmark_history.clear()
        
        return GestureResult(
            gesture=gesture.value,
            confidence=confidence.value,
            isStable=True  # Swipes are instantaneous, considered stable when detected
        )
    
    def _calculate_swipe_confidence(self, dominant_vel: float, secondary_vel: float) -> Confidence:
        """Calculate confidence based on velocity magnitude and directional clarity."""
        # Higher velocity = higher confidence
        if dominant_vel > self.SWIPE_VELOCITY_THRESHOLD * 3:
            if secondary_vel < dominant_vel * 0.3:
                return Confidence.HIGH
            return Confidence.MEDIUM
        elif dominant_vel > self.SWIPE_VELOCITY_THRESHOLD * 2:
            return Confidence.MEDIUM
        else:
            return Confidence.LOW
    
    def _none_result(self) -> GestureResult:
        """Return a NONE gesture result with LOW confidence."""
        return GestureResult(
            gesture=GestureType.NONE.value,
            confidence=Confidence.LOW.value,
            isStable=False
        )
    
    def reset(self):
        """Reset the interpreter state."""
        self.landmark_history.clear()
        self.fist_start_time = None
        self.last_gesture = GestureType.NONE


def create_landmarks_from_array(points: list[tuple[float, float, float]], 
                                 timestamp: Optional[float] = None) -> HandLandmarks:
    """
    Helper function to create HandLandmarks from array of (x, y, z) tuples.
    
    Args:
        points: List of 21 (x, y, z) tuples representing hand landmarks
        timestamp: Optional timestamp, defaults to current time
        
    Returns:
        HandLandmarks object
    """
    ts = timestamp if timestamp is not None else time.time()
    landmark_points = [LandmarkPoint(x, y, z, ts) for x, y, z in points]
    return HandLandmarks(landmarks=landmark_points, timestamp=ts)


# Example usage and testing
if __name__ == "__main__":
    interpreter = GestureInterpreter()
    
    # Simulate a closed fist (all fingertips close to palm center)
    # In real usage, these would come from the Vision Agent
    fist_landmarks = [
        (0.5, 0.7, 0.0),   # 0: WRIST
        (0.45, 0.65, 0.0), # 1: THUMB_CMC
        (0.42, 0.60, 0.0), # 2: THUMB_MCP
        (0.40, 0.55, 0.0), # 3: THUMB_IP
        (0.45, 0.52, 0.0), # 4: THUMB_TIP (curled)
        (0.48, 0.55, 0.0), # 5: INDEX_MCP
        (0.47, 0.50, 0.0), # 6: INDEX_PIP
        (0.46, 0.48, 0.0), # 7: INDEX_DIP
        (0.47, 0.50, 0.0), # 8: INDEX_TIP (curled)
        (0.50, 0.53, 0.0), # 9: MIDDLE_MCP
        (0.49, 0.48, 0.0), # 10: MIDDLE_PIP
        (0.48, 0.46, 0.0), # 11: MIDDLE_DIP
        (0.49, 0.50, 0.0), # 12: MIDDLE_TIP (curled)
        (0.52, 0.54, 0.0), # 13: RING_MCP
        (0.51, 0.49, 0.0), # 14: RING_PIP
        (0.50, 0.47, 0.0), # 15: RING_DIP
        (0.51, 0.51, 0.0), # 16: RING_TIP (curled)
        (0.54, 0.56, 0.0), # 17: PINKY_MCP
        (0.53, 0.52, 0.0), # 18: PINKY_PIP
        (0.52, 0.50, 0.0), # 19: PINKY_DIP
        (0.53, 0.53, 0.0), # 20: PINKY_TIP (curled)
    ]
    
    # Open hand landmarks (fingertips extended away from palm)
    open_hand_landmarks = [
        (0.5, 0.8, 0.0),   # 0: WRIST
        (0.35, 0.7, 0.0),  # 1: THUMB_CMC
        (0.30, 0.6, 0.0),  # 2: THUMB_MCP
        (0.25, 0.5, 0.0),  # 3: THUMB_IP
        (0.20, 0.4, 0.0),  # 4: THUMB_TIP (extended)
        (0.45, 0.6, 0.0),  # 5: INDEX_MCP
        (0.43, 0.5, 0.0),  # 6: INDEX_PIP
        (0.41, 0.4, 0.0),  # 7: INDEX_DIP
        (0.40, 0.3, 0.0),  # 8: INDEX_TIP (extended)
        (0.50, 0.6, 0.0),  # 9: MIDDLE_MCP
        (0.50, 0.5, 0.0),  # 10: MIDDLE_PIP
        (0.50, 0.4, 0.0),  # 11: MIDDLE_DIP
        (0.50, 0.25, 0.0), # 12: MIDDLE_TIP (extended)
        (0.55, 0.6, 0.0),  # 13: RING_MCP
        (0.56, 0.5, 0.0),  # 14: RING_PIP
        (0.57, 0.4, 0.0),  # 15: RING_DIP
        (0.58, 0.3, 0.0),  # 16: RING_TIP (extended)
        (0.60, 0.65, 0.0), # 17: PINKY_MCP
        (0.62, 0.55, 0.0), # 18: PINKY_PIP
        (0.64, 0.45, 0.0), # 19: PINKY_DIP
        (0.66, 0.4, 0.0),  # 20: PINKY_TIP (extended)
    ]
    
    print("Testing Gesture Interpretation Agent")
    print("=" * 50)
    
    # Test closed fist detection with stability
    print("\n1. Testing CLOSED_FIST detection (requires 500ms stability):")
    start_time = time.time()
    for i in range(10):
        landmarks = create_landmarks_from_array(fist_landmarks, start_time + i * 0.1)
        result = interpreter.update(landmarks)
        print(f"   Frame {i+1}: {result.to_json()}")
    
    interpreter.reset()
    
    # Test swipe detection with open hand
    print("\n2. Testing SWIPE_RIGHT detection (open hand moving right):")
    start_time = time.time()
    for i in range(5):
        # Simulate rightward movement with open hand
        swipe_landmarks = [(x + i * 0.15, y, z) for x, y, z in open_hand_landmarks]
        landmarks = create_landmarks_from_array(swipe_landmarks, start_time + i * 0.05)
        result = interpreter.update(landmarks)
        print(f"   Frame {i+1}: {result.to_json()}")
    
    interpreter.reset()
    
    # Test swipe up detection
    print("\n3. Testing SWIPE_UP detection (open hand moving up):")
    start_time = time.time()
    for i in range(5):
        # Simulate upward movement (negative Y in screen coords)
        swipe_landmarks = [(x, y - i * 0.15, z) for x, y, z in open_hand_landmarks]
        landmarks = create_landmarks_from_array(swipe_landmarks, start_time + i * 0.05)
        result = interpreter.update(landmarks)
        print(f"   Frame {i+1}: {result.to_json()}")
    
    interpreter.reset()
    
    # Test ambiguous gesture (returns NONE)
    print("\n4. Testing ambiguous gesture (diagonal movement):")
    start_time = time.time()
    for i in range(5):
        # Diagonal movement - should be ambiguous
        swipe_landmarks = [(x + i * 0.1, y + i * 0.1, z) for x, y, z in open_hand_landmarks]
        landmarks = create_landmarks_from_array(swipe_landmarks, start_time + i * 0.05)
        result = interpreter.update(landmarks)
        print(f"   Frame {i+1}: {result.to_json()}")
    
    print("\n" + "=" * 50)
    print("Gesture Interpretation Agent Ready")

