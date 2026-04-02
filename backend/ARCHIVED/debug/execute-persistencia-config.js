#!/usr/bin/env node

/**
 * SCRIPT: execute-persistencia-config.js
 * PROPÓSITO: Ejecutar la migración para tabla de configuración
 * USO: node execute-persistencia-config.js
 * 
 * Este script:
 * 1. Crea la tabla sorteo_configuracion en Supabase
 * 2. Inserta la configuración inicial
 * 3. Verifica que todo esté bien
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./db');
const fs = require('fs');

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = (color, text) => console.log(`${color}${text}${colors.reset}`);

async function ejecutar() {
    log(colors.cyan, '\n═════════════════════════════════════════════════════════════');
    log(colors.cyan, '   🔧 CONFIGURAR PERSISTENCIA EN SUPABASE');
    log(colors.cyan, '═════════════════════════════════════════════════════════════\n');

    try {
        // 📊 PASO 1: Verificar / crear tabla
        log(colors.blue, '📊 PASO 1: Verificar tabla sorteo_configuracion...');
        
        const tableExists = await db.schema.hasTable('sorteo_configuracion');
        
        if (!tableExists) {
            log(colors.yellow, '   ⚠️  Tabla no existe, creando...');
            
            await db.schema.createTable('sorteo_configuracion', (table) => {
                table.increments('id').primary();
                table.string('clave', 100).notNullable().unique();
                table.jsonb('valor').notNullable().defaultTo('{}');
                table.string('actualizado_por', 255).nullable();
                table.timestamps(true, true);
                table.index('clave');
                table.index('updated_at');
            });
            
            log(colors.green, '   ✅ Tabla creada exitosamente');
        } else {
            log(colors.green, '   ✅ Tabla ya existe');
        }

        // 📝 PASO 2: Insertar o actualizar config inicial
        log(colors.blue, '\n📝 PASO 2: Insertar configuración inicial...');
        
        // Cargar config.json como base
        let configBase;
        try {
            const configJson = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
            configBase = JSON.parse(configJson);
            log(colors.green, '   ✅ Configuración cargada desde config.json');
        } catch (e) {
            log(colors.yellow, '   ⚠️  No se pudo leer config.json, usando config por defecto');
            configBase = {
                cliente: { nombre: 'Mi Sorteo', id: 'DEFAULT' },
                rifa: { nombreSorteo: 'Sorteo', totalBoletos: 1000, precioBoleto: 4 }
            };
        }

        // Insertar o actualizar
        const existeRegistro = await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .first();

        if (existeRegistro) {
            log(colors.yellow, '   ℹ️  Registro ya existe, actualizando...');
            
            await db('sorteo_configuracion')
                .where('clave', 'config_principal')
                .update({
                    valor: configBase,
                    actualizado_por: 'MIGRATION_SETUP'
                });
            
            log(colors.green, '   ✅ Configuración actualizada');
        } else {
            log(colors.yellow, '   ℹ️  Creando nuevo registro...');
            
            await db('sorteo_configuracion').insert({
                clave: 'config_principal',
                valor: configBase,
                actualizado_por: 'MIGRATION_SETUP'
            });
            
            log(colors.green, '   ✅ Configuración insertada');
        }

        // ✅ PASO 3: Verificar
        log(colors.blue, '\n✅ PASO 3: Verificar datos guardados...');
        
        const registro = await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .first();

        if (registro) {
            const valor = typeof registro.valor === 'string' 
                ? JSON.parse(registro.valor) 
                : registro.valor;
            
            log(colors.green, '   ✅ Registro encontrado en BD:');
            log(colors.cyan, `     - Clave: ${registro.clave}`);
            log(colors.cyan, `     - Cliente: ${valor?.cliente?.nombre || 'N/A'}`);
            log(colors.cyan, `     - Sorteo: ${valor?.rifa?.nombreSorteo || 'N/A'}`);
            log(colors.cyan, `     - Actualizado por: ${registro.actualizado_por}`);
            log(colors.cyan, `     - Última actualización: ${registro.updated_at}`);
        } else {
            log(colors.red, '   ❌ ERROR: No se encontró registro en BD');
            process.exit(1);
        }

        // 📊 PASO 4: Estadísticas
        log(colors.blue, '\n📊 PASO 4: Estadísticas de la tabla...');
        
        const count = await db('sorteo_configuracion').count('* as total').first();
        log(colors.cyan, `   Total de registros: ${count.total}`);

        // ✅ RESUMEN
        log(colors.green, '\n═════════════════════════════════════════════════════════════');
        log(colors.green, '   ✅ ¡CONFIGURACIÓN COMPLETADA EXITOSAMENTE!');
        log(colors.green, '═════════════════════════════════════════════════════════════\n');

        log(colors.cyan, '📋 Próximos pasos:');
        log(colors.cyan, '   1. Actualizar server.js con ConfigManagerV2');
        log(colors.cyan, '   2. Reemplazar endpoint PATCH /api/admin/config');
        log(colors.cyan, '   3. Reiniciar el servidor');
        log(colors.cyan, '   4. Probar cambios en admin-configuracion.html\n');

        log(colors.yellow, '📖 Consulta SOLUCION-PERSISTENCIA-CONFIG.md para instrucciones detalladas\n');

        await db.destroy();
        process.exit(0);

    } catch (error) {
        log(colors.red, `\n❌ ERROR: ${error.message}\n`);
        console.error(error);
        await db.destroy();
        process.exit(1);
    }
}

ejecutar();
