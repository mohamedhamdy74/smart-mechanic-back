const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000';
const EMAIL = 'admin@admin.com';
const PASSWORD = 'admin123';

async function runTests() {
    console.log('🚀 Starting AI Integration Tests...');

    // 1. Login
    let token;
    try {
        console.log('🔑 Logging in...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });

        if (!loginRes.ok) {
            const text = await loginRes.text();
            throw new Error(`Login failed: ${loginRes.status} ${text}`);
        }

        const loginData = await loginRes.json();
        token = loginData.accessToken; // Fixed: use accessToken
        console.log('✅ Login successful. Token received.');
    } catch (err) {
        console.error('❌ Login error:', err.message);
        console.log('⚠️  Make sure the backend server is running on port 5000 and admin user exists.');
        process.exit(1);
    }

    // 2. Test Text Diagnosis
    try {
        console.log('\n📝 Testing Text Diagnosis...');
        const textRes = await fetch(`${API_URL}/ai/diagnose`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ text: 'The car engine is making a loud knocking sound and losing power.' })
        });

        if (!textRes.ok) throw new Error(`Text diagnosis failed: ${textRes.status}`);
        const textData = await textRes.json();
        console.log('✅ Text Diagnosis Result:', textData.success ? 'Success' : 'Failed');
        if (textData.diagnosis) console.log('   Diagnosis:', typeof textData.diagnosis === 'string' ? textData.diagnosis.substring(0, 100) + '...' : 'Object');
    } catch (err) {
        console.error('❌ Text Diagnosis Error:', err.message);
    }

    // 3. Test Image Diagnosis (Mock Image)
    try {
        console.log('\n🖼️  Testing Image Diagnosis...');
        // Create a 1x1 transparent PNG buffer
        const imageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

        const form = new FormData();
        form.append('file', imageBuffer, { filename: 'test-image.png', contentType: 'image/png' });

        const imageRes = await fetch(`${API_URL}/ai/diagnose`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                ...form.getHeaders()
            },
            body: form
        });

        if (!imageRes.ok) throw new Error(`Image diagnosis failed: ${imageRes.status}`);
        const imageData = await imageRes.json();
        console.log('✅ Image Diagnosis Result:', imageData.success ? 'Success' : 'Failed');
        console.log('   Response Type:', typeof imageData.diagnosis);
    } catch (err) {
        console.error('❌ Image Diagnosis Error:', err.message);
    }

    // 4. Test Audio Diagnosis (Mock Audio)
    try {
        console.log('\n🎤 Testing Audio Diagnosis...');
        // Create a dummy WAV buffer (header only)
        const audioBuffer = Buffer.from('UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', 'base64');

        const form = new FormData();
        form.append('file', audioBuffer, { filename: 'test-audio.wav', contentType: 'audio/wav' });

        const audioRes = await fetch(`${API_URL}/ai/diagnose`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                ...form.getHeaders()
            },
            body: form
        });

        if (!audioRes.ok) throw new Error(`Audio diagnosis failed: ${audioRes.status}`);
        const audioData = await audioRes.json();
        console.log('✅ Audio Diagnosis Result:', audioData.success ? 'Success' : 'Failed');
        console.log('   Response Type:', typeof audioData.diagnosis);
    } catch (err) {
        console.error('❌ Audio Diagnosis Error:', err.message);
    }

    console.log('\n🏁 Tests Completed.');
}

runTests();
