/**
 * Vision Agent - Hand Landmark Extractor
 * 
 * RESPONSIBILITY:
 * - Extract accurate hand landmark data from live camera feed
 * - Output raw, structured JSON data
 * 
 * DOES NOT:
 * - Classify gestures
 * - Trigger actions
 * - Control visuals beyond landmark visualization
 */

class VisionAgent {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.outputElement = document.getElementById('output');
        this.statusIndicator = document.getElementById('status-indicator');
        this.detectionBadge = document.getElementById('detection-badge');

        this.hands = null;
        this.camera = null;
        this.isInitialized = false;

        // Current output state
        this.currentOutput = {
            handDetected: false,
            landmarks: [],
            handCenter: null,
            timestamp: 0
        };

        // BroadcastChannel for Orchestrator communication
        this.visionChannel = new BroadcastChannel('aura-vision');

        this.init();
    }

    async init() {
        try {
            this.updateStatus('Loading MediaPipe...');

            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
                }
            });

            // Configure for single hand tracking with high accuracy
            this.hands.setOptions({
                maxNumHands: 1,  // Track ONLY one hand
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.7
            });

            this.hands.onResults(this.processResults.bind(this));

            this.updateStatus('Accessing camera...');

            // Initialize camera
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.hands) {
                        await this.hands.send({ image: this.video });
                    }
                },
                width: 640,
                height: 480
            });

            await this.camera.start();

            this.isInitialized = true;
            this.updateStatus('Active', true);

        } catch (error) {
            console.error('Vision Agent initialization failed:', error);
            this.updateStatus('Error: ' + error.message);
            this.outputFailureState();
        }
    }

    /**
     * Process results from MediaPipe Hands
     * Extracts landmarks and outputs structured data
     */
    processResults(results) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const timestamp = Date.now();

        // Check if hand is detected
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            // Get first hand only (RULE: Track ONLY one hand)
            const handLandmarks = results.multiHandLandmarks[0];

            // Extract normalized landmarks
            const landmarks = handLandmarks.map(lm => ({
                x: parseFloat(lm.x.toFixed(6)),
                y: parseFloat(lm.y.toFixed(6)),
                z: parseFloat(lm.z.toFixed(6))
            }));

            // Calculate hand center (average of all landmarks)
            const handCenter = this.calculateHandCenter(landmarks);

            // Update output
            this.currentOutput = {
                handDetected: true,
                landmarks: landmarks,
                handCenter: handCenter,
                timestamp: timestamp
            };

            // Draw landmarks on canvas
            this.drawLandmarks(handLandmarks);

            // Update UI state
            this.updateDetectionBadge(true);

        } else {
            // No hand detected - output empty state
            // RULE: Never fabricate landmarks, never smooth or guess missing data
            this.currentOutput = {
                handDetected: false,
                landmarks: [],
                handCenter: null,
                timestamp: timestamp
            };

            this.updateDetectionBadge(false);
        }

        // Output structured JSON
        this.outputData();
    }

    /**
     * Calculate the center point of all hand landmarks
     */
    calculateHandCenter(landmarks) {
        if (!landmarks || landmarks.length === 0) {
            return null;
        }

        let sumX = 0;
        let sumY = 0;

        for (const lm of landmarks) {
            sumX += lm.x;
            sumY += lm.y;
        }

        return {
            x: parseFloat((sumX / landmarks.length).toFixed(6)),
            y: parseFloat((sumY / landmarks.length).toFixed(6))
        };
    }

    /**
     * Draw hand landmarks and connections on canvas
     */
    drawLandmarks(landmarks) {
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Draw connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],       // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17]             // Palm
        ];

        this.ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
        this.ctx.lineWidth = 2;

        for (const [start, end] of connections) {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x * width, startPoint.y * height);
            this.ctx.lineTo(endPoint.x * width, endPoint.y * height);
            this.ctx.stroke();
        }

        // Draw landmark points
        for (let i = 0; i < landmarks.length; i++) {
            const lm = landmarks[i];
            const x = lm.x * width;
            const y = lm.y * height;

            // Outer glow
            this.ctx.beginPath();
            this.ctx.arc(x, y, 6, 0, 2 * Math.PI);
            this.ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            this.ctx.fill();

            // Inner point
            this.ctx.beginPath();
            this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
            this.ctx.fillStyle = '#22c55e';
            this.ctx.fill();
        }

        // Draw hand center
        if (this.currentOutput.handCenter) {
            const cx = this.currentOutput.handCenter.x * width;
            const cy = this.currentOutput.handCenter.y * height;

            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 8, 0, 2 * Math.PI);
            this.ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
            this.ctx.fill();

            this.ctx.beginPath();
            this.ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
            this.ctx.fillStyle = '#8b5cf6';
            this.ctx.fill();
        }
    }

    /**
     * Output data to display and console
     */
    outputData() {
        const jsonString = JSON.stringify(this.currentOutput, null, 2);
        this.outputElement.textContent = jsonString;

        // Broadcast to Orchestrator Agent via BroadcastChannel
        if (this.visionChannel) {
            this.visionChannel.postMessage(this.currentOutput);
        }
    }

    /**
     * Output failure state when camera is invalid
     * RULE: If camera input is invalid, output handDetected = false
     */
    outputFailureState() {
        this.currentOutput = {
            handDetected: false,
            landmarks: [],
            handCenter: null,
            timestamp: Date.now()
        };
        this.outputData();
    }

    /**
     * Update status indicator
     */
    updateStatus(text, active = false) {
        const statusText = this.statusIndicator.querySelector('.text');
        statusText.textContent = text;

        if (active) {
            this.statusIndicator.classList.add('active');
        } else {
            this.statusIndicator.classList.remove('active');
        }
    }

    /**
     * Update detection badge
     */
    updateDetectionBadge(detected) {
        const badge = this.detectionBadge.querySelector('.badge');

        if (detected) {
            badge.className = 'badge hand-detected';
            badge.textContent = 'Hand Detected';
        } else {
            badge.className = 'badge no-hand';
            badge.textContent = 'No Hand';
        }
    }

    /**
     * Get current output (for external access)
     */
    getCurrentOutput() {
        return { ...this.currentOutput };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.camera) {
            this.camera.stop();
        }
        this.hands = null;
    }
}

// Initialize Vision Agent when DOM is ready
let visionAgent = null;

document.addEventListener('DOMContentLoaded', () => {
    visionAgent = new VisionAgent();
});

// Expose for external access
window.VisionAgent = {
    getInstance: () => visionAgent,
    getCurrentOutput: () => visionAgent ? visionAgent.getCurrentOutput() : null
};
