import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import { useTheme } from '../../utils/themeContext';
import {
  X,
  Camera,
  RotateCw,
  RotateCcw,
  Sliders,
  Check,
  Download,
  FileText,
  Upload,
  RefreshCw,
  Sparkles,
  Sun,
  Contrast,
  Crop,
  Maximize2,
  Wand2,
  AlertCircle,
  Undo2,
  ZoomIn,
  Eye
} from 'lucide-react';

interface DocumentScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (scannedDocumentBase64: string) => void;
  title?: string;
  subtitle?: string;
}

type ScannerStep = 'CAMERA' | 'CROP' | 'PREVIEW';
type ScanFilterMode = 'MAGIC_COLOR' | 'MAGIC_PRO' | 'ACLARAR' | 'GRAYSCALE' | 'ORIGINAL';

interface CornerPoint {
  x: number; // in image pixel space
  y: number; // in image pixel space
}

export const DocumentScannerModal: React.FC<DocumentScannerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  title = 'Escáner Profesional de Boletas y Facturas',
  subtitle = 'Auto-detección de bordes, enderezado a 90° y calidad fotocopiadora CamScanner'
}) => {
  const { themeClasses } = useTheme();

  // Wizard Steps: CAMERA -> CROP -> PREVIEW
  const [step, setStep] = useState<ScannerStep>('CAMERA');

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCameraError, setHasCameraError] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);

  // Raw captured image & native dimensions
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // 4 Corner Points for Perspective Quad [TL, TR, BR, BL] in image coordinates
  const [corners, setCorners] = useState<[CornerPoint, CornerPoint, CornerPoint, CornerPoint]>([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: 0 }
  ]);

  // Handle tracking: 0-3: Corners (TL, TR, BR, BL) | 4-7: Edge Midpoints (Top, Right, Bottom, Left)
  const [activeHandleIdx, setActiveHandleIdx] = useState<number | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragStartCorners, setDragStartCorners] = useState<[CornerPoint, CornerPoint, CornerPoint, CornerPoint] | null>(null);

  // Magnifier Loupe state during corner drag
  const [loupePos, setLoupePos] = useState<{ x: number; y: number; imgX: number; imgY: number } | null>(null);

  // Crop Canvas ref
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Unwarped and Enhanced Images
  const [unwarpedImage, setUnwarpedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<ScanFilterMode>('MAGIC_COLOR');
  const [rotation, setRotation] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(140);
  const [brightness, setBrightness] = useState<number>(115);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize camera when modal opens in CAMERA step
  useEffect(() => {
    if (isOpen && step === 'CAMERA') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, step]);

  const startCamera = async () => {
    setCameraLoading(true);
    setHasCameraError(false);
    try {
      if (streamRef.current) {
        stopCamera();
      }

      // Request Full HD / 4K Ultra High Definition back camera feed
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 3840, min: 1920 },
          height: { ideal: 2160, min: 1080 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraLoading(false);
    } catch (err) {
      console.warn('Error accessing back camera at max res, trying standard HD:', err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 }
          },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraLoading(false);
      } catch (errFallback) {
        setHasCameraError(true);
        setCameraLoading(false);
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Robust Document Boundary & Corner Detector (Sobel Line-Profiling & Least-Squares Edge Intersection)
  const detectDocumentCorners = (img: HTMLImageElement): [CornerPoint, CornerPoint, CornerPoint, CornerPoint] => {
    const w = img.width;
    const h = img.height;

    try {
      const targetSize = 400;
      const scale = Math.min(targetSize / w, targetSize / h);
      const sw = Math.round(w * scale);
      const sh = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('No 2d context');

      ctx.drawImage(img, 0, 0, sw, sh);
      const imgData = ctx.getImageData(0, 0, sw, sh);
      const data = imgData.data;

      // 1. Compute Grayscale
      const gray = new Float32Array(sw * sh);
      for (let i = 0; i < sw * sh; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      }

      // 2. Compute Horizontal (Gx) and Vertical (Gy) Sobel Gradients
      const gx = new Float32Array(sw * sh);
      const gy = new Float32Array(sw * sh);

      for (let y = 1; y < sh - 1; y++) {
        for (let x = 1; x < sw - 1; x++) {
          const pIdx = y * sw + x;
          const gX =
            -gray[(y - 1) * sw + (x - 1)] + gray[(y - 1) * sw + (x + 1)] +
            -2 * gray[y * sw + (x - 1)] + 2 * gray[y * sw + (x + 1)] +
            -gray[(y + 1) * sw + (x - 1)] + gray[(y + 1) * sw + (x + 1)];
          const gY =
            -gray[(y - 1) * sw + (x - 1)] - 2 * gray[(y - 1) * sw + x] - gray[(y - 1) * sw + (x + 1)] +
            gray[(y + 1) * sw + (x - 1)] + 2 * gray[(y + 1) * sw + x] + gray[(y + 1) * sw + (x + 1)];

          gx[pIdx] = gX;
          gy[pIdx] = gY;
        }
      }

      // 3. Detect 4 Dominant Document Edge Lines via Gradient Ridge Profiling
      // A) Top Edge (Transitions from dark desk to light paper in upper 48%)
      const topEdgePts: { x: number; y: number }[] = [];
      for (let x = Math.round(sw * 0.15); x <= Math.round(sw * 0.85); x += 3) {
        let maxGrad = 35;
        let bestY = -1;
        for (let y = Math.round(sh * 0.05); y <= Math.round(sh * 0.45); y++) {
          const val = gy[y * sw + x]; // positive gradient when going from dark to light
          if (val > maxGrad) {
            maxGrad = val;
            bestY = y;
          }
        }
        if (bestY !== -1) topEdgePts.push({ x, y: bestY });
      }

      // B) Bottom Edge (Transitions from light paper to dark desk in lower 48%)
      const botEdgePts: { x: number; y: number }[] = [];
      for (let x = Math.round(sw * 0.15); x <= Math.round(sw * 0.85); x += 3) {
        let maxGrad = 35;
        let bestY = -1;
        for (let y = Math.round(sh * 0.55); y <= Math.round(sh * 0.95); y++) {
          const val = -gy[y * sw + x]; // negative gradient when going from light to dark
          if (val > maxGrad) {
            maxGrad = val;
            bestY = y;
          }
        }
        if (bestY !== -1) botEdgePts.push({ x, y: bestY });
      }

      // C) Left Edge (Transitions from dark desk to light paper on left 48%)
      const leftEdgePts: { x: number; y: number }[] = [];
      for (let y = Math.round(sh * 0.15); y <= Math.round(sh * 0.85); y += 3) {
        let maxGrad = 35;
        let bestX = -1;
        for (let x = Math.round(sw * 0.05); x <= Math.round(sw * 0.45); x++) {
          const val = gx[y * sw + x]; // positive gradient from dark to light
          if (val > maxGrad) {
            maxGrad = val;
            bestX = x;
          }
        }
        if (bestX !== -1) leftEdgePts.push({ x: bestX, y });
      }

      // D) Right Edge (Transitions from light paper to dark desk on right 48%)
      const rightEdgePts: { x: number; y: number }[] = [];
      for (let y = Math.round(sh * 0.15); y <= Math.round(sh * 0.85); y += 3) {
        let maxGrad = 35;
        let bestX = -1;
        for (let x = Math.round(sw * 0.55); x <= Math.round(sw * 0.95); x++) {
          const val = -gx[y * sw + x]; // negative gradient from light to dark
          if (val > maxGrad) {
            maxGrad = val;
            bestX = x;
          }
        }
        if (bestX !== -1) rightEdgePts.push({ x: bestX, y });
      }

      // Helper: Robust Median / Trimmed Linear Fit
      const fitHorizontalLine = (pts: { x: number; y: number }[]): { m: number; c: number } | null => {
        if (pts.length < 5) return null;
        // Sort by y and take interquartile mean
        const sortedY = pts.map(p => p.y).sort((a, b) => a - b);
        const medY = sortedY[Math.floor(sortedY.length / 2)];
        const valid = pts.filter(p => Math.abs(p.y - medY) < sh * 0.08);
        if (valid.length < 4) return { m: 0, c: medY };

        let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
        for (const p of valid) {
          sumX += p.x;
          sumY += p.y;
          sumXX += p.x * p.x;
          sumXY += p.x * p.y;
        }
        const n = valid.length;
        const denom = n * sumXX - sumX * sumX;
        if (Math.abs(denom) < 1e-4) return { m: 0, c: sumY / n };
        const m = (n * sumXY - sumX * sumY) / denom;
        const c = (sumY - m * sumX) / n;
        return { m, c };
      };

      const fitVerticalLine = (pts: { x: number; y: number }[]): { m: number; c: number } | null => {
        if (pts.length < 5) return null;
        const sortedX = pts.map(p => p.x).sort((a, b) => a - b);
        const medX = sortedX[Math.floor(sortedX.length / 2)];
        const valid = pts.filter(p => Math.abs(p.x - medX) < sw * 0.08);
        if (valid.length < 4) return { m: 0, c: medX };

        let sumY = 0, sumX = 0, sumYY = 0, sumXY = 0;
        for (const p of valid) {
          sumY += p.y;
          sumX += p.x;
          sumYY += p.y * p.y;
          sumXY += p.y * p.x;
        }
        const n = valid.length;
        const denom = n * sumYY - sumY * sumY;
        if (Math.abs(denom) < 1e-4) return { m: 0, c: sumX / n };
        const m = (n * sumXY - sumY * sumX) / denom; // x = m * y + c
        const c = (sumX - m * sumY) / n;
        return { m, c };
      };

      const lineTop = fitHorizontalLine(topEdgePts);
      const lineBot = fitHorizontalLine(botEdgePts);
      const lineLeft = fitVerticalLine(leftEdgePts);
      const lineRight = fitVerticalLine(rightEdgePts);

      if (lineTop && lineBot && lineLeft && lineRight) {
        // Calculate 4 Line Intersections:
        // Horizontal line: y = m_h * x + c_h
        // Vertical line: x = m_v * y + c_v  => y = (m_h * c_v + c_h) / (1 - m_h * m_v)
        const intersect = (hLine: { m: number; c: number }, vLine: { m: number; c: number }) => {
          const denom = 1 - hLine.m * vLine.m;
          const y = Math.abs(denom) > 1e-4 ? (hLine.m * vLine.c + hLine.c) / denom : hLine.c;
          const x = vLine.m * y + vLine.c;
          return { x, y };
        };

        const ptTL = intersect(lineTop, lineLeft);
        const ptTR = intersect(lineTop, lineRight);
        const ptBR = intersect(lineBot, lineRight);
        const ptBL = intersect(lineBot, lineLeft);

        const inv = 1 / scale;

        const docW = Math.max(ptTR.x - ptTL.x, ptBR.x - ptBL.x);
        const docH = Math.max(ptBL.y - ptTL.y, ptBR.y - ptTR.y);

        if (docW > sw * 0.35 && docH > sh * 0.35) {
          return [
            { x: Math.max(0, Math.min(w, ptTL.x * inv)), y: Math.max(0, Math.min(h, ptTL.y * inv)) },
            { x: Math.max(0, Math.min(w, ptTR.x * inv)), y: Math.max(0, Math.min(h, ptTR.y * inv)) },
            { x: Math.max(0, Math.min(w, ptBR.x * inv)), y: Math.max(0, Math.min(h, ptBR.y * inv)) },
            { x: Math.max(0, Math.min(w, ptBL.x * inv)), y: Math.max(0, Math.min(h, ptBL.y * inv)) }
          ];
        }
      }
    } catch (e) {
      console.warn('Sobel line-fit corner detection fallback:', e);
    }

    // Default Fallback: Centered clean 7% inset quad
    return [
      { x: w * 0.07, y: h * 0.07 },
      { x: w * 0.93, y: h * 0.07 },
      { x: w * 0.93, y: h * 0.93 },
      { x: w * 0.07, y: h * 0.93 }
    ];
  };

  // Helper to load image & run auto edge detection
  const initImageAndCorners = (dataUrl: string) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = dataUrl;
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      setImageDimensions({ width: w, height: h });
      setRawImage(dataUrl);

      const detected = detectDocumentCorners(img);
      setCorners(detected);

      setRotation(0);
      setFilterMode('MAGIC_COLOR');
      setContrast(120);
      setBrightness(100);
      setStep('CROP');
    };
  };

  // Capture frame from video feed
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    stopCamera();
    initImageAndCorners(dataUrl);
  };

  // Upload file fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      stopCamera();
      initImageAndCorners(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Midpoints of the 4 edges [Top, Right, Bottom, Left]
  const getMidpoints = (): [CornerPoint, CornerPoint, CornerPoint, CornerPoint] => {
    return [
      { x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2 }, // Top
      { x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2 }, // Right
      { x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2 }, // Bottom
      { x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2 }  // Left
    ];
  };

  // Render Interactive Quad Canvas with CamScanner Handles & Guideline Overlays
  useEffect(() => {
    if (step !== 'CROP' || !rawImage) return;

    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = rawImage;
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      // 1. Draw base raw photograph
      ctx.drawImage(img, 0, 0);

      // 2. Draw darkened backdrop mask
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 3. Cutout quad area
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.fill();

      // 4. Redraw clear image in cutout
      ctx.globalCompositeOperation = 'destination-over';
      ctx.drawImage(img, 0, 0);
      ctx.restore();

      // 5. Draw Market Almacén Neon Orange Quad Border
      const orangeColor = '#f97316'; // Orange-500
      ctx.strokeStyle = orangeColor;
      ctx.lineWidth = Math.max(4.5, img.width * 0.004);
      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      ctx.lineTo(corners[1].x, corners[1].y);
      ctx.lineTo(corners[2].x, corners[2].y);
      ctx.lineTo(corners[3].x, corners[3].y);
      ctx.closePath();
      ctx.stroke();

      // 6. Draw 4 Corner Circles
      const cornerRadius = Math.max(16, img.width * 0.018);
      corners.forEach((c, idx) => {
        const isCurrent = activeHandleIdx === idx;

        // Outer circle
        ctx.fillStyle = isCurrent ? '#ea580c' : '#f97316';
        ctx.beginPath();
        ctx.arc(c.x, c.y, cornerRadius + 2, 0, Math.PI * 2);
        ctx.fill();

        // Inner white center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(c.x, c.y, cornerRadius * 0.65, 0, Math.PI * 2);
        ctx.fill();
      });

      // 7. Draw 4 Edge Midpoint Capsules (Orange Market Almacén Style)
      const midpoints = getMidpoints();
      const capW = Math.max(38, img.width * 0.038);
      const capH = Math.max(16, img.width * 0.016);

      midpoints.forEach((mp, i) => {
        const isCurrent = activeHandleIdx === i + 4;
        const isHorizontal = i === 0 || i === 2;
        const w = isHorizontal ? capW : capH;
        const h = isHorizontal ? capH : capW;

        ctx.save();
        ctx.translate(mp.x, mp.y);
        ctx.fillStyle = isCurrent ? '#ea580c' : '#ffffff';
        ctx.strokeStyle = orangeColor;
        ctx.lineWidth = 3;

        // Rounded pill/capsule
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 8);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    };
  }, [step, rawImage, corners, activeHandleIdx]);

  // Touch / Pointer Handling for Draggable Corners and Midpoint Capsules
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!cropCanvasRef.current) return;
    const canvas = cropCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    const hitRadius = Math.max(65, canvas.width * 0.08);

    // 1. Check 4 corners (0-3)
    let bestIdx = -1;
    let minDist = Infinity;

    corners.forEach((c, idx) => {
      const dist = Math.hypot(c.x - clickX, c.y - clickY);
      if (dist < hitRadius && dist < minDist) {
        minDist = dist;
        bestIdx = idx;
      }
    });

    // 2. Check 4 edge midpoints (4-7)
    if (bestIdx === -1) {
      const midpoints = getMidpoints();
      midpoints.forEach((mp, idx) => {
        const dist = Math.hypot(mp.x - clickX, mp.y - clickY);
        if (dist < hitRadius && dist < minDist) {
          minDist = dist;
          bestIdx = idx + 4;
        }
      });
    }

    if (bestIdx !== -1) {
      setActiveHandleIdx(bestIdx);
      setDragStartPos({ x: clickX, y: clickY });
      setDragStartCorners([...corners] as [CornerPoint, CornerPoint, CornerPoint, CornerPoint]);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      // Loupe for corner zoom
      if (bestIdx < 4) {
        setLoupePos({
          x: e.clientX,
          y: e.clientY - 90,
          imgX: corners[bestIdx].x,
          imgY: corners[bestIdx].y
        });
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeHandleIdx === null || !dragStartPos || !dragStartCorners || !cropCanvasRef.current) return;
    const canvas = cropCanvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const currentX = Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX));
    const currentY = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY));

    const dx = currentX - dragStartPos.x;
    const dy = currentY - dragStartPos.y;

    if (activeHandleIdx < 4) {
      // Move individual corner
      setCorners((prev) => {
        const copy = [...prev] as [CornerPoint, CornerPoint, CornerPoint, CornerPoint];
        copy[activeHandleIdx] = { x: currentX, y: currentY };
        return copy;
      });

      setLoupePos({
        x: e.clientX,
        y: Math.max(70, e.clientY - 90),
        imgX: currentX,
        imgY: currentY
      });
    } else {
      // Move entire edge (adjacent corners together)
      const edgeIdx = activeHandleIdx - 4; // 0: Top, 1: Right, 2: Bottom, 3: Left
      const copy = [...dragStartCorners] as [CornerPoint, CornerPoint, CornerPoint, CornerPoint];

      if (edgeIdx === 0) { // Top (corners 0 and 1)
        copy[0] = { x: Math.max(0, Math.min(canvas.width, copy[0].x + dx)), y: Math.max(0, Math.min(canvas.height, copy[0].y + dy)) };
        copy[1] = { x: Math.max(0, Math.min(canvas.width, copy[1].x + dx)), y: Math.max(0, Math.min(canvas.height, copy[1].y + dy)) };
      } else if (edgeIdx === 1) { // Right (corners 1 and 2)
        copy[1] = { x: Math.max(0, Math.min(canvas.width, copy[1].x + dx)), y: Math.max(0, Math.min(canvas.height, copy[1].y + dy)) };
        copy[2] = { x: Math.max(0, Math.min(canvas.width, copy[2].x + dx)), y: Math.max(0, Math.min(canvas.height, copy[2].y + dy)) };
      } else if (edgeIdx === 2) { // Bottom (corners 2 and 3)
        copy[2] = { x: Math.max(0, Math.min(canvas.width, copy[2].x + dx)), y: Math.max(0, Math.min(canvas.height, copy[2].y + dy)) };
        copy[3] = { x: Math.max(0, Math.min(canvas.width, copy[3].x + dx)), y: Math.max(0, Math.min(canvas.height, copy[3].y + dy)) };
      } else if (edgeIdx === 3) { // Left (corners 3 and 0)
        copy[3] = { x: Math.max(0, Math.min(canvas.width, copy[3].x + dx)), y: Math.max(0, Math.min(canvas.height, copy[3].y + dy)) };
        copy[0] = { x: Math.max(0, Math.min(canvas.width, copy[0].x + dx)), y: Math.max(0, Math.min(canvas.height, copy[0].y + dy)) };
      }

      setCorners(copy);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeHandleIdx !== null) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      setActiveHandleIdx(null);
      setDragStartPos(null);
      setDragStartCorners(null);
      setLoupePos(null);
    }
  };

  // Rotate raw image in crop mode
  const handleRotateCropImage = (dir: 'left' | 'right') => {
    if (!rawImage) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = rawImage;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((dir === 'right' ? 90 : -90) * (Math.PI / 180));
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      const newUrl = canvas.toDataURL('image/jpeg', 0.95);
      initImageAndCorners(newUrl);
    };
  };

  // Auto-Select Full Image
  const handleSelectFull = () => {
    if (!imageDimensions.width) return;
    const w = imageDimensions.width;
    const h = imageDimensions.height;
    setCorners([
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h }
    ]);
  };

  // Re-run AI Intelligent Paper Boundary Detection
  const handleAutoFitAI = () => {
    if (!rawImage) return;
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = rawImage;
    img.onload = () => {
      const detected = detectDocumentCorners(img);
      setCorners(detected);
    };
  };

  // Perform Perspective Warp, Deskew and Unwarp (CamScanner Transform)
  const handleApplyCropAndDeskew = () => {
    if (!rawImage) return;
    setIsProcessing(true);

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = rawImage;
    img.onload = () => {
      const [p0, p1, p2, p3] = corners;

      // Compute destination dimensions based on quad edges
      const topWidth = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      const botWidth = Math.hypot(p2.x - p3.x, p2.y - p3.y);
      const leftHeight = Math.hypot(p3.x - p0.x, p3.y - p0.y);
      const rightHeight = Math.hypot(p2.x - p1.x, p2.y - p1.y);

      const avgW = (topWidth + botWidth) / 2;
      const avgH = (leftHeight + rightHeight) / 2;
      // High-definition ultra-crisp page dimensions (Full HD A4/Letter standard)
      const dstWidth = 1600;
      const aspect = avgH / (avgW || 1);
      const dstHeight = Math.round(dstWidth * (aspect > 0.5 && aspect < 2.5 ? aspect : 1.35));

      // Read source pixels
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
      if (!srcCtx) return;
      srcCtx.drawImage(img, 0, 0);
      const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
      const srcPixels = srcData.data;
      const srcW = srcCanvas.width;
      const srcH = srcCanvas.height;

      // Destination unwarped canvas
      const dstCanvas = document.createElement('canvas');
      dstCanvas.width = dstWidth;
      dstCanvas.height = dstHeight;
      const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true });
      if (!dstCtx) return;
      const dstData = dstCtx.createImageData(dstWidth, dstHeight);
      const dstPixels = dstData.data;

      // Projective bilinear interpolation mapping from Quad to Rect
      for (let y = 0; y < dstHeight; y++) {
        const v = y / (dstHeight - 1 || 1);

        for (let x = 0; x < dstWidth; x++) {
          const u = x / (dstWidth - 1 || 1);

          // Bilinear quad point
          const tX = p0.x + (p1.x - p0.x) * u;
          const tY = p0.y + (p1.y - p0.y) * u;
          const bX = p3.x + (p2.x - p3.x) * u;
          const bY = p3.y + (p2.y - p3.y) * u;

          const srcX = tX + (bX - tX) * v;
          const srcY = tY + (bY - tY) * v;

          const x0 = Math.floor(srcX);
          const y0 = Math.floor(srcY);
          const x1 = Math.min(srcW - 1, x0 + 1);
          const y1 = Math.min(srcH - 1, y0 + 1);

          const wx = srcX - x0;
          const wy = srcY - y0;

          if (x0 >= 0 && x1 < srcW && y0 >= 0 && y1 < srcH) {
            const idx00 = (y0 * srcW + x0) * 4;
            const idx10 = (y0 * srcW + x1) * 4;
            const idx01 = (y1 * srcW + x0) * 4;
            const idx11 = (y1 * srcW + x1) * 4;

            const dstIdx = (y * dstWidth + x) * 4;

            for (let c = 0; c < 3; c++) {
              const val =
                srcPixels[idx00 + c] * (1 - wx) * (1 - wy) +
                srcPixels[idx10 + c] * wx * (1 - wy) +
                srcPixels[idx01 + c] * (1 - wx) * wy +
                srcPixels[idx11 + c] * wx * wy;

              dstPixels[dstIdx + c] = Math.round(val);
            }
            dstPixels[dstIdx + 3] = 255;
          }
        }
      }

      dstCtx.putImageData(dstData, 0, 0);
      const unwarpedDataUrl = dstCanvas.toDataURL('image/jpeg', 0.97);
      setUnwarpedImage(unwarpedDataUrl);
      setIsProcessing(false);
      setStep('PREVIEW');
    };
  };

  // CamScanner Magic Color & Local Background Illumination Normalization Algorithm
  useEffect(() => {
    if (!unwarpedImage || step !== 'PREVIEW') return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = unwarpedImage;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const isRotated90or270 = rotation === 90 || rotation === 270;
      canvas.width = isRotated90or270 ? img.height : img.width;
      canvas.height = isRotated90or270 ? img.width : img.height;

      // Handle Rotation
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      ctx.restore();

      if (filterMode === 'ORIGINAL') {
        setProcessedImage(canvas.toDataURL('image/jpeg', 0.94));
        return;
      }

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { width, height, data } = imgData;
      const len = width * height;

      // 1. Grayscale luminance
      const gray = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      }

      // 2. Local Background Illumination Estimation (Fast 2-pass box blur for shadow removal)
      const radius = Math.max(20, Math.round(width / 24));
      const bg = new Float32Array(len);
      const temp = new Float32Array(len);

      // Horizontal pass
      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        let sum = 0;
        let count = 0;
        for (let x = 0; x <= Math.min(radius, width - 1); x++) {
          sum += gray[rowOffset + x];
          count++;
        }
        for (let x = 0; x < width; x++) {
          temp[rowOffset + x] = sum / count;
          const left = x - radius;
          const right = x + radius + 1;
          if (left >= 0) { sum -= gray[rowOffset + left]; count--; }
          if (right < width) { sum += gray[rowOffset + right]; count++; }
        }
      }

      // Vertical pass
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let y = 0; y <= Math.min(radius, height - 1); y++) {
          sum += temp[y * width + x];
          count++;
        }
        for (let y = 0; y < height; y++) {
          bg[y * width + x] = Math.max(1, sum / count);
          const top = y - radius;
          const bottom = y + radius + 1;
          if (top >= 0) { sum -= temp[top * width + x]; count--; }
          if (bottom < height) { sum += temp[bottom * width + x]; count++; }
        }
      }

      // 3. Apply CamScanner Digital Photocopy Enhancement Pipeline with Unsharp Mask
      for (let i = 0; i < len; i++) {
        const idx = i * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const gVal = gray[i];
        const bgVal = bg[i];

        // Detect color stamps / signatures (e.g. red/blue stamps)
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const isColorStamp = (maxC - minC) > 20;

        if (filterMode === 'MAGIC_COLOR') {
          if (isColorStamp) {
            // Keep vibrant color stamps & signatures clean on white paper
            const ratio = 255 / Math.max(1, bgVal);
            data[idx] = Math.max(0, Math.min(255, r * ratio * 1.10));
            data[idx + 1] = Math.max(0, Math.min(255, g * ratio * 1.10));
            data[idx + 2] = Math.max(0, Math.min(255, b * ratio * 1.10));
          } else {
            // Unsharp Mask sharpening for ultra crisp letter edges
            const sharpened = gVal + 0.35 * (gVal - bgVal);
            const n = Math.max(0, Math.min(1.2, sharpened / Math.max(1, bgVal)));

            let v: number;
            if (n >= 0.88) {
              v = 255; // Pure White Paper Background
            } else if (n <= 0.30) {
              v = 0; // Solid Deep Black Ink
            } else {
              const normVal = (n - 0.30) / (0.88 - 0.30);
              v = Math.round(Math.pow(normVal, 1.38) * 255);
            }
            data[idx] = v;
            data[idx + 1] = v;
            data[idx + 2] = v;
          }
        } else if (filterMode === 'MAGIC_PRO') {
          // Pure Photocopier High Contrast B&W
          const sharpened = gVal + 0.45 * (gVal - bgVal);
          const n = Math.max(0, Math.min(1.2, sharpened / Math.max(1, bgVal)));
          let v: number;
          if (n >= 0.84) {
            v = 255;
          } else if (n <= 0.35) {
            v = 0;
          } else {
            const normVal = (n - 0.35) / (0.84 - 0.35);
            v = Math.round(Math.pow(normVal, 1.55) * 255);
          }
          data[idx] = v;
          data[idx + 1] = v;
          data[idx + 2] = v;
        } else if (filterMode === 'ACLARAR') {
          // Gentle shadow removal preserving natural photo tones
          const scaleFactor = 255 / (bgVal || 255);
          data[idx] = Math.min(255, r * scaleFactor);
          data[idx + 1] = Math.min(255, g * scaleFactor);
          data[idx + 2] = Math.min(255, b * scaleFactor);
        } else if (filterMode === 'GRAYSCALE') {
          const n = gVal / Math.max(1, bgVal);
          data[idx] = Math.max(0, Math.min(255, n * 255));
          data[idx + 1] = Math.max(0, Math.min(255, n * 255));
          data[idx + 2] = Math.max(0, Math.min(255, n * 255));
        }

        data[idx + 3] = 255;
      }

      ctx.putImageData(imgData, 0, 0);
      setProcessedImage(canvas.toDataURL('image/jpeg', 0.97));
    };
  }, [unwarpedImage, filterMode, rotation, contrast, brightness, step]);

  const handleRetake = () => {
    setProcessedImage(null);
    setUnwarpedImage(null);
    setRawImage(null);
    setStep('CAMERA');
  };

  const handleBackToCrop = () => {
    setStep('CROP');
  };

  const handleConfirmAndSave = () => {
    if (!processedImage) return;
    onScanComplete(processedImage);
    onClose();
  };

  // Export standalone Scan as PDF
  const handleExportSinglePDF = () => {
    if (!processedImage) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(234, 88, 12);
    doc.text('DOCUMENTO ESCANEADO - MARKET ALMACÉN', 14, 15);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Fecha de Escaneo: ${new Date().toLocaleString('es-CL')}`, 14, 20);

    doc.setDrawColor(203, 213, 225);
    doc.line(14, 23, 202, 23);

    doc.addImage(processedImage, 'JPEG', 14, 26, 188, 235, undefined, 'FAST');
    doc.save(`Documento_Escaneado_${new Date().getTime()}.pdf`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-3 bg-black/95 backdrop-blur-md animate-fadeIn">
      <div className="w-full h-full sm:h-auto sm:max-w-4xl rounded-none sm:rounded-3xl border-0 sm:border border-slate-800 bg-slate-950 shadow-2xl flex flex-col max-h-[100vh] sm:max-h-[96vh] overflow-hidden">
        {/* Header (Market Almacén Style) */}
        <div className="px-4 py-3 bg-black border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={step === 'PREVIEW' ? handleBackToCrop : step === 'CROP' ? handleRetake : onClose}
              className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Volver"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                <span>{step === 'CROP' ? 'Recortar Documento' : step === 'PREVIEW' ? 'Documento Escaneado' : title}</span>
                {step === 'CROP' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30 uppercase">
                    Auto-Bordes
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                {step === 'CAMERA'
                  ? 'Capture la boleta o factura'
                  : step === 'CROP'
                  ? 'Ajuste los 4 puntos naranja para encuadrar la hoja'
                  : 'Documento procesado, enderezado y nítido'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: CAMERA LIVE VIEWFINDER */}
        {step === 'CAMERA' && (
          <div className="flex-1 flex flex-col items-center justify-between p-4 bg-black relative min-h-[460px]">
            <div className="relative w-full max-w-lg aspect-[3/4] sm:aspect-[4/5] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center shadow-2xl">
              {cameraLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-20 text-xs text-slate-300 gap-2">
                  <RefreshCw className="w-7 h-7 text-orange-500 animate-spin" />
                  <span>Iniciando cámara HD...</span>
                </div>
              )}

              {hasCameraError ? (
                <div className="p-6 text-center text-slate-300 space-y-3 z-20">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                  <p className="font-bold text-sm">No se pudo activar la cámara en vivo</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Puede subir una fotografía o archivo de la boleta desde su galería:
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow transition"
                  >
                    Seleccionar Foto de Boleta/Factura
                  </button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />
              )}

              {/* Viewfinder Guide Overlay */}
              {!hasCameraError && (
                <div className="absolute inset-4 sm:inset-6 pointer-events-none z-10 border border-orange-500/40 rounded-2xl shadow-inner flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-xl" />
                    <div className="w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-xl" />
                  </div>
                  <div className="text-center">
                    <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-bold text-orange-300 border border-orange-500/40 shadow-lg">
                      Encuadre la boleta o factura dentro del marco
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <div className="w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-xl" />
                    <div className="w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-xl" />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="w-full max-w-lg pt-4 flex items-center justify-between gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <Upload className="w-4 h-4 text-orange-400" />
                <span>Galería / Archivo</span>
              </button>

              <button
                type="button"
                onClick={handleCapture}
                disabled={hasCameraError || cameraLoading}
                className="flex items-center gap-2 px-8 py-3.5 text-sm font-black rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-xl shadow-orange-500/30 transition active:scale-95 disabled:opacity-50"
              >
                <Camera className="w-5 h-5" />
                <span>CAPTURAR BOLETA</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CROP & PERSPECTIVE WARP */}
        {step === 'CROP' && (
          <div className="flex-1 flex flex-col items-center justify-between p-3 bg-black relative select-none">
            {/* Interactive Quad Canvas */}
            <div className="relative w-full max-w-3xl flex-1 flex items-center justify-center min-h-[380px] max-h-[66vh] overflow-hidden rounded-2xl bg-black">
              <canvas
                ref={cropCanvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="max-h-full max-w-full object-contain cursor-crosshair touch-none select-none"
              />

              {/* Floating Magnifier Loupe when dragging a corner */}
              {loupePos && rawImage && (
                <div
                  className="fixed pointer-events-none z-50 w-28 h-28 rounded-full border-4 border-orange-500 shadow-2xl overflow-hidden bg-black flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
                  style={{ left: loupePos.x, top: loupePos.y }}
                >
                  <img
                    src={rawImage}
                    alt="Zoom"
                    className="absolute max-w-none"
                    style={{
                      width: `${imageDimensions.width * 2.8}px`,
                      height: `${imageDimensions.height * 2.8}px`,
                      left: `${56 - loupePos.imgX * 2.8}px`,
                      top: `${56 - loupePos.imgY * 2.8}px`
                    }}
                  />
                  {/* Crosshair in Loupe */}
                  <div className="absolute w-full h-[1.5px] bg-orange-500/80 pointer-events-none" />
                  <div className="absolute h-full w-[1.5px] bg-orange-500/80 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Bottom Toolbar */}
            <div className="w-full max-w-2xl pt-3 pb-1 border-t border-slate-800 flex items-center justify-around text-slate-300">
              <button
                type="button"
                onClick={() => handleRotateCropImage('left')}
                className="flex flex-col items-center gap-1 p-2 text-xs font-semibold hover:text-orange-400 transition"
              >
                <RotateCcw className="w-5 h-5" />
                <span>Izquierda</span>
              </button>

              <button
                type="button"
                onClick={() => handleRotateCropImage('right')}
                className="flex flex-col items-center gap-1 p-2 text-xs font-semibold hover:text-orange-400 transition"
              >
                <RotateCw className="w-5 h-5" />
                <span>Derecha</span>
              </button>

              <button
                type="button"
                onClick={handleSelectFull}
                className="flex flex-col items-center gap-1 p-2 text-xs font-semibold hover:text-orange-400 transition"
              >
                <Maximize2 className="w-5 h-5" />
                <span>Todo</span>
              </button>

              <button
                type="button"
                onClick={handleAutoFitAI}
                className="flex flex-col items-center gap-1 p-2 text-xs font-bold text-orange-400 hover:text-orange-300 transition"
                title="Detectar automáticamente los 4 bordes de la hoja de papel"
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span>Auto-Bordes IA</span>
              </button>

              <button
                type="button"
                onClick={handleApplyCropAndDeskew}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-black rounded-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-xl shadow-orange-500/25 transition active:scale-95"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <span>Siguiente</span>
                    <span className="text-base font-bold">➔</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ENHANCEMENT & FILTER SELECTION */}
        {step === 'PREVIEW' && (
          <div className="flex-1 flex flex-col justify-between bg-black overflow-hidden select-none">
            {/* Center: Deskewed Pristine Document Preview */}
            <div className="flex-1 p-3 sm:p-4 flex items-center justify-center overflow-auto max-h-[58vh] bg-slate-950">
              {processedImage ? (
                <img
                  src={processedImage}
                  alt="Escaneo Procesado"
                  className="max-h-[52vh] max-w-full object-contain rounded-md shadow-2xl border border-slate-700 bg-white"
                />
              ) : (
                <div className="flex items-center justify-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mr-2 text-orange-400" />
                  <span>Aplicando Color Mágico...</span>
                </div>
              )}
            </div>

            {/* Bottom: Filter Carousel & Actions */}
            <div className="bg-slate-950 border-t border-slate-800 p-3 space-y-3">
              {/* Filter Thumbnails Carousel */}
              <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1">
                {/* 1. Original */}
                <button
                  type="button"
                  onClick={() => setFilterMode('ORIGINAL')}
                  className={`flex flex-col items-center p-1.5 rounded-xl border transition ${
                    filterMode === 'ORIGINAL'
                      ? 'border-orange-500 bg-orange-500/15 text-orange-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="w-12 h-10 rounded bg-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-bold mb-1">
                    📷
                  </div>
                  <span className="text-[11px]">Original</span>
                </button>

                {/* 2. Aclarar */}
                <button
                  type="button"
                  onClick={() => setFilterMode('ACLARAR')}
                  className={`flex flex-col items-center p-1.5 rounded-xl border transition ${
                    filterMode === 'ACLARAR'
                      ? 'border-orange-500 bg-orange-500/15 text-orange-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="w-12 h-10 rounded bg-slate-800 flex items-center justify-center text-[10px] text-amber-300 font-bold mb-1">
                    ☀️
                  </div>
                  <span className="text-[11px]">Aclarar</span>
                </button>

                {/* 3. Color Mágico (Magic Color) */}
                <button
                  type="button"
                  onClick={() => setFilterMode('MAGIC_COLOR')}
                  className={`flex flex-col items-center p-1.5 rounded-xl border transition ${
                    filterMode === 'MAGIC_COLOR'
                      ? 'border-orange-500 bg-orange-500/20 text-orange-300 font-bold shadow-lg shadow-orange-500/20 ring-2 ring-orange-500/40'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="w-12 h-10 rounded bg-gradient-to-br from-orange-500/40 to-amber-500/40 border border-orange-500/60 flex items-center justify-center text-[10px] text-white font-black mb-1">
                    ✨
                  </div>
                  <span className="text-[11px]">Color mágico</span>
                </button>

                {/* 4. Magic Pro / Fotocopiadora B&W */}
                <button
                  type="button"
                  onClick={() => setFilterMode('MAGIC_PRO')}
                  className={`flex flex-col items-center p-1.5 rounded-xl border transition ${
                    filterMode === 'MAGIC_PRO'
                      ? 'border-orange-500 bg-orange-500/15 text-orange-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="w-12 h-10 rounded bg-slate-800 flex items-center justify-center text-[10px] text-white font-bold mb-1">
                    ⭐ Pro
                  </div>
                  <span className="text-[11px]">Magic Pro</span>
                </button>

                {/* 5. Escala de Grises */}
                <button
                  type="button"
                  onClick={() => setFilterMode('GRAYSCALE')}
                  className={`flex flex-col items-center p-1.5 rounded-xl border transition ${
                    filterMode === 'GRAYSCALE'
                      ? 'border-orange-500 bg-orange-500/15 text-orange-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="w-12 h-10 rounded bg-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-bold mb-1">
                    📑
                  </div>
                  <span className="text-[11px]">Sin sombras</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                    title="Girar 90°"
                  >
                    <RotateCw className="w-4 h-4 text-orange-400" />
                    <span>Girar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToCrop}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                  >
                    <Crop className="w-4 h-4 text-orange-400" />
                    <span>Re-encuadrar</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportSinglePDF}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
                  >
                    <Download className="w-4 h-4 text-orange-400" />
                    <span>PDF</span>
                  </button>
                </div>

                {/* Big Orange Confirm Button */}
                <button
                  type="button"
                  onClick={handleConfirmAndSave}
                  className="flex items-center gap-2 px-6 py-2.5 text-xs font-black rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-xl shadow-orange-500/25 transition active:scale-95"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>USAR DOCUMENTO</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
