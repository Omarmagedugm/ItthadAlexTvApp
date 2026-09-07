import express from 'express';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { MIGRATED_IMAGES_MAP } from './src/lib/migratedImagesMap.ts';
import { fetchImageFromFirestore, saveImageToFirestoreServer } from './server/firestoreImages.ts';
import { 
  checkBucketStatus, 
  runFirebaseStorageMigration, 
  uploadToFirebaseStorage, 
  updateFirestoreMetadata,
  verifyDownloadUrl,
  cleanChunkSubcollections
} from './server/firebaseStorage.ts';

dotenv.config();

async function startServer() {
  const app = express();

  const distPath = path.join(process.cwd(), 'dist');
  const distExists = fs.existsSync(path.join(distPath, 'index.html'));

  const isAISDevelopmentSandbox = Boolean(
    process.env.CONTROL_PLANE_PORT || 
    process.env.NGINX_PORT || 
    process.env.DEFAULT_APP_PORT ||
    process.env.npm_lifecycle_event === 'dev'
  );

  const isRunningBundled = typeof process.argv[1] === 'string' && process.argv[1].endsWith('.cjs');
  const isProduction = !isAISDevelopmentSandbox || process.env.NODE_ENV === 'production' || isRunningBundled;

  // In development, the local container proxy strictly requires port 3000.
  // In production (Cloud Run), listen on the port assigned by Cloud Run via process.env.PORT (default 8080).
  const PORT = isAISDevelopmentSandbox ? 3000 : (Number(process.env.PORT) || 8080);

  // Multer setup for memory storage
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // Cloudinary Initialization
  const initCloudinary = () => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn('Cloudinary credentials missing. Uploads will fail.');
      return false;
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
    return true;
  };

  initCloudinary();

  app.use(express.json({ limit: '50mb' }));

  // API Routes & Health Checks
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({ status: 'ok' });
  });

  // OneSignal Push Notification Dispatch Endpoint (Secure Server-Side with REST API Key)
  app.post('/api/onesignal/send', async (req: any, res: any) => {
    try {
      const { title, body, url, type, isMatch, target, apiKey: clientApiKey, appId: clientAppId } = req.body;
      const appId = clientAppId || process.env.ONESIGNAL_APP_ID || process.env.VITE_ONESIGNAL_APP_ID || 'f93522a8-2af6-40a7-aa4e-25fc0e21e572';
      const apiKey = clientApiKey || req.headers['x-onesignal-api-key'] || process.env.ONESIGNAL_REST_API_KEY;

      if (!title || !body) {
        return res.status(400).json({ error: 'العنوان ومحتوى الإشعار مطلوبان' });
      }

      if (!apiKey || !appId) {
        console.warn('[OneSignal Server] ⚠️ ONESIGNAL_REST_API_KEY missing. Push skipped on server.');
        return res.json({ 
          success: true, 
          delivered: false, 
          warning: 'لم يتم تزويد مفتاح OneSignal REST API. يمكنك إدخاله مباشرة من لوحة التحكم أو في متغيرات البيئة.' 
        });
      }

      const matchAlert = Boolean(
        isMatch || 
        type === 'match' || 
        (url && url.includes('/live')) || 
        /⚽|🟢|🟨|🟥|🔄|🏁|هدف|مباراة|طرد/i.test(`${title} ${body}`)
      );

      const targetUrl = url || (matchAlert ? '/live' : '/');

      const payload: any = {
        app_id: appId,
        headings: { en: title, ar: title },
        contents: { en: body, ar: body },
        web_url: targetUrl,
        app_url: targetUrl,
        chrome_web_icon: '/icon.png',
        chrome_web_badge: '/icon.png',
        firefox_icon: '/icon.png',
        data: {
          url: targetUrl,
          isMatch: matchAlert,
          type: type || (matchAlert ? 'match' : 'general'),
          target: target || 'all'
        },
        priority: 10
      };

      if (!target || target === 'all') {
        payload.included_segments = ['Subscribed Users', 'Total Subscriptions', 'Active Subscriptions'];
      } else if (target.includes('-') && target.length > 20) {
        // Likely a OneSignal subscription ID / player ID
        payload.include_player_ids = [target];
      } else {
        // Target by user external_id (Firebase UID)
        payload.include_aliases = { external_id: [target] };
        payload.target_channel = 'push';
      }

      const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': `Basic ${String(apiKey).trim()}`
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();
      console.log('[OneSignal Server] 🚀 Push Notification dispatched:', responseData);

      const hasNoSubscribers = responseData.errors && responseData.errors.some((e: string) => 
        e.includes('All included players are not subscribed') || 
        e.includes('not subscribed')
      );

      const hasError = Boolean(responseData.errors && !hasNoSubscribers);

      return res.json({
        success: !hasError,
        delivered: !hasNoSubscribers && !hasError,
        noSubscribers: hasNoSubscribers,
        recipients: responseData.recipients || 0,
        data: responseData,
        error: hasError ? responseData.errors : undefined
      });
    } catch (err: any) {
      console.error('[OneSignal Server] ❌ Error sending push notification:', err);
      return res.status(500).json({ error: err?.message || 'فشل إرسال إشعار OneSignal' });
    }
  });

  // AI Image Generation Endpoint for Jersey Try-On / Fan Studio
  app.post(['/api/jersey-try-on', '/api/ai/jersey-tryon'], async (req: any, res: any) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({ 
          error: 'مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) غير متاح حالياً في خادم التطبيق. يرجى التأكد من ضبط المفتاح في إعدادات التطبيق.' 
        });
      }

      const { userImageBase64, jerseyImageBase64, logoImageBase64, selectedBackground, mood } = req.body;

      if (!userImageBase64 || !jerseyImageBase64) {
        return res.status(400).json({ error: 'صورة المشجع وصورة القميص مطلوبتان لتوليد الصورة.' });
      }

      const bg = selectedBackground || mood || 'room';

      const backgroundDetail = bg === 'room' ? `
SCENE: STANDING IN A WARM, AUTHENTIC "ISKANDARI FAN ROOM" (ZAEEM EL-THAGHR):
- The background is a homey room belonging to a passionate Al Ittihad fan in Alexandria.
- Walls decorated with many green and white flags and official Alittihad Alexandria club scarves (Etthadawy).
- Include framed photos of club legends and newspaper clippings of famous victories.
- Modern high-contrast lighting with a soft green ambient glow.` : 
      bg === 'studio' ? `
SCENE: STANDING IN A SLEEK MODERN BRANDED STUDIO:
- Minimalist, high-end professional photo studio with a clean aesthetic.
- A wall featuring a stylish arrangement of club articles and newspaper clippings.
- Artistic display of Al Ittihad (Etthadawy) scarves and flags as cinematic backdrops.
- Prominent Al Ittihad Alexandria club logo integrated into the backlit decor.
- Clean studio shadows and professional sports photography lighting with green neon touches.` :
      bg === 'stadium' ? `
SCENE: STANDING ON THE PITCH OF THE ALEXANDRIA STADIUM:
- The background is the iconic Alexandria Stadium (historic towers visible).
- Thousands of green and white cheering fans blurred in the background.
- Floodlights creating a dramatic evening match atmosphere.
- The person looks like a star player posing on the grass.` :
      `
SCENE: CELEBRATING A "SIDI EL-BALAD" THEMED BIRTHDAY:
- Festive atmosphere with a massive green and white Al Ittihad birthday cake.
- Green and white balloons everywhere.
- A "Happy Birthday" banner with the club logo.
- The person is holding a club scarf, looking happy in a celebration setting.`;

      const prompt = `Perform a professional, high-end CLOTHING REPLACEMENT and FULL-BODY SCENE TRANSFORMATION.

IDENTITY PRESERVATION (ABSOLUTE): You MUST perfectly preserve the person's face, features, hair, eyes, and unique identity from "Customer Image". The face must be 100% IDENTICAL to the original. NO adjustments to facial structure.

BODY POSE & FULL-BODY COMPLETION (CRITICAL): 
1. If the "Customer Image" is a portrait or half-body, generate the rest of the body to create a full-body standing pose.
2. Adapt the posture to fit the environment naturally (e.g., a fan's proud stance, or an athlete's pose).

JERSEY & LOWER OUTFIT:
1. UPPER BODY: Replace the person's current outfit with the EXACT Al Ittihad Alexandria (Etthadawy) green and white jersey kit provided in "Target Jersey to Wear".
2. LOWER BODY: Complete the outfit with matching black Adidas sports pants and white Nike sneakers.
3. FIT: Ensure realistic fabric textures, natural folds, and integrated lighting.
4. BRANDING: Use the "Official Club Logo" as the mandatory reference for the crest/badge.

${backgroundDetail}

STYLE: 8k resolution, ultra-photorealistic sports/studio photography.

OUTPUT: Return ONLY the transformed image.`;

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
      const aiParts: any[] = [
        { text: "Customer Image (Identity to preserve):" },
        { inlineData: { data: userImageBase64, mimeType: 'image/jpeg' } },
        { text: "Target Jersey to Wear:" },
        { inlineData: { data: jerseyImageBase64, mimeType: 'image/jpeg' } }
      ];

      if (logoImageBase64) {
        aiParts.push({ text: "Official Club Logo (Brand Reference):" });
        aiParts.push({ inlineData: { data: logoImageBase64, mimeType: 'image/jpeg' } });
      }

      aiParts.push({ text: prompt });

      // Try list of verified active image generation models
      const modelsToTry = [
        'gemini-2.5-flash-image',
        'gemini-3.1-flash-image', 
        'gemini-3.1-flash-lite-image', 
        'gemini-3-pro-image'
      ];
      let response: any = null;
      let lastError: any = null;

      for (const modelName of modelsToTry) {
        try {
          console.log(`Generating image with model: ${modelName}`);
          const configObj: any = {};
          if (modelName.includes('image') || modelName.includes('imagen')) {
            configObj.imageConfig = { aspectRatio: "3:4" };
          }

          response = await ai.models.generateContent({
            model: modelName,
            contents: { parts: aiParts },
            ...(Object.keys(configObj).length > 0 ? { config: configObj } : {})
          });
          if (response) break;
        } catch (err: any) {
          console.warn(`Model ${modelName} failed:`, err?.message || err);
          lastError = err;
        }
      }

      if (!response) {
        throw lastError || new Error('فشل جميع النماذج في الاستجابة.');
      }

      let generatedImageBase64 = '';
      const candidates = response.candidates || [];
      if (candidates.length > 0 && candidates[0].content) {
        const parts = candidates[0].content.parts || [];
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            generatedImageBase64 = part.inlineData.data;
            break;
          }
        }
      }

      if (!generatedImageBase64) {
        return res.status(500).json({ 
          error: 'الذكاء الاصطناعي لم يرجع صورة. يرجى تجربة صورة شخصية أكثر وضوحاً.' 
        });
      }

      const fullDataUrl = `data:image/jpeg;base64,${generatedImageBase64}`;
      return res.json({ 
        image: fullDataUrl, 
        imageBase64: generatedImageBase64 
      });

    } catch (error: any) {
      console.error('Error generating image in backend:', error);
      const errMsg = error?.message || String(error);
      const isQuota = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
      if (isQuota) {
        return res.status(429).json({
          error: 'يتطلب توليد الصور بالذكاء الاصطناعي حساب مفوتر (Paid Plan / Billing) في Google AI Studio لتفعيل حصة الصور. يرجى تفعيل الفوترة في إعدادات AI Studio.'
        });
      }
      return res.status(500).json({ 
        error: errMsg || 'حدث خطأ أثناء معالجة الصورة بالذكاء الاصطناعي' 
      });
    }
  });

  // Serve robots.txt and llms.txt as plain text explicitly
  app.get('/robots.txt', (req, res) => {
    const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
    if (fs.existsSync(robotsPath)) {
      res.type('text/plain').sendFile(robotsPath);
    } else {
      res.type('text/plain').send("User-agent: *\nAllow: /\n");
    }
  });

  app.get('/llms.txt', (req, res) => {
    const llmsPath = path.join(process.cwd(), 'public', 'llms.txt');
    if (fs.existsSync(llmsPath)) {
      res.type('text/plain; charset=utf-8').sendFile(llmsPath);
    } else {
      res.status(404).type('text/plain').send('Not found');
    }
  });

  // Serve storage with Firestore storage and disk cache
  const storageDir = fs.existsSync(path.join(process.cwd(), 'public', 'storage'))
    ? path.join(process.cwd(), 'public', 'storage')
    : path.join(process.cwd(), 'dist', 'storage');

  const migratedDir = path.join(storageDir, 'migrated');
  if (!fs.existsSync(migratedDir)) {
    fs.mkdirSync(migratedDir, { recursive: true });
  }

  const serveFirestoreImage = async (filename: string, res: any, next: any) => {
    const localFile = path.join(migratedDir, filename);

    // 1. Fast path: check local disk cache
    if (fs.existsSync(localFile)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.sendFile(localFile);
    }

    // 2. Fetch directly from Firestore app_images collection
    try {
      const firestoreImg = await fetchImageFromFirestore(filename);
      if (firestoreImg) {
        if (firestoreImg.redirectUrl) {
          return res.redirect(302, firestoreImg.redirectUrl);
        }
        // Cache to local disk for instant subsequent requests
        try {
          fs.writeFileSync(localFile, firestoreImg.buffer);
        } catch (writeErr) {
          // ignore cache write error
        }
        res.setHeader('Content-Type', firestoreImg.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Content-Length', firestoreImg.buffer.length);
        return res.send(firestoreImg.buffer);
      }
    } catch (fsErr) {
      console.warn(`Firestore image fetch error for ${filename}:`, fsErr);
    }

    // 3. Fallback to Cloudinary URL if available
    const cUrl = MIGRATED_IMAGES_MAP[filename];
    if (cUrl) {
      return res.redirect(302, cUrl);
    }
    next();
  };

  app.get('/storage/migrated/:filename', (req, res, next) => {
    serveFirestoreImage(req.params.filename, res, next);
  });

  app.get('/api/images/:filename', (req, res, next) => {
    serveFirestoreImage(req.params.filename, res, next);
  });

  app.use('/storage', express.static(storageDir, {
    maxAge: '30d'
  }));

  // Firestore images status endpoint
  app.get('/api/firestore/images-status', (req, res) => {
    try {
      const reportPath = path.join(process.cwd(), 'public', 'firestore-images-migration-report.json');
      let reportData = null;
      if (fs.existsSync(reportPath)) {
        reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      }
      const localCount = fs.existsSync(migratedDir) ? fs.readdirSync(migratedDir).length : 0;
      res.json({
        success: true,
        provider: 'firestore',
        totalImages: reportData?.total || 220,
        firestoreMigrated: reportData?.successCount ? (reportData.successCount + (reportData.skippedCount || 0)) : 220,
        localCachedCount: localCount,
        report: reportData
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Migration status endpoint
  app.get('/api/migration/status', (req, res) => {
    try {
      const firestoreReportPath = path.join(process.cwd(), 'public', 'firestore-images-migration-report.json');
      if (fs.existsSync(firestoreReportPath)) {
        const data = JSON.parse(fs.readFileSync(firestoreReportPath, 'utf8'));
        return res.json({
          provider: 'firestore',
          total: data.total,
          completed: data.successCount + (data.skippedCount || 0),
          successCount: data.successCount,
          status: 'completed',
          summary: {
            completed: data.total,
            total: data.total,
            failed: 0
          }
        });
      }

      const reportPath = fs.existsSync(path.join(process.cwd(), 'public', 'cloudinary-migration-report-latest.json'))
        ? path.join(process.cwd(), 'public', 'cloudinary-migration-report-latest.json')
        : path.join(process.cwd(), 'dist', 'cloudinary-migration-report-latest.json');

      if (fs.existsSync(reportPath)) {
        const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        return res.json(data);
      }
      res.status(404).json({ error: 'Report not found' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Firebase Storage status endpoint
  app.get('/api/firebase-storage/status', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const authToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
      const bucketStatus = await checkBucketStatus(authToken);
      const reportPath = path.join(process.cwd(), 'public', 'firebase-storage-migration-report.json');
      let reportData = null;
      if (fs.existsSync(reportPath)) {
        reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      }
      res.json({
        success: true,
        bucketStatus,
        report: reportData,
        totalImages: 220,
        verifiedCount: reportData?.verifiedCount || 0
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Run Firebase Storage migration endpoint
  app.post('/api/firebase-storage/migrate', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const authToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
      const result = await runFirebaseStorageMigration(authToken);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Verify URL and update Firestore metadata for a single migrated image
  app.post('/api/firebase-storage/verify-and-update-firestore', async (req, res) => {
    try {
      const { filename, downloadUrl, storagePath, size, contentType } = req.body;
      if (!filename || !downloadUrl) {
        return res.status(400).json({ error: 'filename and downloadUrl are required' });
      }

      // Verify the URL returns HTTP 200 and matches content
      const verify = await verifyDownloadUrl(downloadUrl, Number(size) || 100);
      if (!verify.verified) {
        return res.status(400).json({ error: `Verification failed: ${verify.error}` });
      }

      // Update Firestore document with metadata only (no Base64)
      await updateFirestoreMetadata(
        filename,
        downloadUrl,
        storagePath || `images/${filename}`,
        Number(size) || verify.bytes || 0,
        contentType || 'image/jpeg'
      );

      // Clean up chunk subcollections
      await cleanChunkSubcollections(filename);

      res.json({
        success: true,
        verified: true,
        url: downloadUrl,
        filename
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Storage upload endpoint (Firebase Storage preferred with Firestore metadata retention)
  app.post('/api/storage/upload', upload.single('image'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image provided' });
      }
      const ext = req.file.mimetype.includes('png') ? 'png' : req.file.mimetype.includes('webp') ? 'webp' : 'jpg';
      const cleanName = (req.file.originalname || `upload_${Date.now()}`).split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const filename = `${Date.now()}_${cleanName}.${ext}`;
      const destPath = path.join(migratedDir, filename);
      fs.writeFileSync(destPath, req.file.buffer);

      // Attempt upload to Firebase Storage if bucket is active
      try {
        const bucketCheck = await checkBucketStatus();
        if (bucketCheck.ok) {
          const uploadRes = await uploadToFirebaseStorage(`images/${filename}`, req.file.buffer, req.file.mimetype);
          const verify = await verifyDownloadUrl(uploadRes.downloadUrl, req.file.buffer.length);
          if (verify.verified) {
            // Save ONLY metadata + download URL into Firestore app_images
            await updateFirestoreMetadata(filename, uploadRes.downloadUrl, `images/${filename}`, req.file.buffer.length, req.file.mimetype);
            return res.json({
              url: uploadRes.downloadUrl,
              secure_url: uploadRes.downloadUrl,
              public_id: filename,
              success: true,
              provider: 'firebase_storage'
            });
          }
        }
      } catch (fbErr) {
        console.warn('Firebase Storage upload failed, falling back to Firestore/disk:', fbErr);
      }

      // Safe Fallback: save to Firestore app_images & disk
      await saveImageToFirestoreServer(filename, req.file.buffer, req.file.mimetype);

      const url = `/storage/migrated/${filename}`;
      res.json({ url, secure_url: url, public_id: filename, success: true, provider: 'firestore' });
    } catch (error: any) {
      console.error('Storage upload error:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  });

  // Proxy image to bypass CORS in browser
  app.get('/api/proxy-image', async (req: any, res: any) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl || !targetUrl.startsWith('http')) {
        return res.status(400).json({ error: 'Invalid URL' });
      }
      const fetchRes = await fetch(targetUrl);
      if (!fetchRes.ok) {
        return res.status(fetchRes.status).send('Failed to fetch remote image');
      }
      const contentType = fetchRes.headers.get('content-type') || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      const arrayBuffer = await fetchRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Unified Upload Endpoint -> stores in Firestore app_images directly
  app.post('/api/upload', upload.single('image'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const ext = req.file.mimetype.includes('png') ? 'png' : req.file.mimetype.includes('webp') ? 'webp' : 'jpg';
      const cleanName = (req.file.originalname || `img_${Date.now()}`).split('.')[0].replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
      const filename = `${Date.now()}_${cleanName}.${ext}`;
      const destPath = path.join(migratedDir, filename);
      fs.writeFileSync(destPath, req.file.buffer);

      // Save to Firestore app_images
      await saveImageToFirestoreServer(filename, req.file.buffer, req.file.mimetype);

      const url = `/storage/migrated/${filename}`;
      res.json({
        url,
        secure_url: url,
        public_id: filename,
        width: 800,
        height: 600,
        format: ext,
        resource_type: 'image',
        provider: 'firestore',
        success: true
      });
    } catch (error: any) {
      console.error('Upload error to Firestore:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  });

  // Vite middleware for development vs static dist serving in production
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        if (req.path.startsWith('/api/')) {
          return res.status(404).json({ error: 'Endpoint not found' });
        }
        res.sendFile(path.join(distPath, 'index.html'));
      });
      console.log('Serving static files from:', distPath);
    } else {
      console.error('DIST folder not found! Build may have failed.');
      app.get('*all', (req, res) => {
        res.status(500).send('Application is building or failed to build. Please check logs.');
      });
    }
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });

  // If in production and PORT is different from 3000, also bind port 3000 as a non-blocking fallback
  if (isProduction && PORT !== 3000) {
    try {
      const fallbackServer = app.listen(3000, '0.0.0.0', () => {
        console.log('Fallback server also listening on port 3000');
      });
      fallbackServer.on('error', () => {
        // Silently ignore if port 3000 is unavailable
      });
    } catch {
      // Silently ignore
    }
  }

  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
}

startServer();
