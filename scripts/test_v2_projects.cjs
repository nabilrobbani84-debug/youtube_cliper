const http = require('http');
const db = require('../server/db');

async function testProjectEndpoints() {
    console.log('--- Testing V2 Project Endpoints ---');

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

    // 1. Get a completed task or folder from DB
    const task = await new Promise((resolve) => {
        db.get("SELECT * FROM tasks WHERE status = 'ready' AND output_type = 'folder' ORDER BY created_at DESC LIMIT 1", (err, row) => resolve(row));
    });

    if (!task) {
        console.error('❌ No completed folder task found.');
        process.exit(1);
    }

    const folderId = task.output_id;
    console.log(`Found completed folder: ${folderId}`);

    // Test 1: GET /v2/projects/{folder_id}
    console.log(`\n[Test 1] GET /v2/projects/${folderId}`);
    const listRes = await req(`/v2/projects/${folderId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    console.log('Status Code:', listRes.status);
    console.log('Projects count:', Array.isArray(listRes.body) ? listRes.body.length : 0);
    console.log('Sample Project Object:', Array.isArray(listRes.body) ? listRes.body[0] : listRes.body);

    if (listRes.status !== 200 || !Array.isArray(listRes.body) || listRes.body.length === 0) {
        throw new Error('Test 1 Failed: Expected array of Project Objects');
    }
    const sampleProject = listRes.body[0];
    if (!sampleProject.id || !sampleProject.author_id || !sampleProject.name || sampleProject.virality_score === undefined) {
        throw new Error('Test 1 Failed: Project Object missing expected fields');
    }
    console.log('✅ Test 1 Passed!');

    // Test 2: GET /v2/projects/{folder_id}/{project_id}
    const projectId = sampleProject.id;
    console.log(`\n[Test 2] GET /v2/projects/${folderId}/${projectId}`);
    const getSingleRes = await req(`/v2/projects/${folderId}/${projectId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    console.log('Status Code:', getSingleRes.status);
    console.log('Project Body:', getSingleRes.body);

    if (getSingleRes.status !== 200 || getSingleRes.body.id !== projectId || getSingleRes.body.folder_id !== folderId) {
        throw new Error('Test 2 Failed: Single project retrieval mismatch');
    }
    console.log('✅ Test 2 Passed!');

    // Test 3: GET /v2/projects/{project_id} (Direct Project)
    console.log(`\n[Test 3] GET /v2/projects/${projectId}`);
    const directRes = await req(`/v2/projects/${projectId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    console.log('Status Code:', directRes.status);
    console.log('Direct Project Body:', directRes.body);

    if (directRes.status !== 200 || directRes.body.id !== projectId) {
        throw new Error('Test 3 Failed: Direct project retrieval mismatch');
    }
    console.log('✅ Test 3 Passed!');

    // Test 4: GET /player/{project_id} (Embed/Preview Player)
    console.log(`\n[Test 4] GET /player/${projectId}`);
    const playerRes = await req(`/player/${projectId}`);
    console.log('Status Code:', playerRes.status);
    console.log('Content-Type:', playerRes.headers['content-type']);
    if (playerRes.status !== 200 || !playerRes.raw.includes('<video') || !playerRes.raw.includes('Virality Score')) {
        throw new Error('Test 4 Failed: Player HTML not properly generated');
    }
    console.log('✅ Test 4 Passed! Player HTML rendered correctly.');

    console.log('\n🎉 ALL PROJECT ENDPOINTS TESTS PASSED! 🎉\n');
    process.exit(0);
}

// Start in process
require('../server/server.js');
setTimeout(testProjectEndpoints, 1500);
