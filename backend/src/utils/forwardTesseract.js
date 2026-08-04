const http = require('http');
const https = require('https');
const { URL } = require('url');
const Punch = require('../models/Punch');
const User = require('../models/User');

function forwardPhotoToTesseract(punchId, photoBase64) {
  const serviceUrl = process.env.TESSERACT_SERVICE_URL || 'http://127.0.0.1:5001/process-photo';
  try {
    const parsed = new URL(serviceUrl);
    const data = JSON.stringify({ punch_id: punchId, photo_base64: photoBase64 });

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 8000,
    };

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', async () => {
        try {
          if (res.statusCode >= 400) {
            console.log(`Tesseract forward failed: ${res.statusCode} - ${body}`);
            return;
          }

          const parsedBody = JSON.parse(body || '{}');
          const result = parsedBody.result || null;
          if (!result || !punchId) return;

          const ocrObject = {
            text: result.extracted_text || null,
            confidence: typeof result.confidence === 'number' ? result.confidence : null,
            filename: result.filename || null,
            processedAt: new Date(),
          };

          const punch = await Punch.findByIdAndUpdate(
            punchId,
            { $set: { ocrResult: ocrObject } },
            { new: true, useFindAndModify: false }
          );

          if (punch) {
            await User.updateOne(
              { employeeId: punch.employeeId },
              {
                $set: {
                  lastOcr: {
                    text: ocrObject.text,
                    confidence: ocrObject.confidence,
                    punchId: punchId,
                    processedAt: ocrObject.processedAt,
                  },
                },
              }
            );
          }
        } catch (err) {
          console.log('Tesseract forward parse/update error:', err.message);
        }
      });
    });

    req.on('error', (err) => {
      console.log('Tesseract forward error:', err.message);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('Tesseract forward timed out');
    });

    req.write(data);
    req.end();
  } catch (err) {
    console.log('Tesseract forward exception:', err.message);
  }
}

module.exports = { forwardPhotoToTesseract };