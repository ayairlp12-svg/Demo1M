/**
 * ADMIN RULETAZO - LÓGICA PRINCIPAL
 * Sistema de máquina de ruleta para sorteos administrativos
 */

class RuletazoMachine {
    constructor() {
        this.currentRifa = null;
        this.drawnNumbers = [];
        this.isSpinning = false;
        this.digitCount = 0;
        this.apiBase = (window.rifaplusConfig?.backend?.apiBase) || 'http://localhost:3000';
        this.authToken = localStorage.getItem('adminToken');
        this.participantsMode = 'all'; // 'all' o 'sold'
    }

    /**
     * Calcula cantidad de dígitos necesarios según el rango
     */
    calculateDigits(maxNumber) {
        if (maxNumber <= 9) return 1;
        if (maxNumber <= 99) return 2;
        if (maxNumber <= 999) return 3;
        if (maxNumber <= 9999) return 4;
        if (maxNumber <= 99999) return 5;
        return 6;
    }

    /**
     * Formatea número con ceros iniciales
     */
    formatNumber(num, digits) {
        return String(num).padStart(digits, '0');
    }

    /**
     * Obtiene lista de rifas activas del backend
     */
    async loadActiveRifas() {
        try {
            // Cargar boletos disponibles para ver qué rifas están activas
            const response = await fetch(`${this.apiBase}/api/public/boletos`);

            if (response.ok) {
                const data = await response.json();
                // Agrupar por rifa
                const rifas = {};
                if (data.data && Array.isArray(data.data)) {
                    data.data.forEach(boleto => {
                        if (!rifas[boleto.rifaId]) {
                            rifas[boleto.rifaId] = {
                                id: boleto.rifaId,
                                name: boleto.rifaNombre || `Rifa ${boleto.rifaId}`
                            };
                        }
                    });
                }
                return Object.values(rifas) || [];
            }
        } catch (error) {
            // Backend no disponible
        }

        // Datos de demostración si el backend falla
        return [
            { id: '1', name: 'iPhone 15 Pro Max 256GB' },
            { id: '2', name: 'Samsung Galaxy S24' },
            { id: '3', name: 'MacBook Pro 14"' }
        ];
    }

    /**
     * Carga datos de una rifa específica
     */
    async loadRifa(rifaId) {
        try {
            // Cargar boletos del backend usando endpoint correcto
            const response = await fetch(`${this.apiBase}/api/public/boletos`);

            if (response.ok) {
                const data = await response.json();
                // El endpoint devuelve { sold: [...], reserved: [...] }
                const boletosData = data.data || {};
                const soldNumbers = boletosData.sold || [];
                const reservedNumbers = boletosData.reserved || [];
                
                if (soldNumbers.length > 0 || reservedNumbers.length > 0) {
                    const config = window.rifaplusConfig || {};
                    const totalBoletos = config.rifa?.totalBoletos || 500;
                    this.currentRifa = {
                        id: rifaId,
                        name: this.getSelectedRifaName(rifaId),
                        totalNumbers: totalBoletos, // Dinámico desde config
                        soldNumbers: Array.from(soldNumbers).sort((a, b) => a - b), // ⭐ SOLO vendidos
                        reservedNumbers: Array.from(reservedNumbers).sort((a, b) => a - b) // ⭐ SOLO apartados
                    };
                    await this.loadDrawnNumbers(rifaId);
                    return this.currentRifa;
                }
            }
        } catch (error) {
            // Backend no disponible, usar datos locales
        }

        // Datos de demostración
        const config = window.rifaplusConfig || {};
        const totalBoletos = config.rifa?.totalBoletos || 500;
        this.currentRifa = {
            id: rifaId,
            name: this.getSelectedRifaName(rifaId),
            totalNumbers: totalBoletos,
            soldNumbers: this.generateSoldNumbers(50, totalBoletos)
        };
        
        this.drawnNumbers = [];
        return this.currentRifa;
    }

    /**
     * Obtiene el nombre de la rifa seleccionada
     */
    getSelectedRifaName(rifaId) {
        const names = {
            '1': 'iPhone 15 Pro Max 256GB',
            '2': 'Samsung Galaxy S24',
            '3': 'MacBook Pro 14"'
        };
        return names[rifaId] || 'Rifa Demo';
    }

    /**
     * Genera números vendidos de demostración
     * ⚠️ GARANTIZA: num siempre estará entre 1 y max (totalBoletos)
     */
    generateSoldNumbers(count, max) {
        const sold = [];
        while (sold.length < count && sold.length < max) {
            const num = Math.floor(Math.random() * max) + 1;
            if (!sold.includes(num)) {
                sold.push(num);
            }
        }
        return sold.sort((a, b) => a - b);
    }

    /**
     * Carga números ya sorteados
     */
    async loadDrawnNumbers(rifaId) {
        try {
            // Intentar cargar del localStorage primero
            const stored = localStorage.getItem(`draws_${rifaId}`);
            if (stored) {
                this.drawnNumbers = JSON.parse(stored);
                return;
            }
        } catch (error) {
            // Error leyendo sorteos locales
        }
        
        // Inicializar vacío si no hay datos locales
        this.drawnNumbers = [];
    }

    /**
     * Realiza un sorteo real
     */
    async performRealDraw() {
        try {
            // VALIDACIONES
            if (!this.currentRifa) {
                this.showNotification('Selecciona una rifa primero', 'warning');
                return null;
            }

            const availableNumbers = this.getAvailableNumbers();
            
            if (availableNumbers.length === 0) {
                this.showNotification('No hay números disponibles para sortear', 'error');
                return null;
            }

            // Seleccionar número aleatorio
            const selectedNumber = availableNumbers[
                Math.floor(Math.random() * availableNumbers.length)
            ];

            // Animar máquina
            await this.animateDraw(selectedNumber);

            // Guardar en backend (si está disponible)
            await this.saveDraw(selectedNumber);

            this.drawnNumbers.push(selectedNumber);
            this.showNotification(`¡Número ganador: ${selectedNumber}!`, 'success');

            return selectedNumber;
        } catch (error) {
            this.showNotification('Error realizando sorteo', 'error');
            return null;
        }
    }

    /**
     * Obtiene números disponibles para sortear según el modo de participantes
     * 
     * GARANTÍAS DE VALIDACIÓN:
     * - Modo 'all': Genera rango 1 a totalNumbers (desde config)
     * - Modo 'sold': Solo devuelve boletos que estén en soldNumbers (vendidos)
     * - Nunca incluye números ya sorteados (drawnNumbers)
     * - Todos los números son <= totalBoletos
     */
    getAvailableNumbers() {
        if (!this.currentRifa) {
            return [];
        }

        // Modo 'todos': todos los números del rango (1 a totalNumbers)
        if (this.participantsMode === 'all') {
            const allNumbers = [];
            for (let i = 1; i <= this.currentRifa.totalNumbers; i++) {
                if (!this.drawnNumbers.includes(i)) {
                    allNumbers.push(i);
                }
            }
            return allNumbers;
        }
        
        // Modo 'sold': solo números vendidos + apartados (no sorteados)
        if (this.participantsMode === 'sold') {
            const soldAndReserved = [
                ...(this.currentRifa.soldNumbers || []),
                ...(this.currentRifa.reservedNumbers || [])
            ];
            return soldAndReserved.filter(
                num => !this.drawnNumbers.includes(num)
            );
        }
        
        return [];
    }

    /**
     * Obtiene el total de números en el rango actual
     */
    getTotalParticipants() {
        if (!this.currentRifa) return 0;
        
        if (this.participantsMode === 'all') {
            return this.currentRifa.totalNumbers;
        } else if (this.participantsMode === 'sold') {
            const soldAndReserved = (this.currentRifa.soldNumbers?.length || 0) + (this.currentRifa.reservedNumbers?.length || 0);
            return soldAndReserved;
        }
        return 0;
    }

    /**
     * Anima la máquina para mostrar número
     */
    async animateDraw(targetNumber) {
        return new Promise((resolve) => {
            const machineDiv = document.getElementById('digitMachine');
            if (!machineDiv) {
                resolve();
                return;
            }

            const digitColumns = machineDiv.querySelectorAll('.digit-column');
            const formattedNumber = this.formatNumber(targetNumber, this.digitCount);

            this.isSpinning = true;
            this.updateStatus('spinning');

            let completed = 0;

            digitColumns.forEach((column, index) => {
                const targetDigit = parseInt(formattedNumber[index]);
                const digitNumbers = column.querySelector('.digit-numbers');

                if (!digitNumbers) {
                    completed++;
                    if (completed === digitColumns.length) {
                        this.isSpinning = false;
                        this.updateStatus('ready');
                        this.displayWinner(targetNumber);
                        resolve();
                    }
                    return;
                }

                // Reset posición
                digitNumbers.style.transform = 'translateY(0)';

                // Trigger animación con delay
                setTimeout(() => {
                    digitNumbers.classList.add('spinning');
                    
                    // Calcular posición final
                    const finalPosition = targetDigit * 40;
                    
                    setTimeout(() => {
                        digitNumbers.style.transform = `translateY(-${finalPosition}px)`;
                        digitNumbers.classList.remove('spinning');
                        
                        completed++;
                        if (completed === digitColumns.length) {
                            this.isSpinning = false;
                            this.updateStatus('ready');
                            this.displayWinner(targetNumber);
                            resolve();
                        }
                    }, 500);
                }, index * 100);
            });
        });
    }

    /**
     * Muestra número ganador
     */
    displayWinner(number) {
        const display = document.getElementById('winningDisplay');
        const numberEl = document.getElementById('winningNumber');
        
        if (!display || !numberEl) return;

        numberEl.textContent = this.formatNumber(number, this.digitCount);
        display.style.display = 'block';

        // Animar entrada
        display.style.animation = 'none';
        setTimeout(() => {
            display.style.animation = 'slideIn 0.5s ease-out';
        }, 10);
    }

    /**
     * Guarda sorteo en localStorage
     */
    async saveDraw(number) {
        try {
            if (!this.currentRifa) return false;

            // El número ya fue agregado en performRealDraw()
            // Solo guardamos en localStorage
            try {
                localStorage.setItem(`draws_${this.currentRifa.id}`, JSON.stringify(this.drawnNumbers));
                return true;
            } catch (e) {
                // No se pudo guardar
                return false;
            }
        } catch (error) {
            // Error al guardar sorteo
            return false;
        }
    }

    /**
     * Actualiza estado visual
     */
    updateStatus(status) {
        const statusBadge = document.querySelector('.status-badge');
        const statusTexts = {
            'ready': '✓ Listo',
            'spinning': '🎰 Girando...',
            'error': '⚠ Error'
        };

        if (statusBadge) {
            statusBadge.textContent = statusTexts[status] || status;
            statusBadge.classList.remove('spinning');
            if (status === 'spinning') {
                statusBadge.classList.add('spinning');
            }
        }
    }

    /**
     * Muestra notificación
     */
    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        const icons = {
            'success': 'fas fa-check-circle',
            'error': 'fas fa-exclamation-circle',
            'warning': 'fas fa-exclamation-triangle',
            'info': 'fas fa-info-circle'
        };

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="notification-icon ${icons[type]}"></i>
            <span class="notification-message">${message}</span>
            <button class="notification-close">×</button>
        `;

        container.appendChild(notification);

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 4000);
    }
}

// ============================================
// INICIALIZACIÓN Y EVENT LISTENERS
// ============================================

let machine = null;

document.addEventListener('DOMContentLoaded', async () => {
    machine = new RuletazoMachine();

    // Auto-cargar rifa actual en lugar de usar selector
    await loadCurrentRifa();

    // Event Listeners
    document.getElementById('testSpinBtn').addEventListener('click', testSpin);
    document.getElementById('performDrawBtn').addEventListener('click', performDraw);
    document.getElementById('resetMachineBtn').addEventListener('click', resetMachine);
    document.getElementById('exportHistoryBtn').addEventListener('click', exportHistory);
    document.getElementById('clearHistoryBtn').addEventListener('click', clearHistory);

    // Accordion Event Listeners
    const accordionBtn = document.getElementById('accordionBtn');
    const accordionContent = document.getElementById('accordionContent');
    const participantRadios = document.querySelectorAll('.participant-radio');

    if (accordionBtn) {
        accordionBtn.addEventListener('click', () => {
            accordionBtn.classList.toggle('active');
            accordionContent.classList.toggle('open');
        });
    }

    // Participant selection
    participantRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            machine.participantsMode = e.target.value;
            updateParticipantsCounts();
            updateMachineAvailability();
        });
    });

    // Cerrar modal al hacer click fuera del contenido
    const ticketModal = document.getElementById('ticketModal');
    if (ticketModal) {
        ticketModal.addEventListener('click', (e) => {
            if (e.target === ticketModal) {
                closeTicketModal();
            }
        });
    }
    
    // ===================================
    // SISTEMA REACTIVO: Escuchar cambios en configuración
    // ===================================
    if (window.rifaplusConfig && typeof window.rifaplusConfig.onChange === 'function') {
        window.rifaplusConfig.onChange(function(cambio) {
            // Si cambia el total de boletos, recargar rifa
            if (cambio.seccion === 'rifa' && cambio.campo === 'totalBoletos') {
                if (typeof loadCurrentRifa === 'function') {
                    loadCurrentRifa();
                }
            }
            
            // Si cambia el título, actualizar
            if (cambio.seccion === 'rifa' && cambio.campo === 'titulo') {
                if (typeof selectRifa === 'function') {
                    selectRifa('1');
                }
            }
        });
    }
});

/**
 * Carga la rifa actual/activa automáticamente desde config
 * ⚠️ NOTA: Ya no se carga desde el backend, se usa directamente config.js
 */
async function loadCurrentRifa() {
    try {
        // Obtener datos de la config
        const config = window.rifaplusConfig || {};
        const rifaTitle = config.rifa?.titulo || 'Sorteo en Vivo';
        let totalNumbers = config.rifa?.totalBoletos || 500;  // Config es fuente de verdad
        
        // Intentar obtener boletos reales del backend para contar los VENDIDOS y APARTADOS
        let soldNumbers = [];
        let reservedNumbers = [];
        
        try {
            const token = localStorage.getItem('rifaplus_admin_token') || 
                         localStorage.getItem('admin_token') || 
                         localStorage.getItem('token') || '';
            
            const response = await fetch(`${machine.apiBase}/api/admin/boletos?limit=0`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data && Array.isArray(data.data)) {
                    // Obtener boletos vendidos y apartados por separado
                    const allBoletos = data.data;
                    
                    // Separar vendidos de apartados
                    soldNumbers = allBoletos
                        .filter(b => b.estado && b.estado.toLowerCase().includes('vend'))
                        .map(b => b.numero)
                        .sort((a, b) => a - b);
                    
                    reservedNumbers = allBoletos
                        .filter(b => b.estado && b.estado.toLowerCase().includes('apart'))
                        .map(b => b.numero)
                        .sort((a, b) => a - b);
                }
            }
        } catch (error) {
            // No se pudo cargar boletos del backend
        }
        
        // Si no hay datos del backend, usar demostración
        if (soldNumbers.length === 0) {
            soldNumbers = machine.generateSoldNumbers(Math.floor(totalNumbers * 0.3), totalNumbers);
            reservedNumbers = [];
        }
        
        // Crear rifa con datos de config + datos reales del backend
        machine.currentRifa = {
            id: '1',
            name: rifaTitle,
            totalNumbers: totalNumbers,  // Siempre desde config
            soldNumbers: soldNumbers,      // ⭐ SOLO vendidos del backend
            reservedNumbers: reservedNumbers // ⭐ SOLO apartados del backend
        };
        
        await selectRifa('1');
    } catch (error) {
        // Fallback en caso de error
        const config = window.rifaplusConfig || {};
        machine.currentRifa = {
            id: '1',
            name: config.rifa?.titulo || 'Sorteo Demo',
            totalNumbers: config.rifa?.totalBoletos || 500,
            soldNumbers: machine.generateSoldNumbers(150, config.rifa?.totalBoletos || 500)
        };
        await selectRifa('1');
    }
}

/**
 * Selecciona una rifa
 */
async function selectRifa(rifaId) {
    const rifa = await machine.loadRifa(rifaId);
    
    if (!rifa) return;

    // Mostrar información
    // ⚠️ IMPORTANTE: totalBoletos SIEMPRE viene de config, NUNCA del backend
    const config = window.rifaplusConfig || {};
    const totalBoletos = config.rifa?.totalBoletos || 100000;  // Config es fuente de verdad
    const vendidos = rifa.soldNumbers?.length || 0;
    const sorteados = machine.drawnNumbers.length;
    const disponibles = totalBoletos - vendidos; // Disponibles = total - vendidos
    
    // Actualizar info panel
    // ⚠️ IMPORTANTE: El nombre SIEMPRE viene de config.js, no del servidor
    document.getElementById('rifaNombre').textContent = config.rifa?.titulo || 'Sin nombre';
    document.getElementById('rifaTotal').textContent = totalBoletos;
    document.getElementById('rifaVendidos').textContent = vendidos;
    document.getElementById('rifaSorteados').textContent = sorteados;
    document.getElementById('rifaDisponibles').textContent = disponibles;

    // Calcular dígitos basado en totalBoletos (que viene de config, no del backend)
    machine.digitCount = machine.calculateDigits(totalBoletos);
    document.getElementById('rifaDigitos').textContent = machine.digitCount;

    // Mostrar paneles
    document.getElementById('statsSection').style.display = 'grid';
    document.getElementById('machineSection').style.display = 'block';
    document.getElementById('historySection').style.display = 'block';

    // Inicializar modo de participantes (por defecto 'all')
    machine.participantsMode = 'all';
    document.querySelector('input[name="participants"][value="all"]').checked = true;
    updateParticipantsCounts();

    // Generar máquina
    generateMachine();

    // Habilitar botón de sorteo si hay números disponibles
    const availableCount = machine.getAvailableNumbers().length;
    document.getElementById('performDrawBtn').disabled = availableCount === 0;

    // Cargar historial
    loadHistory();
}

/**
 * Genera la máquina de ruleta
 */
function generateMachine() {
    const machineDiv = document.getElementById('digitMachine');
    machineDiv.innerHTML = '';

    for (let i = 0; i < machine.digitCount; i++) {
        const column = document.createElement('div');
        column.className = 'digit-column';

        const numberContainer = document.createElement('div');
        numberContainer.className = 'digit-numbers';

        // Crear números 0-9 para que el usuario pueda ver el "giro"
        for (let j = 0; j < 10; j++) {
            const digit = document.createElement('div');
            digit.className = 'digit-item';
            digit.textContent = j;
            numberContainer.appendChild(digit);
        }

        column.appendChild(numberContainer);
        machineDiv.appendChild(column);
    }

    // Resetear display ganador
    document.getElementById('winningDisplay').style.display = 'none';
    document.getElementById('drawCounter').textContent = `Sorteo #${machine.drawnNumbers.length + 1}`;
}

/**
 * Prueba animación de giro
 * ⚠️ IMPORTANTE: Selecciona un número válido según el modo de participantes
 */
async function testSpin() {
    if (machine.isSpinning) return;

    // Obtener números disponibles según el modo (all o sold)
    const availableNumbers = machine.getAvailableNumbers();
    
    if (availableNumbers.length === 0) {
        machine.showNotification('No hay números disponibles para probar', 'warning');
        return;
    }

    // Seleccionar número aleatorio de los disponibles
    const randomNumber = availableNumbers[
        Math.floor(Math.random() * availableNumbers.length)
    ];
    
    // Test spin
    await machine.animateDraw(randomNumber);
    machine.showNotification('Prueba de giro completada', 'info');
}

/**
 * Actualiza los conteos de participantes en el acordeón
 */
function updateParticipantsCounts() {
    if (!machine.currentRifa) return;

    const totalCount = machine.currentRifa.totalNumbers || 0;
    const soldCount = machine.currentRifa.soldNumbers?.length || 0;
    const reservedCount = machine.currentRifa.reservedNumbers?.length || 0;
    
    // Actualizar "Todos"
    document.getElementById('allCount').textContent = totalCount;

    // Actualizar "Vendidos" - SOLO VENDIDOS (sin apartados)
    // Los apartados se incluyen en la ruleta, pero el conteo mostrado es solo de vendidos
    document.getElementById('soldCount').textContent = soldCount;
    
    // Actualizar conteos
}

/**
 * Actualiza disponibilidad de máquina basado en modo de participantes
 */
function updateMachineAvailability() {
    if (!machine.currentRifa) return;

    // ⚠️ IMPORTANTE: totalBoletos SIEMPRE viene de config, NUNCA del backend
    const config = window.rifaplusConfig || {};
    const totalBoletos = config.rifa?.totalBoletos || 100000;  // Config es fuente de verdad
    const vendidos = machine.currentRifa.soldNumbers?.length || 0;
    const sorteados = machine.drawnNumbers.length;
    const disponibles = totalBoletos - vendidos; // Los disponibles son total - vendidos
    
    // Actualizar info panel con datos reales
    document.getElementById('rifaDisponibles').textContent = disponibles;
    
    // Habilitar/deshabilitar botón de sorteo basado en números disponibles para sortear
    const availableForDraw = machine.getAvailableNumbers().length;
    document.getElementById('performDrawBtn').disabled = availableForDraw === 0;
    
    // Mostrar mensaje si no hay disponibles
    if (availableForDraw === 0) {
        machine.showNotification('No hay más números disponibles en este modo', 'warning');
    }
}

/**
 * Realiza sorteo real
 */
async function performDraw() {
    if (machine.isSpinning) return;

    document.getElementById('performDrawBtn').disabled = true;
    const number = await machine.performRealDraw();
    
    if (number !== null) {
        // Actualizar información
        document.getElementById('rifaSorteados').textContent = machine.drawnNumbers.length;
        document.getElementById('rifaDisponibles').textContent = machine.getAvailableNumbers().length;
        document.getElementById('drawCounter').textContent = `Sorteo #${machine.drawnNumbers.length + 1}`;

        // Cargar historial
        loadHistory();

        // Habilitar/deshabilitar botón según disponibles
        const availableCount = machine.getAvailableNumbers().length;
        document.getElementById('performDrawBtn').disabled = availableCount === 0;
    } else {
        document.getElementById('performDrawBtn').disabled = false;
    }
}

/**
 * Reinicia la máquina
 */
function resetMachine() {
    if (machine.isSpinning) return;

    document.getElementById('winningDisplay').style.display = 'none';
    const columns = document.querySelectorAll('.digit-column');
    
    columns.forEach(column => {
        const numbers = column.querySelector('.digit-numbers');
        numbers.style.transform = 'translateY(0)';
    });

    machine.updateStatus('ready');
    machine.showNotification('Máquina reiniciada', 'info');
}

/**
 * Carga historial de sorteos
 */
async function loadHistory() {
    if (!machine.currentRifa) return;

    const historyList = document.getElementById('historyList');
    
    if (machine.drawnNumbers.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-inbox"></i>
                <p>No hay sorteos registrados aún</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = machine.drawnNumbers
        .slice()
        .reverse()
        .map((number, index) => {
            const formatted = machine.formatNumber(number, machine.digitCount);
            const time = new Date().toLocaleTimeString();
            
            return `
                <div class="history-item">
                    <div class="history-item-number">${formatted}</div>
                    <div class="history-item-info">
                        <span class="history-item-label">Sorteo #${machine.drawnNumbers.length - index}</span>
                        <span class="history-item-time">${time}</span>
                    </div>
                    <button class="btn btn-sm btn-outline" onclick="viewTicketDetails(${number})">Ver boleto</button>
                </div>
            `;
        })
        .join('');
}

/**
 * Exporta historial a CSV
 */
function exportHistory() {
    if (!machine.currentRifa || machine.drawnNumbers.length === 0) {
        machine.showNotification('No hay datos para exportar', 'warning');
        return;
    }

    let csv = 'Rifa,Número,Posición\n';
    
    machine.drawnNumbers.forEach((number, index) => {
        const formatted = machine.formatNumber(number, machine.digitCount);
        csv += `"${machine.currentRifa.name}","${formatted}",${index + 1}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-sorteos-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    machine.showNotification('Historial exportado', 'success');
}

/**
 * Limpia el historial de sorteos
 */
function clearHistory() {
    if (!machine.currentRifa) {
        machine.showNotification('Selecciona una rifa primero', 'warning');
        return;
    }

    if (machine.drawnNumbers.length === 0) {
        machine.showNotification('El historial ya está vacío', 'info');
        return;
    }

    // Confirmar antes de limpiar
    if (!confirm(`¿Estás seguro de que quieres limpiar el historial?\n\nEsto eliminará ${machine.drawnNumbers.length} número(s) sorteado(s) y los devolverá como disponibles.`)) {
        return;
    }

    // Limpiar números sorteados
    machine.drawnNumbers = [];

    // Guardar cambios en localStorage
    try {
        localStorage.setItem(`draws_${machine.currentRifa.id}`, JSON.stringify(machine.drawnNumbers));
    } catch (e) {
        // No se pudo guardar
    }

    // Actualizar interfaz
    updateParticipantsCounts();
    updateMachineAvailability();
    loadHistory();

    machine.showNotification('Historial limpiado. Los números están disponibles nuevamente', 'success');
}

/**
 * Ve los detalles de un boleto específico
 */
async function viewTicketDetails(ticketNumber) {
    const modal = document.getElementById('ticketModal');
    const modalBody = document.getElementById('ticketModalBody');
    
    modal.classList.add('active');
    modalBody.innerHTML = '<div class="spinner"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
    
    try {
        // Cargar TODAS las órdenes
        const apiBase = (window.rifaplusConfig?.backend?.apiBase) || 'http://127.0.0.1:5001';
        const token = localStorage.getItem('rifaplus_admin_token') || localStorage.getItem('admin_token') || '';
        const resOrdenes = await fetch(`${apiBase}/api/ordenes?limit=1000`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!resOrdenes.ok) {
            throw new Error('No se pudieron cargar las órdenes');
        }
        
        const dataOrdenes = await resOrdenes.json();
        const allOrdenes = dataOrdenes.data || [];
        
        // Buscar la orden que contiene este boleto
        let orden = null;
        for (const o of allOrdenes) {
            try {
                // Intentar diferentes formas de acceder a los boletos
                let boletos = [];
                
                if (Array.isArray(o.boletos)) {
                    boletos = o.boletos.map(b => String(Number(b)));
                } else if (typeof o.boletos === 'string') {
                    boletos = JSON.parse(o.boletos).map(b => String(Number(b)));
                }
                
                const ticketStr = String(ticketNumber);
                
                if (boletos.includes(ticketStr) || boletos.includes(String(ticketNumber))) {
                    orden = o;
                    break;
                }
            } catch (e) {
                // Error procesando orden
            }
        }
        
        const config = window.rifaplusConfig || {};
        const logoOrganizador = config.cliente?.logo || 'images/logo.png';
        const nombreSorteo = config.rifa?.titulo || 'Sorteo';
        const imagenPrincipal = config.rifa?.imagen || 'images/ImagenPrincipal.jpg';
        
        const numeroFormato = machine.formatNumber(ticketNumber, machine.digitCount);
        
        // Si hay orden, extraer datos; si no, datos vacíos (boleto disponible)
        let estadoOrden = 'disponible';
        let nombreCliente = 'N/A';
        let estadoRepublica = 'N/A';
        let ciudad = 'N/A';
        let cantidad = '1';
        let total = 'N/A';
        let fechaPago = '-----';
        let horaPago = '-----';
        let fechaComprobante = '-----';
        let horaComprobante = '-----';
        
        if (orden) {
            estadoOrden = 'vendido';
            nombreCliente = orden.nombre_cliente || 'N/A';
            estadoRepublica = orden.estado_cliente || 'N/A';
            ciudad = orden.ciudad_cliente || 'N/A';
            cantidad = orden.cantidad_boletos || '1';
            total = orden.total ? parseFloat(orden.total).toLocaleString('es-MX', {minimumFractionDigits: 2}) : 'N/A';
            fechaPago = orden.fecha_pago 
                ? new Date(orden.fecha_pago).toLocaleDateString('es-MX')
                : '-----';
            horaPago = orden.fecha_pago
                ? new Date(orden.fecha_pago).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})
                : '-----';
            fechaComprobante = orden.comprobante_pagado_at
                ? new Date(orden.comprobante_pagado_at).toLocaleDateString('es-MX')
                : '-----';
            horaComprobante = orden.comprobante_pagado_at
                ? new Date(orden.comprobante_pagado_at).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})
                : '-----';
        }
        
        const fechaCreacion = orden?.created_at
            ? new Date(orden.created_at).toLocaleDateString('es-MX')
            : '-----';
        const horaCreacion = orden?.created_at
            ? new Date(orden.created_at).toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit'})
            : '-----';
        
        const html = `
            <div class="ticket-card" style="max-width: 100%; margin: 0; border: 2px solid var(--primary); border-radius: 0.75rem; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);">
                <!-- HEADER SUPERIOR -->
                <div style="background: linear-gradient(135deg, var(--primary-light) 0%, #f0f2f5 100%); border-bottom: 2px solid var(--primary); display: flex; justify-content: space-between; align-items: center; padding: 1.5rem;">
                    <!-- Izquierda: Logo + Estado -->
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <img src="${logoOrganizador}" alt="Logo" style="height: 60px; width: 60px; object-fit: contain; border-radius: 0.5rem; flex-shrink: 0; background: white; padding: 0.5rem;" onerror="this.src='images/logo.png'">
                        <div style="background: var(--primary); color: white; padding: 0.6rem 1rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.05em; white-space: nowrap; text-transform: uppercase;">
                            ${estadoOrden === 'vendido' ? 'VENDIDO' : 'DISPONIBLE'}
                        </div>
                    </div>
                    <!-- Derecha: Número y Fecha/Hora -->
                    <div style="text-align: right;">
                        <div style="font-size: 1.75rem; font-weight: 900; color: var(--primary); font-family: 'Courier New', monospace; line-height: 1.2;">#${numeroFormato}</div>
                        <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 0.5rem; font-weight: 500;">${fechaCreacion} ${horaCreacion}</div>
                    </div>
                </div>

                <!-- NOMBRE SORTEO -->
                <div style="background: linear-gradient(135deg, var(--primary-light) 0%, white 100%); padding: 1rem; border-bottom: 1px solid var(--divider); text-align: center;">
                    <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em;">${nombreSorteo}</div>
                </div>

                <!-- IMAGEN PRINCIPAL -->
                <div style="background: linear-gradient(135deg, #f8fafc 0%, #f0f2f5 100%); padding: 1.5rem; text-align: center; border-bottom: 1px solid var(--divider);">
                    <img src="${imagenPrincipal}" alt="${nombreSorteo}" style="max-width: 100%; max-height: 150px; object-fit: contain; border-radius: 0.5rem;" onerror="this.src='images/logo.png'">
                </div>

                <!-- BODY PRINCIPAL -->
                <div style="padding: 1.5rem; background: white;">
                    <!-- SECCIÓN: CLIENTE -->
                    <div style="margin-bottom: 1.5rem;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-user-circle"></i> Cliente
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
                            <div style="padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem; border-left: 3px solid var(--primary);">
                                <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 0.25rem;">Nombre</div>
                                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-dark);">${nombreCliente}</div>
                            </div>
                            <div style="padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem; border-left: 3px solid var(--primary);">
                                <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 0.25rem;">Estado</div>
                                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-dark);">${estadoRepublica}</div>
                            </div>
                            <div style="padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem; border-left: 3px solid var(--primary); grid-column: 1 / -1;">
                                <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 0.25rem;">Ciudad</div>
                                <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-dark);">${ciudad}</div>
                            </div>
                        </div>
                    </div>

                    <!-- SECCIÓN: ORDEN -->
                    <div style="margin-bottom: 1.5rem;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-file-invoice"></i> Orden
                        </div>
                        <div style="padding: 0.75rem; background: #f9fafb; border-radius: 0.5rem; border-left: 3px solid var(--primary);">
                            <div style="font-size: 0.7rem; font-weight: 600; color: var(--text-light); text-transform: uppercase; margin-bottom: 0.25rem;">ID Orden</div>
                            <div style="font-size: 0.95rem; font-weight: 700; color: var(--primary);">${orden?.numero_orden || 'N/A'}</div>
                        </div>
                    </div>

                    <!-- SECCIÓN: COMPROBANTE -->
                    <div style="margin-bottom: 1.5rem; padding: 1rem; background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%); border-radius: 0.5rem; border-left: 3px solid #10b981;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: #059669; margin-bottom: 0.5rem; text-transform: uppercase; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-receipt"></i> Comprobante de Pago
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-dark); font-weight: 500;">${fechaComprobante} ${horaComprobante}</div>
                    </div>

                    <!-- ACCIONES -->
                    <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--divider);">
                        ${window.GanadoresManager?.verificarGanador(ticketNumber) 
                            ? `<button class="btn-action btn-ganador" onclick="markAsWinner(${ticketNumber})" style="flex: 1; padding: 0.75rem 1rem; background: #10b981; color: white; border: none; border-radius: 0.375rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.85rem;">
                                <i class="fas fa-check"></i> ✅ Desmarcar Ganador
                            </button>`
                            : `<button class="btn-action btn-ganador" onclick="markAsWinner(${ticketNumber})" style="flex: 1; padding: 0.75rem 1rem; background: var(--success); color: white; border: none; border-radius: 0.375rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.85rem;">
                                <i class="fas fa-crown"></i> Marcar Ganador
                            </button>`
                        }
                    </div>
                </div>
            </div>
        `;
        
        modalBody.innerHTML = html;
    } catch (error) {
        // Error cargando detalles del boleto
        modalBody.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle"></i>
                Error: ${error.message}
            </div>
        `;
    }
}

/**
 * Cierra el modal
 */
function closeTicketModal() {
    document.getElementById('ticketModal').classList.remove('active');
}

/**
 * Marca boleto como ganador
 */
async function markAsWinner(ticketNumber) {
    if (!confirm(`¿Confirmar que el boleto ${ticketNumber} es el ganador?`)) {
        return;
    }
    
    try {
        const apiBase = (window.rifaplusConfig?.backend?.apiBase) || 'http://127.0.0.1:5001';
        const token = localStorage.getItem('rifaplus_admin_token') || localStorage.getItem('admin_token') || '';
        const response = await fetch(`${apiBase}/api/admin/boleto/${ticketNumber}/ganador`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ganador: true })
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}`);
        }
        
        machine.showNotification('✅ Boleto marcado como ganador', 'success');
        setTimeout(() => viewTicketDetails(ticketNumber), 500);
    } catch (error) {
        machine.showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

/**
 * ===== FUNCIONES PARA GANADORES =====
 */

/**
 * Marcar número ganador como tal
 * @param {Number} numero - Número del boleto ganador
 */
window.markAsWinner = function(numero) {
    if (!window.GanadoresManager) {
        if (window.machine) {
            window.machine.showNotification('❌ Sistema de ganadores no disponible', 'error');
        } else {
            alert('❌ Sistema de ganadores no disponible');
        }
        return;
    }

    // Validar número
    numero = String(numero).trim();
    if (!numero || isNaN(numero)) {
        if (window.machine) {
            window.machine.showNotification('❌ Número de boleto inválido', 'error');
        } else {
            alert('❌ Número de boleto inválido');
        }
        return;
    }

    // Verificar si ya es ganador
    const ganadorExistente = window.GanadoresManager.verificarGanador(numero);
    if (ganadorExistente) {
        // Es ganador, mostrar opción para desmarcar
        const confirmar = confirm(`✅ Este boleto ya es ganador de ${ganadorExistente.tipo}.\n\n¿Deseas desmarcarlo como ganador?`);
        if (confirmar) {
            const resultado = window.GanadoresManager.eliminarGanador(numero, ganadorExistente.tipo);
            if (resultado) {
                if (window.machine) {
                    window.machine.showNotification(`✅ Boleto #${numero} desmarcado como ganador`, 'success');
                } else {
                    alert(`✅ Boleto #${numero} desmarcado como ganador`);
                }
                // Recargar modal
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            } else {
                if (window.machine) {
                    window.machine.showNotification('❌ Error al desmarcar ganador', 'error');
                } else {
                    alert('❌ Error al desmarcar ganador');
                }
            }
        }
        return;
    }

    // Extraer datos del cliente desde el modal
    const modalBody = document.getElementById('ticketModalBody');
    let datosCliente = {
        nombre: '',
        apellido: '',
        ciudad: '',
        estado_cliente: ''
    };

    if (modalBody) {
        // Buscar todos los divs y extraer los datos por su contenido de texto
        const allDivs = Array.from(modalBody.querySelectorAll('div'));
        
        // Buscar contenedores con estilo de fondo grisáceo que contienen Nombre, Estado, Ciudad
        allDivs.forEach((el) => {
            const labelDiv = el.querySelector('div:first-child');
            const valueDiv = el.querySelector('div:last-child');
            
            if (labelDiv && valueDiv) {
                const labelText = labelDiv.textContent.trim().toUpperCase();
                const value = valueDiv.textContent.trim();
                
                if (labelText === 'NOMBRE' && value !== 'NOMBRE') {
                    // Separar nombre y apellido si contiene espacio
                    const partes = value.split(' ');
                    datosCliente.nombre = partes[0] || '';
                    datosCliente.apellido = partes.slice(1).join(' ') || '';
                } else if (labelText === 'ESTADO' && value !== 'ESTADO') {
                    datosCliente.estado_cliente = value;
                } else if (labelText === 'CIUDAD' && value !== 'CIUDAD') {
                    datosCliente.ciudad = value;
                }
            }
        });
    }

    // Abrir modal para seleccionar tipo de ganador
    window.abrirModalSeleccionarGanador(numero, datosCliente, function(numeroGanador, tipoGanador, exito) {
        if (exito) {
            if (window.machine) {
            }
            // Recargar modal después de 1 segundo
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    });
};
