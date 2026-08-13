import React, { useState, useRef } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Loader2, 
  Calendar, 
  Trophy, 
  MapPin, 
  Dribbble,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAppStore } from '../store';

export interface ParsedMatchRow {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string;
  awayLogo: string;
  homeScore: string;
  awayScore: string;
  date: string; // ISO string
  displayDate: string;
  displayTime: string;
  competition: string;
  stadium: string;
  status: 'upcoming' | 'live' | 'finished';
  sport: 'football' | 'basketball' | 'other';
  isValid: boolean;
  validationError?: string;
}

interface CsvMatchesImporterProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DEFAULT_HOME_LOGO = 'https://res.cloudinary.com/dqj6gzwfg/image/upload/v1777720049/admin_homeLogo/bsxn6a8jxy6yfbyh56df.png';
const DEFAULT_AWAY_LOGO = 'https://upload.wikimedia.org/wikipedia/en/thumb/e/e4/Al_Ahly_SC_logo.png/150px-Al_Ahly_SC_logo.png';

// Robust CSV Line Parser that handles quotes, escaped quotes, and different delimiters
function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim());
  return result;
}

export default function CsvMatchesImporter({ isOpen, onClose, onSuccess }: CsvMatchesImporterProps) {
  const { clubs } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedRows, setParsedRows] = useState<ParsedMatchRow[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  // Download Sample CSV Template
  const downloadSampleCsv = () => {
    const sampleHeaders = 'الفريق المضيف,الفريق الضيف,التاريخ,الوقت,البطولة,الملعب,الحالة,الرياضة,نتيجة المضيف,نتيجة الضيف\n';
    const sampleData = [
      'الاتحاد السكندري,الأهلي,2026-09-15,19:00,الدوري المصري الممتاز,ستاد الإسكندرية,upcoming,football,-,-',
      'الاتحاد السكندري,الزمالك,2026-09-22,21:00,الدوري المصري الممتاز,ستاد الإسكندرية,upcoming,football,-,-',
      'الاتحاد السكندري,بيراميدز,2026-10-05,18:30,كأس مصر,ستاد الإسكندرية,upcoming,football,-,-',
      'الاتحاد السكندري,الأهلي السكندري,2026-10-12,18:00,دوري السلة السوبر,صالة الشاطبي,upcoming,basketball,-,-'
    ].join('\n');

    const csvContent = '\uFEFF' + sampleHeaders + sampleData; // UTF-8 BOM for Excel Arabic support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'نموذج_جدول_المباريات.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('تم تحميل نموذج CSV بنجاح');
  };

  // Helper to find team logo from database
  const getTeamLogo = (teamName: string, defaultLogo: string): string => {
    if (!teamName) return defaultLogo;
    const cleanName = teamName.trim().toLowerCase();
    
    // Check if Al Ittihad
    if (cleanName.includes('الاتحاد') || cleanName.includes('ittihad')) {
      return DEFAULT_HOME_LOGO;
    }

    // Check existing clubs list
    const foundClub = clubs.find(c => 
      c.name.trim().toLowerCase() === cleanName || 
      cleanName.includes(c.name.trim().toLowerCase()) ||
      c.name.trim().toLowerCase().includes(cleanName)
    );

    if (foundClub && foundClub.logo) {
      return foundClub.logo;
    }

    return defaultLogo;
  };

  // Process text content from CSV
  const processCsvText = (csvText: string) => {
    try {
      setIsProcessingFile(true);
      
      // Normalize newlines
      const lines = csvText.split(/\r\n|\n|\r/).filter(line => line.trim().length > 0);
      if (lines.length < 2) {
        toast.error('ملف CSV فارغ أو لا يحتوي على بيانات مباريات');
        setIsProcessingFile(false);
        return;
      }

      // Determine delimiter (, or ;)
      const firstLine = lines[0];
      const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';

      const rawHeaders = parseCsvLine(firstLine, delimiter).map(h => h.toLowerCase().trim());

      // Header index mapping helper
      const getHeaderIndex = (aliases: string[]): number => {
        return rawHeaders.findIndex(h => aliases.some(alias => h.includes(alias.toLowerCase())));
      };

      const homeTeamIdx = getHeaderIndex(['homeTeam', 'home_team', 'الفريق المضيف', 'الفريق الأول', 'المضيف', 'فريق 1', 'الفريق1']);
      const awayTeamIdx = getHeaderIndex(['awayTeam', 'away_team', 'الفريق الضيف', 'الفريق الثاني', 'الضيف', 'فريق 2', 'الفريق2']);
      const dateIdx = getHeaderIndex(['date', 'match_date', 'التاريخ', 'تاريخ المباراة', 'تاريخ']);
      const timeIdx = getHeaderIndex(['time', 'match_time', 'الوقت', 'توقيت المباراة', 'التوقيت', 'وقت']);
      const competitionIdx = getHeaderIndex(['competition', 'league', 'tournament', 'البطولة', 'المسابقة', 'الدوري']);
      const stadiumIdx = getHeaderIndex(['stadium', 'venue', 'location', 'الملعب', 'اسم الملعب', 'المكان']);
      const statusIdx = getHeaderIndex(['status', 'الحالة']);
      const sportIdx = getHeaderIndex(['sport', 'الرياضة', 'نوع الرياضة']);
      const homeScoreIdx = getHeaderIndex(['homeScore', 'home_score', 'نتيجة المضيف', 'أهداف المضيف', 'اهداف المضيف']);
      const awayScoreIdx = getHeaderIndex(['awayScore', 'away_score', 'نتيجة الضيف', 'أهداف الضيف', 'اهداف الضيف']);
      const homeLogoIdx = getHeaderIndex(['homeLogo', 'home_logo', 'شعار المضيف']);
      const awayLogoIdx = getHeaderIndex(['awayLogo', 'away_logo', 'شعار الضيف']);

      const parsed: ParsedMatchRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i], delimiter);
        if (row.length === 0 || (row.length === 1 && !row[0])) continue;

        const homeTeamRaw = homeTeamIdx !== -1 && row[homeTeamIdx] ? row[homeTeamIdx] : 'الاتحاد السكندري';
        const awayTeamRaw = awayTeamIdx !== -1 && row[awayTeamIdx] ? row[awayTeamIdx] : '';
        const dateRaw = dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : '';
        const timeRaw = timeIdx !== -1 && row[timeIdx] ? row[timeIdx] : '19:00';
        const compRaw = competitionIdx !== -1 && row[competitionIdx] ? row[competitionIdx] : 'الدوري المصري الممتاز';
        const stadiumRaw = stadiumIdx !== -1 && row[stadiumIdx] ? row[stadiumIdx] : 'ستاد الإسكندرية';
        const statusRaw = statusIdx !== -1 && row[statusIdx] ? row[statusIdx].toLowerCase() : 'upcoming';
        const sportRaw = sportIdx !== -1 && row[sportIdx] ? row[sportIdx].toLowerCase() : 'football';
        const homeScoreRaw = homeScoreIdx !== -1 && row[homeScoreIdx] ? row[homeScoreIdx] : '-';
        const awayScoreRaw = awayScoreIdx !== -1 && row[awayScoreIdx] ? row[awayScoreIdx] : '-';
        const homeLogoRaw = homeLogoIdx !== -1 && row[homeLogoIdx] ? row[homeLogoIdx] : '';
        const awayLogoRaw = awayLogoIdx !== -1 && row[awayLogoIdx] ? row[awayLogoIdx] : '';

        // Validation check
        let isValid = true;
        let validationError = '';

        if (!awayTeamRaw) {
          isValid = false;
          validationError = 'اسم الفريق الضيف مطلوب';
        }

        // Parse date and time
        let isoDate = new Date().toISOString();
        let displayDate = dateRaw || 'غير محدد';
        let displayTime = timeRaw || '19:00';

        if (dateRaw) {
          try {
            // Handle YYYY-MM-DD or DD/MM/YYYY or YYYY/MM/DD
            let formattedDateStr = dateRaw.trim();
            if (formattedDateStr.includes('/')) {
              const parts = formattedDateStr.split('/');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  // YYYY/MM/DD
                  formattedDateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                  // DD/MM/YYYY -> YYYY-MM-DD
                  formattedDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              }
            }

            const cleanTime = timeRaw ? timeRaw.trim() : '19:00';
            const fullDateString = `${formattedDateStr}T${cleanTime.length === 5 ? cleanTime + ':00' : cleanTime}`;
            const d = new Date(fullDateString);
            
            if (!isNaN(d.getTime())) {
              isoDate = d.toISOString();
              displayDate = formattedDateStr;
            } else {
              // Try fallback direct Date parse
              const fallbackD = new Date(dateRaw);
              if (!isNaN(fallbackD.getTime())) {
                isoDate = fallbackD.toISOString();
              }
            }
          } catch (err) {
            console.warn('Date parsing fallback:', err);
          }
        }

        // Determine Status
        let finalStatus: 'upcoming' | 'live' | 'finished' = 'upcoming';
        if (statusRaw.includes('منته') || statusRaw.includes('finish') || statusRaw.includes('انتهت')) {
          finalStatus = 'finished';
        } else if (statusRaw.includes('مباشر') || statusRaw.includes('live') || statusRaw.includes('جارية')) {
          finalStatus = 'live';
        }

        // Determine Sport
        let finalSport: 'football' | 'basketball' | 'other' = 'football';
        if (sportRaw.includes('سلة') || sportRaw.includes('basket')) {
          finalSport = 'basketball';
        }

        // Logos resolution
        const finalHomeLogo = homeLogoRaw || getTeamLogo(homeTeamRaw, DEFAULT_HOME_LOGO);
        const finalAwayLogo = awayLogoRaw || getTeamLogo(awayTeamRaw, DEFAULT_AWAY_LOGO);

        parsed.push({
          id: `match-row-${i}-${Date.now()}`,
          homeTeam: homeTeamRaw,
          awayTeam: awayTeamRaw,
          homeLogo: finalHomeLogo,
          awayLogo: finalAwayLogo,
          homeScore: homeScoreRaw || (finalStatus === 'upcoming' ? '-' : '0'),
          awayScore: awayScoreRaw || (finalStatus === 'upcoming' ? '-' : '0'),
          date: isoDate,
          displayDate,
          displayTime,
          competition: compRaw,
          stadium: stadiumRaw,
          status: finalStatus,
          sport: finalSport,
          isValid,
          validationError
        });
      }

      setParsedRows(parsed);
      if (parsed.length === 0) {
        toast.error('لم يتم العثور على أي مباريات صحيحة في الملف');
      } else {
        toast.success(`تم تحليل ${parsed.length} مباراة من الملف`);
      }
    } catch (err) {
      console.error('CSV Processing error:', err);
      toast.error('حدث خطأ أثناء قراءة ملف CSV');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        processCsvText(text);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          processCsvText(text);
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleRemoveRow = (id: string) => {
    setParsedRows(prev => prev.filter(r => r.id !== id));
  };

  const handleImportAll = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('لا توجد مباريات صالحة للاستيراد');
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: validRows.length });

    let countSuccess = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setUploadProgress({ current: i + 1, total: validRows.length });

      const payload = {
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        homeLogo: row.homeLogo,
        awayLogo: row.awayLogo,
        homeScore: row.homeScore,
        awayScore: row.awayScore,
        date: row.date,
        competition: row.competition,
        status: row.status,
        stadium: row.stadium,
        stadiumImage: '',
        stadiumOpacity: 0.2,
        timerStartTime: null,
        timerBaseMinute: 0,
        isTimerRunning: false,
        isMatchDay: false,
        featured: false,
        sport: row.sport
      };

      try {
        await addDoc(collection(db, 'matches'), payload);
        countSuccess++;

        // Auto add clubs if they don't exist in clubs collection
        const checkAndAddClub = async (name: string, logo: string) => {
          if (name && name !== 'الاتحاد' && name !== 'الاتحاد السكندري' && !clubs.find(c => c.name === name)) {
            try {
              await addDoc(collection(db, 'clubs'), { name, logo });
            } catch (err) {
              console.error('Error adding club:', err);
            }
          }
        };
        await checkAndAddClub(row.homeTeam, row.homeLogo);
        await checkAndAddClub(row.awayTeam, row.awayLogo);

      } catch (err) {
        console.error(`Error importing match ${row.homeTeam} vs ${row.awayTeam}:`, err);
        handleFirestoreError(err, OperationType.CREATE, 'matches');
      }
    }

    setIsUploading(false);
    toast.success(`تم استيراد ${countSuccess} مباراة بنجاح!`);
    
    if (onSuccess) {
      onSuccess();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-card-dark w-full max-w-4xl max-h-[90vh] rounded-3xl border border-border-light dark:border-border-dark shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50 dark:bg-surface-dark">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">إضافة مباريات بالجملة (CSV)</h2>
              <p className="text-xs font-bold text-slate-500">رفع جدول المباريات دفعة واحدة عبر ملف CSV</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            disabled={isUploading}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Instructions and Sample Download */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
              <div className="text-xs font-bold text-blue-900 dark:text-blue-200 leading-relaxed">
                يمكنك إعداد ملف CSV أو شيت Excel يحتوي على الأعمدة التالية:
                <br />
                <span className="text-[11px] opacity-80">
                  الفريق المضيف، الفريق الضيف، التاريخ، الوقت، البطولة، الملعب، الحالة، الرياضة
                </span>
              </div>
            </div>

            <button
              onClick={downloadSampleCsv}
              type="button"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-sm shrink-0 transition-all active:scale-95"
            >
              <Download size={14} />
              تحميل نموذج CSV
            </button>
          </div>

          {/* File Drop Zone */}
          {parsedRows.length === 0 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                dragActive 
                  ? 'border-primary bg-primary/5 scale-[0.99]' 
                  : 'border-slate-200 dark:border-border-dark hover:border-primary/50 bg-slate-50/50 dark:bg-surface-dark/50'
              }`}
            >
              <input 
                ref={fileInputRef} 
                type="file" 
                accept=".csv, .txt" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              
              <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                {isProcessingFile ? <Loader2 size={28} className="animate-spin" /> : <Upload size={28} />}
              </div>

              <div>
                <p className="text-sm font-black text-slate-800 dark:text-white">
                  اسحب ملف CSV هنا أو انقر للاختيار من الجهاز
                </p>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  يدعم صيغ .csv مع ترميز UTF-8
                </p>
              </div>
            </div>
          )}

          {/* Parsed Matches Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-slate-100 dark:bg-surface-dark p-3 rounded-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    تم قراءة ({parsedRows.length}) مباراة
                  </span>
                  <span className="text-[10px] font-black bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full">
                    جاهزة للاستيراد: {parsedRows.filter(r => r.isValid).length}
                  </span>
                  {parsedRows.some(r => !r.isValid) && (
                    <span className="text-[10px] font-black bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full">
                      غير صالحة: {parsedRows.filter(r => !r.isValid).length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    className="text-xs font-black text-primary hover:underline px-2 py-1"
                  >
                    تغيير الملف
                  </button>
                  <button
                    onClick={() => setParsedRows([])}
                    type="button"
                    className="text-xs font-black text-red-500 hover:underline px-2 py-1"
                  >
                    محي الكل
                  </button>
                </div>
              </div>

              {/* Table / Cards List */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {parsedRows.map((row, idx) => (
                  <div 
                    key={row.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      row.isValid 
                        ? 'bg-white dark:bg-surface-dark border-border-light dark:border-border-dark' 
                        : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                    }`}
                  >
                    {/* Teams & Logos */}
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <span className="text-xs font-black text-slate-400 w-5">#{idx + 1}</span>
                      
                      <div className="flex items-center gap-2">
                        {/* Home Team */}
                        <div className="flex items-center gap-1.5">
                          {row.homeLogo && (
                            <img src={row.homeLogo} alt="" className="w-6 h-6 object-contain rounded" referrerPolicy="no-referrer" />
                          )}
                          <span className="text-xs font-black text-slate-900 dark:text-white">{row.homeTeam}</span>
                        </div>

                        <span className="text-xs font-black text-slate-400">×</span>

                        {/* Away Team */}
                        <div className="flex items-center gap-1.5">
                          {row.awayLogo && (
                            <img src={row.awayLogo} alt="" className="w-6 h-6 object-contain rounded" referrerPolicy="no-referrer" />
                          )}
                          <span className="text-xs font-black text-slate-900 dark:text-white">{row.awayTeam || 'غير محدد'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Match Info Details */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-bold">
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-card-dark px-2.5 py-1 rounded-xl">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{row.displayDate} ({row.displayTime})</span>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-card-dark px-2.5 py-1 rounded-xl">
                        <Trophy size={13} className="text-amber-500" />
                        <span>{row.competition}</span>
                      </div>

                      {row.stadium && (
                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-card-dark px-2.5 py-1 rounded-xl">
                          <MapPin size={13} className="text-slate-400" />
                          <span>{row.stadium}</span>
                        </div>
                      )}

                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        row.sport === 'basketball' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-600'
                      }`}>
                        {row.sport === 'basketball' ? 'كرة سلة' : 'كرة قدم'}
                      </span>
                    </div>

                    {/* Error message or Remove Action */}
                    <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 dark:border-border-dark">
                      {!row.isValid && (
                        <span className="text-[11px] font-bold text-red-500 flex items-center gap-1">
                          <AlertCircle size={14} />
                          {row.validationError}
                        </span>
                      )}

                      <button
                        onClick={() => handleRemoveRow(row.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all"
                        title="حذف هذه المباراة من القائمة"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50 dark:bg-surface-dark">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-5 py-2.5 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-slate-300 dark:hover:bg-slate-700 transition-all"
          >
            إلغاء
          </button>

          {parsedRows.length > 0 && (
            <button
              onClick={handleImportAll}
              disabled={isUploading || parsedRows.filter(r => r.isValid).length === 0}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-primary text-white text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 disabled:opacity-50 transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>جاري استيراد ({uploadProgress.current}/{uploadProgress.total})...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>استيراد جميع المباريات ({parsedRows.filter(r => r.isValid).length})</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
