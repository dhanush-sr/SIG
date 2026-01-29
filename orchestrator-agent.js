/**
 * AURA Orchestrator Agent
 *
 * ROLE: Coordinate, validate, and combine outputs from all downstream agents
 * into a single, consistent system state that is safe, deterministic, and user-visible.
 *
 * DOES NOT: Perform detection, classification, actions, or rendering.
 * ONLY: Combines, arbitrates, and finalizes.
 *
 * Enforces execution order: Vision → Gesture → Safety → Action → Visualization
 */

// ============================================================================
// ENUMS AND CONSTANTS
// ============================================================================

const SystemStatus = {
    ACTIVE: 'ACTIVE',
    IDLE: 'IDLE',
    ERROR: 'ERROR'
};

const ConfidenceLevel = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH'
};

const ActionState = {
    NONE: 'NONE',
    READY: 'READY',
    EXECUTED: 'EXECUTED',
    COOLDOWN: 'COOLDOWN'
};

const GestureType = {
    NONE: 'NONE',
    CLOSED_FIST: 'CLOSED_FIST',
    SWIPE_LEFT: 'SWIPE_LEFT',
    SWIPE_RIGHT: 'SWIPE_RIGHT',
    SWIPE_UP: 'SWIPE_UP',
    SWIPE_DOWN: 'SWIPE_DOWN'
};

const ValidationReason = {
    STABLE: 'STABLE',
    LOW_CONFIDENCE: 'LOW_CONFIDENCE',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    CAMERA_INVALID: 'CAMERA_INVALID',
    GESTURE_UNSTABLE: 'GESTURE_UNSTABLE'
};

// ============================================================================
// GESTURE INTERPRETER (Ported from Python)
// ============================================================================

class GestureInterpreter {
    constructor() {
        // Configuration constants
        this.FIST_STABILITY_THRESHOLD_MS = 500;
        this.SWIPE_TIME_WINDOW_MS = 300;
        this.SWIPE_VELOCITY_THRESHOLD = 0.15;
        this.CURL_THRESHOLD = 0.15;
        this.HISTORY_SIZE = 30;

        // State
        this.landmarkHistory = [];
        this.fistStartTime = null;
        this.lastGesture = GestureType.NONE;
    }

    /**
     * Process new landmark data and return gesture interpretation
     * @param {Object} landmarks - Landmarks with 21 points and timestamp
     * @returns {Object} { gesture, confidence, isStable }
     */
    update(landmarks) {
        if (!landmarks || !landmarks.points || landmarks.points.length < 21) {
            this.fistStartTime = null;
            this.lastGesture = GestureType.NONE;
            return this._noneResult();
        }

        // Add to history
        this.landmarkHistory.push({
            points: landmarks.points,
            timestamp: landmarks.timestamp || Date.now()
        });

        // Keep history bounded
        if (this.landmarkHistory.length > this.HISTORY_SIZE) {
            this.landmarkHistory.shift();
        }

        // Check for static gestures first
        const fistResult = this._detectClosedFist(landmarks);
        if (fistResult.gesture !== GestureType.NONE) {
            return fistResult;
        }

        // Check for dynamic gestures (swipes)
        const swipeResult = this._detectSwipe();
        if (swipeResult.gesture !== GestureType.NONE) {
            return swipeResult;
        }

        // No gesture detected
        this.fistStartTime = null;
        this.lastGesture = GestureType.NONE;
        return this._noneResult();
    }

    _detectClosedFist(landmarks) {
        const curlScores = this._calculateFingerCurls(landmarks);

        if (!curlScores) {
            return this._noneResult();
        }

        // All fingers must be curled
        const allCurled = curlScores.every(score => score < this.CURL_THRESHOLD);

        if (!allCurled) {
            this.fistStartTime = null;
            return this._noneResult();
        }

        // Check stability duration
        const currentTime = landmarks.timestamp || Date.now();

        if (this.fistStartTime === null) {
            this.fistStartTime = currentTime;
            return {
                gesture: GestureType.CLOSED_FIST,
                confidence: ConfidenceLevel.LOW,
                isStable: false
            };
        }

        const durationMs = currentTime - this.fistStartTime;

        if (durationMs >= this.FIST_STABILITY_THRESHOLD_MS) {
            this.lastGesture = GestureType.CLOSED_FIST;
            return {
                gesture: GestureType.CLOSED_FIST,
                confidence: ConfidenceLevel.HIGH,
                isStable: true
            };
        } else if (durationMs >= this.FIST_STABILITY_THRESHOLD_MS / 2) {
            return {
                gesture: GestureType.CLOSED_FIST,
                confidence: ConfidenceLevel.MEDIUM,
                isStable: false
            };
        } else {
            return {
                gesture: GestureType.CLOSED_FIST,
                confidence: ConfidenceLevel.LOW,
                isStable: false
            };
        }
    }

    _calculateFingerCurls(landmarks) {
        const points = landmarks.points;
        if (!points || points.length < 21) return null;

        // Calculate palm center from wrist (0) and MCP joints (5, 9, 13, 17)
        const palmIndices = [0, 5, 9, 13, 17];
        const palmX = palmIndices.reduce((sum, i) => sum + points[i].x, 0) / palmIndices.length;
        const palmY = palmIndices.reduce((sum, i) => sum + points[i].y, 0) / palmIndices.length;
        const palmZ = palmIndices.reduce((sum, i) => sum + (points[i].z || 0), 0) / palmIndices.length;

        // Fingertip indices: thumb(4), index(8), middle(12), ring(16), pinky(20)
        const fingertipIndices = [4, 8, 12, 16, 20];

        return fingertipIndices.map(i => {
            const tip = points[i];
            const distance = Math.sqrt(
                Math.pow(tip.x - palmX, 2) +
                Math.pow(tip.y - palmY, 2) +
                Math.pow((tip.z || 0) - palmZ, 2)
            );
            return distance;
        });
    }

    _detectSwipe() {
        if (this.landmarkHistory.length < 5) {
            return this._noneResult();
        }

        const currentTime = this.landmarkHistory[this.landmarkHistory.length - 1].timestamp;
        const recentFrames = this.landmarkHistory.filter(
            lm => (currentTime - lm.timestamp) <= this.SWIPE_TIME_WINDOW_MS
        );

        if (recentFrames.length < 3) {
            return this._noneResult();
        }

        // Get palm centers
        const startPalm = this._getPalmCenter(recentFrames[0].points);
        const endPalm = this._getPalmCenter(recentFrames[recentFrames.length - 1].points);

        if (!startPalm || !endPalm) {
            return this._noneResult();
        }

        const timeDelta = (recentFrames[recentFrames.length - 1].timestamp - recentFrames[0].timestamp) / 1000;
        if (timeDelta <= 0) {
            return this._noneResult();
        }

        // Calculate velocity
        const velocityX = (endPalm.x - startPalm.x) / timeDelta;
        const velocityY = (endPalm.y - startPalm.y) / timeDelta;
        const absVelX = Math.abs(velocityX);
        const absVelY = Math.abs(velocityY);

        // Check velocity threshold
        if (absVelX < this.SWIPE_VELOCITY_THRESHOLD && absVelY < this.SWIPE_VELOCITY_THRESHOLD) {
            return this._noneResult();
        }

        let gesture, confidence;

        // Determine dominant direction (must be 1.5x dominant)
        if (absVelX > absVelY * 1.5) {
            if (absVelX < this.SWIPE_VELOCITY_THRESHOLD) return this._noneResult();
            gesture = velocityX > 0 ? GestureType.SWIPE_RIGHT : GestureType.SWIPE_LEFT;
            confidence = this._calculateSwipeConfidence(absVelX, absVelY);
        } else if (absVelY > absVelX * 1.5) {
            if (absVelY < this.SWIPE_VELOCITY_THRESHOLD) return this._noneResult();
            gesture = velocityY > 0 ? GestureType.SWIPE_DOWN : GestureType.SWIPE_UP;
            confidence = this._calculateSwipeConfidence(absVelY, absVelX);
        } else {
            // Ambiguous direction
            return this._noneResult();
        }

        this.lastGesture = gesture;
        // Clear history after swipe detection
        this.landmarkHistory = [];

        return {
            gesture: gesture,
            confidence: confidence,
            isStable: true // Swipes are instantaneous, considered stable when detected
        };
    }

    _getPalmCenter(points) {
        if (!points || points.length < 18) return null;
        const palmIndices = [0, 5, 9, 13, 17];
        return {
            x: palmIndices.reduce((sum, i) => sum + points[i].x, 0) / palmIndices.length,
            y: palmIndices.reduce((sum, i) => sum + points[i].y, 0) / palmIndices.length,
            z: palmIndices.reduce((sum, i) => sum + (points[i].z || 0), 0) / palmIndices.length
        };
    }

    _calculateSwipeConfidence(dominantVel, secondaryVel) {
        if (dominantVel > this.SWIPE_VELOCITY_THRESHOLD * 3) {
            if (secondaryVel < dominantVel * 0.3) {
                return ConfidenceLevel.HIGH;
            }
            return ConfidenceLevel.MEDIUM;
        } else if (dominantVel > this.SWIPE_VELOCITY_THRESHOLD * 2) {
            return ConfidenceLevel.MEDIUM;
        }
        return ConfidenceLevel.LOW;
    }

    _noneResult() {
        return {
            gesture: GestureType.NONE,
            confidence: ConfidenceLevel.LOW,
            isStable: false
        };
    }

    reset() {
        this.landmarkHistory = [];
        this.fistStartTime = null;
        this.lastGesture = GestureType.NONE;
    }
}

// ============================================================================
// SAFETY VALIDATION AGENT (Ported from Python)
// ============================================================================

class SafetyValidator {
    /**
     * Validate gesture for safe execution
     * @param {Object} input - { gesture, confidence, isStable, cooldownActive, cameraValid }
     * @returns {Object} { approved, reason }
     */
    validate(input) {
        // Check camera validity first
        if (!input.cameraValid) {
            return { approved: false, reason: ValidationReason.CAMERA_INVALID };
        }

        // Check cooldown
        if (input.cooldownActive) {
            return { approved: false, reason: ValidationReason.COOLDOWN_ACTIVE };
        }

        // Check confidence level - must be HIGH
        if (input.confidence !== ConfidenceLevel.HIGH) {
            return { approved: false, reason: ValidationReason.LOW_CONFIDENCE };
        }

        // Check stability
        if (!input.isStable) {
            return { approved: false, reason: ValidationReason.GESTURE_UNSTABLE };
        }

        // All checks passed
        return { approved: true, reason: ValidationReason.STABLE };
    }
}

// ============================================================================
// ORCHESTRATOR AGENT
// ============================================================================

class OrchestratorAgent {
    constructor() {
        // Sub-agents
        this.gestureInterpreter = new GestureInterpreter();
        this.safetyValidator = new SafetyValidator();

        // Action execution state
        this.cooldownActive = false;
        this.cooldownDuration = 1500; // ms
        this.cooldownTimer = null;

        // Current mute state
        this.isMuted = false;

        // System state
        this.systemState = this._createIdleState();

        // BroadcastChannels for inter-window communication
        this.channels = {
            vision: new BroadcastChannel('aura-vision'),
            orchestrator: new BroadcastChannel('aura-orchestrator'),
            visual: new BroadcastChannel('aura-visual')
        };

        // Event listeners
        this.eventListeners = [];

        // Set up channel listeners
        this._setupChannelListeners();

        console.log('%c🎯 AURA Orchestrator Agent Initialized',
            'color: #6366f1; font-size: 14px; font-weight: bold;');
    }

    _setupChannelListeners() {
        // Listen for Vision Agent updates
        this.channels.vision.onmessage = (event) => {
            this.processVisionData(event.data);
        };
    }

    /**
     * Process incoming data from Vision Agent
     * Enforces: Vision → Gesture → Safety → Action → Visualization
     */
    processVisionData(visionData) {
        try {
            // Step 1: Validate vision data
            if (!this._validateVisionData(visionData)) {
                this.systemState = this._createErrorState('Invalid vision data');
                this._broadcastState();
                return;
            }

            // Decision Rule 1: No hand detected → IDLE
            if (!visionData.handDetected) {
                this.systemState = this._createIdleState();
                this._broadcastState();
                return;
            }

            // Step 2: Gesture Interpretation
            const gestureResult = this.gestureInterpreter.update({
                points: visionData.landmarks,
                timestamp: visionData.timestamp
            });

            // Decision Rule 2: No gesture or low confidence
            if (gestureResult.gesture === GestureType.NONE ||
                gestureResult.confidence !== ConfidenceLevel.HIGH) {
                this.systemState = this._createActiveState({
                    detectedGesture: gestureResult.gesture,
                    confidence: gestureResult.confidence,
                    safetyApproved: false,
                    actionState: ActionState.NONE,
                    userMessage: 'Gesture unclear'
                });
                this._broadcastState();
                return;
            }

            // Step 3: Safety Validation
            const safetyResult = this.safetyValidator.validate({
                gesture: gestureResult.gesture,
                confidence: gestureResult.confidence,
                isStable: gestureResult.isStable,
                cooldownActive: this.cooldownActive,
                cameraValid: true
            });

            // Decision Rule 3: Safety not approved
            if (!safetyResult.approved) {
                const userMessage = this._getReasonMessage(safetyResult.reason);
                this.systemState = this._createActiveState({
                    detectedGesture: gestureResult.gesture,
                    confidence: gestureResult.confidence,
                    safetyApproved: false,
                    actionState: this.cooldownActive ? ActionState.COOLDOWN : ActionState.NONE,
                    userMessage: userMessage
                });
                this._broadcastState();
                return;
            }

            // Decision Rule 5: Cooldown active (double-check)
            if (this.cooldownActive) {
                this.systemState = this._createActiveState({
                    detectedGesture: gestureResult.gesture,
                    confidence: gestureResult.confidence,
                    safetyApproved: false,
                    actionState: ActionState.COOLDOWN,
                    userMessage: 'Cooldown active'
                });
                this._broadcastState();
                return;
            }

            // Step 4: Action Execution
            const actionResult = this._executeAction(gestureResult.gesture);

            // Decision Rule 4: Safety approved AND Action executed
            this.systemState = this._createActiveState({
                detectedGesture: gestureResult.gesture,
                confidence: gestureResult.confidence,
                safetyApproved: true,
                actionState: actionResult.actionExecuted ? ActionState.EXECUTED : ActionState.READY,
                userMessage: actionResult.message
            });

            // Start cooldown if action was executed
            if (actionResult.actionExecuted) {
                this._startCooldown();
            }

            this._broadcastState();

        } catch (error) {
            console.error('Orchestrator error:', error);
            this.systemState = this._createErrorState('System paused due to uncertainty');
            this._broadcastState();
        }
    }

    /**
     * Execute action based on gesture type
     */
    _executeAction(gesture) {
        switch (gesture) {
            case GestureType.CLOSED_FIST:
                this.isMuted = !this.isMuted;
                return {
                    actionExecuted: true,
                    actionType: this.isMuted ? 'MUTE' : 'UNMUTE',
                    message: this.isMuted ? 'Muted' : 'Unmuted'
                };

            case GestureType.SWIPE_LEFT:
                return {
                    actionExecuted: true,
                    actionType: 'NAVIGATE_LEFT',
                    message: 'Navigated Left'
                };

            case GestureType.SWIPE_RIGHT:
                return {
                    actionExecuted: true,
                    actionType: 'NAVIGATE_RIGHT',
                    message: 'Navigated Right'
                };

            case GestureType.SWIPE_UP:
                return {
                    actionExecuted: true,
                    actionType: 'NAVIGATE_UP',
                    message: 'Navigated Up'
                };

            case GestureType.SWIPE_DOWN:
                return {
                    actionExecuted: true,
                    actionType: 'NAVIGATE_DOWN',
                    message: 'Navigated Down'
                };

            default:
                return {
                    actionExecuted: false,
                    actionType: 'NONE',
                    message: 'No action'
                };
        }
    }

    _startCooldown() {
        this.cooldownActive = true;

        // Update state to COOLDOWN after a brief EXECUTED display
        setTimeout(() => {
            if (this.cooldownActive) {
                this.systemState.actionState = ActionState.COOLDOWN;
                this.systemState.userMessage = 'Cooldown active';
                this._broadcastState();
            }
        }, 300);

        // Clear cooldown after duration
        this.cooldownTimer = setTimeout(() => {
            this.cooldownActive = false;
            this.systemState.actionState = ActionState.NONE;
            this.systemState.userMessage = 'Ready';
            this._broadcastState();
            this._emitEvent('cooldownEnd', {});
        }, this.cooldownDuration);

        this._emitEvent('cooldownStart', { duration: this.cooldownDuration });
    }

    _validateVisionData(data) {
        if (!data) return false;
        if (typeof data.handDetected !== 'boolean') return false;
        if (data.handDetected && (!data.landmarks || !Array.isArray(data.landmarks))) return false;
        return true;
    }

    _getReasonMessage(reason) {
        switch (reason) {
            case ValidationReason.CAMERA_INVALID:
                return 'Camera unavailable';
            case ValidationReason.COOLDOWN_ACTIVE:
                return 'Cooldown active';
            case ValidationReason.LOW_CONFIDENCE:
                return 'Gesture unclear';
            case ValidationReason.GESTURE_UNSTABLE:
                return 'Hold gesture steady';
            default:
                return 'Waiting...';
        }
    }

    _createIdleState() {
        return {
            systemStatus: SystemStatus.IDLE,
            detectedGesture: GestureType.NONE,
            confidence: ConfidenceLevel.LOW,
            safetyApproved: false,
            actionState: ActionState.NONE,
            userMessage: 'No hand detected'
        };
    }

    _createActiveState(params) {
        return {
            systemStatus: SystemStatus.ACTIVE,
            detectedGesture: params.detectedGesture || GestureType.NONE,
            confidence: params.confidence || ConfidenceLevel.LOW,
            safetyApproved: params.safetyApproved || false,
            actionState: params.actionState || ActionState.NONE,
            userMessage: params.userMessage || ''
        };
    }

    _createErrorState(message) {
        return {
            systemStatus: SystemStatus.ERROR,
            detectedGesture: GestureType.NONE,
            confidence: ConfidenceLevel.LOW,
            safetyApproved: false,
            actionState: ActionState.NONE,
            userMessage: message || 'System paused due to uncertainty'
        };
    }

    _broadcastState() {
        // Broadcast to orchestrator channel (for UI updates)
        this.channels.orchestrator.postMessage(this.systemState);

        // Forward to visualization agent
        this._forwardToVisualization();

        // Emit to local listeners
        this._emitEvent('stateChange', this.systemState);
    }

    _forwardToVisualization() {
        // Map system state to particle visualization parameters
        const visualParams = {
            confidence: this._confidenceToNumber(this.systemState.confidence),
            gestureType: this.systemState.detectedGesture,
            safetyApproved: this.systemState.safetyApproved,
            actionExecuted: this.systemState.actionState === ActionState.EXECUTED,
            cooldownActive: this.systemState.actionState === ActionState.COOLDOWN,
            systemStatus: this.systemState.systemStatus
        };

        this.channels.visual.postMessage(visualParams);
    }

    _confidenceToNumber(confidence) {
        switch (confidence) {
            case ConfidenceLevel.HIGH: return 0.95;
            case ConfidenceLevel.MEDIUM: return 0.6;
            case ConfidenceLevel.LOW: return 0.2;
            default: return 0;
        }
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    /**
     * Get current system state
     */
    getState() {
        return { ...this.systemState };
    }

    /**
     * Manually inject vision data (for testing)
     */
    injectVisionData(data) {
        this.processVisionData(data);
    }

    /**
     * Set test state directly (for keyboard testing)
     */
    setTestState(stateNum) {
        switch (stateNum) {
            case 1: // IDLE - No hand
                this.systemState = this._createIdleState();
                break;

            case 2: // LOW confidence
                this.systemState = this._createActiveState({
                    detectedGesture: GestureType.CLOSED_FIST,
                    confidence: ConfidenceLevel.LOW,
                    safetyApproved: false,
                    actionState: ActionState.NONE,
                    userMessage: 'Gesture unclear'
                });
                break;

            case 3: // MEDIUM confidence
                this.systemState = this._createActiveState({
                    detectedGesture: GestureType.CLOSED_FIST,
                    confidence: ConfidenceLevel.MEDIUM,
                    safetyApproved: false,
                    actionState: ActionState.NONE,
                    userMessage: 'Hold gesture steady'
                });
                break;

            case 4: // HIGH confidence but unstable
                this.systemState = this._createActiveState({
                    detectedGesture: GestureType.CLOSED_FIST,
                    confidence: ConfidenceLevel.HIGH,
                    safetyApproved: false,
                    actionState: ActionState.READY,
                    userMessage: 'Almost there...'
                });
                break;

            case 5: // HIGH + stable + approved
                this.systemState = this._createActiveState({
                    detectedGesture: GestureType.CLOSED_FIST,
                    confidence: ConfidenceLevel.HIGH,
                    safetyApproved: true,
                    actionState: ActionState.READY,
                    userMessage: 'Ready to execute'
                });
                break;

            case 6: // Execute action
                this.isMuted = !this.isMuted;
                this.systemState = this._createActiveState({
                    detectedGesture: GestureType.CLOSED_FIST,
                    confidence: ConfidenceLevel.HIGH,
                    safetyApproved: true,
                    actionState: ActionState.EXECUTED,
                    userMessage: this.isMuted ? 'Muted' : 'Unmuted'
                });
                this._startCooldown();
                break;

            case 0: // Force cooldown
                this.cooldownActive = true;
                this.systemState = this._createActiveState({
                    detectedGesture: GestureType.CLOSED_FIST,
                    confidence: ConfidenceLevel.HIGH,
                    safetyApproved: false,
                    actionState: ActionState.COOLDOWN,
                    userMessage: 'Cooldown active'
                });
                setTimeout(() => {
                    this.cooldownActive = false;
                    this.systemState.actionState = ActionState.NONE;
                    this._broadcastState();
                }, this.cooldownDuration);
                break;

            case 9: // ERROR state
                this.systemState = this._createErrorState('System paused due to uncertainty');
                break;
        }

        this._broadcastState();
    }

    /**
     * Add event listener
     */
    addEventListener(callback) {
        this.eventListeners.push(callback);
    }

    /**
     * Remove event listener
     */
    removeEventListener(callback) {
        const index = this.eventListeners.indexOf(callback);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
        }
    }

    _emitEvent(type, data) {
        this.eventListeners.forEach(cb => cb(type, data));
    }

    /**
     * Reset orchestrator state
     */
    reset() {
        this.gestureInterpreter.reset();
        this.cooldownActive = false;
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        this.isMuted = false;
        this.systemState = this._createIdleState();
        this._broadcastState();
    }

    /**
     * Cleanup resources
     */
    destroy() {
        Object.values(this.channels).forEach(channel => channel.close());
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        OrchestratorAgent,
        GestureInterpreter,
        SafetyValidator,
        SystemStatus,
        ConfidenceLevel,
        ActionState,
        GestureType,
        ValidationReason
    };
}

if (typeof window !== 'undefined') {
    window.OrchestratorAgent = OrchestratorAgent;
    window.GestureInterpreter = GestureInterpreter;
    window.SafetyValidator = SafetyValidator;
    window.AURA = {
        SystemStatus,
        ConfidenceLevel,
        ActionState,
        GestureType,
        ValidationReason
    };
}
