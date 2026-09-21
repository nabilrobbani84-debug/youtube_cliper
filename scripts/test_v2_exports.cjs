const http = require('http');
const db = require('../server/db');

async function testExportEndpoints() {
    console.log('--- Testing V2 Export Endpoints ---');

    const user = await new Promise((resolve) => {
        db.get("SELECT * FROM users WHERE credits > 0 LIMIT 1", (err, row) => resolve(row));
    });

    const apiKey = user.api_key;
    console.log(`Using User: ${user.username} (API Key: ${apiKey})`);

    function req(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(`http://127.0.0.1:5000${path}`);
            const r = http.request({
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try { resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) }); }
                    catch (e) { resolve({ status: res.statusCode, headers: res.headers, raw: data }); }
                });
            });
            r.on('error', reject);
            if (options.body) r.write(JSON.stringify(options.body));
            r.end();
        });
    }

    // 1. Get existing project/folder
    const task = await new Promise((resolve) => {
        db.get("SELECT * FROM tasks WHERE status = 'ready' AND output_type = 'folder' ORDER BY created_at DESC LIMIT 1", (err, row) => resolve(row));
    });

    const folderId = task ? task.output_id : 'folder_001';
    const projectId = 'project_clip75abcef1';

    // Test 1: POST /v2/projects/{folder_id}/{project_id}/exports
    console.log(`\n[Test 1] POST /v2/projects/${folderId}/${projectId}/exports`);
    const createExportRes = await req(`/v2/projects/${folderId}/${projectId}/exports`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: {
            watermark: {
                src_url: 'https://example.com/logo.png',
                pos_x: 0.5,
                pos_y: 0.5,
                scale: 1
            }
        }
    });

    console.log('Status Code:', createExportRes.status);
    console.log('Export Response:', createExportRes.body);

    if (createExportRes.status !== 200 || !createExportRes.body.id || createExportRes.body.status !== 'processing' || createExportRes.body.project_id !== projectId) {
        throw new Error('Test 1 Failed: Create export response does not match spec');
    }
    const exportId = createExportRes.body.id;
    console.log('✅ Test 1 Passed! Export ID:', exportId);

    // Test 2: GET /v2/projects/{folder_id}/{project_id}/exports/{export_id}
    console.log(`\n[Test 2] GET /v2/projects/${folderId}/${projectId}/exports/${exportId}`);
    const getExportRes = await req(`/v2/projects/${folderId}/${projectId}/exports/${exportId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    console.log('Status Code:', getExportRes.status);
    console.log('Export Status Body:', getExportRes.body);

    if (getExportRes.status !== 200 || getExportRes.body.id !== exportId) {
        throw new Error('Test 2 Failed: Unable to fetch export status');
    }
    console.log('✅ Test 2 Passed!');

    // Test 3: POST /v2/projects/{project_id}/exports (Create Export Direct)
    console.log(`\n[Test 3] POST /v2/projects/${projectId}/exports (Direct)`);
    const directExportRes = await req(`/v2/projects/${projectId}/exports`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: {
            watermark: { src_url: 'https://example.com/watermark.png' }
        }
    });

    console.log('Status Code:', directExportRes.status);
    console.log('Direct Export Response:', directExportRes.body);

    if (directExportRes.status !== 200 || !directExportRes.body.id || directExportRes.body.status !== 'processing') {
        throw new Error('Test 3 Failed: Create direct export response does not match spec');
    }
    console.log('✅ Test 3 Passed!');

    // Test 4: GET /v2/exports (List all exports with filter)
    console.log(`\n[Test 4] GET /v2/exports?folder_id=${folderId}`);
    const listExportsRes = await req(`/v2/exports?folder_id=${folderId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    console.log('Status Code:', listExportsRes.status);
    console.log('Exports count:', Array.isArray(listExportsRes.body) ? listExportsRes.body.length : 0);

    if (listExportsRes.status !== 200 || !Array.isArray(listExportsRes.body) || listExportsRes.body.length === 0) {
        throw new Error('Test 4 Failed: Expected array of exports');
    }
    console.log('✅ Test 4 Passed!');

    // Test 5: Poll until export is ready
    console.log(`\n[Test 5] Polling Export ${exportId} until status is "ready"...`);
    let exportReady = false;
    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const checkRes = await req(`/v2/exports/${exportId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        console.log(`[Poll ${i+1}] Export ${exportId} status:`, checkRes.body.status);
        if (checkRes.body.status === 'ready') {
            console.log('✅ Export reached ready state!');
            console.log('Final Export Object:', checkRes.body);
            if (!checkRes.body.src_url || !checkRes.body.finished_at) {
                throw new Error('Test 5 Failed: Ready export object missing src_url or finished_at');
            }
            exportReady = true;
            break;
        }
    }

    if (!exportReady) {
        throw new Error('Test 5 Failed: Export did not complete in time');
    }
    console.log('✅ Test 5 Passed!');

    console.log('\n🎉 ALL EXPORT ENDPOINTS TESTS PASSED! 🎉\n');
    process.exit(0);
}

// Start in process
require('../server/server.js');
setTimeout(testExportEndpoints, 1500);
