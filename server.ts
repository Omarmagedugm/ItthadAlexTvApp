import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // API Routes
  app.get('/api/health', (req, res) => {
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

  // Cloudinary Upload Endpoint (Still needed for image management)
  app.post('/api/upload', upload.single('image'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const uploadPreset = process.env.UPLOAD_PRESET || 'jerseys';
      
      // Upload to Cloudinary using buffer
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { 
            upload_preset: uploadPreset,
            folder: 'ittehad-ai'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        uploadStream.end(req.file.buffer);
      });

      res.json(result);
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ error: error.message || 'Upload failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
