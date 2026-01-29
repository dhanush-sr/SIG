/**
 * StateManager - Manages system state for particle visualization
 * Receives inputs and provides normalized values for particle behaviors
 */

export const SystemState = {
    IDLE: 'IDLE',
    LOW_CONFIDENCE: 'LOW_CONFIDENCE',
    MEDIUM_CONFIDENCE: 'MEDIUM_CONFIDENCE',
    HIGH_CONFIDENCE: 'HIGH_CONFIDENCE',
    GESTURE_STABLE: 'GESTURE_STABLE',
    ACTION_APPROVED: 'ACTION_APPROVED',
    ACTION_EXECUTED: 'ACTION_EXECUTED',
    COOLDOWN: 'COOLDOWN'
};

export class StateManager {
    constructor() {
        // Input state
        this.handPosition = { x: 0, y: 0, z: 0 };
        this.handVelocity = { x: 0, y: 0, z: 0 };
        this.gestureType = 'NONE';
        this.confidence = 0;
        this.safetyApproved = false;
        this.actionExecuted = false;

        // Derived state
        this.currentState = SystemState.IDLE;
        this.previousState = SystemState.IDLE;
        this.stateTransitionProgress = 1.0;
        this.stateStartTime = performance.now();

        // Stability tracking
        this.stabilityDuration = 0;
        this.lastConfidence = 0;
        this.isStable = false;

        // Cooldown tracking
        this.cooldownActive = false;
        this.cooldownStartTime = 0;
        this.cooldownDuration = 2000; // ms

        // Execution burst tracking
        this.burstActive = false;
        this.burstStartTime = 0;
        this.burstDuration = 800; // ms

        // UI Elements
        this.uiElements = {
            confidenceBar: document.getElementById('confidenceBar'),
            confidenceValue: document.getElementById('confidenceValue'),
            gestureValue: document.getElementById('gestureValue'),
            stateValue: document.getElementById('stateValue')
        };
    }

    /**
     * Update system state with new inputs
     */
    update(inputs) {
        const {
            handPosition,
            handVelocity,
            gestureType,
            confidence,
            safetyApproved,
            actionExecuted
        } = inputs;

        // Update raw inputs
        if (handPosition) this.handPosition = handPosition;
        if (handVelocity) this.handVelocity = handVelocity;
        if (gestureType !== undefined) this.gestureType = gestureType;
        if (confidence !== undefined) {
            this.lastConfidence = this.confidence;
            this.confidence = Math.max(0, Math.min(1, confidence));
        }
        if (safetyApproved !== undefined) this.safetyApproved = safetyApproved;

        // Handle action execution - triggers burst
        if (actionExecuted && !this.actionExecuted) {
            this.triggerBurst();
        }
        this.actionExecuted = actionExecuted;

        // Calculate stability
        this.updateStability();

        // Derive current state
        this.deriveState();

        // Update UI
        this.updateUI();
    }

    /**
     * Track gesture stability over time
     */
    updateStability() {
        const confidenceDelta = Math.abs(this.confidence - this.lastConfidence);

        if (confidenceDelta < 0.05 && this.confidence > 0.7) {
            this.stabilityDuration += 16; // Assume ~60fps
        } else {
            this.stabilityDuration = Math.max(0, this.stabilityDuration - 32);
        }

        this.isStable = this.stabilityDuration > 500; // 500ms of stability
    }

    /**
     * Derive the current system state from inputs
     */
    deriveState() {
        const prevState = this.currentState;

        // Check for active burst (highest priority visual)
        if (this.burstActive) {
            const elapsed = performance.now() - this.burstStartTime;
            if (elapsed < this.burstDuration) {
                this.currentState = SystemState.ACTION_EXECUTED;
            } else {
                this.burstActive = false;
                this.cooldownActive = true;
                this.cooldownStartTime = performance.now();
            }
        }
        // Check for cooldown
        else if (this.cooldownActive) {
            const elapsed = performance.now() - this.cooldownStartTime;
            if (elapsed < this.cooldownDuration) {
                this.currentState = SystemState.COOLDOWN;
            } else {
                this.cooldownActive = false;
            }
        }
        // Normal state derivation
        else if (this.safetyApproved && this.isStable) {
            this.currentState = SystemState.ACTION_APPROVED;
        }
        else if (this.isStable && this.confidence > 0.8) {
            this.currentState = SystemState.GESTURE_STABLE;
        }
        else if (this.confidence > 0.7) {
            this.currentState = SystemState.HIGH_CONFIDENCE;
        }
        else if (this.confidence > 0.4) {
            this.currentState = SystemState.MEDIUM_CONFIDENCE;
        }
        else if (this.confidence > 0.1) {
            this.currentState = SystemState.LOW_CONFIDENCE;
        }
        else {
            this.currentState = SystemState.IDLE;
        }

        // Track state transitions
        if (prevState !== this.currentState) {
            this.previousState = prevState;
            this.stateTransitionProgress = 0;
            this.stateStartTime = performance.now();
        }

        // Update transition progress
        const transitionDuration = 300; // ms
        const elapsed = performance.now() - this.stateStartTime;
        this.stateTransitionProgress = Math.min(1, elapsed / transitionDuration);
    }

    /**
     * Trigger action execution burst
     */
    triggerBurst() {
        this.burstActive = true;
        this.burstStartTime = performance.now();
    }

    /**
     * Manually trigger cooldown
     */
    triggerCooldown() {
        this.cooldownActive = true;
        this.cooldownStartTime = performance.now();
        this.burstActive = false;
    }

    /**
     * Get burst progress (0-1)
     */
    getBurstProgress() {
        if (!this.burstActive) return 0;
        return Math.min(1, (performance.now() - this.burstStartTime) / this.burstDuration);
    }

    /**
     * Get cooldown progress (0-1)
     */
    getCooldownProgress() {
        if (!this.cooldownActive) return 0;
        return Math.min(1, (performance.now() - this.cooldownStartTime) / this.cooldownDuration);
    }

    /**
     * Update UI elements
     */
    updateUI() {
        if (this.uiElements.confidenceBar) {
            this.uiElements.confidenceBar.style.width = `${this.confidence * 100}%`;
        }
        if (this.uiElements.confidenceValue) {
            this.uiElements.confidenceValue.textContent = `${Math.round(this.confidence * 100)}%`;
        }
        if (this.uiElements.gestureValue) {
            this.uiElements.gestureValue.textContent = this.gestureType || 'NONE';
        }
        if (this.uiElements.stateValue) {
            const stateEl = this.uiElements.stateValue;
            stateEl.textContent = this.currentState.replace('_', ' ');

            // Update state styling
            stateEl.className = 'status-value state';
            if (this.currentState === SystemState.ACTION_APPROVED) {
                stateEl.classList.add('approved');
            } else if (this.currentState === SystemState.ACTION_EXECUTED) {
                stateEl.classList.add('executed');
            } else if (this.currentState === SystemState.COOLDOWN) {
                stateEl.classList.add('cooldown');
            }
        }
    }

    /**
     * Get normalized state values for particle behaviors
     */
    getParticleParams() {
        return {
            state: this.currentState,
            previousState: this.previousState,
            transitionProgress: this.stateTransitionProgress,
            confidence: this.confidence,
            stability: this.isStable ? 1 : Math.min(1, this.stabilityDuration / 500),
            handPosition: this.handPosition,
            handVelocity: this.handVelocity,
            burstProgress: this.getBurstProgress(),
            cooldownProgress: this.getCooldownProgress()
        };
    }

    /**
     * Set state directly (for keyboard testing)
     */
    setTestState(state, confidence = null) {
        if (confidence !== null) {
            this.confidence = confidence;
        }

        switch (state) {
            case 1: // Low confidence
                this.update({ confidence: 0.2, gestureType: 'UNKNOWN' });
                break;
            case 2: // Medium confidence
                this.update({ confidence: 0.5, gestureType: 'SWIPE' });
                break;
            case 3: // High confidence - stable
                this.update({ confidence: 0.9, gestureType: 'POINT' });
                this.stabilityDuration = 600;
                this.isStable = true;
                break;
            case 4: // Action approved
                this.update({ confidence: 0.95, gestureType: 'POINT', safetyApproved: true });
                this.stabilityDuration = 800;
                this.isStable = true;
                break;
            case 5: // Execute action
                this.triggerBurst();
                break;
            case 0: // Cooldown
                this.triggerCooldown();
                break;
        }

        this.deriveState();
        this.updateUI();
    }
}
