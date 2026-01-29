/**
 * Action Execution Agent
 * 
 * Executes SAFE, APPLICATION-LEVEL actions only when approved by the Safety Agent.
 * Supports gesture-to-action mapping with cooldown protection.
 */

class ActionExecutionAgent {
    constructor(config = {}) {
        // Configuration
        this.cooldownDuration = config.cooldownDuration || 1500; // ms
        this.simulateActions = config.simulateActions ?? true; // UI simulation mode

        // State
        this.currentState = {
            isMuted: false,
            lastAction: null,
            cooldownActive: false,
            cooldownEndTime: null
        };

        // Action registry
        this.actionHandlers = {
            'CLOSED_FIST': this.handleMuteToggle.bind(this),
            'SWIPE_LEFT': this.handleNavigationLeft.bind(this),
            'SWIPE_RIGHT': this.handleNavigationRight.bind(this),
            'SWIPE_UP': this.handleNavigationUp.bind(this),
            'SWIPE_DOWN': this.handleNavigationDown.bind(this)
        };

        // Event listeners for UI updates
        this.eventListeners = [];
    }

    /**
     * Main execution method
     * @param {Object} input - Input from Safety Agent
     * @param {boolean} input.approved - Whether action is approved
     * @param {string} input.gestureType - Type of gesture detected
     * @param {Object} input.systemState - Current system state
     * @returns {Object} Execution result in strict JSON format
     */
    execute(input) {
        const { approved, gestureType, systemState } = input;

        // Rule 1: NEVER execute actions without approval
        if (!approved) {
            return this.createResponse(false, 'NONE', false);
        }

        // Rule 2: NEVER repeat actions during cooldown
        if (this.isInCooldown()) {
            console.log('[ActionExecutionAgent] Action blocked - cooldown active');
            return this.createResponse(false, 'NONE', false);
        }

        // Check if gesture type is supported
        const handler = this.actionHandlers[gestureType];
        if (!handler) {
            console.log(`[ActionExecutionAgent] Unknown gesture type: ${gestureType}`);
            return this.createResponse(false, 'NONE', false);
        }

        // Execute the action
        try {
            const result = handler(systemState);

            // Start cooldown immediately after successful execution
            this.startCooldown();

            // Emit action state
            this.emitActionState(result);

            return this.createResponse(true, result.actionType, true);
        } catch (error) {
            console.error('[ActionExecutionAgent] Action execution failed:', error);
            return this.createResponse(false, 'NONE', false);
        }
    }

    /**
     * Handle MUTE/UNMUTE toggle action
     * @param {Object} systemState - Current system state
     * @returns {Object} Action result
     */
    handleMuteToggle(systemState) {
        const previousState = this.currentState.isMuted;
        this.currentState.isMuted = !this.currentState.isMuted;

        const actionType = this.currentState.isMuted ? 'MUTE' : 'UNMUTE';

        if (this.simulateActions) {
            console.log(`[ActionExecutionAgent] Simulated: ${actionType}`);
            this.simulateMuteAction(actionType);
        } else {
            // Real system integration would go here
            this.executeSystemMute(actionType);
        }

        this.currentState.lastAction = actionType;

        return {
            actionType,
            previousState: { isMuted: previousState },
            newState: { isMuted: this.currentState.isMuted },
            reversible: true
        };
    }

    /**
     * Handle navigation left action
     * @param {Object} systemState - Current system state
     * @returns {Object} Action result
     */
    handleNavigationLeft(systemState) {
        const actionType = 'NAVIGATION';
        const direction = 'LEFT';

        if (this.simulateActions) {
            console.log(`[ActionExecutionAgent] Simulated: Navigate ${direction}`);
            this.simulateNavigationAction(direction);
        }

        this.currentState.lastAction = `${actionType}_${direction}`;

        return {
            actionType,
            direction,
            reversible: true
        };
    }

    /**
     * Handle navigation right action
     * @param {Object} systemState - Current system state
     * @returns {Object} Action result
     */
    handleNavigationRight(systemState) {
        const actionType = 'NAVIGATION';
        const direction = 'RIGHT';

        if (this.simulateActions) {
            console.log(`[ActionExecutionAgent] Simulated: Navigate ${direction}`);
            this.simulateNavigationAction(direction);
        }

        this.currentState.lastAction = `${actionType}_${direction}`;

        return {
            actionType,
            direction,
            reversible: true
        };
    }

    /**
     * Handle navigation up action
     * @param {Object} systemState - Current system state
     * @returns {Object} Action result
     */
    handleNavigationUp(systemState) {
        const actionType = 'NAVIGATION';
        const direction = 'UP';

        if (this.simulateActions) {
            console.log(`[ActionExecutionAgent] Simulated: Navigate ${direction}`);
            this.simulateNavigationAction(direction);
        }

        this.currentState.lastAction = `${actionType}_${direction}`;

        return {
            actionType,
            direction,
            reversible: true
        };
    }

    /**
     * Handle navigation down action
     * @param {Object} systemState - Current system state
     * @returns {Object} Action result
     */
    handleNavigationDown(systemState) {
        const actionType = 'NAVIGATION';
        const direction = 'DOWN';

        if (this.simulateActions) {
            console.log(`[ActionExecutionAgent] Simulated: Navigate ${direction}`);
            this.simulateNavigationAction(direction);
        }

        this.currentState.lastAction = `${actionType}_${direction}`;

        return {
            actionType,
            direction,
            reversible: true
        };
    }

    /**
     * Simulate mute action in UI
     * @param {string} actionType - MUTE or UNMUTE
     */
    simulateMuteAction(actionType) {
        // Dispatch custom event for UI to handle
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gesture-action', {
                detail: {
                    type: 'MUTE_TOGGLE',
                    action: actionType,
                    timestamp: Date.now()
                }
            }));
        }
    }

    /**
     * Simulate navigation action in UI
     * @param {string} direction - Navigation direction
     */
    simulateNavigationAction(direction) {
        // Dispatch custom event for UI to handle
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('gesture-action', {
                detail: {
                    type: 'NAVIGATION',
                    direction,
                    timestamp: Date.now()
                }
            }));
        }
    }

    /**
     * Execute real system mute (placeholder for actual implementation)
     * @param {string} actionType - MUTE or UNMUTE
     */
    executeSystemMute(actionType) {
        // This would integrate with actual system APIs
        // For example: WebRTC mute, system audio controls, etc.
        console.log(`[ActionExecutionAgent] System action: ${actionType}`);
    }

    /**
     * Check if currently in cooldown period
     * @returns {boolean} True if in cooldown
     */
    isInCooldown() {
        if (!this.currentState.cooldownActive) {
            return false;
        }

        if (Date.now() >= this.currentState.cooldownEndTime) {
            this.currentState.cooldownActive = false;
            this.currentState.cooldownEndTime = null;
            return false;
        }

        return true;
    }

    /**
     * Start the cooldown timer
     */
    startCooldown() {
        this.currentState.cooldownActive = true;
        this.currentState.cooldownEndTime = Date.now() + this.cooldownDuration;

        console.log(`[ActionExecutionAgent] Cooldown started for ${this.cooldownDuration}ms`);

        // Auto-clear cooldown after duration
        setTimeout(() => {
            if (this.currentState.cooldownActive) {
                this.currentState.cooldownActive = false;
                this.currentState.cooldownEndTime = null;
                console.log('[ActionExecutionAgent] Cooldown ended');
                this.emitCooldownEnd();
            }
        }, this.cooldownDuration);
    }

    /**
     * Create standardized response object
     * @param {boolean} actionExecuted - Whether action was executed
     * @param {string} actionType - Type of action
     * @param {boolean} cooldownStarted - Whether cooldown was started
     * @returns {Object} Strict JSON response
     */
    createResponse(actionExecuted, actionType, cooldownStarted) {
        return {
            actionExecuted,
            actionType,
            cooldownStarted
        };
    }

    /**
     * Emit action state to listeners
     * @param {Object} result - Action result
     */
    emitActionState(result) {
        const state = {
            ...result,
            timestamp: Date.now(),
            cooldownRemaining: this.currentState.cooldownEndTime - Date.now()
        };

        this.eventListeners.forEach(listener => {
            try {
                listener('actionExecuted', state);
            } catch (e) {
                console.error('[ActionExecutionAgent] Listener error:', e);
            }
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('action-state', { detail: state }));
        }
    }

    /**
     * Emit cooldown end event
     */
    emitCooldownEnd() {
        const state = { cooldownEnded: true, timestamp: Date.now() };

        this.eventListeners.forEach(listener => {
            try {
                listener('cooldownEnded', state);
            } catch (e) {
                console.error('[ActionExecutionAgent] Listener error:', e);
            }
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('cooldown-end', { detail: state }));
        }
    }

    /**
     * Add event listener
     * @param {Function} callback - Callback function (eventType, data)
     */
    addEventListener(callback) {
        this.eventListeners.push(callback);
    }

    /**
     * Remove event listener
     * @param {Function} callback - Callback function to remove
     */
    removeEventListener(callback) {
        const index = this.eventListeners.indexOf(callback);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
        }
    }

    /**
     * Get current state
     * @returns {Object} Current agent state
     */
    getState() {
        return {
            isMuted: this.currentState.isMuted,
            lastAction: this.currentState.lastAction,
            cooldownActive: this.currentState.cooldownActive,
            cooldownRemaining: this.currentState.cooldownActive
                ? Math.max(0, this.currentState.cooldownEndTime - Date.now())
                : 0
        };
    }

    /**
     * Reset agent state
     */
    reset() {
        this.currentState = {
            isMuted: false,
            lastAction: null,
            cooldownActive: false,
            cooldownEndTime: null
        };
        console.log('[ActionExecutionAgent] State reset');
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ActionExecutionAgent };
}

if (typeof window !== 'undefined') {
    window.ActionExecutionAgent = ActionExecutionAgent;
}
