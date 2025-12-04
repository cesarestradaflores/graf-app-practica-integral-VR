// -----------------------------------------------------------------
// --- Game.js (VR PRIMERA PERSONA - VERSIÓN META QUEST 3 COMPLETA)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

import { Config } from './Config.js';
import { Player } from './Player.js';
import { GameWorld } from './GameWorld.js';
import { ObstacleManager } from './ObstacleManager.js';
import { VRControls } from './VRControls.js';
import { VRInputHandler } from './VRInputHandler.js';

export class Game {
    constructor() {
        // ===== SISTEMA THREE.JS =====
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            Config.CAMERA_FOV,
            Config.CAMERA_ASPECT,
            Config.CAMERA_NEAR,
            Config.CAMERA_FAR
        );
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.clock = new THREE.Clock();
        
        // ===== SISTEMA CSS3D PARA MENÚS VR =====
        this.cssRenderer = null;
        this.cssScene = null;
        this.css3DAvailable = false; // Flag para verificar disponibilidad
        
        // ===== COMPONENTES DEL JUEGO =====
        this.player = null;
        this.world = null;
        this.obstacleManager = null;
        this.assets = {};

        // ===== SISTEMA VR =====
        this.isVRMode = false;
        this.vrControls = null;
        this.vrInputHandler = null;
        this.cameraContainer = new THREE.Group();

        // ===== SISTEMA DE MENÚS VR =====
        this.vrMenuSystem = {
            isActive: false,
            type: null, // 'gameover' o 'pause'
            menuElement: null,
            menuContainer: null,
            menuDistance: Config.VR_MENU_SETTINGS.MENU_DISTANCE,
            controllers: []
        };

        // ===== SISTEMA DE AUDIO =====
        this.audioListener = null;
        this.backgroundMusic = null;
        this.coinSound = null;
        this.powerUpSound = null;
        this.isMusicPlaying = false;

        // ===== ESTADO DEL JUEGO =====
        this.isGameStarted = false;
        this.isGameOver = false;
        this.isPaused = false;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.score = 0;
        this.distance = 0;
        this.difficultyLevel = 1;
        this.survivalTime = 0;

        // ===== POWER-UPS =====
        this.activePowerUps = {
            magnet: { active: false, timer: 0 },
            double: { active: false, timer: 0 }
        };

        // ===== INTERFAZ DE USUARIO =====
        this.ui = {
            score: document.getElementById('score'),
            distance: document.getElementById('distance'),
            gameOver: document.getElementById('game-over'),
            loadingScreen: document.getElementById('loading-screen'),
            loadingBar: document.getElementById('loading-bar'),
            loadingText: document.getElementById('loading-text'),
            errorScreen: document.getElementById('error-screen'),
            uiContainer: document.getElementById('ui-container'),
            modalOverlay: document.getElementById('modal-overlay'),
            rulesModal: document.getElementById('rules-modal'),
            pauseButton: document.getElementById('pause-button'),
            pauseMenu: document.getElementById('pause-menu')
        };

        // ===== INDICADORES DE POWER-UPS =====
        this.powerUpIndicators = {
            magnet: document.createElement('div'),
            double: document.createElement('div')
        };

        // ===== CONFIGURACIÓN DE RENDIMIENTO =====
        this.frameCount = 0;
        this.collisionDebugEnabled = Config.DEBUG_SETTINGS.SHOW_COLLISION_DEBUG;
        this.debugStatsTimer = 0;
        this.lastFrameTime = 0;
        
        // ===== CONTROLES VR =====
        this.lastButtonState = { A: false, B: false, X: false, Y: false };
        this.buttonCheckInterval = null;

        // ===== INICIALIZACIÓN =====
        this.setupPowerUpUI();
        Config.logConfig(); // Mostrar configuración en consola
        
        console.log("🎮 Game.js inicializado - Sistema VR Completo");
    }

    async init() {
        console.log("🎮 Iniciando el juego con sistema VR completo...");

        // Configurar renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        document.body.appendChild(this.renderer.domElement);

        // Configurar WebXR/VR para Meta Quest
        this.setupWebXR();

        // Configurar cámara
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        // Configurar contenedor de cámara VR
        this.setupCameraContainer();

        // Configurar audio
        this.setupAudio();

        // Configurar niebla y ambiente
        this.scene.fog = new THREE.Fog(Config.FOG_COLOR, Config.FOG_NEAR, Config.FOG_FAR);
        
        // Posición inicial de cámara VR
        this.cameraContainer.position.set(0, Config.VR_SETTINGS.PLAYER_HEIGHT, 0);
        this.camera.position.set(0, 0, 0);

        try {
            // Cargar assets
            this.assets = await this.preloadAssets();
            this.ui.loadingScreen.style.display = 'none';
            console.log("✅ Assets cargados correctamente");
            
        } catch (error) {
            console.error("❌ Error al cargar assets:", error);
            this.ui.loadingScreen.style.display = 'none';
            this.ui.errorScreen.style.display = 'flex';
            return Promise.reject(error);
        }
        
        // Inicializar componentes del juego
        this.world = new GameWorld(this.scene, this.assets);
        this.player = new Player(this.scene, this.assets);
        this.player.game = this; // Conectar referencia al juego
        this.obstacleManager = new ObstacleManager(this.scene, this.assets);

        // Configurar controles VR Meta Quest 3
        this.setupVRControls();
        
        // Configurar sistema de input VR
        this.setupVRInputHandler();
        
        // Configurar sistema de menús VR
        this.setupVRMenuSystem();

        // Configurar iluminación
        this.setupLights();
        
        // Cargar ambiente HDR
        this.loadEnvironment('Recursos/sunset_jhbcentral_4k.hdr'); 

        // Event listeners
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        document.addEventListener('keydown', this.player.onKeyDown.bind(this.player), false);

        // AJUSTAR PARA META QUEST 3 - DESPUÉS DE Config.logConfig()
        Config.adjustForMetaQuest();

        console.log("✅ Juego completamente inicializado - Sistema VR con Menús listo");
        
        return Promise.resolve();
    }

    setupWebXR() {
        this.renderer.xr.enabled = true;
        
        // Crear botón VR con estilo personalizado
        const vrButton = VRButton.createButton(this.renderer);
        vrButton.style.cssText = `
            position: absolute;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            background: linear-gradient(135deg, rgba(0, 255, 65, 0.3) 0%, rgba(0, 136, 0, 0.3) 100%);
            border: 2px solid #00FF41;
            border-radius: 8px;
            color: white;
            font-size: 1rem;
            font-weight: bold;
            cursor: pointer;
            z-index: 100;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        `;
        
        vrButton.addEventListener('mouseenter', () => {
            vrButton.style.background = 'linear-gradient(135deg, rgba(0, 255, 65, 0.5) 0%, rgba(0, 136, 0, 0.5) 100%)';
        });
        
        vrButton.addEventListener('mouseleave', () => {
            vrButton.style.background = 'linear-gradient(135deg, rgba(0, 255, 65, 0.3) 0%, rgba(0, 136, 0, 0.3) 100%)';
        });
        
        document.body.appendChild(vrButton);
        
        // Eventos de sesión VR
        this.renderer.xr.addEventListener('sessionstart', () => {
            console.log('🚀 Sesión VR iniciada - Meta Quest 3 detectado');
            this.onVRStart();
        });
        
        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('📴 Sesión VR finalizada');
            this.onVREnd();
        });
        
        // Verificar capacidades VR
        const capabilities = VRInputHandler.detectVRCapabilities();
        console.log("🔍 Capacidades VR detectadas:", capabilities);
        
        console.log("✅ WebXR configurado para Meta Quest 3");
    }

    setupVRInputHandler() {
        // Inicializar el sistema de input VR
        this.vrInputHandler = new VRInputHandler(this.renderer, this);
        console.log("✅ VR Input Handler configurado para Meta Quest 3");
    }

    setupVRControls() {
        if (this.renderer.xr.enabled && this.player) {
            this.vrControls = new VRControls(this.camera, this.renderer, this.player, this.scene, this.cameraContainer);
            console.log("✅ Controles VR Meta Quest 3 configurados");
        }
    }

    onVRStart() {
        this.isVRMode = true;
        this.player.enableVRMode();
        
        // Ocultar modelo del jugador en VR
        if (this.player.group) {
            this.player.group.visible = false;
        }
        
        // Posicionar cámara VR
        this.cameraContainer.position.set(
            this.player.group.position.x,
            Config.VR_SETTINGS.PLAYER_HEIGHT,
            this.player.group.position.z
        );
        
        // Forzamos rotación a 0 para que mire al frente
        this.cameraContainer.rotation.set(0, 0, 0);
        // Notificar a la UI
        window.dispatchEvent(new CustomEvent('game-vr-start'));
        
        this.showVRInstructions();
        console.log("🎮 Modo VR activado - Rotación corregida 180°");
    }

    onVREnd() {
        this.isVRMode = false;
        this.player.disableVRMode();
        
        // Mostrar modelo del jugador nuevamente
        if (this.player.group) {
            this.player.group.visible = true;
        }
        
        // Si hay menú VR activo, ocultarlo
        if (this.vrMenuSystem.isActive) {
            this.hideVRMenu();
            this.resumeGameFromVRMenu();
        }
        
        // Restaurar posición de cámara en modo normal
        this.cameraContainer.position.set(0, Config.CAMERA_START_Y, Config.CAMERA_START_Z);
        this.cameraContainer.lookAt(0, 0, 0);
        
        // Notificar a la UI
        window.dispatchEvent(new CustomEvent('game-vr-end'));
        
        console.log("🖥️ Modo VR desactivado - Volviendo a tercera persona");
    }

    showVRInstructions() {
        // Detectar si es Meta Quest
        const userAgent = navigator.userAgent.toLowerCase();
        const isMetaQuest = userAgent.includes('quest') || userAgent.includes('oculus');
        
        let instructions = '';
        
        if (isMetaQuest) {
            instructions = `
                <div style="margin-bottom: 15px;">🎮 CONTROLES META QUEST 3</div>
                <div style="font-size: 1.2rem; margin-bottom: 10px;">Trigger L: Saltar • Trigger R: Rodar</div>
                <div style="font-size: 1.2rem; margin-bottom: 10px;">Botón Grip: Pausa rápida</div>
                <div style="font-size: 1.2rem; margin-bottom: 10px;">Botón A/X: Menú principal</div>
                <div style="font-size: 1.2rem;">Girar cabeza y mantener: Cambiar carril</div>
            `;
        } else {
            instructions = `
                <div style="margin-bottom: 15px;">🎮 CONTROLES VR</div>
                <div style="font-size: 1.2rem; margin-bottom: 10px;">Botón A/X: Pausa</div>
                <div style="font-size: 1.2rem; margin-bottom: 10px;">Botón Grip: Menú rápido</div>
                <div style="font-size: 1.2rem;">Mirar a los lados: Cambiar carril</div>
            `;
        }
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: #00FF41;
            padding: 30px 50px;
            border-radius: 15px;
            font-size: 1.5rem;
            font-weight: bold;
            z-index: 2000;
            text-align: center;
            border: 3px solid #00FF41;
            box-shadow: 0 0 40px rgba(0, 255, 65, 0.5);
            backdrop-filter: blur(10px);
            animation: fadeInOut 5s ease-in-out;
        `;
        
        notification.innerHTML = instructions;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeInOut {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
                20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        }, 5000);
    }

    setupVRMenuSystem() {
        console.log("🔄 Configurando sistema de menús VR para Meta Quest...");
        
        // 1. Configurar renderizador CSS3D
        this.setupCSS3DRenderer();
        
        // 2. Crear contenedor del menú VR
        this.createVRMenuContainer();
        
        console.log("✅ Sistema de menús VR configurado para Meta Quest");
    }

    setupCSS3DRenderer() {
        try {
            if (typeof CSS3DRenderer === 'undefined' || typeof CSS3DObject === 'undefined') {
                console.warn("⚠️ CSS3DRenderer no disponible, usando fallback 2D");
                this.css3DAvailable = false;
                return;
            }
            
            this.cssRenderer = new CSS3DRenderer();
            this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
            this.cssRenderer.domElement.style.position = 'absolute';
            this.cssRenderer.domElement.style.top = '0';
            this.cssRenderer.domElement.style.pointerEvents = 'none';
            this.cssRenderer.domElement.style.zIndex = '999';
            document.body.appendChild(this.cssRenderer.domElement);
            
            this.cssScene = new THREE.Scene();
            this.css3DAvailable = true;
            
            console.log("✅ Renderizador CSS3D configurado correctamente");
        } catch (error) {
            console.error("❌ Error al configurar CSS3DRenderer:", error);
            this.css3DAvailable = false;
            this.createFallbackVRMenu();
        }
    }

    createVRMenuContainer() {
        this.vrMenuSystem.menuContainer = document.createElement('div');
        this.vrMenuSystem.menuContainer.id = 'vr-menu-container';
        
        const menuStyle = Config.VR_MENU_SETTINGS;
        this.vrMenuSystem.menuContainer.style.cssText = `
            position: absolute;
            width: ${menuStyle.MENU_WIDTH}px;
            min-height: ${menuStyle.MENU_HEIGHT}px;
            background: ${menuStyle.COLOR_BACKGROUND};
            border: 4px solid ${menuStyle.COLOR_PRIMARY};
            border-radius: 20px;
            padding: 40px;
            color: white;
            font-family: 'Arial', sans-serif;
            text-align: center;
            box-shadow: ${menuStyle.SHADOW_INTENSITY} rgba(0, 255, 65, 0.7);
            backdrop-filter: blur(${menuStyle.BLUR_AMOUNT});
            display: none;
            pointer-events: auto;
            z-index: 1000;
            transform-style: preserve-3d;
            box-sizing: border-box;
            opacity: ${menuStyle.OPACITY};
        `;
        
        this.vrMenuSystem.menuContainer.innerHTML = `
            <div id="vr-menu-title" style="font-size: ${menuStyle.FONT_SIZE_TITLE}; 
                 color: ${menuStyle.COLOR_PRIMARY}; margin-bottom: 30px; 
                 text-shadow: 0 0 15px ${menuStyle.COLOR_PRIMARY}; font-weight: bold;"></div>
            
            <div id="vr-menu-content" style="margin: 40px 0; font-size: ${menuStyle.FONT_SIZE_CONTENT}; 
                 line-height: 1.6;"></div>
            
            <div id="vr-menu-buttons" style="display: flex; flex-direction: column; 
                 gap: 20px; margin-top: 30px;"></div>
            
            <div id="vr-menu-instructions" style="margin-top: 40px; padding-top: 20px; 
                 border-top: 2px solid rgba(255,255,255,0.2); font-size: 1rem; 
                 color: #888; font-style: italic;">
                META QUEST: Usa el Trigger para seleccionar opciones
            </div>
        `;
        
        document.body.appendChild(this.vrMenuSystem.menuContainer);
        
        if (this.css3DAvailable && typeof CSS3DObject !== 'undefined') {
            try {
                this.vrMenuSystem.menuElement = new CSS3DObject(this.vrMenuSystem.menuContainer);
                this.vrMenuSystem.menuElement.scale.set(
                    menuStyle.MENU_SCALE,
                    menuStyle.MENU_SCALE,
                    menuStyle.MENU_SCALE
                );
                this.cssScene.add(this.vrMenuSystem.menuElement);
                console.log("✅ Contenedor de menú VR creado con CSS3DObject");
            } catch (error) {
                console.error("❌ Error al crear CSS3DObject:", error);
                this.css3DAvailable = false;
            }
        } else {
            console.log("⚠️ CSS3DObject no disponible, usando menú 2D overlay");
            this.css3DAvailable = false;
            this.vrMenuSystem.menuContainer.style.position = 'fixed';
            this.vrMenuSystem.menuContainer.style.top = '50%';
            this.vrMenuSystem.menuContainer.style.left = '50%';
            this.vrMenuSystem.menuContainer.style.transform = 'translate(-50%, -50%)';
        }
    }

    createFallbackVRMenu() {
        console.log("🔄 Creando menú VR de fallback (2D overlay)");
        
        this.vrMenuSystem.menuContainer = document.createElement('div');
        this.vrMenuSystem.menuContainer.id = 'vr-menu-fallback';
        
        this.vrMenuSystem.menuContainer.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            min-height: 300px;
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
            pointer-events: auto;
            z-index: 1000;
        `;
        
        this.vrMenuSystem.menuContainer.innerHTML = `
            <div id="vr-fallback-title" style="font-size: 2rem; color: #00FF41; margin-bottom: 20px;"></div>
            <div id="vr-fallback-content" style="margin: 30px 0;"></div>
            <div id="vr-fallback-buttons" style="display: flex; flex-direction: column; gap: 15px;"></div>
        `;
        
        document.body.appendChild(this.vrMenuSystem.menuContainer);
        console.log("✅ Menú VR de fallback creado");
    }

    showVRGameOverMenu() {
        if (this.vrMenuSystem.isActive) return;
        
        console.log("💀 Mostrando menú Game Over en VR");
        
        this.vrMenuSystem.isActive = true;
        this.vrMenuSystem.type = 'gameover';
        
        const menuStyle = Config.VR_MENU_SETTINGS;
        
        // Configurar título
        const titleElement = document.getElementById('vr-menu-title') || document.getElementById('vr-fallback-title');
        if (titleElement) {
            titleElement.textContent = '¡GAME OVER!';
            titleElement.style.color = menuStyle.COLOR_SECONDARY;
            titleElement.style.textShadow = `0 0 20px ${menuStyle.COLOR_SECONDARY}`;
        }
        
        // Configurar contenido
        const contentElement = document.getElementById('vr-menu-content') || document.getElementById('vr-fallback-content');
        if (contentElement) {
            contentElement.innerHTML = `
                <div style="margin-bottom: 30px; font-size: 1.4rem;">
                    Has sido atrapado por los zombies
                </div>
                <div style="background: rgba(255, 68, 68, 0.15); padding: 25px; border-radius: 12px; 
                     border-left: 5px solid ${menuStyle.COLOR_SECONDARY}; border-right: 5px solid ${menuStyle.COLOR_SECONDARY};">
                    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 1.2rem;">
                        <span>Puntuación Final:</span>
                        <span style="color: ${menuStyle.COLOR_SECONDARY}; font-weight: bold; font-size: 1.3rem;">${this.score}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 1.2rem;">
                        <span>Distancia Recorrida:</span>
                        <span style="color: ${menuStyle.COLOR_SECONDARY}; font-weight: bold; font-size: 1.3rem;">${Math.floor(this.distance)}m</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 1.2rem;">
                        <span>Monedas Recolectadas:</span>
                        <span style="color: ${menuStyle.COLOR_SECONDARY}; font-weight: bold; font-size: 1.3rem;">${Math.floor(this.score / 10)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 12px 0; font-size: 1.2rem;">
                        <span>Tiempo de Supervivencia:</span>
                        <span style="color: ${menuStyle.COLOR_SECONDARY}; font-weight: bold; font-size: 1.3rem;">${Math.floor(this.survivalTime)}s</span>
                    </div>
                </div>
            `;
        }
        
        // Configurar botones
        const buttonsElement = document.getElementById('vr-menu-buttons') || document.getElementById('vr-fallback-buttons');
        if (buttonsElement) {
            buttonsElement.innerHTML = `
                <button id="vr-restart-btn" class="vr-menu-btn" 
                        style="background: linear-gradient(135deg, ${menuStyle.COLOR_SECONDARY} 0%, #CC0000 100%); 
                        padding: ${menuStyle.BUTTON_PADDING}; font-size: ${menuStyle.FONT_SIZE_BUTTON};
                        border-radius: ${menuStyle.BUTTON_BORDER_RADIUS}; transition: ${menuStyle.BUTTON_TRANSITION};">
                    🔄 REINICIAR NIVEL
                </button>
                <button id="vr-mainmenu-btn" class="vr-menu-btn" 
                        style="background: linear-gradient(135deg, #666666 0%, #333333 100%); 
                        padding: ${menuStyle.BUTTON_PADDING}; font-size: ${menuStyle.FONT_SIZE_BUTTON};
                        border-radius: ${menuStyle.BUTTON_BORDER_RADIUS}; transition: ${menuStyle.BUTTON_TRANSITION};">
                    🏠 MENÚ PRINCIPAL
                </button>
            `;
        }
        
        // Mostrar menú
        const menuToShow = this.vrMenuSystem.menuContainer || document.getElementById('vr-menu-fallback');
        if (menuToShow) {
            menuToShow.style.display = 'block';
        }
        
        // Posicionar menú si es CSS3D
        if (this.css3DAvailable) {
            this.positionVRMenu();
        }
        
        // Agregar event listeners a botones
        setTimeout(() => {
            const restartBtn = document.getElementById('vr-restart-btn');
            const mainMenuBtn = document.getElementById('vr-mainmenu-btn');
            
            if (restartBtn) {
                restartBtn.addEventListener('click', () => this.onVRRestartClick());
            }
            if (mainMenuBtn) {
                mainMenuBtn.addEventListener('click', () => this.onVRMainMenuClick());
            }
        }, 50);
        
        // Pausar el juego completamente
        this.pauseGameForVRMenu();
        
        console.log("✅ Menú Game Over VR mostrado");
    }

    showVRPauseMenu() {
        if (this.vrMenuSystem.isActive) return;
        
        console.log("⏸️ Mostrando menú de pausa en VR");
        
        this.vrMenuSystem.isActive = true;
        this.vrMenuSystem.type = 'pause';
        
        const menuStyle = Config.VR_MENU_SETTINGS;
        
        // Configurar título
        const titleElement = document.getElementById('vr-menu-title') || document.getElementById('vr-fallback-title');
        if (titleElement) {
            titleElement.textContent = 'JUEGO EN PAUSA';
            titleElement.style.color = menuStyle.COLOR_PRIMARY;
            titleElement.style.textShadow = `0 0 15px ${menuStyle.COLOR_PRIMARY}`;
        }
        
        // Configurar contenido
        const contentElement = document.getElementById('vr-menu-content') || document.getElementById('vr-fallback-content');
        if (contentElement) {
            contentElement.innerHTML = `
                <div style="margin-bottom: 30px; font-size: 1.4rem;">
                    El juego está pausado
                </div>
                <div style="background: rgba(0, 255, 65, 0.15); padding: 25px; border-radius: 12px; 
                     border-left: 5px solid ${menuStyle.COLOR_PRIMARY}; border-right: 5px solid ${menuStyle.COLOR_PRIMARY};">
                    <div style="font-size: 1.2rem; margin-bottom: 15px;">
                        <strong>Estado Actual:</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span>Puntuación:</span>
                        <span style="color: ${menuStyle.COLOR_PRIMARY}; font-weight: bold;">${this.score}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span>Distancia:</span>
                        <span style="color: ${menuStyle.COLOR_PRIMARY}; font-weight: bold;">${Math.floor(this.distance)}m</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span>Velocidad:</span>
                        <span style="color: ${menuStyle.COLOR_PRIMARY}; font-weight: bold;">${this.gameSpeed.toFixed(1)}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin: 10px 0;">
                        <span>Tiempo:</span>
                        <span style="color: ${menuStyle.COLOR_PRIMARY}; font-weight: bold;">${Math.floor(this.survivalTime)}s</span>
                    </div>
                </div>
            `;
        }
        
        // Configurar botones
        const buttonsElement = document.getElementById('vr-menu-buttons') || document.getElementById('vr-fallback-buttons');
        if (buttonsElement) {
            buttonsElement.innerHTML = `
                <button id="vr-resume-btn" class="vr-menu-btn" 
                        style="background: linear-gradient(135deg, ${menuStyle.COLOR_PRIMARY} 0%, #008800 100%); 
                        padding: ${menuStyle.BUTTON_PADDING}; font-size: ${menuStyle.FONT_SIZE_BUTTON};
                        border-radius: ${menuStyle.BUTTON_BORDER_RADIUS}; transition: ${menuStyle.BUTTON_TRANSITION};">
                    ▶️ REANUDAR JUEGO
                </button>
                <button id="vr-restart-pause-btn" class="vr-menu-btn" 
                        style="background: linear-gradient(135deg, ${menuStyle.COLOR_ACCENT} 0%, #CC8400 100%); 
                        padding: ${menuStyle.BUTTON_PADDING}; font-size: ${menuStyle.FONT_SIZE_BUTTON};
                        border-radius: ${menuStyle.BUTTON_BORDER_RADIUS}; transition: ${menuStyle.BUTTON_TRANSITION};">
                    🔄 REINICIAR NIVEL
                </button>
                <button id="vr-mainmenu-pause-btn" class="vr-menu-btn" 
                        style="background: linear-gradient(135deg, #666666 0%, #333333 100%); 
                        padding: ${menuStyle.BUTTON_PADDING}; font-size: ${menuStyle.FONT_SIZE_BUTTON};
                        border-radius: ${menuStyle.BUTTON_BORDER_RADIUS}; transition: ${menuStyle.BUTTON_TRANSITION};">
                    🏠 MENÚ PRINCIPAL
                </button>
            `;
        }
        
        // Mostrar menú
        const menuToShow = this.vrMenuSystem.menuContainer || document.getElementById('vr-menu-fallback');
        if (menuToShow) {
            menuToShow.style.display = 'block';
        }
        
        // Posicionar menú si es CSS3D
        if (this.css3DAvailable) {
            this.positionVRMenu();
        }
        
        // Agregar event listeners
        setTimeout(() => {
            const resumeBtn = document.getElementById('vr-resume-btn');
            const restartBtn = document.getElementById('vr-restart-pause-btn');
            const mainMenuBtn = document.getElementById('vr-mainmenu-pause-btn');
            
            if (resumeBtn) {
                resumeBtn.addEventListener('click', () => this.onVRResumeClick());
            }
            if (restartBtn) {
                restartBtn.addEventListener('click', () => this.onVRRestartClick());
            }
            if (mainMenuBtn) {
                mainMenuBtn.addEventListener('click', () => this.onVRMainMenuClick());
            }
        }, 50);
        
        // Pausar el juego completamente
        this.pauseGameForVRMenu();
        
        console.log("✅ Menú Pausa VR mostrado");
    }

    positionVRMenu() {
        if (!this.camera || !this.vrMenuSystem.menuElement || !this.css3DAvailable) return;
        
        // Obtener posición y dirección de la cámara
        const cameraWorldPosition = new THREE.Vector3();
        const cameraWorldDirection = new THREE.Vector3();
        
        this.camera.getWorldPosition(cameraWorldPosition);
        this.camera.getWorldDirection(cameraWorldDirection);
        
        // Posicionar menú frente a la cámara
        const menuPosition = cameraWorldPosition.clone()
            .add(cameraWorldDirection.multiplyScalar(this.vrMenuSystem.menuDistance));
        
        this.vrMenuSystem.menuElement.position.copy(menuPosition);
        
        // Hacer que el menú mire hacia la cámara
        this.vrMenuSystem.menuElement.lookAt(cameraWorldPosition);
        
        // Rotar para que el texto sea legible
        this.vrMenuSystem.menuElement.rotateY(Math.PI);
        
        // Ajustar altura ligeramente
        this.vrMenuSystem.menuElement.position.y += Config.VR_SETTINGS.CAMERA_OFFSET_Y;
    }

    pauseGameForVRMenu() {
        console.log("⏸️ Pausando juego para menú VR (Time.timeScale = 0)");
        
        this.isPaused = true;
        this.clock.stop();
        
        // Pausar música
        if (this.backgroundMusic && this.isMusicPlaying) {
            this.backgroundMusic.pause();
            
            // --- AGREGA ESTA LÍNEA AQUÍ ---
            this.isMusicPlaying = false; 
            // ------------------------------
        }
        
        // Pausar animaciones Three.js (equivalente a Time.timeScale = 0)
        this.scene.traverse((object) => {
            if (object.mixer) {
                object.mixer.timeScale = 0;
            }
        });
        
        // Pausar actualizaciones del mundo
        if (this.world) {
            this.world.update = function() {}; // Sobrescribir temporalmente
        }
        
        console.log("✅ Juego pausado completamente (Time.timeScale = 0 equivalente)");
    }

    resumeGameFromVRMenu() {
        console.log("▶️ Reanudando juego desde menú VR");
        
        this.isPaused = false;
        this.clock.start();
        
        // Reanudar música
        if (this.backgroundMusic && !this.isMusicPlaying) {
            this.backgroundMusic.play();
            this.isMusicPlaying = true;
        }
        
        // Reanudar animaciones Three.js (Time.timeScale = 1)
        this.scene.traverse((object) => {
            if (object.mixer) {
                object.mixer.timeScale = 1;
            }
        });
        
        // Restaurar actualizaciones del mundo
        if (this.world) {
            this.world.update = GameWorld.prototype.update;
        }
        
        console.log("✅ Juego reanudado (Time.timeScale = 1)");
    }

    onVRRestartClick() {
        console.log("🔄 Reiniciando desde menú VR");
        this.hideVRMenu();
        this.resumeGameFromVRMenu();
        
        // Reiniciar juego
        this.restartGame();
    }

    onVRResumeClick() {
        console.log("▶️ Reanudando desde menú VR");
        this.hideVRMenu();
        this.resumeGameFromVRMenu();
    }

    onVRMainMenuClick() {
        console.log("🏠 Volviendo al menú principal desde VR");
        this.hideVRMenu();
        this.resumeGameFromVRMenu();
        
        // Volver al menú principal
        this.resetToMainMenu();
    }

    hideVRMenu() {
        console.log("👻 Ocultando menú VR");
        
        this.vrMenuSystem.isActive = false;
        this.vrMenuSystem.type = null;
        
        // Ocultar todos los posibles menús
        const menus = [
            this.vrMenuSystem.menuContainer,
            document.getElementById('vr-menu-container'),
            document.getElementById('vr-menu-fallback')
        ];
        
        menus.forEach(menu => {
            if (menu) {
                menu.style.display = 'none';
            }
        });
        
        // Limpiar event listeners de botones
        const buttonIds = ['vr-restart-btn', 'vr-mainmenu-btn', 'vr-resume-btn', 
                          'vr-restart-pause-btn', 'vr-mainmenu-pause-btn'];
        
        buttonIds.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
            }
        });
    }

    toggleVRPauseMenu() {
        if (this.vrMenuSystem.isActive && this.vrMenuSystem.type === 'pause') {
            this.hideVRMenu();
            this.resumeGameFromVRMenu();
        } else if (!this.vrMenuSystem.isActive && this.isGameStarted && !this.isGameOver) {
            this.showVRPauseMenu();
        }
    }

    // ===== CONFIGURACIÓN DEL JUEGO =====

    setupCameraContainer() {
        this.scene.add(this.cameraContainer);
        this.cameraContainer.add(this.camera);
        console.log("✅ Contenedor de cámara VR configurado");
    }

    setupAudio() {
        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);
        
        // Música de fondo
        this.backgroundMusic = new THREE.Audio(this.audioListener);
        const audioLoader = new THREE.AudioLoader();
        
        audioLoader.load('Recursos/Subway Surfers.mp3', (buffer) => {
            this.backgroundMusic.setBuffer(buffer);
            this.backgroundMusic.setLoop(true);
            this.backgroundMusic.setVolume(Config.AUDIO_SETTINGS.MUSIC_VOLUME);
            console.log("✅ Música cargada correctamente");
        }, undefined, (error) => {
            console.error("❌ Error al cargar la música:", error);
        });

        // Sonido de monedas
        this.coinSound = new THREE.Audio(this.audioListener);
        audioLoader.load('Recursos/SonidoMoneda.mp3', (buffer) => {
            this.coinSound.setBuffer(buffer);
            this.coinSound.setVolume(Config.AUDIO_SETTINGS.COIN_VOLUME);
            console.log("✅ Sonido de monedas cargado correctamente");
        }, undefined, (error) => {
            console.error("❌ Error al cargar el sonido de monedas:", error);
        });

        // Sonido de power-ups
        this.powerUpSound = new THREE.Audio(this.audioListener);
        audioLoader.load('Recursos/SonidoMoneda.mp3', (buffer) => {
            this.powerUpSound.setBuffer(buffer);
            this.powerUpSound.setVolume(Config.AUDIO_SETTINGS.POWERUP_VOLUME);
            console.log("✅ Sonido de power-ups cargado correctamente");
        }, undefined, (error) => {
            console.error("❌ Error al cargar el sonido de power-ups:", error);
        });
    }

    setupPowerUpUI() {
        const powerUpContainer = document.createElement('div');
        powerUpContainer.id = 'powerup-container';
        powerUpContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;

        // Indicador de imán
        this.powerUpIndicators.magnet.id = 'magnet-indicator';
        this.powerUpIndicators.magnet.style.cssText = `
            background: rgba(255, 0, 0, 0.3);
            border: 2px solid #FF0000;
            border-radius: 10px;
            padding: 10px 15px;
            color: white;
            font-weight: bold;
            min-width: 160px;
            text-align: center;
            display: none;
            transition: all 0.3s ease;
            font-size: 14px;
            backdrop-filter: blur(5px);
        `;
        this.powerUpIndicators.magnet.innerHTML = '🎯 IMÁN: <span class="timer">0.0s</span>';

        // Indicador de doble puntos
        this.powerUpIndicators.double.id = 'double-indicator';
        this.powerUpIndicators.double.style.cssText = `
            background: rgba(255, 255, 0, 0.3);
            border: 2px solid #FFFF00;
            border-radius: 10px;
            padding: 10px 15px;
            color: white;
            font-weight: bold;
            min-width: 160px;
            text-align: center;
            display: none;
            transition: all 0.3s ease;
            font-size: 14px;
            backdrop-filter: blur(5px);
        `;
        this.powerUpIndicators.double.innerHTML = '🔧 DOBLE: <span class="timer">0.0s</span>';

        powerUpContainer.appendChild(this.powerUpIndicators.magnet);
        powerUpContainer.appendChild(this.powerUpIndicators.double);
        document.body.appendChild(powerUpContainer);
    }

    // ===== POWER-UPS =====

    activatePowerUp(type) {
        console.log(`🎯 ACTIVANDO POWER-UP: ${type}`);
        
        const duration = Config.POWERUP_DURATION[type];
        
        this.activePowerUps[type].active = true;
        this.activePowerUps[type].timer = duration;
        
        // Mostrar indicador UI
        this.powerUpIndicators[type].style.display = 'block';
        this.powerUpIndicators[type].style.background = type === 'magnet' 
            ? 'rgba(255, 0, 0, 0.7)' 
            : 'rgba(255, 255, 0, 0.7)';
        
        // Reproducir sonido
        this.playPowerUpSound();
        
        // Mostrar notificación
        this.showPowerUpNotification(type);
        
        // Vibración en VR si está disponible
        if (this.isVRMode && this.vrInputHandler) {
            this.vrInputHandler.vibrateController(0, 0.8, 200);
            this.vrInputHandler.vibrateController(1, 0.8, 200);
        }
        
        console.log(`✅ Power-up ACTIVADO: ${type} por ${duration}s`);
    }

    updatePowerUps(deltaTime) {
        for (const [type, powerUp] of Object.entries(this.activePowerUps)) {
            if (powerUp.active) {
                powerUp.timer -= deltaTime;
                
                // Actualizar timer en UI
                const indicator = this.powerUpIndicators[type];
                const timerElement = indicator.querySelector('.timer');
                if (timerElement) {
                    timerElement.textContent = `${Math.max(0, powerUp.timer).toFixed(1)}s`;
                }
                
                // Efecto de parpadeo cuando está por terminar
                if (powerUp.timer < 3.0) {
                    const blink = (Math.sin(Date.now() * 0.02) + 1) * 0.3 + 0.4;
                    indicator.style.opacity = blink;
                }
                
                // Desactivar cuando el timer llega a 0
                if (powerUp.timer <= 0) {
                    console.log(`⏰ Power-up ${type} terminó - Desactivando`);
                    this.deactivatePowerUp(type);
                }
            }
        }
    }

    deactivatePowerUp(type) {
        console.log(`🔚 DESACTIVANDO POWER-UP: ${type}`);
        
        this.activePowerUps[type].active = false;
        this.activePowerUps[type].timer = 0;
        
        // Ocultar indicador UI
        this.powerUpIndicators[type].style.display = 'none';
        this.powerUpIndicators[type].style.opacity = '1';
        
        console.log(`❌ Power-up DESACTIVADO: ${type}`);
    }

    showPowerUpNotification(type) {
        const powerUpInfo = {
            magnet: { text: '🎯 IMÁN ACTIVADO!', color: '#FF0000', subtext: 'Atrae monedas automáticamente' },
            double: { text: '🔧 DOBLE PUNTUACIÓN!', color: '#FFFF00', subtext: 'Monedas valen 20 puntos' }
        };
        
        const info = powerUpInfo[type];
        const notification = document.createElement('div');
        
        notification.style.cssText = `
            position: fixed;
            top: 30%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: ${info.color}DD;
            color: white;
            padding: 25px 50px;
            border-radius: 15px;
            font-size: 28px;
            font-weight: bold;
            z-index: 1000;
            animation: powerUpNotification 3s ease-in-out;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            text-align: center;
            border: 3px solid white;
            box-shadow: 0 0 30px ${info.color};
        `;
        
        notification.innerHTML = `
            <div style="margin-bottom: 10px;">${info.text}</div>
            <div style="font-size: 18px; opacity: 0.9;">${info.subtext}</div>
            <div style="font-size: 16px; opacity: 0.7; margin-top: 5px;">15 segundos</div>
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes powerUpNotification {
                0% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
                15% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                25% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                75% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                85% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
                100% { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        }, 3000);
    }

    playPowerUpSound() {
        if (this.powerUpSound) {
            this.powerUpSound.stop();
            this.powerUpSound.play();
        }
    }

    playBackgroundMusic() {
        if (this.backgroundMusic && !this.isMusicPlaying) {
            this.backgroundMusic.play();
            this.isMusicPlaying = true;
            console.log("🎵 Música de fondo iniciada");
        }
    }

    playCoinSound() {
        if (this.coinSound) {
            this.coinSound.stop();
            this.coinSound.play();
        }
    }

    pauseBackgroundMusic() {
        if (this.backgroundMusic && this.isMusicPlaying) {
            this.backgroundMusic.pause();
            this.isMusicPlaying = false;
            console.log("⏸️ Música de fondo pausada");
        }
    }

    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.stop();
            this.isMusicPlaying = false;
            console.log("⏹️ Música de fondo detenida");
        }
    }

    // ===== GESTIÓN DEL JUEGO =====

    resetToMainMenu() {
        console.log("🔄 Reiniciando a menú principal...");
        
        this.stopBackgroundMusic();
        
        // Ocultar menú VR si está activo
        if (this.vrMenuSystem.isActive) {
            this.hideVRMenu();
        }
        
        // Resetear estado del juego
        this.isGameStarted = false;
        this.isGameOver = false;
        this.isPaused = false;
        this.score = 0;
        this.distance = 0;
        this.survivalTime = 0;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.difficultyLevel = 1;
        
        // Desactivar power-ups
        for (const type in this.activePowerUps) {
            this.activePowerUps[type].active = false;
            this.activePowerUps[type].timer = 0;
            if (this.powerUpIndicators[type]) {
                this.powerUpIndicators[type].style.display = 'none';
                this.powerUpIndicators[type].style.opacity = '1';
            }
        }
        
        // Resetear componentes
        if (this.obstacleManager) {
            this.obstacleManager.reset();
        }
        
        if (this.player) this.player.reset();
        if (this.world) this.world.reset();
        
        // Ocultar UI del juego
        this.ui.uiContainer.style.display = 'none';
        this.ui.gameOver.style.display = 'none';
        this.ui.pauseButton.style.display = 'none';
        this.ui.pauseMenu.style.display = 'none';
        
        // Mostrar menú principal
        this.ui.modalOverlay.style.display = 'flex';
        this.ui.rulesModal.style.display = 'block';

        // Reiniciar música de intro
        const introMusic = document.getElementById('intro-music');
        if (introMusic) {
            introMusic.currentTime = 0;
            if (!introMusic.muted) {
                introMusic.play().catch(e => console.log('Error al reanudar música:', e));
            }
        }
        
        console.log("✅ Menú principal cargado correctamente");
    }

    async enterVRAndStart() {
        console.log("🥽 Solicitando entrada a VR...");

        // 1. Verificar si el navegador soporta VR
        if ('xr' in navigator) {
            const isSupported = await navigator.xr.isSessionSupported('immersive-vr');
            
            if (isSupported) {
                try {
                    // 2. Pedir la sesión al navegador (esto requiere clic del usuario)
                    const session = await navigator.xr.requestSession('immersive-vr', {
                        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']
                    });

                    // 3. Conectar la sesión a Three.js
                    await this.renderer.xr.setSession(session);
                    
                    console.log("✅ Sesión VR concedida. Iniciando juego...");
                    
                    // 4. Arrancar el juego inmediatamente
                    this.startGame();
                    
                } catch (err) {
                    console.error("❌ Error al entrar en VR:", err);
                    // Si falla (ej: cancelaste), inicia en modo normal
                    this.startGame();
                }
            } else {
                console.warn("⚠️ Tu navegador no soporta VR inmersivo.");
                this.startGame();
            }
        } else {
            console.warn("⚠️ WebXR no disponible.");
            this.startGame();
        }
    }
    // =========================================================

    startGame() {
        this.clock.start();
        console.log("🚀 INICIANDO JUEGO");
        
        this.checkInitialCollisions();
        
        // Ocultar menú principal
        this.ui.modalOverlay.style.display = 'none';
        this.ui.rulesModal.style.display = 'none';
        
        // Mostrar UI del juego
        this.ui.uiContainer.style.display = 'block';
        this.ui.pauseButton.style.display = 'block';

        this.isGameStarted = true;
        this.isGameOver = false;
        
        this.playBackgroundMusic();
        this.resetGameLogic();
        
        // CORRECCIÓN: Si inicia directo en VR, forzar mirada al frente
        if (this.isVRMode) {
            this.cameraContainer.rotation.set(0, 0, 0); // <--- Pon 0 aquí también
        }
        
        this.animate();
    }

    checkInitialCollisions() {
        console.log("🔍 VERIFICANDO COLISIONES INICIALES...");
        
        const playerBox = this.player.getBoundingBox();
        console.log("📍 Posición inicial del jugador:", {
            x: this.player.group.position.x.toFixed(2),
            y: this.player.group.position.y.toFixed(2), 
            z: this.player.group.position.z.toFixed(2)
        });

        console.log(`🎯 Obstáculos al inicio: ${this.obstacleManager.obstacles.length}`);
        
        if (Config.DEBUG_SETTINGS.SHOW_BOUNDING_BOXES) {
            console.log("📦 Debug: Bounding boxes visibles");
        }
    }

    resetGameLogic() {
        console.log("🔄 Reseteando lógica del juego...");
        
        this.score = 0;
        this.distance = 0;
        this.survivalTime = 0;
        this.gameSpeed = Config.GAME_START_SPEED;
        this.difficultyLevel = 1;
        this.frameCount = 0;
        this.debugStatsTimer = 0;

        // Desactivar power-ups
        for (const type in this.activePowerUps) {
            this.activePowerUps[type].active = false;
            this.activePowerUps[type].timer = 0;
            this.powerUpIndicators[type].style.display = 'none';
        }

        // Actualizar UI
        this.ui.score.textContent = `Puntos: 0`;
        this.ui.distance.textContent = `Distancia: 0m`;

        // Resetear componentes
        if (this.obstacleManager) {
            this.obstacleManager.reset();
        }
        
        if (this.player) this.player.reset();
        if (this.world) this.world.reset();

        console.log("✅ Juego reiniciado - Listo para empezar");
    }

    restartGame() {
        this.clock.start();
        console.log("🔄 Reiniciando el juego...");
        
        this.ui.gameOver.style.display = 'none';
        this.isGameOver = false;
        this.isPaused = false;
        
        if (this.vrMenuSystem.isActive) {
            this.hideVRMenu();
        }
        
        this.playBackgroundMusic();
        this.resetGameLogic();
        
        // CORRECCIÓN: Al reiniciar en VR, forzar mirada al frente de nuevo
        if (this.isVRMode) {
            this.cameraContainer.rotation.set(0, 0, 0); // <--- Pon 0 aquí también
        }
        
        this.animate();
    }

    setupLights() {
        // Luz ambiental
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        // Luz direccional principal
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 1024;
        dirLight.shadow.mapSize.height = 1024;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 50;
        dirLight.shadow.bias = -0.001;
        this.scene.add(dirLight);
        
        console.log("💡 Sistema de iluminación configurado");
    }

    loadEnvironment(hdrPath) {
        const rgbeLoader = new RGBELoader();
        rgbeLoader.load(hdrPath, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = texture;
            this.scene.environment = texture;
            console.log("✅ Fondo HDR cargado correctamente");
        }, undefined, (err) => {
            console.warn("⚠️ No se pudo cargar el fondo HDR. Usando fondo por defecto.", err);
            this.scene.background = new THREE.Color(Config.FOG_COLOR);
        });
    }

    updateDifficulty() {
        const newDifficulty = Math.floor(this.distance / Config.DIFFICULTY_INTERVAL) + 1;
        
        if (newDifficulty > this.difficultyLevel) {
            this.difficultyLevel = newDifficulty;
            
            // Aumentar velocidad
            const speedIncrease = 2 * this.difficultyLevel;
            this.gameSpeed = Math.min(
                Config.GAME_START_SPEED + speedIncrease, 
                Config.GAME_MAX_SPEED
            );
            
            // Ajustar tasa de aparición de obstáculos
            if (this.obstacleManager) {
                this.obstacleManager.baseSpawnRate = Math.max(
                    0.5, 
                    2 - (this.difficultyLevel * 0.3)
                );
            }
            
            console.log(`📈 ¡Dificultad Nivel ${this.difficultyLevel}! Velocidad: ${this.gameSpeed.toFixed(1)}`);
        }
    }

    // ===== CARGA DE ASSETS =====

    preloadAssets() {
        console.log("📦 Precargando assets...");
        const fbxLoader = new FBXLoader();
        const textureLoader = new THREE.TextureLoader();
        const totalAssets = 15;
        let loadedCount = 0;

        const updateProgress = () => {
            loadedCount++;
            const progress = (loadedCount / totalAssets) * 100;
            this.ui.loadingBar.style.width = `${progress}%`;
            this.ui.loadingText.textContent = `${Math.round(progress)}%`;
            console.log(`📊 Progreso de carga: ${progress}%`);
        };

        const loadPromise = (path, assetName) => {
            return new Promise((resolve, reject) => {
                fbxLoader.load(path, (obj) => {
                    updateProgress();
                    console.log(`✅ ${assetName} cargado: ${path}`);
                    resolve(obj);
                }, undefined, (err) => {
                    console.error(`❌ Error cargando ${assetName} (${path}):`, err);
                    reject(err);
                });
            });
        };

        const loadTexturePromise = (path, textureName) => {
            return new Promise((resolve, reject) => {
                textureLoader.load(path, (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    texture.encoding = THREE.sRGBEncoding;
                    console.log(`✅ Textura cargada: ${textureName}`);
                    resolve(texture);
                }, undefined, (err) => {
                    console.error(`❌ Error cargando textura ${textureName} (${path})`, err);
                    reject(err);
                });
            });
        };

        return new Promise(async (resolve, reject) => {
            try {
                // RUTAS DE ASSETS
                const assetPaths = {
                    coin: 'Recursos/Low Poly Coin.fbx',
                    barrier: 'Recursos/concrete_road_barrier4k.fbx',
                    car: 'Recursos/covered_car4k.fbx',
                    rock: 'Recursos/moon_rock_4k.fbx',
                    barrel: 'Recursos/Barrel.fbx',
                    dartboard: 'Recursos/dartboard_4k.fbx', 
                    pipeWrench: 'Recursos/pipe_wrench_4k.fbx', 
                    playerModel: 'Recursos/character.fbx',
                    animRun: 'Recursos/Fast Run.fbx',
                    animJump: 'Recursos/Jump.fbx',
                    animDie: 'Recursos/Death.fbx',
                    animRoll: 'Recursos/Sprinting Forward Roll.fbx',
                    animLeft: 'Recursos/Left.fbx',
                    animRight: 'Recursos/Right.fbx',
                    zombieModel: 'Recursos/Zombie Walk1.fbx'
                };

                console.log("🎨 Cargando texturas...");
                const [
                    carTexture,
                    barrierDiffTexture,
                    barrierDispTexture,
                    rockDiffTexture,
                    rockDispTexture,
                    barrelTexture, 
                    dartboardTexture, 
                    pipeWrenchTexture 
                ] = await Promise.all([
                    loadTexturePromise('Recursos/covered_car_diff_4k.jpg', 'carTexture'),
                    loadTexturePromise('Recursos/concrete_road_barrier_diff_4k.jpg', 'barrierDiffTexture'),
                    loadTexturePromise('Recursos/concrete_road_barrier_disp_4k.png', 'barrierDispTexture'),
                    loadTexturePromise('Recursos/moon_rock_03_diff_4k.jpg', 'rockDiffTexture'),
                    loadTexturePromise('Recursos/moon_rock_03_disp_4k.png', 'rockDispTexture'),
                    loadTexturePromise('Recursos/Barrel_01.png', 'barrelTexture'), 
                    loadTexturePromise('Recursos/dartboard_diff_4k.jpg', 'dartboardTexture'), 
                    loadTexturePromise('Recursos/pipe_wrench_diff_4k.jpg', 'pipeWrenchTexture') 
                ]);

                console.log("🔄 Cargando modelos FBX...");
                const [
                    coin, 
                    barrier, 
                    car, 
                    rock,
                    barrel, 
                    dartboard,
                    pipeWrench, 
                    playerModel,
                    animRun,
                    animJump,
                    animDie,
                    animRoll,
                    animLeft,
                    animRight,
                    zombieModel
                    
                ] = await Promise.all([
                    loadPromise(assetPaths.coin, 'coin'),
                    loadPromise(assetPaths.barrier, 'barrier'),
                    loadPromise(assetPaths.car, 'car'),
                    loadPromise(assetPaths.rock, 'rock'),
                    loadPromise(assetPaths.barrel, 'barrel'),
                    loadPromise(assetPaths.dartboard, 'dartboard'), 
                    loadPromise(assetPaths.pipeWrench, 'pipeWrench'), 
                    loadPromise(assetPaths.playerModel, 'playerModel'),
                    loadPromise(assetPaths.animRun, 'animRun'),
                    loadPromise(assetPaths.animJump, 'animJump'),
                    loadPromise(assetPaths.animDie, 'animDie'),
                    loadPromise(assetPaths.animRoll, 'animRoll'),
                    loadPromise(assetPaths.animLeft, 'animLeft'),
                    loadPromise(assetPaths.animRight, 'animRight'),
                    loadPromise(assetPaths.zombieModel, 'zombieModel')
                ]);

                // Aplicar texturas
                console.log("✨ Aplicando texturas a modelos...");
                
                const applyTexture = (model, texture, textureName) => {
                    model.traverse(child => {
                        if (child.isMesh && child.material) {
                            child.material.map = texture;
                            child.material.needsUpdate = true;
                        }
                    });
                    console.log(`✅ Textura aplicada: ${textureName}`);
                };

                const applyTextureWithDisplacement = (model, diffTexture, dispTexture, textureName) => {
                    model.traverse(child => {
                        if (child.isMesh && child.material) {
                            child.material.map = diffTexture;
                            child.material.displacementMap = dispTexture;
                            child.material.displacementScale = textureName.includes('barrier') ? 0.1 : 0.05;
                            child.material.needsUpdate = true;
                        }
                    });
                   console.log(`✅ Textura con displacement aplicada: ${textureName}`);
                };

                // Aplicar texturas a cada modelo
                applyTexture(car, carTexture, 'car');
                applyTextureWithDisplacement(barrier, barrierDiffTexture, barrierDispTexture, 'barrier');
                applyTextureWithDisplacement(rock, rockDiffTexture, rockDispTexture, 'rock');
                applyTexture(barrel, barrelTexture, 'barrel');
                applyTexture(dartboard, dartboardTexture, 'dartboard');
                applyTexture(pipeWrench, pipeWrenchTexture, 'pipeWrench');

                // Configurar escalas
                console.log("📏 Configurando escalas...");
                coin.scale.set(0.005, 0.005, 0.005);           
                barrier.scale.set(0.01, 0.01, 0.01);           
                car.scale.set(0.015, 0.015, 0.015);            
                barrel.scale.set(0.02, 0.02, 0.02);            
                dartboard.scale.set(0.03, 0.03, 0.03);    
                pipeWrench.scale.set(0.03, 0.03, 0.03); 
                zombieModel.scale.set(0.011, 0.011, 0.011);

                // Configurar sombras
                console.log("🌑 Configurando sombras...");
                [coin, barrier, car, rock, barrel, dartboard, pipeWrench, playerModel].forEach(model => {
                    model.traverse(child => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                });

                console.log("🎉 ¡Todos los assets cargados y configurados!");

                // Retornar assets organizados
                resolve({
                    coin: coin,
                    playerModel: playerModel,
                    barrier: barrier,
                    car: car,
                    rock: rock,
                    barrel: barrel, 
                    dartboard: dartboard, 
                    pipeWrench: pipeWrench, 
                    obstacleBarriers: [barrier, car, rock, barrel], 
                    animRun: animRun,
                    animJump: animJump,
                    animDie: animDie,
                    animRoll: animRoll,
                    animLeft: animLeft,
                    animRight: animRight,
                    zombieModel: zombieModel
                });

            } catch (error) {
                console.error("💥 Error fatal en preloadAssets:", error);
                reject(error);
            }
        });
    }

    // ===== SISTEMA DE COLISIONES =====

    checkCollisions() {
        if (this.isGameOver || this.vrMenuSystem.isActive || !this.isGameStarted) return;

        const playerBox = this.player.getBoundingBox();
        const playerPosition = this.player.group.position;

        this.frameCount++;
        this.debugStatsTimer++;

        // Mostrar stats de debug cada 5 segundos
        if (this.debugStatsTimer > 300 && Config.DEBUG_SETTINGS.LOG_PERFORMANCE) {
            console.log(`📊 Frame ${this.frameCount} - Distancia: ${this.distance.toFixed(0)}m`);
            console.log(`📍 Jugador: X=${playerPosition.x.toFixed(2)}, Z=${playerPosition.z.toFixed(2)}`);
            this.debugStatsTimer = 0;
        }

        // Verificar colisiones con obstáculos
        for (let i = 0; i < this.obstacleManager.obstacles.length; i++) {
            const obstacle = this.obstacleManager.obstacles[i];
            if (!obstacle.isActive) continue;
            
            const obstacleBox = obstacle.getBoundingBox();
            
            if (playerBox.intersectsBox(obstacleBox)) {
                console.log("🚨 ¡COLISIÓN CON OBSTÁCULO! Iniciando Game Over...");
                
                // CAMBIO: Llamamos siempre a gameOver(), ya no usamos showVRGameOverMenu()
                this.gameOver("COLISIÓN CON OBSTÁCULO");
                return;
            }
        }

        // Verificar colisiones con monedas
        for (let i = this.obstacleManager.coins.length - 1; i >= 0; i--) {
            const coin = this.obstacleManager.coins[i];
            if (!coin.isActive) continue;
            
            const coinBox = coin.getBoundingBox();
            if (playerBox.intersectsBox(coinBox)) {
                if (Config.DEBUG_SETTINGS.LOG_COLLISIONS) {
                    console.log("💰 Moneda recolectada!");
                }
                
                this.obstacleManager.collectCoin(coin);
                
                // Calcular puntos (con power-up de doble si está activo)
                let points = 10;
                if (this.activePowerUps.double.active) {
                    points = 20;
                    if (Config.DEBUG_SETTINGS.LOG_POWERUPS) {
                        console.log("✅ Bonus doble aplicado: +20 puntos");
                    }
                }
                
                this.score += points;
                this.ui.score.textContent = `Puntos: ${this.score}`;
                
                // Reproducir sonido
                this.playCoinSound();
                
                // Vibración en VR si está disponible
                if (this.isVRMode && this.vrInputHandler) {
                    this.vrInputHandler.vibrateController(0, 0.3, 100);
                }
            }
        }

        // Verificar colisiones con power-ups
        for (let i = this.obstacleManager.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.obstacleManager.powerUps[i];
            if (!powerUp.isActive) continue;
            
            const powerUpBox = powerUp.getBoundingBox();
            
            if (playerBox.intersectsBox(powerUpBox)) {
                if (Config.DEBUG_SETTINGS.LOG_POWERUPS) {
                    console.log(`⚡ ¡COLISIÓN CON POWER-UP! Tipo: ${powerUp.powerUpType}`);
                }
                
                const powerUpType = powerUp.powerUpType;
                
                // Recolectar power-up
                this.obstacleManager.collectPowerUp(powerUp);
                
                // Activar power-up
                if (powerUpType && (powerUpType === 'magnet' || powerUpType === 'double')) {
                    if (Config.DEBUG_SETTINGS.LOG_POWERUPS) {
                        console.log(`🎯 Activando power-up: ${powerUpType}`);
                    }
                    this.activatePowerUp(powerUpType);
                } else {
                    console.error("❌ Tipo de power-up inválido:", powerUpType);
                }
                break;
            }
        }
    }
    
    showGameOverMenuFromVR() {
        console.log("💀 Mostrando Game Over desde VR");
        
        // Detener el juego
        this.isGameOver = true;
        this.pauseBackgroundMusic();
        
        // Ejecutar animación de muerte del jugador
        if (this.player) {
            this.player.die();
        }
        
        // Mostrar menú VR de Game Over
        this.showVRGameOverMenu();
        
        // Notificar en consola
        console.log("✅ Menú VR Game Over activado");
    }
    
    gameOver(reason = "DESCONOCIDO") {
        if (this.isGameOver) return;

        console.log("🛑 GAME OVER - Razón:", reason);

        this.isGameOver = true;
        this.pauseBackgroundMusic();

        // 1. Ejecutar animación de muerte del jugador
        if (this.player) {
            this.player.die();
        }

        // 2. DETECTAR SI ESTAMOS EN VR Y SALIR
        if (this.isVRMode) {
            console.log("🥽 Detectado modo VR - Saliendo de la sesión para mostrar menú...");
            
            const session = this.renderer.xr.getSession();
            if (session) {
                // Esta función fuerza al navegador a salir del modo inmersivo
                session.end().then(() => {
                    console.log("✅ Salida de VR exitosa");
                }).catch(err => {
                    console.error("❌ Error al salir de VR:", err);
                });
            }
        }

        // 3. MOSTRAR MENÚ HTML (Usamos un pequeño retraso para dar tiempo a la transición)
        setTimeout(() => {
            console.log("🖥️ Mostrando menú 2D de Game Over");
            
            // Actualizar estadísticas finales en el HTML
            const finalScoreEl = document.getElementById('final-score');
            const finalDistEl = document.getElementById('final-distance');
            const finalCoinsEl = document.getElementById('final-coins');
            const finalTimeEl = document.getElementById('final-time');

            if (finalScoreEl) finalScoreEl.textContent = this.score;
            if (finalDistEl) finalDistEl.textContent = Math.floor(this.distance) + 'm';
            if (finalCoinsEl) finalCoinsEl.textContent = Math.floor(this.score / 10);
            if (finalTimeEl) finalTimeEl.textContent = Math.floor(this.survivalTime) + 's';

            // Mostrar el div de Game Over
            if (this.ui.gameOver) {
                this.ui.gameOver.style.display = 'block';
            }
            
            // Asegurarnos que el cursor del mouse sea visible de nuevo
            document.body.style.cursor = 'default';

        }, 500); // Esperamos medio segundo para que la transición de salir de VR sea suave
    }

    // AÑADIR método para debug de carriles
    debugLaneSystem() {
        if (this.vrControls) {
            console.log("🔧 Debug Sistema de Carriles:", {
                jugador: {
                    carrilActual: this.player.currentLane,
                    posiciónX: this.player.group.position.x.toFixed(2)
                },
                vrControls: this.vrControls.gazeState ? {
                    carrilVR: this.vrControls.gazeState.currentLane,
                    targetVR: this.vrControls.gazeState.targetLane,
                    angulo: this.vrControls.gazeState.gazeAngle?.toFixed(3)
                } : "No disponible"
            });
        }
    }

    // ===== SISTEMA DE RENDERIZADO =====

    onWindowResize() {
        // Actualizar cámara
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        // Actualizar renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Actualizar renderizador CSS3D
        if (this.cssRenderer) {
            this.cssRenderer.setSize(window.innerWidth, window.innerHeight);
        }
        
        // Actualizar configuración dinámica
        Config.updateAspectRatio();
        
        if (Config.DEBUG_SETTINGS.LOG_PERFORMANCE) {
            console.log("🔄 Ventana redimensionada");
        }
    }

    animate() {
        if (!this.isGameStarted) {
            return;
        }

        // Configurar loop de animación para VR o modo normal
        if (this.renderer.xr.isPresenting) {
            this.renderer.setAnimationLoop(this.render.bind(this));
        } else {
            requestAnimationFrame(this.animate.bind(this));
            this.render();
        }
    }

    render() {
        // Si está pausado y no hay menú VR activo, no renderizar
        if (this.isPaused && !this.vrMenuSystem.isActive) {
            return; 
        }

        const delta = this.clock.getDelta();
        const currentTime = performance.now();
        
        // Calcular FPS (solo para debug)
        if (Config.DEBUG_SETTINGS.LOG_PERFORMANCE && this.lastFrameTime > 0) {
            const fps = 1000 / (currentTime - this.lastFrameTime);
            if (this.frameCount % 60 === 0) {
                console.log(`📈 FPS: ${fps.toFixed(1)}`);
            }
        }
        this.lastFrameTime = currentTime;

        // Actualizar tiempo de supervivencia
        this.survivalTime += delta;

        // Actualizar controles VR
        if (this.vrControls && this.isVRMode) {
            this.vrControls.update(delta);
        }

        // Actualizar jugador
        if (this.player) {
            this.player.update(delta);
            
            // En VR primera persona, la cámara sigue al jugador
            if (this.isVRMode) {
                // 1. Seguir posición X y Z del jugador
                this.cameraContainer.position.x = this.player.group.position.x;
                this.cameraContainer.position.z = this.player.group.position.z;
                
                // 2. Gestionar la altura (Y) de la cámara
                if (this.player.state === Config.PLAYER_STATE.JUMPING) {
                    // Si salta, seguimos la física del salto (altura base + salto)
                    this.cameraContainer.position.y = Config.VR_SETTINGS.PLAYER_HEIGHT + this.player.group.position.y;
                } else {
                    // Si no salta, determinamos la altura objetivo (Pie o Rodando)
                    let targetHeight = Config.VR_SETTINGS.PLAYER_HEIGHT; // Altura normal (1.6m)
                    
                    if (this.player.state === Config.PLAYER_STATE.ROLLING) {
                        targetHeight = 0.6; // Altura al rodar (bajamos a 60cm del suelo)
                    }
                    
                    // EFECTO SUAVE: Movemos la cámara hacia la altura objetivo poco a poco
                    // Esto crea la sensación de "bajar la cabeza" al rodar
                    this.cameraContainer.position.y += (targetHeight - this.cameraContainer.position.y) * 0.15;
                }

                // 3. Actualizar menú VR si existe
                if (this.vrMenuSystem.isActive && this.css3DAvailable) {
                    this.positionVRMenu();
                }
            }
        }

        // Si el juego terminó, solo actualizar animaciones de muerte
        if (this.isGameOver) {
            if (this.world) {
                this.world.zombieCatch(delta);
            }
            this.renderer.render(this.scene, this.camera);
            
            // Renderizar menú CSS3D si está activo (para VR)
            if (this.vrMenuSystem.isActive && this.cssRenderer && this.css3DAvailable) {
                this.cssRenderer.render(this.cssScene, this.camera);
            }
            return;
        }

        const playerPosition = this.player.group.position;

        // Actualizar mundo
        this.world.update(delta, this.gameSpeed, playerPosition);
        
        // Actualizar obstáculos y power-ups
        if (this.obstacleManager) {
            this.obstacleManager.update(
                delta, 
                this.gameSpeed, 
                this.distance, 
                playerPosition,
                this.activePowerUps
            );
        }

        // En modo normal, cámara sigue al jugador en 3ra persona
        if (!this.isVRMode) {
            this.cameraContainer.position.z = playerPosition.z + Config.CAMERA_START_Z;
            this.cameraContainer.position.x = playerPosition.x;
        }

        // Actualizar distancia y UI
        this.distance += this.gameSpeed * delta;
        this.ui.distance.textContent = `Distancia: ${this.distance.toFixed(0)}m`;
        
        // Actualizar power-ups
        this.updatePowerUps(delta);
        
        // Actualizar dificultad
        this.updateDifficulty();
        
        // Verificar colisiones
        this.checkCollisions();

        // Renderizar escena 3D principal
        this.renderer.render(this.scene, this.camera);
        
        // Renderizar menú CSS3D si está activo (menús VR)
        if (this.vrMenuSystem.isActive && this.cssRenderer && this.css3DAvailable) {
            this.cssRenderer.render(this.cssScene, this.camera);
        }
    }

    // ===== MÉTODOS PÚBLICOS PARA UI =====

    getGameState() {
        return {
            isGameStarted: this.isGameStarted,
            isGameOver: this.isGameOver,
            isPaused: this.isPaused,
            isVRMode: this.isVRMode,
            score: this.score,
            distance: Math.floor(this.distance),
            survivalTime: Math.floor(this.survivalTime),
            gameSpeed: this.gameSpeed.toFixed(1),
            difficultyLevel: this.difficultyLevel,
            activePowerUps: Object.keys(this.activePowerUps).filter(key => this.activePowerUps[key].active)
        };
    }

    debugInfo() {
        return {
            fps: this.lastFrameTime > 0 ? (1000 / (performance.now() - this.lastFrameTime)).toFixed(1) : "N/A",
            frameCount: this.frameCount,
            playerState: this.player ? this.player.debugInfo() : null,
            vrMenuActive: this.vrMenuSystem.isActive,
            vrMenuType: this.vrMenuSystem.type,
            css3DAvailable: this.css3DAvailable,
            activeObstacles: this.obstacleManager ? this.obstacleManager.obstacles.length : 0,
            activeCoins: this.obstacleManager ? this.obstacleManager.coins.length : 0,
            activePowerUpsCount: this.obstacleManager ? this.obstacleManager.powerUps.length : 0
        };
    }
}

// Exportar clase para acceso global
window.Game = Game;