// -----------------------------------------------------------------
// --- ObstacleItem.js (Clase base para Monedas y Obstáculos)
// -----------------------------------------------------------------

import * as THREE from 'three';

export class ObstacleItem {
    constructor(mesh, scene) {
        this.mesh = mesh;
        this.scene = scene;
        
        // Solo añadir a la escena si no está ya añadido
        if (this.mesh.parent !== this.scene) {
            this.scene.add(this.mesh);
        }

        this.boundingBox = new THREE.Box3();
        this.updateBoundingBox();
        
        // Para pooling
        this.isActive = true;
        this.type = null;
        this.powerUpType = null;
        this.originalY = 0;
        this.floatTime = 0;
    }

    updateBoundingBox() {
        if (this.mesh && this.isActive) {
            this.boundingBox.setFromObject(this.mesh);
        }
    }
    
    getBoundingBox() {
        return this.boundingBox;
    }

    removeFromScene() {
        if (this.mesh && this.mesh.parent === this.scene) {
            this.scene.remove(this.mesh);
        }
        this.isActive = false;
    }
    
    // Para pooling
    setActive(active) {
        this.isActive = active;
        if (this.mesh) {
            this.mesh.visible = active;
        }
    }
    
    reset() {
        this.isActive = true;
        if (this.mesh) {
            this.mesh.visible = true;
            this.mesh.position.set(0, 0, 0);
            this.mesh.rotation.set(0, 0, 0);
        }
        this.boundingBox.makeEmpty();
        this.type = null;
        this.powerUpType = null;
        this.floatTime = 0;
    }
}