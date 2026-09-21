const http = require('http');
const db = require('../server/db');

async function runTests() {
    console.log('--- Starting V2 Task API Test ---');

    // 1. Get an active user with credits and api_key
    const user = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM users WHERE credits > 0 AND api_key IS NOT NULL LIMIT 1", (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });

    if (!user) {
        console.error('❌ No user with credits and api_key found.');
        process.exit(1);
    }
    console.log(`✅ Using User: ${user.username} (API Key: ${user.api_key}, Credits: ${user.credits})`);

    const apiKey = user.api_key;

    function request(path, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(`http://127.0.0.1:5000${path}`);
            const reqOptions = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            };

            const req = http.request(reqOptions, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
                    } catch (e) {
                        resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
                    }
                });
            });

            req.on('error', reject);
            if (options.body) {
                req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
            }
            req.end();
        });
    }

    try {
        // Test 1: POST /v2/tasks/video-to-shorts
        console.log('\n[Test 1] POST /v2/tasks/video-to-shorts');
        const shortsRes = await request('/v2/tasks/video-to-shorts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: {
                source_video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                language: 'en',
                transcription_context: 'Test transcription context for podcast',
                style_preset_id: 'dd2875e8-4e75-4887-973c-2adc928dd2ab',
                max_duration: 30,
                max_clip_count: 5
            }
        });

        console.log('Status Code:', shortsRes.status);
        console.log('Response Body:', shortsRes.body);

        if (shortsRes.status !== 200 || !shortsRes.body.id || shortsRes.body.status !== 'processing' || shortsRes.body.output_type !== 'folder') {
            throw new Error('Test 1 Failed: Response does not match Task Object spec');
        }
        console.log('✅ Test 1 Passed! Task ID:', shortsRes.body.id);
        const shortsTaskId = shortsRes.body.id;

        // Test 2: GET /v2/tasks/{task_id}
        console.log(`\n[Test 2] GET /v2/tasks/${shortsTaskId}`);
        const getTaskRes = await request(`/v2/tasks/${shortsTaskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        });

        console.log('Status Code:', getTaskRes.status);
        console.log('Response Body:', getTaskRes.body);
        if (getTaskRes.status !== 200 || getTaskRes.body.id !== shortsTaskId) {
            throw new Error('Test 2 Failed: Unable to fetch task');
        }
        console.log('✅ Test 2 Passed!');

        // Test 3: POST /v2/tasks/video-to-video
        console.log('\n[Test 3] POST /v2/tasks/video-to-video');
        const v2vRes = await request('/v2/tasks/video-to-video', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: {
                source_video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                language: 'en',
                style_preset_id: 'dd2875e8-4e75-4887-973c-2adc928dd2ab',
                editing_options: {
                    captions: true,
                    reframe: true
                }
            }
        });

        console.log('Status Code:', v2vRes.status);
        console.log('Response Body:', v2vRes.body);

        if (v2vRes.status !== 200 || !v2vRes.body.id || v2vRes.body.output_type !== 'project') {
            throw new Error('Test 3 Failed: Video-to-video response does not match spec');
        }
        console.log('✅ Test 3 Passed! Task ID:', v2vRes.body.id);

        // Test 4: Auth failure test (Invalid API Key)
        console.log('\n[Test 4] POST /v2/tasks/video-to-shorts with Invalid API Key');
        const invalidAuthRes = await request('/v2/tasks/video-to-shorts', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer invalid_random_key_123',
                'Content-Type': 'application/json'
            },
            body: {
                source_video_url: 'https://www.youtube.com/watch?v=sample'
            }
        });

        console.log('Status Code:', invalidAuthRes.status);
        if (invalidAuthRes.status === 401) {
            console.log('✅ Test 4 Passed: Properly rejected unauthorized request with 401');
        } else {
            throw new Error('Test 4 Failed: Expected 401 Unauthorized');
        }

        // Test 5: Validation failure test (Missing source_video_url)
        console.log('\n[Test 5] POST /v2/tasks/video-to-shorts with Missing URL');
        const missingUrlRes = await request('/v2/tasks/video-to-shorts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: {}
        });

        console.log('Status Code:', missingUrlRes.status);
        if (missingUrlRes.status === 400) {
            console.log('✅ Test 5 Passed: Properly validated missing required parameter with 400');
        } else {
            throw new Error('Test 5 Failed: Expected 400 Bad Request');
        }

        console.log('\n🎉 ALL V2 API TESTS PASSED SUCCESSFULLY! 🎉\n');
        process.exit(0);

    } catch (err) {
        console.error('\n❌ Test run error:', err);
        process.exit(1);
    }
}

// Check if server is running; if not, launch it
const httpCheck = http.get('http://127.0.0.1:5000/api/user', { headers: { 'user-id': '1' } }, (res) => {
    runTests();
});

httpCheck.on('error', () => {
    console.log('Server not currently running on port 5000, launching server in-process...');
    require('../server/server.js');
    setTimeout(runTests, 1500);
});
