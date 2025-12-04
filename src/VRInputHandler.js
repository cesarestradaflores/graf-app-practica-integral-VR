// -----------------------------------------------------------------
// --- VRInputHandler.js (VERSIÓN FINAL CORREGIDA)
// -----------------------------------------------------------------

import * as THREE from 'three';

export class VRInputHandler {
    constructor(renderer, gameInstance) {
        this.renderer = renderer;
        this.game = gameInstance;
        this.controllers = [];
        this.controllerGrips = [];
        this.raycaster = new THREE.Raycaster();
        this.rayLength = 3.0;
        this.selectedObject = null;
        this.hoveredObject = null;
        
        // Estados de botones
        this.buttonStates = {
            A: { pressed: false, lastPressed: false },
            B: { pressed: false, lastPressed: false },
            X: { pressed: false, lastPressed: false },
            Y: { pressed: false, lastPressed: false },
            Grip: { pressed: false, lastPressed: false },
            Trigger: { pressed: false, lastPressed: false }
        };
        
        // Configuración
        this.controllerModelsVisible = false; // DESACTIVADO temporalmente
        this.hapticEnabled = true;
        
        this.init();
    }
    
    init() {
        if (!this.renderer.xr.enabled) {
            console.warn("WebXR no está habilitado en el renderer");
            return;
        }
        
        // Crear controladores XR
        this.createControllers();
        
        // Configurar raycaster
        this.raycaster.far = this.rayLength;
        this.raycaster.lineWidth = 2;
        
        console.log("✅ VRInputHandler inicializado con THREE disponible");
    }
    
    createControllers() {
        // Controller 0 (izquierdo)
        const controller1 = this.renderer.xr.getController(0);
        controller1.addEventListener('selectstart', () => this.onSelectStart(0));
        controller1.addEventListener('selectend', () => this.onSelectEnd(0));
        controller1.addEventListener('connected', (event) => this.onControllerConnected(event, 0));
        controller1.addEventListener('disconnected', () => this.onControllerDisconnected(0));
        
        // Controller 1 (derecho)
        const controller2 = this.renderer.xr.getController(1);
        controller2.addEventListener('selectstart', () => this.onSelectStart(1));
        controller2.addEventListener('selectend', () => this.onSelectEnd(1));
        controller2.addEventListener('connected', (event) => this.onControllerConnected(event, 1));
        controller2.addEventListener('disconnected', () => this.onControllerDisconnected(1));
        
        // Añadir a la escena del juego
        if (this.game && this.game.scene) {
            this.game.scene.add(controller1);
            this.game.scene.add(controller2);
        }
        
        this.controllers = [controller1, controller2];
        
        // Crear grips SOLO si THREE está disponible y está habilitado
        if (this.controllerModelsVisible) {
            this.createControllerModels();
        } else {
            console.log("⚠️ Modelos de controladores desactivados temporalmente");
        }
        
        console.log("🎮 Controladores VR creados");
    }
    
    createControllerModels() {
        // Verificar que THREE esté disponible
        if (!THREE) {
            console.error("❌ THREE no está disponible para crear modelos de controladores");
            return;
        }
        
        try {
            // Modelo simple para controlador izquierdo
            const geometryLeft = new THREE.CylinderGeometry(0.05, 0.07, 0.15, 8);
            const materialLeft = new THREE.MeshPhongMaterial({ color: 0x0000ff });
            const controllerModelLeft = new THREE.Mesh(geometryLeft, materialLeft);
            controllerModelLeft.rotation.x = Math.PI / 2;
            
            // Modelo simple para controlador derecho
            const geometryRight = new THREE.CylinderGeometry(0.05, 0.07, 0.15, 8);
            const materialRight = new THREE.MeshPhongMaterial({ color: 0xff0000 });
            const controllerModelRight = new THREE.Mesh(geometryRight, materialRight);
            controllerModelRight.rotation.x = Math.PI / 2;
            
            // Crear grupos para los grips
            const gripLeft = new THREE.Group();
            gripLeft.add(controllerModelLeft);
            gripLeft.userData.controllerIndex = 0;
            
            const gripRight = new THREE.Group();
            gripRight.add(controllerModelRight);
            gripRight.userData.controllerIndex = 1;
            
            // Añadir a la escena
            if (this.game && this.game.scene) {
                this.game.scene.add(gripLeft);
                this.game.scene.add(gripRight);
            }
            
            this.controllerGrips = [gripLeft, gripRight];
            
            console.log("🎮 Modelos de controladores VR creados");
        } catch (error) {
            console.error("❌ Error al crear modelos de controladores:", error);
        }
    }
    
    onControllerConnected(event, index) {
        console.log(`✅ Controlador ${index} conectado:`, event.data);
        
        // Actualizar modelo según el tipo de controlador
        if (this.controllerGrips[index]) {
            const controllerType = event.data.targetRayMode || 'unknown';
            console.log(`🎮 Controlador ${index} es de tipo: ${controllerType}`);
        }
    }
    
    onControllerDisconnected(index) {
        console.log(`📴 Controlador ${index} desconectado`);
    }
    
    onSelectStart(index) {
        console.log(`🎮 Controlador ${index}: Botón select presionado`);
        
        // Vibración háptica
        this.vibrateController(index, 0.5, 100);
        
        // Lógica de interacción con menús VR
        if (this.game && this.game.vrMenuSystem && this.game.vrMenuSystem.isActive) {
            this.handleVRMenuInteraction(index);
        }
    }
    
    onSelectEnd(index) {
        console.log(`🎮 Controlador ${index}: Botón select liberado`);
    }
    
    handleVRMenuInteraction(controllerIndex) {
        if (!this.game || !this.game.vrMenuSystem.isActive) return;
        
        const controller = this.controllers[controllerIndex];
        if (!controller) return;
        
        // Obtener dirección del rayo
        const direction = new THREE.Vector3(0, 0, -1);
        controller.localToWorld(direction);
        direction.sub(controller.position).normalize();
        
        this.raycaster.set(controller.position, direction);
        
        // Verificar colisión con elementos del menú VR
        const intersects = this.raycaster.intersectObjects(
            this.game.cssScene ? this.game.cssScene.children : [],
            true
        );
        
        if (intersects.length > 0) {
            const intersect = intersects[0];
            const button = this.findButtonFromIntersection(intersect.object);
            
            if (button) {
                console.log(`🎮 Botón VR seleccionado: ${button.id || button.className}`);
                this.simulateButtonClick(button);
                this.vibrateController(controllerIndex, 0.8, 200);
            }
        }
    }
    
    findButtonFromIntersection(object) {
        // Buscar hacia arriba en la jerarquía hasta encontrar un elemento botón
        let current = object;
        while (current) {
            if (current.element && 
                (current.element.tagName === 'BUTTON' || 
                 current.element.classList.contains('vr-menu-btn'))) {
                return current.element;
            }
            current = current.parent;
        }
        return null;
    }
    
    simulateButtonClick(buttonElement) {
        if (!buttonElement) return;
        
        // Simular clic
        buttonElement.click();
        
        // Efecto visual
        buttonElement.style.transform = 'scale(0.95)';
        setTimeout(() => {
            buttonElement.style.transform = '';
        }, 150);
    }
    
    update(deltaTime) {
        if (!this.renderer.xr.isPresenting) return;
        
        // Actualizar posición de los grips
        for (let i = 0; i < this.controllerGrips.length; i++) {
            if (this.controllerGrips[i] && this.controllers[i]) {
                const controller = this.controllers[i];
                const grip = this.controllerGrips[i];
                
                // Actualizar posición y rotación
                grip.position.copy(controller.position);
                grip.rotation.copy(controller.rotation);
                
                // Actualizar rayo de selección visual
                this.updateSelectionRay(i);
            }
        }
        
        // Verificar botones continuamente
        this.checkControllerButtons();
        
        // Actualizar interacción con menús VR
        if (this.game && this.game.vrMenuSystem && this.game.vrMenuSystem.isActive) {
            this.updateVRMenuInteraction();
        }
    }
    
    updateSelectionRay(controllerIndex) {
        // Podrías añadir aquí un rayo visual si lo deseas
    }
    
    updateVRMenuInteraction() {
        // Actualizar hover sobre botones del menú VR
        for (let i = 0; i < this.controllers.length; i++) {
            if (!this.controllers[i]) continue;
            
            const controller = this.controllers[i];
            const direction = new THREE.Vector3(0, 0, -1);
            controller.localToWorld(direction);
            direction.sub(controller.position).normalize();
            
            this.raycaster.set(controller.position, direction);
            
            const intersects = this.raycaster.intersectObjects(
                this.game.cssScene ? this.game.cssScene.children : [],
                true
            );
            
            if (intersects.length > 0) {
                const intersect = intersects[0];
                const button = this.findButtonFromIntersection(intersect.object);
                
                if (button && button !== this.hoveredObject) {
                    // Nuevo hover
                    if (this.hoveredObject) {
                        this.hoveredObject.style.filter = 'none';
                    }
                    
                    this.hoveredObject = button;
                    button.style.filter = 'brightness(1.3)';
                    
                    // Vibración sutil
                    this.vibrateController(i, 0.3, 50);
                }
            } else if (this.hoveredObject) {
                // Salir del hover
                this.hoveredObject.style.filter = 'none';
                this.hoveredObject = null;
            }
        }
    }
    
    checkControllerButtons() {
        // Esta función verificaría el estado de botones específicos
        // En un sistema real usarías gamepad API
        
        // Simulación para demostración
        if (this.game && this.game.renderer.xr.isPresenting) {
            // Detectar botón A/X para pausa
            if (this.isButtonPressed('A')) {
                if (!this.buttonStates.A.lastPressed) {
                    console.log("🎮 Botón A/X presionado - Alternar pausa");
                    this.game.toggleVRPauseMenu();
                    this.buttonStates.A.lastPressed = true;
                    this.vibrateController(0, 0.7, 150);
                }
            } else {
                this.buttonStates.A.lastPressed = false;
            }
            
            // Detectar botón B/Y para salir
            if (this.isButtonPressed('B')) {
                if (!this.buttonStates.B.lastPressed) {
                    console.log("🎮 Botón B/Y presionado");
                    // Lógica para salir o menú
                    this.buttonStates.B.lastPressed = true;
                }
            } else {
                this.buttonStates.B.lastPressed = false;
            }
            
            // Detectar botón Grip para menú rápido
            if (this.isButtonPressed('Grip')) {
                if (!this.buttonStates.Grip.lastPressed) {
                    console.log("🎮 Botón Grip presionado - Menú rápido");
                    this.buttonStates.Grip.lastPressed = true;
                }
            } else {
                this.buttonStates.Grip.lastPressed = false;
            }
        }
    }
    
    isButtonPressed(buttonName) {
        // En una implementación real, esto leería del gamepad
        // Por ahora es simulado
        return false;
    }
    
    vibrateController(controllerIndex, intensity, duration) {
        if (!this.hapticEnabled || !this.renderer.xr.isPresenting) return;
        
        const controller = this.controllers[controllerIndex];
        if (controller && controller.inputSource && controller.inputSource.hapticActuators) {
            const actuator = controller.inputSource.hapticActuators[0];
            if (actuator) {
                actuator.pulse(intensity, duration);
            }
        }
    }
    
    // Métodos estáticos de utilidad
    static detectVRCapabilities() {
        const capabilities = {
            hasVR: false,
            hasAR: false,
            hasHandTracking: false,
            controllerTypes: []
        };
        
        if (navigator.xr) {
            navigator.xr.isSessionSupported('immersive-vr').then(supported => {
                capabilities.hasVR = supported;
            });
            
            navigator.xr.isSessionSupported('immersive-ar').then(supported => {
                capabilities.hasAR = supported;
            });
        }
        
        return capabilities;
    }
    
    static getControllerType(controller) {
        if (!controller || !controller.inputSource) return 'unknown';
        
        const profile = controller.inputSource.profiles[0] || 'unknown';
        return profile.includes('oculus') ? 'oculus-touch' : 
               profile.includes('valve') ? 'index-controller' : 
               profile.includes('windows-mixed-reality') ? 'wmr' : 
               'generic';
    }
    
    // Configuración
    setControllerModelsVisible(visible) {
        this.controllerModelsVisible = visible;
        if (this.controllerGrips.length > 0) {
            this.controllerGrips.forEach(grip => {
                grip.visible = visible;
            });
        } else if (visible) {
            // Crear modelos si no existen
            this.createControllerModels();
        }
    }
    
    setHapticEnabled(enabled) {
        this.hapticEnabled = enabled;
    }
    
    cleanup() {
        // Limpiar event listeners
        this.controllers.forEach(controller => {
            if (controller) {
                controller.removeEventListener('selectstart', () => {});
                controller.removeEventListener('selectend', () => {});
                controller.removeEventListener('connected', () => {});
                controller.removeEventListener('disconnected', () => {});
            }
        });
        
        console.log("🧹 VRInputHandler limpiado");
    }
}