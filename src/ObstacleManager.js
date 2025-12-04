// -----------------------------------------------------------------
// --- ObstacleManager.js - POWER-UPS (Compatibilidad VR) CON POOLING
// -----------------------------------------------------------------

import * as THREE from 'three';
import { Config } from './Config.js';
import { ObstacleItem } from './ObstacleItem.js';

export class ObstacleManager {
    constructor(scene, assets) {
        this.scene = scene;
        this.assets = assets;
        
        // Arrays activos
        this.obstacles = [];
        this.coins = [];
        this.powerUps = [];

        // Pools
        this.obstaclePool = [];
        this.coinPool = [];
        this.powerUpPool = [];
        
        // Pre-crear pools
        this.createPools();

        this.spawnTimer = 2;
        this.baseSpawnRate = 2;
        this.difficultyLevel = 1;
        
        console.log("✅ ObstacleManager con POOLING inicializado");
    }
    
    createPools() {
        // Pool de obstáculos (15 elementos)
        for (let i = 0; i < 15; i++) {
            const mesh = this.assets.barrier.clone();
            mesh.visible = false;
            this.scene.add(mesh);
            const obstacle = new ObstacleItem(mesh, this.scene);
            obstacle.setActive(false);
            this.obstaclePool.push(obstacle);
        }
        
        // Pool de monedas (30 elementos)
        for (let i = 0; i < 30; i++) {
            const mesh = this.assets.coin.clone();
            mesh.visible = false;
            this.scene.add(mesh);
            const coin = new ObstacleItem(mesh, this.scene);
            coin.type = Config.OBSTACLE_TYPE.COIN;
            coin.setActive(false);
            this.coinPool.push(coin);
        }
        
        // Pool de power-ups (10 elementos)
        for (let i = 0; i < 10; i++) {
            const mesh = this.assets.dartboard.clone();
            mesh.visible = false;
            this.scene.add(mesh);
            const powerUp = new ObstacleItem(mesh, this.scene);
            powerUp.type = "POWERUP";
            powerUp.setActive(false);
            this.powerUpPool.push(powerUp);
        }
    }
    
    getFromPool(poolArray) {
        for (let i = 0; i < poolArray.length; i++) {
            if (!poolArray[i].isActive) {
                const item = poolArray[i];
                item.setActive(true);
                item.reset();
                return item;
            }
        }
        
        // Si no hay objetos disponibles, crear uno nuevo
        console.log("⚠️ Pool vacío, creando nuevo objeto");
        let mesh, type;
        
        if (poolArray === this.obstaclePool) {
            mesh = this.assets.barrier.clone();
            type = "obstacle";
        } else if (poolArray === this.coinPool) {
            mesh = this.assets.coin.clone();
            type = "coin";
        } else {
            mesh = this.assets.dartboard.clone();
            type = "powerup";
        }
        
        mesh.visible = true;
        this.scene.add(mesh);
        const newItem = new ObstacleItem(mesh, this.scene);
        newItem.type = type === "coin" ? Config.OBSTACLE_TYPE.COIN : 
                      type === "powerup" ? "POWERUP" : null;
        newItem.setActive(true);
        poolArray.push(newItem);
        return newItem;
    }
    
    releaseToPool(item, poolArray) {
        item.setActive(false);
        item.mesh.visible = false;
    }
    
    spawnSet() {
        const lane = Math.floor(Math.random() * 3);
        const obstacleType = this.getRandomObstacleType();
        
        this.spawnObstacle(lane, obstacleType);
        
        if (Math.random() < Config.POWERUP_SPAWN_CHANCE) {
            const powerUpLane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
            this.spawnPowerUp(powerUpLane);
        } else if (this.difficultyLevel >= 3 && Math.random() > 0.6) {
            const secondLane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
            this.spawnObstacle(secondLane, this.getRandomObstacleType());
        }
        
        const coinLane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
        for(let i = 0; i < 5; i++) {
            this.spawnCoin(coinLane, Config.SPAWN_Z - i * 3);
        }
    }

    getRandomObstacleType() {
        const rand = Math.random();
        if (rand < 0.33) {
            return Config.OBSTACLE_TYPE.BARRIER;
        } else if (rand < 0.66) {
            return Config.OBSTACLE_TYPE.WALL;
        } else {
            return Config.OBSTACLE_TYPE.BARREL;
        }
    }

    spawnObstacle(lane, type) {
        const obstacle = this.getFromPool(this.obstaclePool);
        obstacle.type = type;
        
        let positionY = 0;
        let scale = 1;
        let modelSource;
        
        switch (type) {
            case Config.OBSTACLE_TYPE.BARRIER:
                modelSource = this.assets.barrier;
                scale = 0.015;
                break;
                
            case Config.OBSTACLE_TYPE.WALL:
                modelSource = this.assets.car;
                positionY = 0;
                scale = 0.012;
                break;
                
            case Config.OBSTACLE_TYPE.BARREL: 
                modelSource = this.assets.barrel;
                positionY = 0;
                scale = 0.02;
                break;
                
            default:
                modelSource = this.assets.barrier;
                scale = 0.015;
        }

        // Actualizar modelo si es necesario
        if (obstacle.mesh !== modelSource) {
            this.scene.remove(obstacle.mesh);
            obstacle.mesh = modelSource.clone();
            obstacle.mesh.visible = true;
            this.scene.add(obstacle.mesh);
        }
        
        obstacle.mesh.position.x = (lane - 1) * Config.LANE_WIDTH;
        obstacle.mesh.position.y = positionY;
        obstacle.mesh.position.z = Config.SPAWN_Z;
        obstacle.mesh.scale.set(scale, scale, scale);
        
        this.obstacles.push(obstacle);
    }

    spawnCoin(lane, zPos) {
        const coin = this.getFromPool(this.coinPool);
        coin.type = Config.OBSTACLE_TYPE.COIN;
        
        coin.mesh.position.x = (lane - 1) * Config.LANE_WIDTH;
        coin.mesh.position.y = 1.5;
        coin.mesh.position.z = zPos;
        coin.mesh.scale.set(0.005, 0.005, 0.005);
        
        this.coins.push(coin);
    }

    spawnPowerUp(lane) {
        try {
            const powerUpType = Math.random() > 0.5 ? Config.POWERUP_TYPE.MAGNET : Config.POWERUP_TYPE.DOUBLE;
            
            let modelSource;
            
            switch (powerUpType) {
                case Config.POWERUP_TYPE.MAGNET:
                    modelSource = this.assets.dartboard;
                    break;
                    
                case Config.POWERUP_TYPE.DOUBLE:
                    modelSource = this.assets.pipeWrench;
                    break;
                    
                default:
                    console.error("❌ Tipo de power-up desconocido:", powerUpType);
                    return;
            }

            const powerUp = this.getFromPool(this.powerUpPool);
            powerUp.type = "POWERUP";
            powerUp.powerUpType = powerUpType;
            
            // Actualizar modelo si es necesario
            if (powerUp.mesh !== modelSource) {
                this.scene.remove(powerUp.mesh);
                powerUp.mesh = modelSource.clone();
                powerUp.mesh.visible = true;
                this.scene.add(powerUp.mesh);
            }
            
            powerUp.mesh.position.x = (lane - 1) * Config.LANE_WIDTH;
            powerUp.mesh.position.y = 1.6;
            powerUp.mesh.position.z = Config.SPAWN_Z;
            powerUp.mesh.scale.set(0.03, 0.03, 0.03);
            
            powerUp.mesh.castShadow = true;
            powerUp.mesh.receiveShadow = true;
            
            powerUp.originalY = powerUp.mesh.position.y;
            powerUp.floatTime = 0;
            
            this.powerUps.push(powerUp);
            
            console.log(`⚡ Power-up generado: ${powerUpType}`);
            
        } catch (error) {
            console.error("❌ Error al generar power-up:", error);
        }
    }

    update(deltaTime, speed, distance, playerPosition, activePowerUps) {
        this.updateDifficulty(distance);
        
        this.spawnTimer -= deltaTime;
        if (this.spawnTimer <= 0) {
            this.spawnSet();
            this.spawnTimer = this.baseSpawnRate / (this.difficultyLevel * 0.7) + Math.random() * 0.8;
        }

        // Actualizar obstáculos
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obstacle = this.obstacles[i];
            if (!obstacle.isActive) continue;
            
            obstacle.mesh.position.z += speed * deltaTime;
            obstacle.updateBoundingBox();

            if (obstacle.mesh.position.z > Config.DESPAWN_Z) {
                this.releaseToPool(obstacle, this.obstaclePool);
                this.obstacles.splice(i, 1);
            }
        }

        // Actualizar monedas
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];
            if (!coin.isActive) continue;
            
            coin.mesh.position.z += speed * deltaTime;
            coin.mesh.rotation.z += 5 * deltaTime;
            coin.updateBoundingBox();
            
            // Efecto de imán
            if (activePowerUps.magnet && activePowerUps.magnet.active) {
                const distanceToPlayer = Math.sqrt(
                    Math.pow(coin.mesh.position.x - playerPosition.x, 2) +
                    Math.pow(coin.mesh.position.z - playerPosition.z, 2)
                );
                
                if (distanceToPlayer < 10.0) {
                    const directionX = playerPosition.x - coin.mesh.position.x;
                    const directionZ = playerPosition.z - coin.mesh.position.z;
                    
                    coin.mesh.position.x += directionX * deltaTime * 15;
                    coin.mesh.position.z += directionZ * deltaTime * 15;
                }
            }
            
            if (coin.mesh.position.z > Config.DESPAWN_Z) {
                this.releaseToPool(coin, this.coinPool);
                this.coins.splice(i, 1);
            }
        }

        // Actualizar power-ups
        for (let i = this.powerUps.length - 1; i >= 0; i--) {
            const powerUp = this.powerUps[i];
            if (!powerUp.isActive) continue;
            
            powerUp.mesh.position.z += speed * deltaTime;
            
            powerUp.floatTime += deltaTime;

            powerUp.mesh.rotation.y += deltaTime * 3;

            // Animación flotante
            powerUp.mesh.position.y = powerUp.originalY + Math.sin(powerUp.floatTime * 3) * 0.3;

            // Efecto de brillo
            if (powerUp.mesh.material) {
                const glowIntensity = (Math.sin(powerUp.floatTime * 10) + 1) * 0.3 + 0.4;
                if (powerUp.powerUpType === Config.POWERUP_TYPE.MAGNET) {
                    powerUp.mesh.material.emissive = new THREE.Color(0xFF0000).multiplyScalar(glowIntensity);
                } else {
                    powerUp.mesh.material.emissive = new THREE.Color(0xFFFF00).multiplyScalar(glowIntensity);
                }
            }
            
            powerUp.updateBoundingBox();
            
            if (powerUp.mesh.position.z > Config.DESPAWN_Z) {
                this.releaseToPool(powerUp, this.powerUpPool);
                this.powerUps.splice(i, 1);
            }
        }
    }

    updateDifficulty(distance) {
        const newDifficulty = Math.floor(distance / Config.DIFFICULTY_INTERVAL) + 1;
        if (newDifficulty > this.difficultyLevel) {
            this.difficultyLevel = newDifficulty;
        }
    }

    reset() {
        console.log("🔄 Reseteando ObstacleManager...");

        // Liberar todos los objetos activos
        this.obstacles.forEach(obstacle => {
            this.releaseToPool(obstacle, this.obstaclePool);
        });
        
        this.coins.forEach(coin => {
            this.releaseToPool(coin, this.coinPool);
        });
        
        this.powerUps.forEach(powerUp => {
            this.releaseToPool(powerUp, this.powerUpPool);
        });

        this.obstacles = [];
        this.coins = [];
        this.powerUps = [];

        this.spawnTimer = 2;
        this.difficultyLevel = 1;
        
        console.log(`✅ ObstacleManager reiniciado`);
    } 
    
    collectCoin(coin) {
        if (!coin || !coin.isActive) {
            console.warn("⚠️ Intento de recolectar moneda inválida");
            return;
        }
        
        this.releaseToPool(coin, this.coinPool);
        const index = this.coins.indexOf(coin);
        if (index > -1) {
            this.coins.splice(index, 1);
        }
    }

    collectPowerUp(powerUp) {
        if (!powerUp || !powerUp.isActive) {
            console.error("❌ Power-up inválido en collectPowerUp");
            return null;
        }
        
        if (!powerUp.powerUpType) {
            console.error("❌ Power-up sin tipo definido:", powerUp);
            return null;
        }
        
        const powerUpType = powerUp.powerUpType;
        
        this.releaseToPool(powerUp, this.powerUpPool);
        
        const index = this.powerUps.indexOf(powerUp);
        if (index > -1) {
            this.powerUps.splice(index, 1);
        }
        
        return powerUpType;
    }
    
    // Método para debug
    getPoolStats() {
        const activeObstacles = this.obstaclePool.filter(o => o.isActive).length;
        const activeCoins = this.coinPool.filter(c => c.isActive).length;
        const activePowerUps = this.powerUpPool.filter(p => p.isActive).length;
        
        return {
            totalObstacles: this.obstaclePool.length,
            activeObstacles: activeObstacles,
            totalCoins: this.coinPool.length,
            activeCoins: activeCoins,
            totalPowerUps: this.powerUpPool.length,
            activePowerUps: activePowerUps,
            arrays: {
                obstacles: this.obstacles.length,
                coins: this.coins.length,
                powerUps: this.powerUps.length
            }
        };
    }
}