#!/usr/bin/env node
/**
 * Script para liberar boletos de órdenes canceladas
 * Uso: node cleanup-canceled-orders.js
 */

const knex = require('knex');

const db = knex({
    client: 'pg',
    connection: {
        host: 'dpg-d58tsger433s73fg9360-a.virginia-postgres.render.com',
        port: 5432,
        user: 'yepyep_user',
        password: 'DjIxbuHvknTYTROQWGdJm6uPmob46Oay',
        database: 'yepyep',
        ssl: { rejectUnauthorized: false }
    }
});

async function limpiarOrdenesCarceladas() {
    try {
        console.log('🧹 Iniciando limpieza de órdenes canceladas...\n');
        console.log('⚠️  IMPORTANTE: Solo liberará órdenes SIN COMPROBANTE (expiradas automáticamente)\n');

        // PASO 1: Encontrar SOLO órdenes canceladas SIN comprobante (expiradas por timeout)
        // NO tocar órdenes con comprobante_recibido (esas deben procesarse manualmente)
        const ordenesCanceladas = await db('ordenes')
            .where('estado', 'cancelada')
            .whereNull('comprobante_path')  // ⭐ CRITICAL: Solo sin comprobante
            .select('id', 'numero_orden', 'boletos');

        console.log(`✅ Encontradas ${ordenesCanceladas.length} órdenes canceladas\n`);

        if (ordenesCanceladas.length === 0) {
            console.log('ℹ️  No hay órdenes canceladas para procesar');
            process.exit(0);
        }

        // PASO 2: Procesar cada orden
        let boletosLiberadosTotal = 0;
        let ordenesProcessadas = 0;

        for (const orden of ordenesCanceladas) {
            try {
                // Parsear boletos
                let boletos = [];
                
                if (Array.isArray(orden.boletos)) {
                    boletos = orden.boletos.map(n => {
                        const num = parseInt(n, 10);
                        return isNaN(num) ? null : num;
                    }).filter(n => n !== null);
                } else if (typeof orden.boletos === 'string') {
                    try {
                        boletos = JSON.parse(orden.boletos || '[]');
                        if (!Array.isArray(boletos)) boletos = [];
                    } catch (e) {
                        if (orden.boletos.length > 0) {
                            boletos = orden.boletos.split(',').map(n => {
                                const num = parseInt(n.trim(), 10);
                                return isNaN(num) ? null : num;
                            }).filter(n => n !== null);
                        }
                    }
                }

                if (boletos.length === 0) {
                    console.log(`⚠️  ${orden.numero_orden}: Sin boletos para liberar`);
                    continue;
                }

                // Liberar boletos
                const actualizado = await db('boletos_estado')
                    .whereIn('numero', boletos)
                    .whereIn('estado', ['reservado', 'vendido'])
                    .update({
                        estado: 'disponible',
                        numero_orden: null,
                        reservado_en: null,
                        vendido_en: null,
                        updated_at: new Date()
                    });

                if (actualizado > 0) {
                    console.log(`✅ ${orden.numero_orden}: ${actualizado}/${boletos.length} boletos liberados`);
                    boletosLiberadosTotal += actualizado;
                    ordenesProcessadas++;
                } else {
                    console.log(`⚠️  ${orden.numero_orden}: No se liberaron boletos (ya estaban disponibles)`);
                }
            } catch (error) {
                console.error(`❌ Error procesando ${orden.numero_orden}:`, error.message);
            }
        }

        console.log(`\n✅ COMPLETADO:`);
        console.log(`   - Órdenes procesadas: ${ordenesProcessadas}/${ordenesCanceladas.length}`);
        console.log(`   - Boletos liberados: ${boletosLiberadosTotal}`);
        
        await db.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error crítico:', error.message);
        process.exit(1);
    }
}

limpiarOrdenesCarceladas();
