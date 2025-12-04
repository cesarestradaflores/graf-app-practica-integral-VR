// -----------------------------------------------------------------
// --- Player.js (VERSIÓN MEJORADA CON SOPORTE VR COMPLETO)
// -----------------------------------------------------------------

import * as THREE from 'three';
import { Config } from './Config.js';

export class Player {
    constructor(scene, assets) {
        this.scene = scene;
        this.assets = assets;
        this.height = 2.5; 
        this.width = 1;

        // NUEVO: Referencia al juego
        this.game = null;
        
        this.group = new THREE.Group();
        this.group.scale.set(0.015, 0.015, 0.015);
        this.scene.add(this.group);
        
        this.mesh = null; 
        this.mixer = null; 
        this.actions = {}; 
        this.activeActionName = ''; 

        this.boundingBox = new THREE.Box3();
        this.boundingBoxHelper = null; // Para debug
        this.frameCount = 0;
        this.lastPosition = new THREE.Vector3();
        this.needsBoundingBoxUpdate = true;

        this.animationTransitionInProgress = false;
        this.pendingAnimation = '';

        if (assets.playerModel) {
            this.mesh = assets.playerModel;
            this.mesh.position.y = 0; 
            
            this.group.add(this.mesh); 
            this.mesh.rotation.y = Math.PI;
            
            this.mixer = new THREE.AnimationMixer(this.mesh);

            this.setupAnimations();
            
            this.activeActionName = 'run';
            if (this.actions.run) {
                this.actions.run.play();
            }
            
            this._updateBoundingBox();
            
            this.setupAnimationListeners();
            
            // Crear helper de bounding box para debug (opcional)
            // this.createBoundingBoxHelper();
            
        } else {
            console.error("No se pasó ningún modelo de jugador. Creando placeholder.");
            this._createPlaceholder();
        }
        
        this.state = Config.PLAYER_STATE.RUNNING;
        this.currentLane = 1; 
        this.yVelocity = 0;
        this.rollTimer = 0;

        this.vrMode = false;
        this.vrHeadPosition = new THREE.Vector3();
        
        console.log("✅ Player inicializado con bounding box optimizado");
    }

    // AÑADIR método para conectar al juego
    connectToGame(gameInstance) {
        this.game = gameInstance;
        console.log("🎮 Jugador conectado al juego");
    }

    setupAnimations() {
        const animationClips = {
            'run': this.assets.animRun,
            'jump': this.assets.animJump,
            'die': this.assets.animDie,
            'roll': this.assets.animRoll,
            'left': this.assets.animLeft,
            'right': this.assets.animRight
        };

        for (const [name, animAsset] of Object.entries(animationClips)) {
            if (animAsset && animAsset.animations && animAsset.animations.length > 0) {
                this.actions[name] = this.mixer.clipAction(animAsset.animations[0]);
                console.log(`✅ Animación cargada: ${name}`);
            } else {
                console.warn(`⚠️ Animación no disponible: ${name}`);
                // Crear acción vacía para evitar errores
                this.actions[name] = null;
            }
        }

        if (this.actions.run) {
            this.actions.run.setLoop(THREE.LoopRepeat);
            this.actions.run.setEffectiveTimeScale(1.0);
        }
        
        if (this.actions.jump) {
            this.actions.jump.setLoop(THREE.LoopOnce);
            this.actions.jump.clampWhenFinished = false;
        }
        
        if (this.actions.die) {
            this.actions.die.setLoop(THREE.LoopOnce);
            this.actions.die.clampWhenFinished = true;
        }
        
        if (this.actions.roll) {
            this.actions.roll.setLoop(THREE.LoopOnce);
            this.actions.roll.clampWhenFinished = false;
        }
        
        if (this.actions.left) {
            this.actions.left.setLoop(THREE.LoopOnce);
            this.actions.left.clampWhenFinished = false;
        }
        
        if (this.actions.right) {
            this.actions.right.setLoop(THREE.LoopOnce);
            this.actions.right.clampWhenFinished = false;
        }
    }

    setupAnimationListeners() {
        this.mixer.addEventListener('finished', (e) => {
            if (this.animationTransitionInProgress) return;

            const finishedAction = e.action;
            
            if (finishedAction === this.actions.die) {
                return;
            }
            
            if ((finishedAction === this.actions.jump && this.state === Config.PLAYER_STATE.JUMPING) ||
                (finishedAction === this.actions.roll && this.state === Config.PLAYER_STATE.ROLLING)) {
                
                setTimeout(() => {
                    if (this.state !== Config.PLAYER_STATE.DEAD) {
                        this.switchAnimation('run');
                    }
                }, 50);
            }
            
            if (finishedAction === this.actions.left || finishedAction === this.actions.right) {
                if (this.state === Config.PLAYER_STATE.RUNNING) {
                    this.switchAnimation('run');
                }
            }
        });
    }

    switchAnimation(newActionName) {
        if (this.activeActionName === newActionName || !this.actions[newActionName]) {
            return;
        }

        if (this.animationTransitionInProgress) {
            this.pendingAnimation = newActionName;
            return;
        }

        this.animationTransitionInProgress = true;

        const oldAction = this.actions[this.activeActionName];
        const newAction = this.actions[newActionName];

        if (newAction) {
            newAction.reset();
            
            if (newActionName === 'run') {
                newAction.setLoop(THREE.LoopRepeat);
            } else {
                newAction.setLoop(THREE.LoopOnce);
            }
            
            newAction.clampWhenFinished = (newActionName === 'die');
            
            if (oldAction && oldAction !== newAction) {
                oldAction.fadeOut(0.1);
            }
            
            newAction.fadeIn(0.1);
            newAction.play();

            this.activeActionName = newActionName;
        }

        setTimeout(() => {
            this.animationTransitionInProgress = false;
            
            if (this.pendingAnimation) {
                const pending = this.pendingAnimation;
                this.pendingAnimation = '';
                this.switchAnimation(pending);
            }
        }, 100);
    }

    createBoundingBoxHelper() {
        const helper = new THREE.Box3Helper(this.boundingBox, 0xffff00);
        this.scene.add(helper);
        this.boundingBoxHelper = helper;
    }

    updateBoundingBoxHelper() {
        if (this.boundingBoxHelper) {
            this.boundingBoxHelper.box.copy(this.boundingBox);
        }
    }

    _createPlaceholder() {
        const geometry = new THREE.CapsuleGeometry(this.width / 2, this.height - this.width, 16);
        const material = new THREE.MeshPhongMaterial({ color: 0xeeeeee });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.group.add(this.mesh);
        this.group.position.y = this.height / 2;
        this._updateBoundingBox();
    }
    
    die() {
        this.state = Config.PLAYER_STATE.DEAD;
        this.switchAnimation('die');
        
        if (this.vrMode) {
            this.disableVRControls();
        }
    }

    enableVRMode() {
        this.vrMode = true;
        console.log("🎮 Modo VR activado para el jugador");
    }

    disableVRMode() {
        this.vrMode = false;
        console.log("🖥️ Modo VR desactivado para el jugador");
    }

    disableVRControls() {
        if (this.vrMode) {
            console.log("🚫 Controles VR desactivados (jugador muerto)");
        }
    }

    updateVRHeadPosition(headPosition) {
        if (this.vrMode && headPosition) {
            this.vrHeadPosition.copy(headPosition);
        }
    }

    onKeyDown(event) {
        if (this.state === Config.PLAYER_STATE.DEAD) return; 

        switch (event.code) {
            case 'KeyW':
            case 'ArrowUp':
            case 'Space':
                this.jump();
                break;
            case 'KeyA':
            case 'ArrowLeft':
                this.strafe(-1);
                break;
            case 'KeyD':
            case 'ArrowRight':
                this.strafe(1);
                break;
            case 'KeyS':
            case 'ArrowDown':
                this.roll();
                break;
        }
    }

    reset() {
        console.log("Reseteando al jugador...");
        this.state = Config.PLAYER_STATE.RUNNING;
        this.yVelocity = 0;
        this.rollTimer = 0;
        this.currentLane = 1; 
        this.animationTransitionInProgress = false;
        this.pendingAnimation = '';
        this.frameCount = 0;
        this.needsBoundingBoxUpdate = true;

        if (this.group) {
            this.group.scale.set(0.015, 0.015, 0.015);
            this.group.position.x = 0;
            this.group.position.y = 0;
            this.group.position.z = 0;
            
            this._updateBoundingBox();
            
            if (this.mixer) {
                this.mixer.stopAllAction();
                this.activeActionName = 'run';
                if (this.actions.run) {
                    this.actions.run.reset();
                    this.actions.run.play();
                }
            }
        }
    }

    // Reemplaza tu función strafe existente por esta:
    strafe(direction) {
        if (this.state === Config.PLAYER_STATE.DEAD) return; 

        // Calcular hacia dónde vamos
        const targetLane = this.currentLane + direction;
        
        // IMPORTANTE: Asegurar que no nos salimos de los límites (0 a 2)
        if (targetLane >= 0 && targetLane <= 2) {
            this.currentLane = targetLane;

            // Animación y logs
            if (this.state === Config.PLAYER_STATE.RUNNING) {
                if (direction === -1 && this.actions.left) {
                    this.switchAnimation('left');
                } else if (direction === 1 && this.actions.right) {
                    this.switchAnimation('right');
                }
                console.log(`🔄 Moviendo a carril ${this.currentLane}`);
            }
            
            this.needsBoundingBoxUpdate = true;
        }
    }

    jump() {
        if (this.state === Config.PLAYER_STATE.RUNNING) {
            this.state = Config.PLAYER_STATE.JUMPING;
            this.yVelocity = Config.JUMP_STRENGTH;
            if (this.actions.jump) {
                this.switchAnimation('jump');
            }
            this.needsBoundingBoxUpdate = true;
        }
    }

    roll() {
        if (this.state === Config.PLAYER_STATE.RUNNING) {
            this.state = Config.PLAYER_STATE.ROLLING;
            this.rollTimer = Config.ROLL_DURATION;
            if (this.actions.roll) {
                this.switchAnimation('roll');
            }
            this.needsBoundingBoxUpdate = true;
        }
    }

    update(deltaTime) {
        if (!this.group) return; 
        
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        if (this.state === Config.PLAYER_STATE.DEAD) return; 

        const targetX = (this.currentLane - 1) * Config.LANE_WIDTH;
        const currentX = this.group.position.x;
        
        // Solo actualizar si hay movimiento significativo
        if (Math.abs(targetX - currentX) > 0.01) {
            this.group.position.x = THREE.MathUtils.lerp(currentX, targetX, 10 * deltaTime);
            this.needsBoundingBoxUpdate = true;
        }
        
        const groundY = 0;

        if (this.state === Config.PLAYER_STATE.JUMPING) {
            this.group.position.y += this.yVelocity * deltaTime;
            this.yVelocity += Config.GRAVITY * deltaTime;
            this.needsBoundingBoxUpdate = true;

            if (this.group.position.y <= groundY) {
                this.group.position.y = groundY;
                this.yVelocity = 0;
                this.state = Config.PLAYER_STATE.RUNNING;
                this.needsBoundingBoxUpdate = true;
            }
        }

        if (this.state === Config.PLAYER_STATE.ROLLING) {
            this.rollTimer -= deltaTime;
            if (this.rollTimer <= 0) {
                this.state = Config.PLAYER_STATE.RUNNING;
                this.needsBoundingBoxUpdate = true;
            }
        }
        
        // Actualizar bounding box solo cuando es necesario
        if (this.needsBoundingBoxUpdate || this.frameCount % 5 === 0) {
            this._updateBoundingBox();
            this.needsBoundingBoxUpdate = false;
        }
        
        this.frameCount++;
    }

    _updateBoundingBox() {
        if (!this.group) return; 
        
        this.boundingBox.setFromObject(this.group, true);
        
        const padding = 0.1;
        this.boundingBox.expandByScalar(padding);
        
        // Ajustar según estado
        if (this.state === Config.PLAYER_STATE.ROLLING) {
            this.boundingBox.min.y += 0.5;
            this.boundingBox.max.y -= 0.3;
        }
        
        if (this.state === Config.PLAYER_STATE.JUMPING) {
            this.boundingBox.expandByScalar(0.2);
        }
        
        // Actualizar helper si existe
        if (this.boundingBoxHelper) {
            this.updateBoundingBoxHelper();
        }
    }

    getBoundingBox() {
        return this.boundingBox;
    }

    debugInfo() {
        return {
            state: this.state,
            currentLane: this.currentLane,
            animation: this.activeActionName,
            position: {
                x: this.group.position.x.toFixed(2),
                y: this.group.position.y.toFixed(2),
                z: this.group.position.z.toFixed(2)
            },
            vrMode: this.vrMode,
            needsUpdate: this.needsBoundingBoxUpdate,
            connectedToGame: !!this.game
        };
    }
}