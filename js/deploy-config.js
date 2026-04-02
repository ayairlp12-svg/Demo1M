// Configuracion centralizada de despliegue.
// En futuros hostings, cambia solo este archivo.
(function configurarDeployRifaPlus() {
    const deployConfig = {
        apiBase: 'https://demo1m-production.up.railway.app',
        socketScriptUrl: 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js'
    };

    window.__RIFAPLUS_DEPLOY__ = Object.assign({}, deployConfig, window.__RIFAPLUS_DEPLOY__ || {});
    window.RIFAPLUS_ENV = Object.assign({}, window.RIFAPLUS_ENV || {}, {
        apiBase: window.__RIFAPLUS_DEPLOY__.apiBase,
        socketUrl: window.__RIFAPLUS_DEPLOY__.socketScriptUrl
    });
})();
