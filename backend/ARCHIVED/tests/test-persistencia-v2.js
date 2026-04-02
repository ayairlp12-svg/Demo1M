#!/usr/bin/env node

/**
 * Script de prueba: Verificar persistencia de config en BD
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const db = require('./db');

const API = 'http://localhost:5001';
let adminToken = null;

function request(method, path, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 5001,
            path,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

test();

async function test() {
    try {
        let nombreOriginal = null;
        let esloganOriginal = null;

        // 🔐 PASO 1: Obtener token de admin
        console.log('\n🔐 PASO 1: Obtener JWT de admin...');
        
        let loginRes = await request('POST', '/api/admin/login', {
            username: 'admin',
            password: 'admin123456'
        });
        
        if (loginRes.status !== 200) {
            throw new Error(`Login admin falló. Status=${loginRes.status}, body=${JSON.stringify(loginRes.body)}. Asegúrate de tener un usuario admin válido antes de correr esta prueba.`);
        }

        adminToken = loginRes.body.token;
        console.log('   ✅ Token obtenido', adminToken.substring(0, 20) + '...');

        const registroInicial = await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .first();

        if (!registroInicial) {
            throw new Error('No se encontró config_principal antes de iniciar la prueba');
        }

        const configInicial = typeof registroInicial.valor === 'string'
            ? JSON.parse(registroInicial.valor)
            : registroInicial.valor;

        nombreOriginal = configInicial.cliente?.nombre || '';
        esloganOriginal = configInicial.cliente?.eslogan || '';

        // 📝 PASO 2: Enviar cambios al config
        console.log('\n📝 PASO 2: Enviar PATCH con cambios de prueba...');
        
        const cambiosPrueba = {
            cliente: {
                nombre: 'TEST - ' + new Date().toISOString().split('T')[0],
                eslogan: 'Prueba de persistencia en BD ✅'
            }
        };
        
        console.log('   Enviando:', JSON.stringify(cambiosPrueba));
        
        const patchRes = await request('PATCH', '/api/admin/config', cambiosPrueba, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (patchRes.status === 200) {
            console.log('   ✅ PATCH enviado exitosamente');
        } else {
            console.log(`   ❌ Error ${patchRes.status}:`, patchRes.body);
        }

        // 🟦 PASO 3: Verificar en BD que se guardó
        console.log('\n🟦 PASO 3: Verificar configuración en BD...');
        
        const registroDB = await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .first();
        
        if (!registroDB) {
            throw new Error('No se encontró registro en BD');
        }
        
        const configEnBD = typeof registroDB.valor === 'string'
            ? JSON.parse(registroDB.valor)
            : registroDB.valor;
        
        const clienteEnBD = configEnBD.cliente?.nombre;
        const esperado = cambiosPrueba.cliente.nombre;
        
        if (clienteEnBD === esperado) {
            console.log(`   ✅ GUARDADO EN BD CORRECTAMENTE`);
            console.log(`      - Nombre: ${clienteEnBD}`);
            console.log(`      - Eslogan: ${configEnBD.cliente?.eslogan}`);
            console.log(`      - Actualizado por: ${registroDB.actualizado_por}`);
        } else {
            console.log(`   ❌ No coincide:`);
            console.log(`      - Esperaba: ${esperado}`);
            console.log(`      - BD tiene: ${clienteEnBD}`);
        }

        // ✅ PASO 4: GET /api/admin/config para verificar que el server ve el cambio
        console.log('\n✅ PASO 4: GET /api/admin/config desde servidor...');
        
        const getRes = await request('GET', '/api/admin/config', null, {
            'Authorization': `Bearer ${adminToken}`
        });

        const configServer = getRes.body.data?.cliente?.nombre || 
                           getRes.body.cliente?.nombre;
        
        console.log(`      - Nombre en servidor: ${configServer}`);
        console.log(`      - Cargado desde: ${getRes.body.cargadoDesde || '(BD)'}`);

        // ✅ PASO 5: GET /api/public/config
        console.log('\n✅ PASO 5: GET /api/public/config...');
        const publicRes = await request('GET', '/api/public/config');
        const nombrePublico = publicRes.body.data?.rifa?.nombreSorteo;
        const precioPublico = publicRes.body.data?.precioBoleto;
        console.log(`      - nombre sorteo público: ${nombrePublico}`);
        console.log(`      - precio público: ${precioPublico}`);

        // ✅ PASO 6: GET /api/cliente
        console.log('\n✅ PASO 6: GET /api/cliente...');
        const clienteRes = await request('GET', '/api/cliente');
        const nombreClienteEndpoint = clienteRes.body.data?.cliente?.nombre;
        console.log(`      - nombre cliente en /api/cliente: ${nombreClienteEndpoint}`);

        // ✅ PASO 7: Revertir cambios
        console.log('\n✅ PASO 7: Revertir cambios de prueba...');
        await request('PATCH', '/api/admin/config', {
            cliente: {
                nombre: nombreOriginal,
                eslogan: esloganOriginal
            }
        }, {
            'Authorization': `Bearer ${adminToken}`
        });
        console.log(`      - nombre restaurado a: ${nombreOriginal}`);

        // 🎉 RESUMEN
        console.log('\n' + '═'.repeat(60));
        console.log('🎉 RESUMEN');
        console.log('═'.repeat(60));
        
        const exitosa = clienteEnBD === esperado;
        
        console.log(`
   ✅ Autenticación: OK
   ✅ PATCH enviado: OK
   ${clienteEnBD === esperado ? '✅' : '❌'} Guardado en BD: ${exitosa ? 'OK (' + clienteEnBD + ')' : 'FALLÓ'}
   ${configServer === esperado ? '✅' : '❌'} /api/admin/config: ${configServer === esperado ? 'OK' : 'NO'}
   ${nombreClienteEndpoint === esperado ? '✅' : '❌'} /api/cliente: ${nombreClienteEndpoint === esperado ? 'OK' : 'NO'}
   ${publicRes.status === 200 ? '✅' : '❌'} /api/public/config: ${publicRes.status === 200 ? 'OK' : 'NO'}
   
   ${exitosa && configServer === esperado && nombreClienteEndpoint === esperado ? '🎉 PERSISTENCIA ✅ FUNCIONANDO CORRECTAMENTE' : '⚠️  Revisar errores'}
        `);

        await db.destroy();
        process.exit(exitosa && configServer === esperado && nombreClienteEndpoint === esperado ? 0 : 1);

    } catch (error) {
        console.error('\n❌ ERROR EN PRUEBA:', error.message);
        await db.destroy();
        process.exit(1);
    }
}
