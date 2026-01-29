"""
Safety & Validation Agent
=========================
The last line of defense before gesture actions are executed.

This agent validates gesture outputs to ensure safe and reliable execution.
All validation checks must pass for a gesture to be approved.
"""

import json
from enum import Enum
from dataclasses import dataclass
from typing import Optional


class ValidationReason(Enum):
    """Enumeration of validation result reasons."""
    STABLE = "STABLE"
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    COOLDOWN_ACTIVE = "COOLDOWN_ACTIVE"
    CAMERA_INVALID = "CAMERA_INVALID"


class ConfidenceLevel(Enum):
    """Confidence levels for gesture recognition."""
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class GestureInput:
    """Input data structure for gesture validation."""
    gesture: str
    confidence: str  # "HIGH", "MEDIUM", "LOW"
    stability: bool  # True if gesture is stable
    cooldown_active: bool  # True if system is in cooldown
    camera_valid: bool  # True if camera feed is valid


@dataclass
class ValidationResult:
    """Output data structure for validation result."""
    approved: bool
    reason: str

    def to_json(self) -> str:
        """Convert result to strict JSON format."""
        return json.dumps({
            "approved": self.approved,
            "reason": self.reason
        }, indent=2)

    def to_dict(self) -> dict:
        """Convert result to dictionary."""
        return {
            "approved": self.approved,
            "reason": self.reason
        }


class SafetyValidationAgent:
    """
    Safety & Validation Agent
    
    Responsible for validating gesture inputs before action execution.
    This agent is conservative and acts as the last line of defense.
    
    VALIDATION CHECKS (ALL REQUIRED):
    1. Confidence must be HIGH
    2. Gesture must be stable
    3. Cooldown must be inactive
    4. Camera feed must be valid
    
    RULES:
    - Never override gesture agent decisions
    - Never allow unsafe execution
    - Be conservative in approval
    """

    def __init__(self):
        """Initialize the Safety & Validation Agent."""
        self._validation_order = [
            self._check_camera_validity,
            self._check_cooldown_state,
            self._check_confidence_level,
            self._check_gesture_stability,
        ]

    def validate(self, gesture_input: GestureInput) -> ValidationResult:
        """
        Validate a gesture input against all safety checks.
        
        Args:
            gesture_input: The gesture data to validate
            
        Returns:
            ValidationResult with approved status and reason
        """
        # Run all validation checks in order
        # First failure stops the chain and returns rejection
        for check in self._validation_order:
            result = check(gesture_input)
            if result is not None:
                return result

        # All checks passed - gesture is approved
        return ValidationResult(
            approved=True,
            reason=ValidationReason.STABLE.value
        )

    def validate_from_dict(self, data: dict) -> ValidationResult:
        """
        Validate gesture input from a dictionary.
        
        Args:
            data: Dictionary containing gesture data with keys:
                  - gesture: str
                  - confidence: str ("HIGH", "MEDIUM", "LOW")
                  - stability: bool
                  - cooldown_active: bool
                  - camera_valid: bool
                  
        Returns:
            ValidationResult with approved status and reason
        """
        gesture_input = GestureInput(
            gesture=data.get("gesture", ""),
            confidence=data.get("confidence", "LOW"),
            stability=data.get("stability", False),
            cooldown_active=data.get("cooldown_active", True),
            camera_valid=data.get("camera_valid", False)
        )
        return self.validate(gesture_input)

    def validate_from_json(self, json_str: str) -> ValidationResult:
        """
        Validate gesture input from a JSON string.
        
        Args:
            json_str: JSON string containing gesture data
            
        Returns:
            ValidationResult with approved status and reason
        """
        try:
            data = json.loads(json_str)
            return self.validate_from_dict(data)
        except json.JSONDecodeError:
            # Invalid JSON means invalid camera/input state
            return ValidationResult(
                approved=False,
                reason=ValidationReason.CAMERA_INVALID.value
            )

    def _check_camera_validity(self, gesture_input: GestureInput) -> Optional[ValidationResult]:
        """
        Check if camera feed is valid.
        
        Args:
            gesture_input: The gesture data to validate
            
        Returns:
            ValidationResult if check fails, None if passes
        """
        if not gesture_input.camera_valid:
            return ValidationResult(
                approved=False,
                reason=ValidationReason.CAMERA_INVALID.value
            )
        return None

    def _check_cooldown_state(self, gesture_input: GestureInput) -> Optional[ValidationResult]:
        """
        Check if system cooldown is inactive.
        
        Args:
            gesture_input: The gesture data to validate
            
        Returns:
            ValidationResult if check fails, None if passes
        """
        if gesture_input.cooldown_active:
            return ValidationResult(
                approved=False,
                reason=ValidationReason.COOLDOWN_ACTIVE.value
            )
        return None

    def _check_confidence_level(self, gesture_input: GestureInput) -> Optional[ValidationResult]:
        """
        Check if confidence level is HIGH.
        
        Args:
            gesture_input: The gesture data to validate
            
        Returns:
            ValidationResult if check fails, None if passes
        """
        if gesture_input.confidence.upper() != ConfidenceLevel.HIGH.value:
            return ValidationResult(
                approved=False,
                reason=ValidationReason.LOW_CONFIDENCE.value
            )
        return None

    def _check_gesture_stability(self, gesture_input: GestureInput) -> Optional[ValidationResult]:
        """
        Check if gesture is stable.
        
        Args:
            gesture_input: The gesture data to validate
            
        Returns:
            ValidationResult if check fails, None if passes
        """
        if not gesture_input.stability:
            return ValidationResult(
                approved=False,
                reason=ValidationReason.STABLE.value  # Using STABLE as reason for instability rejection
            )
        return None


# Convenience function for direct validation
def validate_gesture(
    gesture: str,
    confidence: str,
    stability: bool,
    cooldown_active: bool,
    camera_valid: bool
) -> dict:
    """
    Validate a gesture with the given parameters.
    
    Args:
        gesture: The detected gesture name
        confidence: Confidence level ("HIGH", "MEDIUM", "LOW")
        stability: Whether the gesture is stable
        cooldown_active: Whether system cooldown is active
        camera_valid: Whether camera feed is valid
        
    Returns:
        Dictionary with 'approved' and 'reason' keys
    """
    agent = SafetyValidationAgent()
    result = agent.validate(GestureInput(
        gesture=gesture,
        confidence=confidence,
        stability=stability,
        cooldown_active=cooldown_active,
        camera_valid=camera_valid
    ))
    return result.to_dict()


# Example usage and testing
if __name__ == "__main__":
    agent = SafetyValidationAgent()
    
    print("=" * 50)
    print("Safety & Validation Agent - Test Cases")
    print("=" * 50)
    
    # Test Case 1: All checks pass
    print("\n[TEST 1] All checks pass - Should be APPROVED")
    result = agent.validate(GestureInput(
        gesture="SWIPE_LEFT",
        confidence="HIGH",
        stability=True,
        cooldown_active=False,
        camera_valid=True
    ))
    print(result.to_json())
    
    # Test Case 2: Low confidence
    print("\n[TEST 2] Low confidence - Should be REJECTED")
    result = agent.validate(GestureInput(
        gesture="SWIPE_LEFT",
        confidence="MEDIUM",
        stability=True,
        cooldown_active=False,
        camera_valid=True
    ))
    print(result.to_json())
    
    # Test Case 3: Cooldown active
    print("\n[TEST 3] Cooldown active - Should be REJECTED")
    result = agent.validate(GestureInput(
        gesture="PINCH",
        confidence="HIGH",
        stability=True,
        cooldown_active=True,
        camera_valid=True
    ))
    print(result.to_json())
    
    # Test Case 4: Camera invalid
    print("\n[TEST 4] Camera invalid - Should be REJECTED")
    result = agent.validate(GestureInput(
        gesture="THUMBS_UP",
        confidence="HIGH",
        stability=True,
        cooldown_active=False,
        camera_valid=False
    ))
    print(result.to_json())
    
    # Test Case 5: Gesture unstable
    print("\n[TEST 5] Gesture unstable - Should be REJECTED")
    result = agent.validate(GestureInput(
        gesture="WAVE",
        confidence="HIGH",
        stability=False,
        cooldown_active=False,
        camera_valid=True
    ))
    print(result.to_json())
    
    # Test Case 6: Using convenience function
    print("\n[TEST 6] Using convenience function - Should be APPROVED")
    result = validate_gesture(
        gesture="OPEN_PALM",
        confidence="HIGH",
        stability=True,
        cooldown_active=False,
        camera_valid=True
    )
    print(json.dumps(result, indent=2))
    
    # Test Case 7: From JSON string
    print("\n[TEST 7] From JSON string - Should be APPROVED")
    json_input = '{"gesture": "FIST", "confidence": "HIGH", "stability": true, "cooldown_active": false, "camera_valid": true}'
    result = agent.validate_from_json(json_input)
    print(result.to_json())
    
    # Test Case 8: Invalid JSON
    print("\n[TEST 8] Invalid JSON - Should be REJECTED (CAMERA_INVALID)")
    result = agent.validate_from_json("invalid json {}")
    print(result.to_json())
    
    print("\n" + "=" * 50)
    print("All tests completed!")
    print("=" * 50)
