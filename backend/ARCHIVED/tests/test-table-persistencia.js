#!/usr/bin/env node

/**
 * Test Simple: Verificar que tabla sorteo_configuracion existe y tiene datos
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const db = require('./db');

async function test() {
    try {
        console.log('\n🟦 TEST SIMPLE: Verificar tabla sorteo_configuracion\n');

        // ✅ PASO 1: Verificar que tabla existe
        console.log('📝 PASO 1: Verificar que tabla existe...');
        const tableExists = await db.schema.hasTable('sorteo_configuracion');
        if (!tableExists) {
            throw new Error('❌ Tabla NO existe');
        }
        console.log('   ✅ Tabla sorteo_configuracion EXISTE');

        // ✅ PASO 2: Contar registros
        console.log('\n📝 PASO 2: Contar registros en tabla...');
        const count = await db('sorteo_configuracion').count('* as total').first();
        console.log(`   ✅ Total de registros: ${count.total}`);

        // ✅ PASO 3: Leer registro principal
        console.log('\n📝 PASO 3: Leer configuración principal...');
        const registro = await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .first();
        
        if (!registro) {
            throw new Error('❌ No existe registro config_principal');
        }

        console.log('   ✅ Registro encontrado');
        console.log(`      - Clave: ${registro.clave}`);
        
        const config = typeof registro.valor === 'string'
            ? JSON.parse(registro.valor)
            : registro.valor;
        
        console.log(`      - Cliente: ${config.cliente?.nombre}`);
        console.log(`      - Sorteo: ${config.rifa?.nombreSorteo}`);
        console.log(`      - Actualizado por: ${registro.actualizado_por}`);
        console.log(`      - Última actualización: ${registro.updated_at}`);

        // ✅ PASO 4: Hacer un cambio de prueba
        console.log('\n📝 PASO 4: Hacer cambio de prueba en BD...');
        
        const nombreOriginal = config.cliente?.nombre;
        const nombrePrueba = 'TEST-' + Date.now();
        
        config.cliente.nombre = nombrePrueba;
        
        await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .update({
                valor: config,
                actualizado_por: 'TEST_SCRIPT'
            });
        
        console.log(`   ✅ Cambio guardado: "${nombreOriginal}" → "${nombrePrueba}"`);

        // ✅ PASO 5: Verificar que se guardó
        console.log('\n📝 PASO 5: Verificar que el cambio se guardó...');
        const registroActualizado = await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .first();
        
        const configActualizado = typeof registroActualizado.valor === 'string'
            ? JSON.parse(registroActualizado.valor)
            : registroActualizado.valor;
        
        const nombreEnBD = configActualizado.cliente?.nombre;
        
        if (nombreEnBD === nombrePrueba) {
            console.log(`   ✅ Cambio verificado: "${nombreEnBD}"`);
        } else {
            throw new Error(`❌ Mismatch: esperaba "${nombrePrueba}", BD tiene "${nombreEnBD}"`);
        }

        // ✅ REVERTIR al valor original
        console.log('\n📝 PASO 6: Revertir al valor original...');
        config.cliente.nombre = nombreOriginal;
        await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .update({
                valor: config,
                actualizado_por: 'TEST_SCRIPT_REVERT'
            });
        console.log(`   ✅ Revertido a: "${nombreOriginal}"`);

        // 🎉 RESUMEN
        console.log('\n' + '═'.repeat(60));
        console.log('🎉 ✅ TODOS LOS TESTS PASARON');
        console.log('═'.repeat(60));
        console.log(`
   ✅ Tabla sorteo_configuracion existe
   ✅ Contiene ${count.total} registro(s)
   ✅ Config se puede leer desde BD
   ✅ Config se puede actualizar en BD
   ✅ Los cambios se verifican correctamente
   
   ✅ PERSISTENCIA EN BD FUNCIONANDO A LA PERFECCIÓN
        `);

        await db.destroy();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        await db.destroy();
        process.exit(1);
    }
}

test();
