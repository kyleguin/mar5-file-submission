"use client";
import { useRef, useState, useEffect } from "react";
import { createClient } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);
const bucketName = 'webform-uploads';

export default function Home() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate video thumbnail
  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.playsInline = true;
        video.currentTime = 0.1;
        video.onloadeddata = () => {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png"));
          } else {
            resolve("");
          }
          URL.revokeObjectURL(video.src);
        };
        video.onerror = () => resolve("");
      } else if (file.type.startsWith("image/")) {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/png"));
          } else {
            resolve("");
          }
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve("");
      } else {
        // For non-image/video files, return an empty string (will show a placeholder)
        resolve("");
      }
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files ? Array.from(e.target.files) : [];
    if (selected.length > 10) {
      setError("You can upload a maximum of 10 files.");
      setFiles([]);
      setFilePreviews([]);
      return;
    }
    setError("");
    setFiles(selected);
    // Generate thumbnails
    const previews = await Promise.all(selected.map(generateThumbnail));
    setFilePreviews(previews);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    setFilePreviews(filePreviews.filter((_, i) => i !== index));
  };

  const handleCustomFileClick = () => {
    fileInputRef.current?.click();
  };

  // Helper to sanitize file names
  function sanitizeFileName(name: string) {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  // Placeholder submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess(false);
    setProgress(0);

    // Get form data
    const formData = new FormData(formRef.current!);
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const message = formData.get('message') as string;

    const uploadedFiles: { name: string; url: string }[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filePath = `${Date.now()}_${sanitizeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
        uploadedFiles.push({ name: file.name, url: publicUrlData.publicUrl });
        setProgress(Math.round(((i + 1) / files.length) * 100));
      }

      // Store submission in Supabase table
      const { error: insertError } = await supabase.from('submissions').insert([
        {
          name,
          email,
          message,
          files: uploadedFiles,
          submitted_at: new Date().toISOString(),
        },
      ]);
      if (insertError) throw insertError;

      setSubmitting(false);
      setSuccess(true);
      formRef.current?.reset();
      setFiles([]);
      setFilePreviews([]);
      setProgress(0);
    } catch {
      setSubmitting(false);
      setError('Upload failed. Please try again.');
      setProgress(0);
    }
  };

  useEffect(() => {
    if (success) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: [
          '#ff595e', // red
          '#ffca3a', // yellow
          '#8ac926', // green
          '#1982c4', // blue
          '#6a4c93', // purple
          '#ecab55', // mar5 orange
          '#fff',    // white
        ],
        scalar: 1.2,
      });
    }
  }, [success]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-4">
      {/* Loading Modal */}
      {submitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/10 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-lg p-8 flex flex-col items-center gap-4 min-w-[220px]">
            <svg className="animate-spin h-8 w-8 text-[#ecab55]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-[#ecab55] font-semibold text-lg">Uploading files...</span>
            <span className="text-gray-600 text-sm mt-2 text-center">This could take up to 3 minutes depending on file size.</span>
          </div>
        </div>
      )}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-10 flex flex-col gap-8 border border-gray-200 animate-fadein relative overflow-hidden">
        {!success ? (
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="flex flex-col gap-8"
          >
            <h1 className="text-2xl font-bold text-center mb-2" style={{ color: "rgb(236, 171, 85)" }}>
              Tell your Story
            </h1>
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="font-medium text-gray-700">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="border border-gray-300 rounded-lg px-4 py-2 bg-[#faf7f3] text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ecab55] focus:border-[#ecab55] transition-shadow shadow-sm"
                placeholder="Your name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="border border-gray-300 rounded-lg px-4 py-2 bg-[#faf7f3] text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ecab55] focus:border-[#ecab55] transition-shadow shadow-sm"
                placeholder="you@email.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="message" className="font-medium text-gray-700">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={3}
                className="border border-gray-300 rounded-lg px-4 py-2 bg-[#faf7f3] text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ecab55] focus:border-[#ecab55] transition-shadow shadow-sm resize-none"
                placeholder="Your message to the charity"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="video" className="font-medium text-gray-700">
                File Upload (max 10)
              </label>
              <input
                id="video"
                name="video"
                type="file"
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                multiple
                onChange={handleFileChange}
                ref={fileInputRef}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleCustomFileClick}
                className="w-full bg-[#ecab55] hover:bg-[#e09a3c] text-white font-semibold py-2 rounded transition-colors mb-2"
              >
                Upload Files
              </button>
              {filePreviews.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-2">
                  {filePreviews.map((src, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                      {src ? (
                        <img src={src} alt={`File thumbnail ${idx + 1}`} className="object-cover w-full h-full" />
                      ) : (
                        <span className="text-xs text-gray-400">No preview</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-bl"
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-[#ecab55] hover:bg-[#e09a3c] text-white font-semibold py-2 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
            {error && (
              <div className="text-red-600 text-center font-medium mt-2">
                {error}
              </div>
            )}
          </form>
        ) : (
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="text-3xl font-bold text-[#ecab55] text-center">Thank you for your submission!</h2>
            <p className="text-lg text-gray-700 text-center mt-2">We appreciate your story and support.</p>
          </div>
        )}
      </div>
    </div>
  );
}
