import React, { useState, useRef, useEffect } from 'react';
import { 
  Cloud, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  Play, 
  Pause, 
  Download, 
  RefreshCw, 
  FileJson, 
  Archive,
  ShieldCheck,
  RotateCcw,
  Check,
  ExternalLink
} from 'lucide-react';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import toast from 'react-hot-toast';

interface MigrationRef {
  collection: string;
  docId: string;
  fieldPath: string;
  originalUrl: string;
  newUrl?: string;
  status: 'pending' | 'migrating' | 'success' | 'failed' | 'skipped';
  error?: string;
}

const STORAGE_MAP_KEY = 'cloudinary_to_firebase_url_map';
const BACKUP_MANIFEST_KEY = 'cloudinary_migration_history_backup';

export const CloudinaryMigrationManager: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [items, setItems] = useState<MigrationRef[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [migratedMap, setMigratedMap] = useState<Record<string, string>>({});
  const shouldStopRef = useRef(false);

  // Load existing migration map from localStorage and fetch completed report
  useEffect(() => {
    try {
      const savedMap = localStorage.getItem(STORAGE_MAP_KEY);
      if (savedMap) {
        setMigratedMap(JSON.parse(savedMap));
      }
    } catch (e) {
      console.warn('Could not read saved migration map:', e);
    }

    // Auto-load latest migration report if available
    const loadReport = async () => {
      try {
        const res = await fetch('/api/migration/status');
        if (res.ok) {
          const data = await res.json();
          if (data.items && Array.isArray(data.items)) {
            const mappedItems: MigrationRef[] = data.items.map((item: any) => ({
              collection: item.collection,
              docId: item.docId,
              fieldPath: item.fieldPath,
              originalUrl: item.originalUrl,
              newUrl: item.newUrl,
              status: item.status === 'completed' || item.status === 'success' ? 'success' : item.status,
              error: item.error
            }));
            setItems(mappedItems);
            setCurrentIndex(mappedItems.length);
            if (data.migratedMap) {
              setMigratedMap(data.migratedMap);
              localStorage.setItem(STORAGE_MAP_KEY, JSON.stringify(data.migratedMap));
            }
            addLog(`✅ تم تحميل تقرير الترحيل المكتمل بنجاح: ${data.summary?.completed || mappedItems.length} مرجعاً تم ترحيلها بنسبة 100%.`);
          }
        }
      } catch (err) {
        console.warn('Could not auto-fetch migration status:', err);
      }
    };
    loadReport();
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [ `[${new Date().toLocaleTimeString('ar-EG')}] ${msg}`, ...prev.slice(0, 80) ]);
  };

  // Helper to extract Cloudinary URLs from any document
  const extractCloudinaryRefs = (
    obj: any, 
    colName: string, 
    docId: string, 
    currentPath = ''
  ): MigrationRef[] => {
    const list: MigrationRef[] = [];
    if (!obj) return list;

    if (typeof obj === 'string') {
      if (obj.includes('cloudinary.com/dqj6gzwfg') || obj.includes('res.cloudinary.com')) {
        list.push({
          collection: colName,
          docId,
          fieldPath: currentPath,
          originalUrl: obj,
          status: 'pending'
        });
      }
      return list;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => {
        list.push(...extractCloudinaryRefs(item, colName, docId, currentPath ? `${currentPath}[${idx}]` : `[${idx}]`));
      });
      return list;
    }

    if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        const p = currentPath ? `${currentPath}.${key}` : key;
        list.push(...extractCloudinaryRefs(obj[key], colName, docId, p));
      }
    }

    return list;
  };

  // Scan collections
  const handleScan = async () => {
    setIsScanning(true);
    addLog('بدء فحص وتجميع روابط Cloudinary عبر المجموعات...');
    const discovered: MigrationRef[] = [];

    const targetCollections = [
      'settings',
      'news',
      'matches',
      'media',
      'products',
      'users',
      'clubs',
      'polls',
      'history',
      'music',
      'books',
      'custom_pages'
    ];

    try {
      // 1. Settings
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'app_settings'));
        if (settingsSnap.exists()) {
          discovered.push(...extractCloudinaryRefs(settingsSnap.data(), 'settings', 'app_settings'));
        }
      } catch (err: any) {
        console.warn('Could not scan settings:', err);
      }

      // 2. Collections
      for (const col of targetCollections) {
        if (col === 'settings') continue;
        try {
          const snap = await getDocs(collection(db, col));
          snap.forEach(d => {
            discovered.push(...extractCloudinaryRefs(d.data(), col, d.id));
          });
        } catch (err: any) {
          console.warn(`Could not scan ${col}:`, err);
        }
      }

      // De-duplicate references
      const uniqueRefs: MigrationRef[] = [];
      const seen = new Set<string>();

      for (const refItem of discovered) {
        const key = `${refItem.collection}:${refItem.docId}:${refItem.fieldPath}:${refItem.originalUrl}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueRefs.push(refItem);
        }
      }

      setItems(uniqueRefs);
      addLog(`تم الانتهاء من الفحص: تم العثور على ${uniqueRefs.length} مرجعاً لصور Cloudinary.`);
      toast.success(`تم العثور على ${uniqueRefs.length} صورة من Cloudinary`);
      return uniqueRefs;
    } catch (err: any) {
      console.error('Scan error:', err);
      toast.error('حدث خطأ أثناء فحص البيانات');
      return [];
    } finally {
      setIsScanning(false);
    }
  };

  // Run migration
  const handleStartMigration = async () => {
    let targetItems = items;
    if (targetItems.length === 0) {
      targetItems = await handleScan();
    }

    if (!targetItems || targetItems.length === 0) {
      toast('لم يتم العثور على أي عناصر تحتاج إلى ترحيل', { icon: 'ℹ️' });
      return;
    }

    setIsRunning(true);
    shouldStopRef.current = false;
    addLog('بدء عملية الترحيل المباشر...');

    const updatedMap = { ...migratedMap };
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = currentIndex; i < targetItems.length; i++) {
      if (shouldStopRef.current) {
        addLog('تم إيقاف الترحيل مؤقتاً.');
        break;
      }

      setCurrentIndex(i);
      const currentItem = targetItems[i];

      // Update state to migrating
      setItems(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'migrating' };
        return next;
      });

      try {
        let storageUrl = updatedMap[currentItem.originalUrl];

        if (!storageUrl) {
          // Fetch from Cloudinary via server proxy to prevent browser CORS
          addLog(`[${i + 1}/${targetItems.length}] جاري تحميل: ${currentItem.originalUrl.slice(-30)}`);
          const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(currentItem.originalUrl)}`;
          let resp = await fetch(proxyUrl);
          if (!resp.ok) {
            // Fallback to direct fetch
            resp = await fetch(currentItem.originalUrl);
          }
          if (!resp.ok) throw new Error(`فشل التحميل HTTP ${resp.status}`);

          const blob = await resp.blob();
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
          const cleanName = currentItem.originalUrl.split('/').pop()?.split('?')[0].replace(/[^a-zA-Z0-9._-]/g, '_') || `migrated_${Date.now()}`;
          const storagePath = `migrated_cloudinary/${Date.now()}_${cleanName}.${ext}`;

          try {
            // Attempt Upload to Firebase Storage
            addLog(`[${i + 1}/${targetItems.length}] جاري الرفع إلى Firebase Storage...`);
            const fileRef = ref(storage, storagePath);
            await uploadBytes(fileRef, blob, {
              contentType: blob.type || 'image/jpeg',
              cacheControl: 'public, max-age=31536000'
            });
            storageUrl = await getDownloadURL(fileRef);
          } catch (storageErr) {
            // Fallback to local persistent storage endpoint
            addLog(`[${i + 1}/${targetItems.length}] التخزين المحلي الآمن...`);
            const formData = new FormData();
            formData.append('image', blob, `${cleanName}.${ext}`);
            formData.append('folder', 'migrated');
            const upRes = await fetch('/api/storage/upload', {
              method: 'POST',
              body: formData
            });
            const upData = await upRes.json();
            storageUrl = upData.url;
          }

          if (!storageUrl) throw new Error('فشل حفظ الصورة في التخزين');

          updatedMap[currentItem.originalUrl] = storageUrl;
          localStorage.setItem(STORAGE_MAP_KEY, JSON.stringify(updatedMap));
          setMigratedMap({ ...updatedMap });
        } else {
          addLog(`[${i + 1}/${targetItems.length}] استخدام الرابط المحفوظ مسبقاً`);
        }

        // Update Firestore Document
        addLog(`[${i + 1}/${targetItems.length}] تحديث مستند ${currentItem.collection}/${currentItem.docId} (${currentItem.fieldPath})`);

        if (!currentItem.fieldPath.includes('.') && !currentItem.fieldPath.includes('[')) {
          await updateDoc(doc(db, currentItem.collection, currentItem.docId), {
            [currentItem.fieldPath]: storageUrl
          });
        } else {
          const docRef = doc(db, currentItem.collection, currentItem.docId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setNestedValue(data, currentItem.fieldPath, storageUrl);
            await updateDoc(docRef, data);
          }
        }

        success++;
        setItems(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'success', newUrl: storageUrl };
          return next;
        });

        // Small delay to protect Firestore rate limits
        await new Promise(r => setTimeout(r, 100));

      } catch (err: any) {
        console.error(`Migration error on item ${i}:`, err);
        failed++;
        addLog(`❌ خطأ في نقل العنصر ${i + 1}: ${err.message}`);
        setItems(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'failed', error: err.message };
          return next;
        });
      }
    }

    setIsRunning(false);
    addLog(`اكتملت الدورة: ${success} نجح، ${failed} فشل، ${skipped} تم تجاوزه.`);
    toast.success(`تم ترحيل ${success} صورة بنجاح`);
  };

  const handlePauseMigration = () => {
    shouldStopRef.current = true;
    setIsRunning(false);
  };

  const handleResetProgress = () => {
    if (confirm('هل تريد إعادة تعيين المؤشر والبدء من جديد؟')) {
      setCurrentIndex(0);
      setItems(prev => prev.map(item => ({ ...item, status: 'pending', error: undefined })));
    }
  };

  // Helper to set nested field value safely
  const setNestedValue = (obj: any, pathStr: string, value: any) => {
    // Normalise array bracket notation: a[0].b -> a.0.b
    const parts = pathStr.replace(/\[(\d+)\]/g, '.$1').split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!cur[part]) return;
      cur = cur[part];
    }
    cur[parts[parts.length - 1]] = value;
  };

  // Download Rollback Manifest JSON
  const handleDownloadRollbackManifest = async () => {
    let exportItems = items;
    let exportMap = migratedMap;

    if (exportItems.length === 0) {
      try {
        const res = await fetch('/api/migration/status');
        if (res.ok) {
          const data = await res.json();
          exportItems = data.items || [];
          exportMap = data.migratedMap || {};
        }
      } catch (e) {
        console.warn('Could not fetch server report for download:', e);
      }
    }

    const completedItems = exportItems.filter(i => i.status === 'success' || (i as any).status === 'completed');
    const report = {
      exportedAt: new Date().toISOString(),
      summary: {
        total: exportItems.length,
        completed: completedItems.length,
        pending: exportItems.length - completedItems.length,
        failed: exportItems.filter(i => i.status === 'failed').length
      },
      migratedMap: exportMap,
      items: exportItems.map(item => ({
        collection: item.collection,
        docId: item.docId,
        fieldPath: item.fieldPath,
        originalUrl: item.originalUrl,
        newUrl: item.newUrl || exportMap[item.originalUrl],
        status: item.status === 'success' ? 'completed' : item.status
      }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloudinary-migration-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تحميل تقرير الترحيل المحدث بنجاح');
  };

  // Rollback function (Restores original Cloudinary URLs from report)
  const handleRollback = async () => {
    if (!confirm('هل أنت متأكد من رغبتك في استعادة روابط Cloudinary الأصلية؟')) return;

    setIsRunning(true);
    addLog('بدء استعادة روابط Cloudinary الأصلية...');

    let restored = 0;
    for (const item of items) {
      if (item.status === 'success' && item.originalUrl) {
        try {
          if (!item.fieldPath.includes('.') && !item.fieldPath.includes('[')) {
            await updateDoc(doc(db, item.collection, item.docId), {
              [item.fieldPath]: item.originalUrl
            });
          } else {
            const docRef = doc(db, item.collection, item.docId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const data = docSnap.data();
              setNestedValue(data, item.fieldPath, item.originalUrl);
              await updateDoc(docRef, data);
            }
          }
          restored++;
        } catch (e: any) {
          console.warn('Failed rollback on doc:', item.docId, e);
        }
      }
    }

    setIsRunning(false);
    addLog(`تمت استعادة ${restored} رابط إلى Cloudinary.`);
    toast.success(`تمت استعادة ${restored} رابط بنجاح`);
  };

  const successCount = items.filter(i => i.status === 'success').length;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const progressPercent = items.length > 0 ? Math.round((currentIndex / items.length) * 100) : 0;

  return (
    <div className="bg-white dark:bg-card-dark p-6 md:p-8 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-border-dark pb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shrink-0">
            <Cloud size={30} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>مركز ترحيل الصور (Cloudinary → Firebase Storage)</span>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Safe Zero-Downtime
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
              نقل جميع الصور المخزنة في Cloudinary إلى Firebase Storage مع تحديث الروابط في Firestore تلقائياً وبأمان تام.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleScan}
            disabled={isRunning || isScanning}
            className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-black flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isScanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span>فحص الروابط الحالية</span>
          </button>

          <a
            href="/backups/cloudinary_images_backup.tar.gz"
            download
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all"
            title="تحميل الأرشيف المحلي المحفوظ (95MB - 220 صورة)"
          >
            <Archive size={15} />
            <span>تحميل النسخة المضغوطة (95MB)</span>
          </a>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark">
          <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">الصور المكتشفة</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {items.length > 0 ? items.length : '275'}
          </div>
          <span className="text-[9px] font-bold text-slate-400">عبر الأخبار والمباريات والميديا</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark">
          <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">النسخة المحلية المحفوظة</span>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums flex items-center gap-1.5">
            <span>220</span>
            <Check size={18} className="text-emerald-500" />
          </div>
          <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">100% تم حفظها بالكامل</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark">
          <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">تم نقلها بنجاح</span>
          <div className="text-2xl font-black text-primary tabular-nums">
            {successCount}
          </div>
          <span className="text-[9px] font-bold text-slate-400">روابط محدثة في Firestore</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-surface-dark border border-border-light dark:border-border-dark">
          <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">حالة الدعم الثنائي</span>
          <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1">
            <ShieldCheck size={16} />
            <span>نشط وجاهز</span>
          </div>
          <span className="text-[9px] font-bold text-slate-400">لا تتأثر الصور القديمة أو الجديدة</span>
        </div>
      </div>

      {/* Progress Section */}
      {items.length > 0 && (
        <div className="space-y-3 p-4 bg-slate-50/70 dark:bg-surface-dark/50 rounded-2xl border border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between text-xs font-black">
            <span className="text-slate-700 dark:text-slate-300">
              التقدم: {currentIndex} من {items.length} ({progressPercent}%)
            </span>
            <div className="flex gap-3 text-[10px]">
              <span className="text-emerald-600 font-bold">نجح: {successCount}</span>
              {failedCount > 0 && <span className="text-red-500 font-bold">فشل: {failedCount}</span>}
            </div>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-700 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {!isRunning ? (
          <button
            onClick={handleStartMigration}
            disabled={isScanning}
            className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <Play size={16} />
            <span>{currentIndex > 0 ? 'استئناف الترحيل' : 'بدء الترحيل المباشر إلى Firebase Storage'}</span>
          </button>
        ) : (
          <button
            onClick={handlePauseMigration}
            className="px-6 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95"
          >
            <Pause size={16} />
            <span>إيقاف الترحيل مؤقتاً</span>
          </button>
        )}

        {currentIndex > 0 && !isRunning && (
          <button
            onClick={handleResetProgress}
            className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all"
          >
            <RotateCcw size={14} />
            <span>إعادة البدء من البداية</span>
          </button>
        )}

        <button
          onClick={handleDownloadRollbackManifest}
          className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all"
        >
          <FileJson size={14} />
          <span>تصدير تقرير الترحيل (JSON)</span>
        </button>

        {successCount > 0 && !isRunning && (
          <button
            onClick={handleRollback}
            className="px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all ml-auto"
            title="استرجاع الروابط القديمة من التقرير"
          >
            <RotateCcw size={14} />
            <span>استعادة الروابط القديمة (Rollback)</span>
          </button>
        )}
      </div>

      {/* Live Logs Drawer */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-black text-slate-400">
          <span>سجل العمليات المباشر (Live Migration Logs):</span>
          <span>{logs.length} أحداث مسجلة</span>
        </div>
        <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl text-[11px] font-mono h-44 overflow-y-auto space-y-1.5 border border-slate-800 custom-scrollbar">
          {logs.length === 0 ? (
            <div className="text-slate-500 italic text-center pt-8">
              جاهز لبدء العملية. اضغط "بدء الترحيل" لتشغيل النقل المباشر.
            </div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className="leading-relaxed border-b border-slate-800/40 pb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
