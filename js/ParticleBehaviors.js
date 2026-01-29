/**
 * ParticleBehaviors - Defines particle behavior patterns for each system state
 * Particles are a visual debugger - they must never lie about system state
 */

import { SystemState } from './StateManager.js';

export class ParticleBehaviors {
    constructor(particleCount) {
        this.particleCount = particleCount;

        // Behavior parameters for each state
        this.behaviors = {
            [SystemState.IDLE]: {
                chaos: 0.1,
                convergence: 0,
                orbitSpeed: 0,
                orbitRadius: 3,
                pulseSpeed: 0,
                pulseIntensity: 0,
                compression: 0,
                opacity: 0.3,
                color: { r: 0.3, g: 0.4, b: 0.5 },
                particleSize: 1.0,
                spread: 4.0
            },
            [SystemState.LOW_CONFIDENCE]: {
                chaos: 0.8,
                convergence: 0.1,
                orbitSpeed: 0,
                orbitRadius: 4,
                pulseSpeed: 0.5,
                pulseIntensity: 0.3,
                compression: 0,
                opacity: 0.5,
                color: { r: 1.0, g: 0.3, b: 0.3 },
                particleSize: 0.8,
                spread: 5.0
            },
            [SystemState.MEDIUM_CONFIDENCE]: {
                chaos: 0.4,
                convergence: 0.5,
                orbitSpeed: 0.3,
                orbitRadius: 3,
                pulseSpeed: 1.0,
                pulseIntensity: 0.2,
                compression: 0.2,
                opacity: 0.7,
                color: { r: 1.0, g: 0.7, b: 0.2 },
                particleSize: 1.0,
                spread: 3.5
            },
            [SystemState.HIGH_CONFIDENCE]: {
                chaos: 0.15,
                convergence: 0.8,
                orbitSpeed: 0.8,
                orbitRadius: 2.5,
                pulseSpeed: 1.5,
                pulseIntensity: 0.3,
                compression: 0.4,
                opacity: 0.85,
                color: { r: 0.2, g: 0.8, b: 1.0 },
                particleSize: 1.2,
                spread: 2.5
            },
            [SystemState.GESTURE_STABLE]: {
                chaos: 0.05,
                convergence: 0.9,
                orbitSpeed: 1.2,
                orbitRadius: 2.0,
                pulseSpeed: 2.0,
                pulseIntensity: 0.4,
                compression: 0.6,
                opacity: 0.95,
                color: { r: 0.0, g: 0.9, b: 0.8 },
                particleSize: 1.4,
                spread: 2.0
            },
            [SystemState.ACTION_APPROVED]: {
                chaos: 0.02,
                convergence: 0.98,
                orbitSpeed: 2.0,
                orbitRadius: 1.2,
                pulseSpeed: 3.0,
                pulseIntensity: 0.5,
                compression: 0.85,
                opacity: 1.0,
                color: { r: 0.0, g: 1.0, b: 0.5 },
                particleSize: 1.6,
                spread: 1.2
            },
            [SystemState.ACTION_EXECUTED]: {
                chaos: 0.0,
                convergence: 0.0,
                orbitSpeed: 0,
                orbitRadius: 0.5,
                pulseSpeed: 0,
                pulseIntensity: 0,
                compression: 0,
                opacity: 1.0,
                color: { r: 0.5, g: 0.2, b: 1.0 },
                particleSize: 2.5,
                spread: 0.5,
                burst: true
            },
            [SystemState.COOLDOWN]: {
                chaos: 0.05,
                convergence: 0.3,
                orbitSpeed: 0.2,
                orbitRadius: 3.5,
                pulseSpeed: 0.5,
                pulseIntensity: 0.1,
                compression: 0,
                opacity: 0.2,
                color: { r: 0.4, g: 0.3, b: 0.5 },
                particleSize: 0.6,
                spread: 4.5
            }
        };
    }

    /**
     * Get interpolated behavior between two states
     */
    getInterpolatedBehavior(fromState, toState, progress) {
        const from = this.behaviors[fromState] || this.behaviors[SystemState.IDLE];
        const to = this.behaviors[toState] || this.behaviors[SystemState.IDLE];

        // Smooth easing function
        const t = this.easeInOutCubic(progress);

        return {
            chaos: this.lerp(from.chaos, to.chaos, t),
            convergence: this.lerp(from.convergence, to.convergence, t),
            orbitSpeed: this.lerp(from.orbitSpeed, to.orbitSpeed, t),
            orbitRadius: this.lerp(from.orbitRadius, to.orbitRadius, t),
            pulseSpeed: this.lerp(from.pulseSpeed, to.pulseSpeed, t),
            pulseIntensity: this.lerp(from.pulseIntensity, to.pulseIntensity, t),
            compression: this.lerp(from.compression, to.compression, t),
            opacity: this.lerp(from.opacity, to.opacity, t),
            color: {
                r: this.lerp(from.color.r, to.color.r, t),
                g: this.lerp(from.color.g, to.color.g, t),
                b: this.lerp(from.color.b, to.color.b, t)
            },
            particleSize: this.lerp(from.particleSize, to.particleSize, t),
            spread: this.lerp(from.spread, to.spread, t),
            burst: to.burst || false
        };
    }

    /**
     * Calculate particle position for a given index and time
     */
    calculateParticlePosition(index, time, behavior, basePosition, burstProgress = 0) {
        const i = index;
        const count = this.particleCount;

        // Base spherical distribution
        const phi = Math.acos(-1 + (2 * i) / count);
        const theta = Math.sqrt(count * Math.PI) * phi;

        // Calculate base position on sphere
        let x = Math.cos(theta) * Math.sin(phi);
        let y = Math.sin(theta) * Math.sin(phi);
        let z = Math.cos(phi);

        // Apply spread
        const spread = behavior.spread;
        x *= spread;
        y *= spread;
        z *= spread;

        // Apply chaos (random displacement)
        if (behavior.chaos > 0) {
            const chaosAmount = behavior.chaos;
            const noiseX = Math.sin(time * 2 + i * 0.1) * chaosAmount;
            const noiseY = Math.cos(time * 1.5 + i * 0.15) * chaosAmount;
            const noiseZ = Math.sin(time * 1.8 + i * 0.12) * chaosAmount;
            x += noiseX;
            y += noiseY;
            z += noiseZ;
        }

        // Apply convergence (move toward center)
        if (behavior.convergence > 0) {
            const convergeFactor = 1 - behavior.convergence * 0.7;
            x *= convergeFactor;
            y *= convergeFactor;
            z *= convergeFactor;
        }

        // Apply orbit
        if (behavior.orbitSpeed > 0) {
            const orbitAngle = time * behavior.orbitSpeed + (i / count) * Math.PI * 2;
            const orbitOffset = behavior.orbitRadius * (1 - behavior.compression);
            const orbitX = Math.cos(orbitAngle) * orbitOffset * 0.3;
            const orbitZ = Math.sin(orbitAngle) * orbitOffset * 0.3;
            x += orbitX;
            z += orbitZ;
        }

        // Apply compression
        if (behavior.compression > 0) {
            const compressFactor = 1 - behavior.compression * 0.8;
            x *= compressFactor;
            y *= compressFactor;
            z *= compressFactor;
        }

        // Apply burst effect (shockwave expansion)
        if (behavior.burst && burstProgress > 0) {
            const burstRadius = this.easeOutExpo(burstProgress) * 8;
            const direction = { x, y, z };
            const len = Math.sqrt(x * x + y * y + z * z) || 1;
            x = (direction.x / len) * burstRadius;
            y = (direction.y / len) * burstRadius;
            z = (direction.z / len) * burstRadius;
        }

        // Apply pulsing
        if (behavior.pulseSpeed > 0) {
            const pulse = Math.sin(time * behavior.pulseSpeed) * behavior.pulseIntensity;
            const pulseFactor = 1 + pulse;
            x *= pulseFactor;
            y *= pulseFactor;
            z *= pulseFactor;
        }

        // Offset by hand position
        x += basePosition.x;
        y += basePosition.y;
        z += basePosition.z;

        return { x, y, z };
    }

    /**
     * Calculate particle size for a given index and time
     */
    calculateParticleSize(index, time, behavior, burstProgress = 0) {
        let size = behavior.particleSize;

        // Add variation per particle
        const variation = Math.sin(index * 0.5 + time * 0.5) * 0.3;
        size += variation;

        // Pulsing size
        if (behavior.pulseSpeed > 0) {
            const pulse = Math.sin(time * behavior.pulseSpeed + index * 0.1);
            size *= 1 + pulse * behavior.pulseIntensity * 0.5;
        }

        // Burst makes particles larger initially then smaller
        if (behavior.burst && burstProgress > 0) {
            if (burstProgress < 0.3) {
                size *= 1 + burstProgress * 3;
            } else {
                size *= 1 + (1 - burstProgress) * 0.5;
            }
        }

        return Math.max(0.1, size);
    }

    /**
     * Calculate particle opacity for a given index and time
     */
    calculateParticleOpacity(index, time, behavior, burstProgress = 0, cooldownProgress = 0) {
        let opacity = behavior.opacity;

        // Add flickering for chaotic states
        if (behavior.chaos > 0.3) {
            const flicker = Math.random() * behavior.chaos * 0.5;
            opacity -= flicker;
        }

        // Burst flash
        if (behavior.burst && burstProgress > 0) {
            if (burstProgress < 0.2) {
                opacity = 1;
            } else {
                opacity = Math.max(0, 1 - (burstProgress - 0.2) * 1.5);
            }
        }

        // Cooldown fade
        if (cooldownProgress > 0) {
            opacity *= 1 - cooldownProgress * 0.7;
        }

        return Math.max(0, Math.min(1, opacity));
    }

    // Utility functions
    lerp(a, b, t) {
        return a + (b - a) * t;
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    easeOutExpo(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }
}
