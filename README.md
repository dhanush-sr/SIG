# AURA Orchestrator - 3D Gesture Control System

## Overview
AURA (Advanced User Response Agent) is a sophisticated gesture recognition and control system that visualizes system intent through dynamic 3D particles. It combines computer vision, real-time state orchestration, and immersive visual feedback to create a safe and intuitive touchless interface.

## Key Features
- **Vision Agent**: Real-time hand tracking and high-fidelity landmark extraction using MediaPipe.
- **Orchestrator Agent**: Central nervous system managing state, safety checks, and component coordination.
- **Particle Visualization**: Dynamic 3D particle system (Three.js) that visually represents the system's "truth" and intent.
- **Safety & Validation**: Multi-layer safety checks including confidence thresholds, stability verification, and cooldown periods.
- **Dual-Mode Feedback**: Visual cues through particle behaviors and HUD overlays, plus optional audio feedback.
- **Action Execution**: Mute/Unmute toggle and navigation controls based on interpreted gestures.

## System Architecture
The system operates on a coordinated pipeline of specialized agents:

1.  **Vision Agent** (`vision.html`): Captures webcam feed and extracts raw hand landmarks.
2.  **Gesture Interpreter**: Analyzes landmark data to identify high-level gestures (e.g., SWIPE_RIGHT, CLOSED_FIST).
3.  **Safety Agent**: Validates detected gestures against confidence thresholds and cooldown timers.
4.  **Orchestrator Agent** (`orchestrator-agent.js`): The central hub that coordinates communication between all agents and manages the global system state.
5.  **Action Agent**: Executes the final approved command (e.g., muting audio).
6.  **Visual Agent**: Renders real-time feedback using a particle system.

## Getting Started

### Prerequisites
- A modern web browser (Chrome/Edge recommended) with WebGL support.
- A webcam.

### Running Locally
1.  Clone the repository:
    ```bash
    git clone https://github.com/dhanush-sr/SIG.git
    cd SIG
    ```
2.  Serve the directory using a local web server (to avoid CORS issues with modules).
    ```bash
    # Python 3
    python3 -m http.server 8080
    ```
3.  Open `http://localhost:8080/orchestrator.html` in your browser.

### Using Gestures
- **Closed Fist (Hold)**: Toggle System Mute.
- **Swipe Left/Right**: Navigation (simulated).

## File Structure
- `orchestrator.html`: The main entry point and UI dashboard.
- `vision.html`: Standalone vision processing module.
- `gesture_interpreter.py`: Python reference implementation for gesture logic (ported to JS for the web agent).
- `orchestrator-agent.js`: Core logic for state management and agent coordination.
- `vision-agent.js`: Hand tracking and landmark broadcasting logic.
- `index.html`: Particle visualization layer.

## Technologies
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Computer Vision**: MediaPipe Hands
- **Visualization**: Three.js / WebGL
- **Communication**: BroadcastChannel API

## Virtual Health Assistant
This repository also contains a `virtual-health-assistant` module, a React/Vite based application for health monitoring interfaces.

## License
[MIT](LICENSE)
