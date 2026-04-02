# 📋 SOLUCIÓN: Configuración Persistente en Supabase

**Fecha:** Abril 2026  
**Problema:** Los cambios en admin-configuración se perdían al reiniciar Railway  
**Solución:** Almacenar configuración en Supabase en lugar del filesystem  

---

## 🎯 Qué se va a hacer

Cambiar de esto:
```
Admin cambia config → Escribe en config.json (filesystem de Railway)
→ Al reiniciar Railway → config.json vuelve a la versión del repo
```

A esto:
```
Admin cambia config → Escribe en tabla sorteo_configuracion de Supabase
→ Al reiniciar → Lee desde Supabase (cambios persisten)
```

---

## 📋 Pasos de Implementación

### PASO 1: Ejecutar la migración

```bash
cd backend
node -e "const db = require('./db'); const migration = require('./migrations/010_create_sorteo_configuracion'); migration.up(db).then(() => { console.log('✅ Migración completada'); process.exit(0); }).catch(e => { console.error('❌ Error:', e.message); process.exit(1); });"
```

O si tienes script de migraciones:
```bash
npm run migrate
```

**Verificar que la tabla se creó:**
```bash
# En Supabase console:
SELECT * FROM sorteo_configuracion;
```

---

### PASO 2: Actualizar server.js

**En la parte de imports (línea ~1-50):**

```javascript
// ANTES:
const configManager = require('./config-manager');
const ConfigManager = require('./config-manager');
const configManager = new ConfigManager();

// DESPUÉS:
const ConfigManagerV2 = require('./config-manager-v2');
let configManagerV2; // Se inicializa en startup
```

**En la sección de inicialización (línea ~3800+ donde está server startup):**

Busca la línea donde está:
```javascript
const server = app.listen(PORT, () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
});
```

Cambia a:
```javascript
const server = app.listen(PORT, async () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
    
    // 🟦 Inicializar ConfigManager V2 desde Supabase
    try {
        configManagerV2 = new ConfigManagerV2(db);
        await configManagerV2.inicializar();
        console.log('✅ ConfigManagerV2 inicializado y listo');
        console.log('   Info:', configManagerV2.getInfo());
    } catch (err) {
        console.error('❌ Error inicializando ConfigManagerV2:', err.message);
        console.log('⚠️  Continuando con config fallback...');
    }
});
```

---

### PASO 3: Reemplazar el endpoint PATCH /api/admin/config

**Ubicación:** `backend/server.js` línea ~1985

**Opción A: Reemplazar completamente**

Busca el endpoint actual:
```javascript
app.patch('/api/admin/config', verificarToken, async (req, res) => {
    // ... todo el código actual ...
});
```

Reemplázalo por el código en `patch-endpoint-mejorado.js`

**Opción B: Cambios mínimos en el endpoint existente**

Si prefieres cambios menores, ve a la línea donde hace:
```javascript
try {
    fs.writeFileSync(configPath, nuevoContenido, 'utf8');
    // ...
    configManager.load();
```

Reemplázalo por:
```javascript
// 💾 GUARDAR EN SUPABASE (NUEVO)
try {
    await configManagerV2.guardarEnBD(config, req.usuario.username);
    console.log('✅ Config guardada en Supabase');
    await configManagerV2.reload();
    // Ya NO guardamos en config.json
```

---

### PASO 4: Actualizar GET /api/admin/config (si existe)

Si tienes un endpoint GET para obtener la config actual:

**Antes:**
```javascript
app.get('/api/admin/config', verificarToken, (req, res) => {
    const config = require('./config.json');
    res.json(config);
});
```

**Después:**
```javascript
app.get('/api/admin/config', verificarToken, (req, res) => {
    const config = configManagerV2.getConfig();
    res.json({
        success: true,
        data: config,
        cargadoDesde: configManagerV2.esBD ? 'Supabase' : 'config.json (fallback)',
        version: configManagerV2.cacheVersion
    });
});
```

---

## 🧪 Pruebas

### Prueba 1: Verificar que se guarda

```bash
# En Supabase console:
SELECT * FROM sorteo_configuracion;

# Deberías ver un registro con:
# - clave: "config_principal"
# - valor: {...tu configuración...}
# - actualizado_por: usuario admin
# - updated_at: timestamp reciente
```

### Prueba 2: Cambiar config desde admin

1. Ve a admin-configuracion.html
2. Cambia algo (ej: nombre del sorteo)
3. Guarda
4. Verifica en Supabase que `updated_at` se actualiza

### Prueba 3: Reinicio persistencia

1. Haz un cambio en config desde admin
2. Detén el servidor: `Ctrl+C`
3. Inicia nuevamente: `npm start`
4. Verifica que el cambio sigue ahí

### Prueba 4: Fallback a config.json

Si quieres probar el fallback:
1. Apaga la BD o desconéctate del internet
2. Inicia el servidor
3. Debería cargar desde config.json
4. Los cambios se guardarán en memoria pero se perderán al reiniciar

---

## 📊 Estructura de la tabla

```sql
CREATE TABLE sorteo_configuracion (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100) NOT NULL UNIQUE,        -- ej: "config_principal"
    valor JSONB NOT NULL DEFAULT '{}',         -- La config completa en JSON
    actualizado_por VARCHAR(255),              -- Username del admin
    created_at TIMESTAMP,                      -- Cuándo se creó
    updated_at TIMESTAMP                       -- Cuándo se actualizó último
);
```

---

## 🔒 Seguridad

✅ **Lo que está protegido:**
- Solo admins pueden actualizar (verificarToken + rol check)
- Los cambios se auditan (actualizado_por)
- Se mantiene historial de updated_at

⚠️ **Consideración:** Si quieres auditoría completa:
```sql
-- Opción: Crear tabla de historial
CREATE TABLE sorteo_configuracion_historial (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(100),
    valor_anterior JSONB,
    valor_nuevo JSONB,
    actualizado_por VARCHAR(255),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Deployment a Railway

1. **Commit los cambios:**
```bash
git add backend/migrations/010_create_sorteo_configuracion.js
git add backend/config-manager-v2.js
git add backend/patch-endpoint-mejorado.js
git commit -m "✅ Persistencia de config en Supabase"
```

2. **Push a Railway** (se deployará automáticamente):
```bash
git push
```

3. **Railway ejecutará la migración automáticamente** (si tienes script de startup)

4. **Verifica los logs:**
```
✅ ConfigManagerV2 inicializado y listo
   Info: { cargadoDesde: 'Supabase', ... }
```

---

## ❌ Troubleshooting

### "ConfigManagerV2 is not defined"
**Causa:** No se inicializó en server startup  
**Solución:** Asegúrate de agregar el `await configManagerV2.inicializar()` en startup

### "No existe registro de configuración en BD"
**Normal:** Es la primera vez  
**Solución:** Se crea automáticamente. Verifica Supabase

### "Error conectando a BD, intentando fallback"
**Causa:** BD no disponible  
**Solución:** Carga desde config.json, pero los cambios se pierden al reiniciar

### Los cambios se pierden después de reiniciar
**Causa:** Se guardó en config.json en lugar de BD  
**Solución:** Verifica que el endpoint use `configManagerV2.guardarEnBD()`

---

## 📝 Próximas mejoras opcional

1. **Historial de cambios** - Tabla de auditoría
2. **Backup automático de config** - Antes de actualizar
3. **Versionado de config** - Poder revertir a versiones anteriores
4. **Caché Redis** - Para lecturas rápidas (opcional)
5. **Webhooks** - Notificar cambios al frontend en tiempo real

---

**¿Preguntas?** Revisa los logs en Railway para detalles de errores.
