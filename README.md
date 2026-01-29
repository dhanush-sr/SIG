# AURA - 3D Gesture Control System

## Overview
AURA (Advanced User Response Agent) is a sophisticated gesture recognition and control system that visualizes system intent through dynamic 3D particles. It combines computer vision, real-time state orchestration, and immersive visual feedback to create a safe and intuitive touchless interface.

## Key Features

- **Vision Agent**: Real-time hand tracking and high-fidelity landmark extraction using MediaPipe.
- **Orchestrator Agent**: Central nervous system managing state, safety checks, and component coordination.
- **Particle Visualization**: Dynamic 3D particle system (Three.js) that visually represents the system's "truth" and intent.
- **Safety & Validation**: Multi-layer safety checks including confidence thresholds, stability verification, and cooldown periods.
- **Dual-Mode Feedback**: Visual cues through particle behaviors and HUD overlays, plus optional audio feedback.

## System Architecture

The system operates on a pipeline architecture:
1.  **Vision**: Camera feed -> Landmark Extraction (Raw JSON data)
2.  **Gesture**: Analysis of landmarks to detect specific gestures (Closed Fist, Open Palm, etc.)
3.  **Safety**: Validation of gesture confidence and stability.
4.  **Action**: Execution of approved commands (e.g., Toggle Mute, Navigation).
5.  **Visual**: Real-time rendering of the system state via the particle field.

## Getting Started

### Prerequisites
- A modern web browser (Chrome/Edge recommended) with WebGL support.
- A webcam.

### Running Locally
1. Clone the repository.
2. Serve the directory using a local web server (to avoid CORS issues with modules).
   ```bash
   # Python 3
   python3 -m http.server 8080
   ```
3. Open `http://localhost:8080/orchestrator.html` in your browser.

## Virtual Health Assistant
This repository also contains a `virtual-health-assistant` module, a React/Vite based application for health monitoring interfaces.

## License
[MIT](LICENSE)
