import React, { useState, useRef } from 'react';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface ImageUploaderProps {
  folderName: string;
  onUploadSuccess: (url: string) => void;
  onError?: (error: string) => void;
  buttonText?: string;
  className?: string;
  previewImageUrl?: string;
  showPreview?: boolean;
  buttonClassName?: string;
  iconOnly?: boolean;
  skipResize?: boolean;
}

export default function ImageUploader({ 
  folderName, 
  onUploadSuccess, 
  onError, 
  buttonText = 'اختر صورة', 
  className = '',
  previewImageUrl = '',
  showPreview = true,
  buttonClassName = '',
  iconOnly = false,
  skipResize = false
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(previewImageUrl);

  const CLOUD_NAME = 'dqj6gzwfg';
  const UPLOAD_PRESET = 'uhicj3ig';

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (showPreview && !iconOnly) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }

    setIsUploading(true);

    try {
      // Client-side Resize before upload (only if not skipping)
      const resizedFile = skipResize ? file : await resizeImage(file, 1200, 1200);
      
      const formData = new FormData();
      formData.append('file', resizedFile);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', folderName);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();
      
      if (data.secure_url) {
        if (showPreview && !iconOnly) {
          setPreviewUrl(data.secure_url);
        }
        onUploadSuccess(data.secure_url);
      } else {
        throw new Error(data.error?.message || 'حدث خطأ أثناء رفع الصورة');
      }
    } catch (error) {
      console.error('Upload Error:', error);
      if (onError) onError(error instanceof Error ? error.message : 'فشل الرفع');
    } finally {
      setIsUploading(false);
      // Reset the value via target to allow picking the same file again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Helper function to resize image
  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob | File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          // Clear canvas for transparent images
          if (ctx) {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
          }
          
          // Determine type - if it's png or gif, keep it, otherwise use jpeg
          const outputType = (file.type === 'image/png' || file.type === 'image/gif') ? file.type : 'image/jpeg';
          
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: outputType }));
            } else {
              console.error('Canvas focus/blob generation failed');
              resolve(file);
            }
          }, outputType, 0.9); // 90% quality
        };
        img.onerror = () => {
          console.error('Image load failed during resize');
          resolve(file);
        };
      };
      reader.onerror = () => {
        console.error('File read failed during resize');
        resolve(file);
      };
    });
  };

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      {showPreview && previewUrl && !iconOnly && (
        <div className="relative w-32 h-32 rounded-2xl overflow-hidden glass-card border border-white/20">
          <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>
      )}
      
      <input 
        type="file" 
        accept="image/*" 
        ref={fileInputRef}
        onChange={handleFileChange} 
        className="hidden"
        disabled={isUploading}
      />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={isUploading}
        className={`${buttonClassName || (iconOnly 
          ? `flex items-center justify-center transition-all ${isUploading ? 'text-primary opacity-50 cursor-not-allowed' : 'text-slate-400 hover:text-primary cursor-pointer'}` 
          : `flex items-center justify-center cursor-pointer gap-2 px-6 py-3 rounded-2xl text-sm font-black transition-all w-full max-w-xs ${
          isUploading 
            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none' 
            : 'bg-primary text-white hover:bg-primary-dark shadow-xl hover:shadow-primary/30 active:scale-95'
        }`)}`}
      >
        {isUploading ? (
          iconOnly ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
              <Loader2 className="w-5 h-5" />
            </motion.div>
          ) : (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري الرفع والحفظ...</span>
            </>
          )
        ) : (
          iconOnly ? (
            <ImageIcon className="w-5 h-5" />
          ) : (
            <>
              <ImageIcon className="w-5 h-5" />
              <span>{buttonText}</span>
            </>
          )
        )}
      </button>
    </div>
  );
}
