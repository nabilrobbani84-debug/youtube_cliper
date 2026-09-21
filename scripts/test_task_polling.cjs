const http = require('http');
const db = require('../server/db');

async function testPolling() {
    console.log('--- Testing Task Processing & Status Transition to "ready" ---');

    const user = await new Promise((resolve) => {
        db.get("SELECT * FROM users WHERE credits > 0 LIMIT 1", (err, row) => resolve(row));
    });

    const apiKey = user.api_key;

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
                    try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                    catch (e) { resolve({ status: res.statusCode, raw: data }); }
                });
            });
            r.on('error', reject);
            if (options.body) r.write(JSON.stringify(options.body));
            r.end();
        });
    }

    // Create task
    const createRes = await req('/v2/tasks/video-to-shorts', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: {
            source_video_url: 'https://www.youtube.com/watch?v=sample_video',
            target_clip_count: 3
        }
    });

    console.log('Created task:', createRes.body);
    const taskId = createRes.body.id;

    // Poll until ready or timeout
    let ready = false;
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const statusRes = await req(`/v2/tasks/${taskId}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        console.log(`[Poll ${i+1}] Task ${taskId} status:`, statusRes.body.status);
        if (statusRes.body.status === 'ready') {
            console.log('✅ Task reached "ready" status!');
            console.log('Output clips count:', statusRes.body.output?.total_clips || statusRes.body.output?.clips?.length);
            ready = true;
            break;
        }
    }

    if (!ready) {
        console.error('❌ Task did not reach ready state in time.');
        process.exit(1);
    } else {
        console.log('🎉 Task polling test passed successfully!');
        process.exit(0);
    }
}

// Start in process
require('../server/server.js');
setTimeout(testPolling, 1500);
