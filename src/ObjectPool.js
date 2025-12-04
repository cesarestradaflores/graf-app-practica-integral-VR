// -----------------------------------------------------------------
// --- ObjectPool.js (Sistema de Pooling para Mejorar Rendimiento)
// -----------------------------------------------------------------

export class ObjectPool {
    constructor(createFn, resetFn = null, initialSize = 10) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.pool = [];
        this.activeObjects = new Set();
        
        // Crear objetos iniciales
        for (let i = 0; i < initialSize; i++) {
            this.pool.push(this.createFn());
        }
        
        console.log(`✅ ObjectPool creado con ${initialSize} objetos iniciales`);
    }
    
    get() {
        let obj;
        
        if (this.pool.length > 0) {
            obj = this.pool.pop();
        } else {
            console.log("⚠️ Pool vacío, creando nuevo objeto");
            obj = this.createFn();
        }
        
        if (this.resetFn) {
            this.resetFn(obj);
        }
        
        this.activeObjects.add(obj);
        return obj;
    }
    
    release(obj) {
        if (!this.activeObjects.has(obj)) {
            console.warn("⚠️ Intento de liberar objeto no activo");
            return;
        }
        
        this.activeObjects.delete(obj);
        this.pool.push(obj);
    }
    
    releaseAll() {
        for (const obj of this.activeObjects) {
            this.pool.push(obj);
        }
        this.activeObjects.clear();
    }
    
    getStats() {
        return {
            poolSize: this.pool.length,
            activeCount: this.activeObjects.size,
            total: this.pool.length + this.activeObjects.size
        };
    }
    
    clear() {
        this.pool = [];
        this.activeObjects.clear();
    }
}