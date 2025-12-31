#!/usr/bin/env node
/**
 * Script para RESTAURAR boletos de órdenes específicas
 * Marca los boletos como 'reservado' nuevamente
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

async function restaurarBoletos() {
    try {
        console.log('🔄 Restaurando boletos de órdenes incorrectamente liberadas...\n');

        // ÓRDENES A RESTAURAR (modificar esta lista según sea necesario)
        const ordenesARestaurar = ['SET-AA085', 'SET-AA080', 'SET-AA096'];

        // Obtener información de estas órdenes
        const ordenes = await db('ordenes')
            .whereIn('numero_orden', ordenesARestaurar)
            .select('id', 'numero_orden', 'boletos', 'estado');

        console.log(`✅ Encontradas ${ordenes.length} órdenes:\n`);

        let boletosRestauradosTotal = 0;

        for (const orden of ordenes) {
            console.log(`📋 ${orden.numero_orden} (Estado: ${orden.estado})`);

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
                console.log(`   ⚠️  Sin boletos para restaurar\n`);
                continue;
            }

            // Restaurar boletos a 'reservado'
            const actualizado = await db('boletos_estado')
                .whereIn('numero', boletos)
                .update({
                    estado: 'reservado',
                    numero_orden: orden.numero_orden,
                    reservado_en: new Date(),
                    updated_at: new Date()
                });

            console.log(`   ✅ Restaurados ${actualizado}/${boletos.length} boletos a 'reservado'\n`);
            boletosRestauradosTotal += actualizado;
        }

        console.log(`✅ COMPLETADO: ${boletosRestauradosTotal} boletos restaurados`);
        console.log(`\n⚠️  IMPORTANTE: Ahora debes cambiar el estado de estas órdenes al correcto:`);
        console.log(`   - Si tienen comprobante: estado = 'comprobante_recibido'`);
        console.log(`   - Si están esperando pago: estado = 'pendiente'`);
        
        await db.destroy();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error crítico:', error.message);
        process.exit(1);
    }
}

restaurarBoletos();
