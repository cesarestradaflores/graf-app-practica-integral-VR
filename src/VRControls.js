// -----------------------------------------------------------------
// --- VRControls.js (CORREGIDO - MOVIMIENTO RESPONSIVO INSTANTÁNEO)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { Config } from './Config.js';

export class VRControls {
    constructor(camera, renderer, player, scene, cameraContainer) {
        this.camera = camera;
        this.renderer = renderer;
        this.player = player;
        this.scene = scene;
        this.cameraContainer = cameraContainer;
        
        this.controllers = [];
        this.raycaster = new THREE.Raycaster();
        
        // ESTADO DE GIRO SIMPLIFICADO (NUEVO)
        this.gazeState = {
            canChangeLane: true,      // Bandera para permitir movimiento
            resetThreshold: 0.10,     // Zona muerta central para resetear
            currentAngle: 0
        };
        
        // Estados de botones
        this.buttonStates = {
            A: { pressed: false, lastPressed: false },
            B: { pressed: false, lastPressed: false },
            X: { pressed: false, lastPressed: false },
            Y: { pressed: false, lastPressed: false },
            Grip: { pressed: false, lastPressed: false },
            Trigger: { pressed: false, lastPressed: false },
            Menu: { pressed: false, lastPressed: false }
        };
        
        this.setupControllers();
        console.log("✅ VRControls - Sistema de giro optimizado cargado");
    }
    
    setupControllers() {
        if (!this.renderer.xr.enabled) return;
        
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            this.scene.add(controller);
            this.controllers.push(controller);
            this.setupMetaQuestEvents(controller, i);
            this.addControllerRay(controller, i);
        }
    }
    
    setupMetaQuestEvents(controller, index) {
        controller.addEventListener('selectstart', () => this.onSelectStart(index));
        controller.addEventListener('squeezestart', () => this.onSqueezeStart(index));
    }
    
    addControllerRay(controller, index) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1)
        ]);
        const material = new THREE.LineBasicMaterial({ 
            color: index === 0 ? 0xff0000 : 0x0000ff,
            opacity: 0.3,
            transparent: true
        });
        const line = new THREE.Line(geometry, material);
        line.scale.z = 3;
        controller.add(line);
    }
    
    onSelectStart(controllerIndex) {
        // Trigger: Izquierda = Saltar, Derecha = Rodar
        if (this.player && this.player.state !== 'dead') {
            if (controllerIndex === 0) this.player.jump();
            else if (controllerIndex === 1) this.player.roll();
            this.vibrateController(controllerIndex, 0.5, 50);
        }
    }
    
    onSqueezeStart(controllerIndex) {
        // Grip: Menú de Pausa
        if (this.player && this.player.game && this.player.game.toggleVRPauseMenu) {
            this.player.game.toggleVRPauseMenu();
            this.vibrateController(controllerIndex, 0.5, 100);
        }
    }
    
    update(deltaTime) {
        if (!this.renderer.xr.isPresenting) return;
        
        // 1. Actualizar Giro de Cabeza (Movimiento)
        this.updateHeadGazeControls();
        
        // 2. Actualizar Botones
        this.updateButtonStates();
        
        // 3. La cámara sigue al jugador suavemente en X
        if (this.cameraContainer && this.player) {
            const targetX = this.player.group.position.x;
            this.cameraContainer.position.x += (targetX - this.cameraContainer.position.x) * 0.1;
        }
    }

    // --- LÓGICA DE MOVIMIENTO CORREGIDA ---
    updateHeadGazeControls() {
        if (!this.camera) return;

        // 1. Obtener dirección de la mirada
        const gazeDirection = new THREE.Vector3();
        this.camera.getWorldDirection(gazeDirection);
        
        // gazeDirection.x: Negativo = Izquierda, Positivo = Derecha
        const rotationX = gazeDirection.x; 
        
        const threshold = Config.VR_SETTINGS.GAZE_THRESHOLD; 
        const resetZone = this.gazeState.resetThreshold;
        
        // LÓGICA DE DISPARO Y RESETEO
        if (this.gazeState.canChangeLane) {
            // Estamos listos para movernos
            
            if (rotationX < -threshold) {
                // MIRADA A LA IZQUIERDA
                console.log("⬅️ VR: Mover Izquierda");
                this.changeLane(-1);
                this.gazeState.canChangeLane = false; // Bloquear
                
            } else if (rotationX > threshold) {
                // MIRADA A LA DERECHA
                console.log("➡️ VR: Mover Derecha");
                this.changeLane(1);
                this.gazeState.canChangeLane = false; // Bloquear
            }
            
        } else {
            // Esperar a que el usuario mire al frente para desbloquear
            if (Math.abs(rotationX) < resetZone) {
                this.gazeState.canChangeLane = true;
            }
        }
    }
    
    changeLane(direction) {
        if (!this.player || this.player.state === 'dead') return;
        
        const currentLane = this.player.currentLane;
        // Calcular carril objetivo (0, 1, 2)
        const targetLane = THREE.MathUtils.clamp(currentLane + direction, 0, 2);
        
        if (targetLane !== currentLane) {
            this.player.strafe(direction);
            // Feedback táctil suave en ambos mandos
            this.vibrateController(0, 0.3, 50); 
            this.vibrateController(1, 0.3, 50);
        }
    }
    
    updateButtonStates() {
        // Implementación básica para compatibilidad de botones físicos si se agregan a futuro
        const session = this.renderer.xr.getSession();
        if (session && session.inputSources) {
            session.inputSources.forEach((source) => {
                if (source.gamepad) {
                    // Aquí podrías leer botones extra si lo necesitas
                }
            });
        }
    }
    
    vibrateController(index, intensity, duration) {
        if (this.controllers[index] && this.controllers[index].inputSource && this.controllers[index].inputSource.hapticActuators) {
            const actuator = this.controllers[index].inputSource.hapticActuators[0];
            if (actuator) actuator.pulse(intensity, duration);
        }
    }
}