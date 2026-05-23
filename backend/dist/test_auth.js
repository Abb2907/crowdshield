"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const PORT = 4001;
const BASE_URL = `http://localhost:${PORT}`;
// Helper assert function
function assert(condition, message) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    }
    else {
        console.log(`✅ ${message}`);
    }
}
async function runTests() {
    console.log('--- STARTING CROWDSHIELD SECURITY & RBAC UNIT TESTS ---');
    // 1. Wait a moment for server to bind or bind programmatically
    // Note: server is already started at port 4000 in index.ts if it imports index.ts, 
    // but to avoid address in use or testing conflicts, we can query the active port if needed.
    // Actually index.ts does: server.listen(PORT, ...)
    // Since index.ts executes on import, let's query the running server.
    // Wait, let's see what PORT it runs on: standard port is 4000.
    const targetUrl = `http://localhost:4000`;
    try {
        // A quick health check
        const healthRes = await fetch(`${targetUrl}/health`);
        assert(healthRes.status === 200, 'Health endpoint is accessible publicly');
        const healthData = await healthRes.json();
        assert(healthData.status === 'UP', 'Health status is UP');
        // 2. Test Login & Token Generation
        console.log('\n--- TESTING LOGIN & TOKEN CREATION ---');
        // Admin login
        const adminLoginRes = await fetch(`${targetUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        assert(adminLoginRes.status === 200, 'Admin credentials login successfully');
        const adminData = await adminLoginRes.json();
        assert(adminData.success === true, 'Admin login response reports success');
        assert(adminData.token !== undefined, 'Admin token is returned');
        assert(adminData.user.role === 'admin', 'Admin user object has admin role');
        const adminToken = adminData.token;
        // Operator login
        const operatorLoginRes = await fetch(`${targetUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'operator', password: 'operator123' })
        });
        assert(operatorLoginRes.status === 200, 'Operator credentials login successfully');
        const operatorData = await operatorLoginRes.json();
        const operatorToken = operatorData.token;
        // Viewer login
        const viewerLoginRes = await fetch(`${targetUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'viewer', password: 'viewer123' })
        });
        assert(viewerLoginRes.status === 200, 'Viewer credentials login successfully');
        const viewerData = await viewerLoginRes.json();
        const viewerToken = viewerData.token;
        // Invalid login
        const invalidLoginRes = await fetch(`${targetUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'hacker', password: 'wrongpassword' })
        });
        assert(invalidLoginRes.status === 401, 'Invalid credentials return 401 Unauthorized');
        // 3. Test RBAC on Securing Emergency Evacuation Endpoint
        console.log('\n--- TESTING RBAC FOR /api/emergency ---');
        // No token
        const noTokenRes = await fetch(`${targetUrl}/api/emergency`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: true })
        });
        assert(noTokenRes.status === 401, 'POST /api/emergency with no token returns 401 Unauthorized');
        // Viewer token (should be forbidden)
        const viewerEvacRes = await fetch(`${targetUrl}/api/emergency`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${viewerToken}`
            },
            body: JSON.stringify({ active: true })
        });
        assert(viewerEvacRes.status === 403, 'POST /api/emergency with Viewer token returns 403 Forbidden');
        // Operator token (should succeed)
        const operatorEvacRes = await fetch(`${targetUrl}/api/emergency`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${operatorToken}`
            },
            body: JSON.stringify({ active: true, duration: 600, triggeredBy: 'Operator Test Suite' })
        });
        assert(operatorEvacRes.status === 200, 'POST /api/emergency with Operator token succeeds');
        // Admin token (should succeed)
        const adminEvacRes = await fetch(`${targetUrl}/api/emergency`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ active: false, duration: 900 }) // Disarm
        });
        assert(adminEvacRes.status === 200, 'POST /api/emergency with Admin token succeeds (disarmed)');
        // 4. Test RBAC on Incident reporting
        console.log('\n--- TESTING RBAC FOR /api/incident ---');
        // No token
        const noTokenIncident = await fetch(`${targetUrl}/api/incident`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test incident', severity: 'low', zoneId: 'zone_a' })
        });
        assert(noTokenIncident.status === 401, 'POST /api/incident with no token returns 401 Unauthorized');
        // Viewer (should be forbidden)
        const viewerIncident = await fetch(`${targetUrl}/api/incident`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${viewerToken}`
            },
            body: JSON.stringify({ title: 'Test incident', severity: 'low', zoneId: 'zone_a' })
        });
        assert(viewerIncident.status === 403, 'POST /api/incident with Viewer token returns 403 Forbidden');
        // Operator (should succeed)
        const operatorIncident = await fetch(`${targetUrl}/api/incident`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${operatorToken}`
            },
            body: JSON.stringify({ title: 'Operator Test Incident', severity: 'medium', zoneId: 'zone_b' })
        });
        assert(operatorIncident.status === 200, 'POST /api/incident with Operator token succeeds');
        // 5. Test AI Briefing Access
        console.log('\n--- TESTING RBAC FOR /api/ai/briefing ---');
        // Viewer should be able to get briefings
        const viewerBriefing = await fetch(`${targetUrl}/api/ai/briefing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${viewerToken}`
            }
        });
        assert(viewerBriefing.status === 200, 'POST /api/ai/briefing with Viewer token succeeds (Read-only access allowed)');
        const briefingData = await viewerBriefing.json();
        assert(briefingData.briefing !== undefined, 'Briefing content successfully returned to Viewer');
        // 6. Test voice command RBAC
        console.log('\n--- TESTING RBAC FOR /api/ai/voice ---');
        // Viewer should be forbidden
        const viewerVoice = await fetch(`${targetUrl}/api/ai/voice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${viewerToken}`
            },
            body: JSON.stringify({ command: 'close gate c' })
        });
        assert(viewerVoice.status === 403, 'POST /api/ai/voice with Viewer token returns 403 Forbidden');
        // Admin should succeed
        const adminVoice = await fetch(`${targetUrl}/api/ai/voice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ command: 'restrict gate a' })
        });
        assert(adminVoice.status === 200, 'POST /api/ai/voice with Admin token succeeds');
        console.log('\n======================================================');
        console.log('🎉 ALL SECURITY & RBAC AUTHENTICATION TESTS PASSED!');
        console.log('======================================================');
        process.exit(0);
    }
    catch (err) {
        console.error('Error during unit test execution:', err);
        process.exit(1);
    }
}
runTests();
