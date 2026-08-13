import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import dotenv from 'dotenv';
import { initializeApp, getApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

// Firebase Admin initialization
const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
let db: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    const app = getApps().length === 0 
      ? initializeApp({ projectId: config.projectId })
      : getApp();
    
    // Support custom database ID if available
    db = getFirestore(app, config.firestoreDatabaseId || '(default)');
    console.log('Firebase Admin initialized successfully');
  } catch (err) {
    console.error('Error initializing Firebase Admin:', err);
  }
}

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

  app.post('/api/users/sync-auth', async (req: any, res: any) => {
    try {
      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' });
      }
      const adminApp = getApps()[0];
      if (!adminApp) {
        return res.status(500).json({ error: 'Firebase Admin not initialized' });
      }
      const authInstance = getAuth(adminApp);
      
      const authUsers: any[] = [];
      let nextPageToken: string | undefined = undefined;
      
      do {
        const listUsersResult = await authInstance.listUsers(1000, nextPageToken);
        authUsers.push(...listUsersResult.users);
        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken);
      
      console.log(`Fetched ${authUsers.length} users from Firebase Auth`);

      const usersColl = db.collection('users');
      const snapshot = await usersColl.get();
      const existingUids = new Set<string>();
      snapshot.forEach((doc: any) => {
        existingUids.add(doc.id);
      });

      let createdCount = 0;
      let currentBatch = db.batch();
      let batchSize = 0;

      for (const authUser of authUsers) {
        if (!existingUids.has(authUser.uid)) {
          const docRef = usersColl.doc(authUser.uid);
          const name = authUser.displayName || authUser.email?.split('@')[0] || 'عضو غير معروف';
          
          const userData = {
            uid: authUser.uid,
            name: name,
            email: authUser.email || '',
            role: 'user',
            tier: 'new',
            joinDate: authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
            lastActive: authUser.metadata.lastSignInTime ? new Date(authUser.metadata.lastSignInTime).toISOString() : new Date().toISOString(),
            createdAt: authUser.metadata.creationTime ? new Date(authUser.metadata.creationTime).toISOString() : new Date().toISOString()
          };
          
          currentBatch.set(docRef, userData);
          batchSize++;
          createdCount++;

          if (batchSize >= 400) {
            await currentBatch.commit();
            currentBatch = db.batch();
            batchSize = 0;
          }
        }
      }

      if (batchSize > 0) {
        await currentBatch.commit();
      }

      res.json({
        success: true,
        authUserCount: authUsers.length,
        firestoreUserCountBefore: existingUids.size,
        createdCount,
        totalNow: existingUids.size + createdCount
      });
    } catch (error: any) {
      console.error('Error syncing auth users with firestore:', error);
      res.status(500).json({ error: error.message || 'Synchronization failed' });
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
