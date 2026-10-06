// Same-origin snapshots only. Third party map tiles are intentionally excluded.
export function initOfflineSnapshot() {
    const status = document.getElementById('snapshot-status');
    if (!('serviceWorker' in navigator)) {
        status.textContent = 'Offline storage unavailable.';
        return;
    }
    let snapshot;
    const render = () => {
        const state = navigator.onLine ? 'Local snapshot ready' : 'Offline · using saved snapshot';
        status.textContent = snapshot
            ? state + ' · ' + new Date(snapshot.savedAt).toLocaleDateString('en-GB')
            : navigator.onLine ? 'Preparing a local snapshot…' : 'Offline · no saved snapshot yet.';
    };
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'SNAPSHOT_READY') { snapshot = event.data; render(); }
    });
    navigator.serviceWorker.register('service-worker.js', {updateViaCache: 'none'})
        .then(registration => {
            const offerUpdate = () => {
                if (!registration.waiting || !navigator.serviceWorker.controller || document.querySelector('.snapshot-refresh')) return;
                const refresh = document.createElement('button');
                refresh.className = 'snapshot-refresh';
                refresh.textContent = 'Load updated snapshot';
                refresh.addEventListener('click', () => {
                    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {once: true});
                    registration.waiting.postMessage({type: 'ACTIVATE_SNAPSHOT'});
                });
                status.after(refresh);
            };
            offerUpdate();
            registration.addEventListener('updatefound', () => {
                registration.installing?.addEventListener('statechange', offerUpdate);
            });
            return Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Snapshot preparation timed out')), 20000))
            ]);
        })
        .then(registration => registration.active?.postMessage({type: 'SNAPSHOT_STATUS'}))
        .catch(() => { status.textContent = 'Snapshot unavailable · online viewing works.'; });
    render();
}
