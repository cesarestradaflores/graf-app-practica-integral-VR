// -----------------------------------------------------------------
// --- VRMenuSystem.js (SISTEMA DE MENÚS VR CON CANVAS WORLD SPACE)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

export class VRMenuSystem {
    constructor(scene, camera, renderer, gameInstance) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.game = gameInstance;
        
        // Estado
        this.isMenuActive = false;
        this.menuType = null; // 'gameover' o 'pause'
        this.menuDistance = 2.0; // Distancia del menú a la cámara
        
        // Renderizador CSS3D para UI
        this.cssRenderer = null;
        this.cssScene = null;
        
        // Elementos del menú
        this.menuContainer = null;
        this.menuElement = null;
        
        // Controles VR
        this.controllers = [];
        this.lastButtonState = { A: false, B: false, X: false, Y: false };
        
        this.init();
    }
    
    init() {
        console.log("🎮 Inicializando sistema de menús VR...");
        
        // 1. Configurar renderizador CSS3D
        this.setupCSS3DRenderer();
        
        // 2. Crear contenedor del menú
        this.createMenuContainer();
        
        // 3. Configurar controles VR
        this.setupVRControls();
        
        // 4. Agregar al loop de renderizado
        this.addToRenderLoop();
        
        console.log("✅ Sistema de menús VR inicializado");
    }
    
    setupCSS3DRenderer() {
        this.cssRenderer = new CSS3DRenderer();
        this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
        this.cssRenderer.domElement.style.position = 'absolute';
        this.cssRenderer.domElement.style.top = '0';
        this.cssRenderer.domElement.style.pointerEvents = 'none'; // Importante
        document.body.appendChild(this.cssRenderer.domElement);
        
        this.cssScene = new THREE.Scene();
        
        console.log("✅ Renderizador CSS3D configurado");
    }
    
    createMenuContainer() {
        // Contenedor HTML para el menú
        this.menuContainer = document.createElement('div');
        this.menuContainer.id = 'vr-menu-container';
        this.menuContainer.style.cssText = `
            position: absolute;
            width: 400px;
            background: rgba(20, 20, 30, 0.95);
            border: 3px solid #00FF41;
            border-radius: 15px;
            padding: 30px;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
            box-shadow: 0 0 50px rgba(0, 255, 65, 0.5);
            backdrop-filter: blur(10px);
            display: none;
            pointer-events: auto; /* Habilitar interacción */
            z-index: 1000;
            transform-style: preserve-3d;
        `;
        
        // Crear contenido del menú
        this.menuContainer.innerHTML = `
            <div id="vr-menu-title" style="font-size: 2.5rem; color: #00FF41; margin-bottom: 20px; text-shadow: 0 0 10px #00FF41;"></div>
            <div id="vr-menu-content" style="margin: 30px 0;"></div>
            <div id="vr-menu-buttons" style="display: flex; flex-direction: column; gap: 15px;"></div>
        `;
        
        document.body.appendChild(this.menuContainer);
        
        // Crear objeto CSS3D para posicionar en 3D
        this.menuElement = new CSS3DObject(this.menuContainer);
        this.menuElement.scale.set(0.002, 0.002, 0.002); // Escala adecuada para VR
        this.cssScene.add(this.menuElement);
        
        console.log("✅ Contenedor de menú VR creado");
    }
    
    setupVRControls() {
        if (!this.renderer.xr.enabled) return;
        
        for (let i = 0; i < 2; i++) {
            const controller = this.renderer.xr.getController(i);
            
            // Agregar rayo para interacción
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -1)
            ]);
            
            const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ 
                color: i === 0 ? 0xff4444 : 0x4444ff,
                opacity: 0.5,
                transparent: true
            }));
            line.scale.z = 5;
            controller.add(line);
            
            // Escuchar eventos de botones
            controller.addEventListener('selectstart', (event) => this.onControllerSelect(event, i));
            controller.addEventListener('squeezestart', (event) => this.onControllerSqueeze(event, i));
            
            this.controllers.push(controller);
            this.scene.add(controller);
        }
        
        console.log("✅ Controles VR configurados para menús");
    }
    
    onControllerSelect(event, controllerIndex) {
        if (!this.isMenuActive) return;
        
        // Lanzar rayo para detectar clics en botones del menú
        const controller = this.controllers[controllerIndex];
        const raycaster = new THREE.Raycaster();
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(controller.quaternion);
        
        raycaster.set(controller.position, direction);
        
        // Verificar colisión con el menú
        const intersects = raycaster.intersectObject(this.menuElement, true);
        
        if (intersects.length > 0) {
            console.log("🎯 Click en menú VR detectado");
            // Aquí puedes implementar lógica específica de botones
        }
    }
    
    onControllerSqueeze(event, controllerIndex) {
        // Botón de pausa (ejemplo: grip button)
        if (!this.isMenuActive && this.game.isGameStarted && !this.game.isGameOver) {
            this.showPauseMenu();
        }
    }
    
    addToRenderLoop() {
        // Integrar con el render loop principal
        const originalRender = this.renderer.render;
        const self = this;
        
        this.renderer.render = function(scene, camera) {
            // Renderizar escena 3D normal
            originalRender.call(this, scene, camera);
            
            // Renderizar menú CSS3D si está activo
            if (self.isMenuActive) {
                self.cssRenderer.render(self.cssScene, camera);
            }
        };
    }
    
    showGameOverMenu() {
        console.log("🔄 Mostrando menú de Game Over en VR");
        
        this.menuType = 'gameover';
        this.isMenuActive = true;
        
        // Configurar contenido
        document.getElementById('vr-menu-title').textContent = '¡GAME OVER!';
        document.getElementById('vr-menu-title').style.color = '#FF4444';
        
        const content = `
            <div style="margin-bottom: 20px; font-size: 1.2rem;">
                Has sido atrapado por los zombies
            </div>
            <div style="background: rgba(255, 68, 68, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #FF4444;">
                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                    <span>Puntuación:</span>
                    <span style="color: #FF4444; font-weight: bold;">${this.game.score}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                    <span>Distancia:</span>
                    <span style="color: #FF4444; font-weight: bold;">${Math.floor(this.game.distance)}m</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                    <span>Tiempo:</span>
                    <span style="color: #FF4444; font-weight: bold;">${Math.floor(this.game.distance / this.game.gameSpeed)}s</span>
                </div>
            </div>
        `;
        
        document.getElementById('vr-menu-content').innerHTML = content;
        
        // Crear botones
        const buttonsHTML = `
            <button id="vr-restart-btn" class="vr-menu-btn" style="background: linear-gradient(135deg, #FF4444 0%, #CC0000 100%);">
                REINICIAR NIVEL
            </button>
            <button id="vr-mainmenu-btn" class="vr-menu-btn" style="background: linear-gradient(135deg, #666666 0%, #333333 100%);">
                MENÚ PRINCIPAL
            </button>
        `;
        
        document.getElementById('vr-menu-buttons').innerHTML = buttonsHTML;
        
        // Mostrar menú
        this.menuContainer.style.display = 'block';
        this.positionMenuInFrontOfCamera();
        
        // Agregar event listeners a los botones
        setTimeout(() => {
            document.getElementById('vr-restart-btn').addEventListener('click', () => this.onRestartClick());
            document.getElementById('vr-mainmenu-btn').addEventListener('click', () => this.onMainMenuClick());
        }, 100);
        
        // Pausar el juego
        this.pauseGame();
    }
    
    showPauseMenu() {
        console.log("⏸️ Mostrando menú de pausa en VR");
        
        this.menuType = 'pause';
        this.isMenuActive = true;
        
        // Configurar contenido
        document.getElementById('vr-menu-title').textContent = 'JUEGO EN PAUSA';
        document.getElementById('vr-menu-title').style.color = '#00FF41';
        
        const content = `
            <div style="margin-bottom: 20px; font-size: 1.2rem;">
                El juego está pausado
            </div>
            <div style="background: rgba(0, 255, 65, 0.1); padding: 15px; border-radius: 10px; border-left: 4px solid #00FF41;">
                <div style="margin: 10px 0; font-size: 1.1rem;">
                    Usa el rayo del controlador para interactuar
                </div>
            </div>
        `;
        
        document.getElementById('vr-menu-content').innerHTML = content;
        
        // Crear botones
        const buttonsHTML = `
            <button id="vr-resume-btn" class="vr-menu-btn" style="background: linear-gradient(135deg, #00FF41 0%, #008800 100%);">
                REANUDAR JUEGO
            </button>
            <button id="vr-restart-pause-btn" class="vr-menu-btn" style="background: linear-gradient(135deg, #FFA500 0%, #CC8400 100%);">
                REINICIAR NIVEL
            </button>
            <button id="vr-mainmenu-pause-btn" class="vr-menu-btn" style="background: linear-gradient(135deg, #666666 0%, #333333 100%);">
                MENÚ PRINCIPAL
            </button>
        `;
        
        document.getElementById('vr-menu-buttons').innerHTML = buttonsHTML;
        
        // Mostrar menú
        this.menuContainer.style.display = 'block';
        this.positionMenuInFrontOfCamera();
        
        // Agregar event listeners
        setTimeout(() => {
            document.getElementById('vr-resume-btn').addEventListener('click', () => this.onResumeClick());
            document.getElementById('vr-restart-pause-btn').addEventListener('click', () => this.onRestartClick());
            document.getElementById('vr-mainmenu-pause-btn').addEventListener('click', () => this.onMainMenuClick());
        }, 100);
        
        // Pausar el juego
        this.pauseGame();
    }
    
    positionMenuInFrontOfCamera() {
        if (!this.camera || !this.menuElement) return;
        
        // Obtener posición y dirección de la cámara
        const cameraWorldPosition = new THREE.Vector3();
        const cameraWorldDirection = new THREE.Vector3();
        
        this.camera.getWorldPosition(cameraWorldPosition);
        this.camera.getWorldDirection(cameraWorldDirection);
        
        // Posicionar menú frente a la cámara
        const menuPosition = cameraWorldPosition.clone()
            .add(cameraWorldDirection.multiplyScalar(this.menuDistance));
        
        this.menuElement.position.copy(menuPosition);
        
        // Hacer que el menú mire hacia la cámara
        this.menuElement.lookAt(cameraWorldPosition);
        
        // Rotar 180 grados para que el texto sea legible
        this.menuElement.rotateY(Math.PI);
    }
    
    update() {
        if (this.isMenuActive) {
            // Actualizar posición del menú para que siga a la cámara
            this.positionMenuInFrontOfCamera();
            
            // Verificar botones del controlador
            this.checkControllerButtons();
        }
    }
    
    checkControllerButtons() {
        if (!this.renderer.xr.enabled || !this.renderer.xr.getSession()) return;
        
        // Aquí implementarías la lógica para OVRInput o Input System
        // Por ahora usamos eventos ya configurados
        
        // Para WebXR, puedes verificar gamepads
        const session = this.renderer.xr.getSession();
        if (session && session.inputSources) {
            session.inputSources.forEach((inputSource, index) => {
                if (inputSource.gamepad) {
                    const gamepad = inputSource.gamepad;
                    
                    // Botón A (índice 0 en muchos controladores)
                    if (gamepad.buttons[0] && gamepad.buttons[0].pressed && !this.lastButtonState.A) {
                        console.log("🎮 Botón A presionado en VR");
                        if (!this.isMenuActive && this.game.isGameStarted && !this.game.isGameOver) {
                            this.showPauseMenu();
                        }
                    }
                    this.lastButtonState.A = gamepad.buttons[0]?.pressed || false;
                    
                    // Botón B (índice 1)
                    if (gamepad.buttons[1] && gamepad.buttons[1].pressed && !this.lastButtonState.B) {
                        console.log("🎮 Botón B presionado en VR");
                        if (this.isMenuActive) {
                            this.hideMenu();
                        }
                    }
                    this.lastButtonState.B = gamepad.buttons[1]?.pressed || false;
                }
            });
        }
    }
    
    pauseGame() {
        console.log("⏸️ Pausando juego desde menú VR");
        
        // Pausar lógica del juego
        if (this.game) {
            this.game.isPaused = true;
            this.game.clock.stop();
            
            // Pausar música
            if (this.game.backgroundMusic && this.game.isMusicPlaying) {
                this.game.backgroundMusic.pause();
            }
        }
        
        // También pausar animaciones Three.js
        this.scene.traverse((object) => {
            if (object.mixer) {
                object.mixer.timeScale = 0;
            }
        });
    }
    
    resumeGame() {
        console.log("▶️ Reanudando juego desde menú VR");
        
        // Reanudar lógica del juego
        if (this.game) {
            this.game.isPaused = false;
            this.game.clock.start();
            
            // Reanudar música
            if (this.game.backgroundMusic && !this.game.isMusicPlaying) {
                this.game.backgroundMusic.play();
                this.game.isMusicPlaying = true;
            }
        }
        
        // Reanudar animaciones Three.js
        this.scene.traverse((object) => {
            if (object.mixer) {
                object.mixer.timeScale = 1;
            }
        });
    }
    
    onRestartClick() {
        console.log("🔄 Reiniciando nivel desde menú VR");
        this.hideMenu();
        
        if (this.game && this.game.restartGame) {
            this.resumeGame();
            this.game.restartGame();
        }
    }
    
    onResumeClick() {
        console.log("▶️ Reanudando desde menú VR");
        this.hideMenu();
        this.resumeGame();
    }
    
    onMainMenuClick() {
        console.log("🏠 Volviendo al menú principal desde VR");
        this.hideMenu();
        
        if (this.game && this.game.resetToMainMenu) {
            this.resumeGame();
            this.game.resetToMainMenu();
        }
    }
    
    hideMenu() {
        console.log("👻 Ocultando menú VR");
        this.isMenuActive = false;
        this.menuType = null;
        
        if (this.menuContainer) {
            this.menuContainer.style.display = 'none';
        }
    }
    
    handleCollision() {
        console.log("💥 Colisión detectada - Mostrando menú VR");
        if (!this.isMenuActive) {
            this.showGameOverMenu();
        }
    }
    
    resize() {
        if (this.cssRenderer) {
            this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    dispose() {
        // Limpiar recursos
        if (this.menuContainer && this.menuContainer.parentNode) {
            this.menuContainer.parentNode.removeChild(this.menuContainer);
        }
        
        if (this.cssRenderer && this.cssRenderer.domElement.parentNode) {
            this.cssRenderer.domElement.parentNode.removeChild(this.cssRenderer.domElement);
        }
        
        console.log("🧹 Sistema de menús VR limpiado");
    }
}