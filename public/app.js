// Face detection using face-api.js
let video;
let canvas;
let displaySize;
let statusElement;

// Liveness detection variables
let livenessState = {
    center: false,
    left: false,
    right: false,
    up: false,
    down: false,
    completed: false,
    completedCount: 0,
    currentInstruction: 'Realiza movimientos de cabeza en cualquier orden'
};

// Required movements for complete liveness check (no specific order)
const requiredMovements = ['center', 'left', 'up', 'right', 'down'];
const totalMovements = requiredMovements.length;
let detectionCount = 0;
const DETECTION_THRESHOLD = 3; // Más sensible para pasar checks más fácil
let lastOrientation = '';
let orientationStabilityCount = 0;

// Update status message
function updateStatus(message) {
    if (statusElement) {
        statusElement.textContent = message;
    }
}

// Load face-api.js models
async function loadModels() {
    const MODEL_URL = '/models';
    
    try {
        updateStatus('Loading AI models...');
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        updateStatus('Models loaded successfully!');
    } catch (error) {
        updateStatus('Error loading models: ' + error.message);
        console.error('Error loading models:', error);
    }
}

// Start video stream
async function startVideo() {
    try {
        updateStatus('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 500, height: 500 } 
        });
        video.srcObject = stream;
        updateStatus('Camera access granted!');
    } catch (error) {
        updateStatus('Error accessing camera: ' + error.message);
        console.error('Error accessing camera:', error);
        alert('Error accessing camera. Please make sure you have given camera permissions.');
    }
}

// Analyze face orientation based on landmarks
function analyzeFaceOrientation(landmarks) {
    // Get key facial landmarks
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const jaw = landmarks.getJawOutline();
    
    // Calculate face center
    const faceCenter = {
        x: (jaw[0].x + jaw[16].x) / 2,
        y: (jaw[0].y + jaw[16].y) / 2
    };
    
    // Calculate nose position relative to face center
    const noseX = nose[3].x; // Nose tip
    const noseY = nose[3].y;
    
    // Calculate face dimensions
    const faceWidth = Math.abs(jaw[16].x - jaw[0].x);
    const faceHeight = Math.abs(jaw[8].y - Math.min(leftEye[1].y, rightEye[1].y));
    
    // Calculate offsets (normalized)
    const noseOffsetX = (noseX - faceCenter.x) / faceWidth;
    const noseOffsetY = (noseY - faceCenter.y) / faceHeight;
    
    // Calculate eye distance ratio for horizontal rotation
    const eyeDistance = Math.abs(rightEye[3].x - leftEye[0].x);
    const eyeRatio = eyeDistance / faceWidth;
    
    // Detection with intermediate positions (optional/skippable)
    let orientation = 'center';
    
    // Check horizontal movements with intermediates (left/right) - INVERTED for mirror effect
    if (noseOffsetX > 0.35) {
        orientation = 'left-strong';  // Inverted: positive X is now left
    } else if (noseOffsetX > 0.25) {
        orientation = 'left';
    } else if (noseOffsetX > 0.18) {
        orientation = 'left-light';
    } else if (noseOffsetX < -0.35) {
        orientation = 'right-strong';  // Inverted: negative X is now right
    } else if (noseOffsetX < -0.25) {
        orientation = 'right';
    } else if (noseOffsetX < -0.18) {
        orientation = 'right-light';
    }
    // Then check vertical movements with intermediates (up/down) - down más restrictivo
    else if (noseOffsetY < -0.28) {
        orientation = 'up-strong';
    } else if (noseOffsetY < -0.20) {
        orientation = 'up';
    } else if (noseOffsetY < -0.08) {
        orientation = 'up-light';
    } else if (noseOffsetY > 0.40) {
        orientation = 'down-strong';
    } else if (noseOffsetY > 0.32) {
        orientation = 'down';
    } else if (noseOffsetY > 0.25) {
        orientation = 'down-light';
    }
    // Everything else is center (default)
    
    // Debug info
    
    return orientation;
}

// Update liveness instructions
function updateLivenessInstructions() {
    updateProgressVisual();
    
    if (livenessState.completed) {
        updateStatus('Verificación de vida completada correctamente!');
        return;
    }
    
    // Get remaining movements
    const remainingMovements = requiredMovements.filter(movement => !livenessState[movement]);
    
    if (remainingMovements.length === 0) {
        livenessState.completed = true;
        updateStatus('Verificación de vida completada correctamente!');
        return;
    }
    
    // Create instruction based on remaining movements
    const movementNames = {
        'center': 'centro',
        'left': 'izquierda',
        'right': 'derecha',
        'up': 'arriba',
        'down': 'abajo'
    };
    
    const remainingNames = remainingMovements.map(m => movementNames[m]).join(', ');
    const instruction = `Pendientes: ${remainingNames}`;
    
    updateStatus(`${instruction} (${livenessState.completedCount}/${totalMovements} completados)`);
}

// Update visual progress indicators
function updateProgressVisual() {
    const centerStep = document.getElementById('step-center');
    const leftStep = document.getElementById('step-left');
    const rightStep = document.getElementById('step-right');
    const upStep = document.getElementById('step-up');
    const downStep = document.getElementById('step-down');
    
    if (!centerStep || !leftStep || !rightStep || !upStep || !downStep) return;
    
    const steps = {
        center: centerStep,
        left: leftStep,
        right: rightStep,
        up: upStep,
        down: downStep
    };
    
    // Reset all steps
    Object.values(steps).forEach(step => {
        step.classList.remove('active', 'completed');
    });
    
    // Mark completed steps based on livenessState
    Object.keys(steps).forEach(movement => {
        if (livenessState[movement]) {
            steps[movement].classList.add('completed');
        }
    });
    
    // If completed, mark all as completed
    if (livenessState.completed) {
        Object.values(steps).forEach(step => {
            step.classList.add('completed');
        });
    }
}

// Process face orientation for liveness detection
function processLivenessDetection(orientation) {
    if (livenessState.completed) return;
    
    // Map intermediate positions to main positions for acceptance
    let mainOrientation = orientation;
    if (orientation.includes('-')) {
        mainOrientation = orientation.split('-')[0]; // Remove -light, -strong suffixes
    }
    
    // Allow for more flexible detection - count stable detections
    if (orientation === lastOrientation) {
        orientationStabilityCount++;
    } else {
        orientationStabilityCount = 1;
        lastOrientation = orientation;
    }
    
    // Check if current orientation is one of the required movements and not yet completed
    const isValidMovement = requiredMovements.includes(mainOrientation);
    const isNotCompleted = !livenessState[mainOrientation];
    const isStableDetection = orientationStabilityCount >= DETECTION_THRESHOLD;
    
    if (isValidMovement && isNotCompleted && isStableDetection) {
        
        // Mark movement as completed
        livenessState[mainOrientation] = true;
        livenessState.completedCount++;
        
        // Capture photo for this step
        capturePhoto(mainOrientation);
        
        // Check if we completed all movements
        if (livenessState.completedCount >= totalMovements) {
            livenessState.completed = true;
            // Capture final photo and then redirect
            setTimeout(() => {
                capturePhoto('final');
                // Redirect to home page after capturing final photo
                setTimeout(() => {
                    window.location.href = '/';
                }, 3000); // Wait 3 seconds to show completion message
            }, 1000);
        }
        
        // Reset counters
        orientationStabilityCount = 0;
        lastOrientation = '';
        
        // Update instructions and visual indicators
        updateLivenessInstructions();
        updateProgressVisual();
    }
}
function createCanvas() {
    canvas = faceapi.createCanvasFromMedia(video);
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.borderRadius = '50%';
    canvas.style.overflow = 'hidden';
    
    const videoContainer = document.getElementById('video-container');
    if (videoContainer) {
        videoContainer.style.position = 'relative';
        videoContainer.appendChild(canvas);
    }
    
    displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
}

// Detect faces and draw results
async function detectFaces() {
    // Stop detection if liveness is completed
    if (livenessState.completed) {
        return;
    }
    
    if (!video || video.paused || video.ended) return;
    
    try {
        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceExpressions();

        // Clear previous drawings
        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);

        if (detections.length > 0) {
            // Resize detections to match canvas
            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            // Hide face detection boxes and landmarks for cleaner UI
            // faceapi.draw.drawDetections(canvas, resizedDetections);
            // faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
            // faceapi.draw.drawFaceExpressions(canvas, resizedDetections);
            
            // Process liveness detection for the first detected face
            const landmarks = resizedDetections[0].landmarks;
            if (landmarks) {
                const orientation = analyzeFaceOrientation(landmarks);
                processLivenessDetection(orientation);
                
                // Update face outline and visual indicators
                updateFaceOutline(resizedDetections[0]);
                updateCircleIndicators(orientation);
                
                // Optional: Hide debug info for cleaner UI
                // context.fillStyle = livenessState.completed ? '#28a745' : '#007bff';
                // context.font = '14px Arial';
                // context.fillText(`Debug: ${orientation}`, 10, 25);
            }
            
        } else {
            // No face detected, reset detection counter and hide face outline
            detectionCount = 0;
            const faceOutline = document.getElementById('face-outline');
            const directionCircle = document.getElementById('direction-circle');
            if (faceOutline) faceOutline.classList.remove('visible');
            if (directionCircle) directionCircle.classList.remove('active');
            updateStatus('No se detecta rostro - Colócate frente a la cámara');
        }
    } catch (error) {
        console.error('Error during face detection:', error);
    }
    
    // Continue detection loop only if not completed
    if (!livenessState.completed) {
        requestAnimationFrame(detectFaces);
    }
}

// Get progress text for display
function getProgressText() {
    if (livenessState.completed) return 'Completado';
    const currentStep = livenessState.currentStep;
    const steps = ['Centro', 'Izquierda', 'Arriba', 'Derecha', 'Abajo', 'Centro Final'];
    
    let progress = '';
    for (let i = 0; i <= currentStep && i < steps.length; i++) {
        if (i > 0) progress += ' → ';
        progress += i < currentStep ? steps[i] + '' : steps[i];
    }
    
    return progress || 'Iniciando...';
}

// Update face outline based on detection
function updateFaceOutline(detection) {
    const faceOutline = document.getElementById('face-outline');
    const directionCircle = document.getElementById('direction-circle');
    if (!faceOutline || !detection || !directionCircle) return;
    
    const box = detection.detection.box;
    const videoContainer = document.getElementById('video-container');
    
    // Get container dimensions (circular)
    const containerSize = Math.min(videoContainer.offsetWidth, videoContainer.offsetHeight);
    const videoSize = Math.min(video.videoWidth, video.videoHeight);
    const scale = containerSize / videoSize;
    
    // Calculate center of the circular container
    const containerCenterX = containerSize / 2;
    const containerCenterY = containerSize / 2;
    
    // Calculate face position (accounting for mirror effect)
    const faceWidth = box.width * scale;
    const faceHeight = box.height * scale;
    const faceCenterX = containerCenterX - (box.x + box.width / 2 - videoSize / 2) * scale; // Mirror X
    const faceCenterY = containerCenterY + (box.y + box.height / 2 - videoSize / 2) * scale;
    
    // Make the outline proportional to face size
    const outlineSize = Math.max(faceWidth, faceHeight) * 1.2;
    
    // Position the face outline
    faceOutline.style.left = `${faceCenterX - outlineSize / 2}px`;
    faceOutline.style.top = `${faceCenterY - outlineSize / 2}px`;
    faceOutline.style.width = `${outlineSize}px`;
    faceOutline.style.height = `${outlineSize}px`;
    faceOutline.classList.add('visible');
    
    // The direction circle is already positioned relative to container center
    directionCircle.classList.add('active');
}

// Update visual circle indicators
function updateCircleIndicators(currentOrientation) {
    const segments = {
        center: document.getElementById('segment-center'),
        up: document.getElementById('segment-up'),
        down: document.getElementById('segment-down'),
        left: document.getElementById('segment-left'),
        right: document.getElementById('segment-right')
    };
    
    // Reset all segments
    Object.values(segments).forEach(segment => {
        if (segment) {
            segment.classList.remove('segment-active', 'segment-completed');
        }
    });
    
    // Mark completed segments based on livenessState
    Object.keys(segments).forEach(movement => {
        if (livenessState[movement] && segments[movement]) {
            segments[movement].classList.add('segment-completed');
        }
    });
    
    // Mark current orientation as active (if not completed yet)
    let mainOrientation = currentOrientation;
    if (currentOrientation.includes('-')) {
        mainOrientation = currentOrientation.split('-')[0];
    }
    
    if (segments[mainOrientation] && !livenessState[mainOrientation] && !livenessState.completed) {
        segments[mainOrientation].classList.add('segment-active');
    }
    
    // If all completed, mark all as completed
    if (livenessState.completed) {
        Object.values(segments).forEach(segment => {
            if (segment) {
                segment.classList.add('segment-completed');
                segment.classList.remove('segment-active');
            }
        });
    }
}

// Capture photo from video stream
function capturePhoto(step) {
    try {
        // Create a temporary canvas to capture the photo
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = video.videoWidth;
        tempCanvas.height = video.videoHeight;
        const tempContext = tempCanvas.getContext('2d');
        
        // Draw the current video frame to the canvas
        tempContext.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        
        // Convert to base64
        const imageData = tempCanvas.toDataURL('image/png');
        
        // Upload the photo
        uploadPhoto(imageData, step);
        
    } catch (error) {
        console.error('Error capturing photo:', error);
        updateStatus(`Error capturando foto para paso: ${step}`);
    }
}

// Upload photo to server
async function uploadPhoto(imageData, step) {
    try {
        updateStatus(`Guardando foto para paso: ${step}...`);
        
        const response = await fetch('/api/save-liveness-photo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                imageData: imageData,
                step: step,
                timestamp: Date.now()
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log(`Foto guardada exitosamente: ${result.filename}`);
            if (step === 'final') {
                updateStatus('¡Verificación completa! Redirigiendo al inicio...');
            } else {
                // Return to normal status after a brief confirmation
                setTimeout(() => {
                    if (!livenessState.completed) {
                        updateLivenessInstructions();
                    }
                }, 1500);
            }
        } else {
            console.error('Error uploading photo:', result.message);
            updateStatus(`Error guardando foto: ${result.message}`);
        }
        
    } catch (error) {
        console.error('Error uploading photo:', error);
        updateStatus('Error de conexión al guardar foto');
    }
}

// Function to restart verification
function restartVerification() {
    // Reset liveness state
    livenessState = {
        center: false,
        left: false,
        right: false,
        up: false,
        down: false,
        completed: false,
        completedCount: 0,
        currentInstruction: 'Realiza movimientos de cabeza en cualquier orden'
    };
    
    // Reset detection variables
    detectionCount = 0;
    lastOrientation = '';
    orientationStabilityCount = 0;
    
    // Update UI
    updateLivenessInstructions();
    updateProgressVisual();
    
    // Restart face detection if video is available
    if (video && !video.paused && !video.ended) {
        detectFaces();
    }
    
    updateStatus('Realiza movimientos hacia: centro, izquierda, arriba, derecha, abajo (cualquier orden)');
}

// Initialize everything when page loads
window.addEventListener('DOMContentLoaded', async () => {
    
    video = document.getElementById('video');
    statusElement = document.getElementById('status');
    
    if (!video) {
        updateStatus('Error: Video element not found');
        return;
    }
    
    // Load models first
    await loadModels();
    
    // Start video stream
    await startVideo();
    
    // Wait for video to be ready
    video.addEventListener('loadedmetadata', () => {
        updateStatus('Setting up face detection...');
        createCanvas();
        
        // Start face detection
        video.addEventListener('play', () => {
            updateStatus('Realiza movimientos hacia: centro, izquierda, arriba, derecha, abajo (cualquier orden)');
            updateLivenessInstructions();
            detectFaces();
        });
    });
});
