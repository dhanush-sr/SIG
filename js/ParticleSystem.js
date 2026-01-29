/**
 * ParticleSystem - Three.js particle system for gesture visualization
 * Heavy, dynamic 3D particles that visually represent system truth
 */

import * as THREE from 'three';
import { ParticleBehaviors } from './ParticleBehaviors.js';
import { SystemState } from './StateManager.js';

export class ParticleSystem {
    constructor(canvas, particleCount = 5000) {
        this.canvas = canvas;
        this.particleCount = particleCount;

        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = null;
        this.particleGeometry = null;
        this.particleMaterial = null;

        // Particle data
        this.positions = null;
        this.colors = null;
        this.sizes = null;
        this.opacities = null;

        // Animation
        this.time = 0;
        this.clock = new THREE.Clock();

        // Behavior engine
        this.behaviors = new ParticleBehaviors(particleCount);

        // Current visual state
        this.currentBehavior = null;

        // Initialize
        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a0f);
        this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.03);

        // Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 100);
        this.camera.position.z = 8;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Create particles
        this.createParticles();

        // Add ambient glow
        this.createAmbientGlow();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }

    createParticles() {
        // Geometry with buffer attributes
        this.particleGeometry = new THREE.BufferGeometry();

        // Initialize arrays
        this.positions = new Float32Array(this.particleCount * 3);
        this.colors = new Float32Array(this.particleCount * 3);
        this.sizes = new Float32Array(this.particleCount);
        this.opacities = new Float32Array(this.particleCount);

        // Initial random positions
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;

            // Spherical distribution
            const phi = Math.acos(-1 + (2 * i) / this.particleCount);
            const theta = Math.sqrt(this.particleCount * Math.PI) * phi;

            this.positions[i3] = Math.cos(theta) * Math.sin(phi) * 4;
            this.positions[i3 + 1] = Math.sin(theta) * Math.sin(phi) * 4;
            this.positions[i3 + 2] = Math.cos(phi) * 4;

            // Initial colors (cyan-ish)
            this.colors[i3] = 0.2;
            this.colors[i3 + 1] = 0.5;
            this.colors[i3 + 2] = 0.8;

            // Initial sizes
            this.sizes[i] = 1.0;

            // Initial opacities
            this.opacities[i] = 0.5;
        }

        // Set attributes
        this.particleGeometry.setAttribute('position',
            new THREE.BufferAttribute(this.positions, 3));
        this.particleGeometry.setAttribute('color',
            new THREE.BufferAttribute(this.colors, 3));
        this.particleGeometry.setAttribute('size',
            new THREE.BufferAttribute(this.sizes, 1));
        this.particleGeometry.setAttribute('opacity',
            new THREE.BufferAttribute(this.opacities, 1));

        // Custom shader material
        this.particleMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                pixelRatio: { value: this.renderer.getPixelRatio() }
            },
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        // Create points mesh
        this.particles = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.scene.add(this.particles);
    }

    createAmbientGlow() {
        // Central glow sphere
        const glowGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.15
        });
        this.glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        this.scene.add(this.glowSphere);

        // Outer glow
        const outerGlowGeometry = new THREE.SphereGeometry(1.5, 32, 32);
        const outerGlowMaterial = new THREE.MeshBasicMaterial({
            color: 0x7b2dff,
            transparent: true,
            opacity: 0.05
        });
        this.outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
        this.scene.add(this.outerGlow);
    }

    getVertexShader() {
        return `
            attribute float size;
            attribute float opacity;
            attribute vec3 color;
            
            varying vec3 vColor;
            varying float vOpacity;
            
            uniform float time;
            uniform float pixelRatio;
            
            void main() {
                vColor = color;
                vOpacity = opacity;
                
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                
                // Size attenuation
                gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
                gl_PointSize = clamp(gl_PointSize, 1.0, 50.0);
                
                gl_Position = projectionMatrix * mvPosition;
            }
        `;
    }

    getFragmentShader() {
        return `
            varying vec3 vColor;
            varying float vOpacity;
            
            void main() {
                // Circular particle with soft edge
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                // Soft circle with glow
                float alpha = 1.0 - smoothstep(0.2, 0.5, dist);
                alpha *= vOpacity;
                
                // Add core brightness
                float core = 1.0 - smoothstep(0.0, 0.2, dist);
                vec3 finalColor = vColor + vec3(core * 0.5);
                
                if (alpha < 0.01) discard;
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `;
    }

    /**
     * Update particles based on state parameters
     */
    update(stateParams) {
        const delta = this.clock.getDelta();
        this.time += delta;

        // Get interpolated behavior
        const behavior = this.behaviors.getInterpolatedBehavior(
            stateParams.previousState,
            stateParams.state,
            stateParams.transitionProgress
        );

        this.currentBehavior = behavior;

        // Update each particle
        for (let i = 0; i < this.particleCount; i++) {
            const i3 = i * 3;

            // Calculate new position
            const pos = this.behaviors.calculateParticlePosition(
                i,
                this.time,
                behavior,
                stateParams.handPosition,
                stateParams.burstProgress
            );

            this.positions[i3] = pos.x;
            this.positions[i3 + 1] = pos.y;
            this.positions[i3 + 2] = pos.z;

            // Calculate size
            this.sizes[i] = this.behaviors.calculateParticleSize(
                i,
                this.time,
                behavior,
                stateParams.burstProgress
            );

            // Calculate opacity
            this.opacities[i] = this.behaviors.calculateParticleOpacity(
                i,
                this.time,
                behavior,
                stateParams.burstProgress,
                stateParams.cooldownProgress
            );

            // Update colors
            this.colors[i3] = behavior.color.r;
            this.colors[i3 + 1] = behavior.color.g;
            this.colors[i3 + 2] = behavior.color.b;
        }

        // Update buffer attributes
        this.particleGeometry.attributes.position.needsUpdate = true;
        this.particleGeometry.attributes.color.needsUpdate = true;
        this.particleGeometry.attributes.size.needsUpdate = true;
        this.particleGeometry.attributes.opacity.needsUpdate = true;

        // Update shader uniforms
        this.particleMaterial.uniforms.time.value = this.time;

        // Update glow based on state
        this.updateGlow(behavior, stateParams);

        // Slow camera rotation
        this.camera.position.x = Math.sin(this.time * 0.1) * 0.5;
        this.camera.position.y = Math.cos(this.time * 0.08) * 0.3;
        this.camera.lookAt(0, 0, 0);
    }

    updateGlow(behavior, stateParams) {
        // Update central glow color and intensity
        const glowColor = new THREE.Color(behavior.color.r, behavior.color.g, behavior.color.b);
        this.glowSphere.material.color = glowColor;
        this.glowSphere.material.opacity = 0.1 + behavior.compression * 0.3;

        // Scale glow based on compression
        const glowScale = 0.5 + (1 - behavior.compression) * 0.5;
        this.glowSphere.scale.setScalar(glowScale);

        // Burst effect on glow
        if (stateParams.burstProgress > 0 && stateParams.burstProgress < 0.5) {
            this.glowSphere.material.opacity = 0.8;
            this.glowSphere.scale.setScalar(1 + stateParams.burstProgress * 3);
        }

        // Outer glow
        this.outerGlow.material.opacity = 0.02 + behavior.pulseIntensity * 0.05;
        this.outerGlow.scale.setScalar(1.5 + Math.sin(this.time * behavior.pulseSpeed) * 0.2);
    }

    /**
     * Render the scene
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Handle window resize
     */
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.particleMaterial.uniforms.pixelRatio.value = this.renderer.getPixelRatio();
    }

    /**
     * Get particle count
     */
    getParticleCount() {
        return this.particleCount;
    }
}
