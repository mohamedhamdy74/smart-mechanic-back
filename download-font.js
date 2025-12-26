const fs = require('fs');
const https = require('https');
const path = require('path');

const dir = path.join(__dirname, 'fonts');
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('Created fonts directory');
}

const file = fs.createWriteStream(path.join(dir, 'Cairo-Regular.ttf'));
const request = https.get("https://github.com/google/fonts/raw/main/ofl/cairo/Cairo-Regular.ttf", function (response) {
    response.pipe(file);
    file.on('finish', function () {
        file.close(() => {
            console.log('Download Completed to ' + path.join(dir, 'Cairo-Regular.ttf'));
            console.log('File size: ' + fs.statSync(path.join(dir, 'Cairo-Regular.ttf')).size + ' bytes');
        });
    });
}).on('error', function (err) {
    console.error('Download Failed', err);
    fs.unlink(path.join(dir, 'Cairo-Regular.ttf'));
});
