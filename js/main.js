/**
 * Main Entry Point - 3D Particle Visualization Agent
 * 
 * Particles are a visual debugger. They must never lie.
 */

import { ParticleSystem } from './ParticleSystem.js';
import { StateManager, SystemState } from './StateManager.js';

class ParticleVisualizationAgent {
    constructor() {
        // Get canvas
        this.canvas = document.getElementById('particleCanvas');

        // Initialize systems
        this.particleSystem = new ParticleSystem(this.canvas, 5000);
        this.stateManager = new StateManager();

        // FPS tracking
        this.fpsCounter = document.getElementById('fpsCounter');
        this.frameCount = 0;
        this.lastFpsUpdate = performance.now();
        this.currentFps = 60;

        // Demo mode for testing
        this.demoMode = true;
        this.demoStartTime = performance.now();

        // BroadcastChannel for Orchestrator communication
        this.visualChannel = new BroadcastChannel('aura-visual');
        this.setupOrchestratorListener();

        // Set up keyboard controls
        this.setupKeyboardControls();

        // Start animation loop
        this.animate();

        console.log('%c🎇 Particle Visualization Agent Initialized',
            'color: #00d4ff; font-size: 14px; font-weight: bold;');
        console.log(`   Particle count: ${this.particleSystem.getParticleCount()}`);
        console.log('   Controls: 1-5 for states, 0 for cooldown, Space for execute');
    }

    setupOrchestratorListener() {
        this.visualChannel.onmessage = (event) => {
            // Disable demo mode when receiving orchestrator data
            this.demoMode = false;

            const data = event.data;

            // Map orchestrator state to particle state manager
            this.stateManager.update({
                confidence: data.confidence || 0,
                gestureType: data.gestureType || 'NONE',
                safetyApproved: data.safetyApproved || false,
                actionExecuted: data.actionExecuted || false
            });

            // Handle cooldown state
            if (data.cooldownActive && !this.stateManager.cooldownActive) {
                this.stateManager.triggerCooldown();
            }

            // Handle execution burst
            if (data.actionExecuted && !this.stateManager.burstActive) {
                this.stateManager.triggerBurst();
            }
        };
    }

    setupKeyboardControls() {
        window.addEventListener('keydown', (e) => {
            // Disable demo mode on any key press
            this.demoMode = false;

            switch (e.key) {
                case '1':
                    this.stateManager.setTestState(1);
                    break;
                case '2':
                    this.stateManager.setTestState(2);
                    break;
                case '3':
                    this.stateManager.setTestState(3);
                    break;
                case '4':
                    this.stateManager.setTestState(4);
                    break;
                case '5':
                case ' ':
                    this.stateManager.setTestState(5);
                    break;
                case '0':
                    this.stateManager.setTestState(0);
                    break;
            }
        });
    }

    /**
     * Demo mode - automatically cycle through states
     */
    runDemoSequence() {
        const elapsed = (performance.now() - this.demoStartTime) / 1000;
        const cycleTime = 12; // seconds per full cycle
        const phase = (elapsed % cycleTime) / cycleTime;

        // Cycle through states
        if (phase < 0.15) {
            // Idle / Low confidence
            this.stateManager.update({
                confidence: 0.1 + phase * 2,
                gestureType: 'SCANNING'
            });
        } else if (phase < 0.30) {
            // Building confidence
            const subPhase = (phase - 0.15) / 0.15;
            this.stateManager.update({
                confidence: 0.4 + subPhase * 0.3,
                gestureType: 'SWIPE'
            });
        } else if (phase < 0.45) {
            // High confidence
            const subPhase = (phase - 0.30) / 0.15;
            this.stateManager.update({
                confidence: 0.7 + subPhase * 0.2,
                gestureType: 'POINT'
            });
            this.stateManager.stabilityDuration = 600;
            this.stateManager.isStable = true;
        } else if (phase < 0.55) {
            // Action approved
            this.stateManager.update({
                confidence: 0.95,
                gestureType: 'POINT',
                safetyApproved: true
            });
            this.stateManager.stabilityDuration = 800;
            this.stateManager.isStable = true;
        } else if (phase < 0.60) {
            // Execute burst
            if (!this.stateManager.burstActive && !this.stateManager.cooldownActive) {
                this.stateManager.triggerBurst();
            }
        } else if (phase < 0.80) {
            // Cooldown or continuing burst/cooldown naturally
            if (!this.stateManager.burstActive && !this.stateManager.cooldownActive) {
                this.stateManager.triggerCooldown();
            }
        } else {
            // Reset for next cycle
            this.stateManager.update({
                confidence: 0.05,
                gestureType: 'NONE',
                safetyApproved: false
            });
            this.stateManager.stabilityDuration = 0;
            this.stateManager.isStable = false;
        }

        // Derive state
        this.stateManager.deriveState();
        this.stateManager.updateUI();
    }

    /**
     * Main animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());

        // Run demo if active
        if (this.demoMode) {
            this.runDemoSequence();
        }

        // Get particle parameters from state
        const stateParams = this.stateManager.getParticleParams();

        // Update particle system
        this.particleSystem.update(stateParams);

        // Render
        this.particleSystem.render();

        // Update FPS counter
        this.updateFPS();
    }

    updateFPS() {
        this.frameCount++;
        const now = performance.now();
        const elapsed = now - this.lastFpsUpdate;

        if (elapsed >= 500) {
            this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
            this.frameCount = 0;
            this.lastFpsUpdate = now;

            if (this.fpsCounter) {
                this.fpsCounter.textContent = `${this.currentFps} FPS`;
                this.fpsCounter.className = 'fps-counter';

                if (this.currentFps < 30) {
                    this.fpsCounter.classList.add('critical');
                } else if (this.currentFps < 50) {
                    this.fpsCounter.classList.add('warning');
                }
            }
        }
    }

    /**
     * External API for receiving gesture data
     */
    receiveGestureData(data) {
        this.demoMode = false;
        this.stateManager.update(data);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.particleAgent = new ParticleVisualizationAgent();
});

// Export for external use
export { ParticleVisualizationAgent };
