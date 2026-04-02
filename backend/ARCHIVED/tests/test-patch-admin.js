#!/usr/bin/env node

/**
 * Test: Cambiar config desde API y verificar que se guarda
 */

const http = require('http');
const db = require('./db');

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
            },
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(body), raw: body });
                } catch (e) {
                    resolve({ status: res.statusCode, body, raw: body });
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    try {
        console.log('\n🔧 TEST: Cambiar config y verificar que se guarda\n');

        // PASO 1: Login
        console.log('📝 PASO 1: Login con admin...');
        const loginRes = await request('POST', '/api/admin/login', {
            username: 'admin',
            password: 'admin123456'
        });

        if (loginRes.status !== 200) {
            console.log('❌ Login falló:', loginRes.body);
            process.exit(1);
        }

        const token = loginRes.body.token;
        console.log('✅ Login exitoso');

        // PASO 2: Leer config actual
        console.log('\n📊 PASO 2: Leer config actual...');
        const getRes = await request('GET', '/api/admin/config', null, {
            'Authorization': `Bearer ${token}`
        });

        if (getRes.status !== 200) {
            console.log('❌ GET falló:', getRes.body);
            process.exit(1);
        }

        const configActual = getRes.body.data || getRes.body;
        const nombreAnterior = configActual.cliente?.nombre;
        console.log(`✅ Config leída. Cliente actual: "${nombreAnterior}"`);

        // PASO 3: Hacer cambio
        const nombreNuevo = 'TEST-' + Date.now();
        console.log(`\n📝 PASO 3: Cambiar nombre a "${nombreNuevo}"...`);

        const patchRes = await request('PATCH', '/api/admin/config', {
            cliente: {
                nombre: nombreNuevo
            }
        }, {
            'Authorization': `Bearer ${token}`
        });

        console.log(`Status: ${patchRes.status}`);
        if (patchRes.status !== 200) {
            console.log('❌ PATCH falló:');
            console.log(JSON.stringify(patchRes.body, null, 2));
            process.exit(1);
        }

        console.log('✅ PATCH enviado exitosamente');
        console.log(`   Respuesta: ${patchRes.body.success ? '✅ Success' : '❌ Failed'}`);

        // PASO 4: Verificar en BD
        await new Promise(r => setTimeout(r, 500));
        console.log('\n🟦 PASO 4: Verificar en BD...');

        const regBD = await db('sorteo_configuracion')
            .where('clave', 'config_principal')
            .first();

        const configBD = typeof regBD.valor === 'string'
            ? JSON.parse(regBD.valor)
            : regBD.valor;

        const nombreEnBD = configBD.cliente?.nombre;
        console.log(`BD tiene: "${nombreEnBD}"`);

        if (nombreEnBD === nombreNuevo) {
            console.log('✅ ¡GUARDADO EN BD CORRECTAMENTE!');
        } else {
            console.log(`❌ Mismatch: esperaba "${nombreNuevo}", BD tiene "${nombreEnBD}"`);
        }

        // PASO 5: GET nuevamente para verificar que el server lo ve
        await new Promise(r => setTimeout(r, 500));
        console.log('\n✅ PASO 5: GET nuevamente para verificar...');

        const getRes2 = await request('GET', '/api/admin/config', null, {
            'Authorization': `Bearer ${token}`
        });

        const configFinal = getRes2.body.data || getRes2.body;
        const nombreEnServer = configFinal.cliente?.nombre;

        console.log(`Server tiene: "${nombreEnServer}"`);

        if (nombreEnServer === nombreNuevo) {
            console.log('✅ ¡TODO FUNCIONA PERFECTAMENTE!');
        } else {
            console.log(`❌ Mismatch en servidor: esperaba "${nombreNuevo}", server tiene "${nombreEnServer}"`);
        }

        console.log('\n═══════════════════════════════════════════');
        if (nombreEnBD === nombreNuevo && nombreEnServer === nombreNuevo) {
            console.log('🎉 SISTEMA FUNCIONANDO CORRECTAMENTE');
        } else {
            console.log('⚠️  HAY UN PROBLEMA - Ver arriba');
        }
        console.log('═══════════════════════════════════════════\n');

        await db.destroy();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        await db.destroy();
        process.exit(1);
    }
}

setTimeout(test, 2000);
