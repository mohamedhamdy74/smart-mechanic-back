require('dotenv').config();
const { HfInference } = require('@huggingface/inference');

async function testHfClient() {
    try {
        console.log('Testing with @huggingface/inference client...');

        const hf = new HfInference(process.env.HF_TOKEN);

        const result = await hf.textGeneration({
            model: 'google/flan-t5-small',
            inputs: 'Diagnose this car problem: engine making noise',
        });

        console.log('Success!');
        console.log('Result:', result);
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Full error:', error);
    }
}

testHfClient();
