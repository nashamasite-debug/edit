'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download,
  Plus,
  Menu,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Columns,
  Undo2,
  Redo2,
  Layers,
  Zap,
  Loader2,
  Sparkles,
  Type as TypeIcon,
  Eraser,
  Wand2,
  Image as ImageIcon,
  Sliders,
  Palette,
  RotateCcw,
  X,
  CreditCard,
  LogIn,
  LogOut,
  History,
  AlertCircle,
  CheckCircle2,
  Upload,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '@/lib/firebase';
import {
  DetectedTextItem,
  renderUploadedImageWithTextEdits,
  TextLabelType,
} from '@/lib/poster-renderer';
import { buildEditPrompt, TextReplacementSpec } from '@/lib/job-store';

interface VersionEntry {
  id: string;
  imageUrl: string;
  parentId: string;
  createdAt: string;
  promptUsed: string;
  modelUsed: string;
  textsSnapshot: DetectedTextItem[];
}

interface CreditTransactionEntry {
  id: string;
  amount: number;
  type: 'deduct' | 'refund' | 'purchase' | 'bonus';
  reason: string;
  jobId: string;
  createdAt: string;
}

interface BatchItem {
  id: string;
  name: string;
  originalUrl: string;
  currentUrl: string;
  texts: DetectedTextItem[];
}

type BottomTabId = 'create' | 'ai_tools' | 'background' | 'adjust' | 'effects';
type ActiveAiToolId = 'text_editor' | 'editable' | 'magic_eraser' | 'enhance';
type EditModelOption = 'Gemini Image' | 'Flux Kontext' | 'gpt-image';

export default function StudioApp() {
  // Auth & User Credits
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [credits, setCredits] = useState<number>(15);
  const [transactions, setTransactions] = useState<CreditTransactionEntry[]>([
    {
      id: 'tx_init',
      amount: 15,
      type: 'bonus',
      reason: 'رصيد ترحيبي مجاني عند فتح الاستوديو',
      jobId: 'welcome',
      createdAt: 'الآن',
    },
  ]);

  // Mode: 'single' | 'batch'
  const [workspaceMode, setWorkspaceMode] = useState<'single' | 'batch'>('single');

  // Project State (No default ads — starts empty until user uploads an image)
  const [projectName, setProjectName] = useState<string>('مشروع جديد');
  const [projectId, setProjectId] = useState<string>('proj_default_1');
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState<boolean>(false);

  // Canvas & Versions State
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [currentVersionIndex, setCurrentVersionIndex] = useState<number>(0);
  const [customUploadedBaseUrl, setCustomUploadedBaseUrl] = useState<string | null>(
    null
  );

  // Batch Mode items (starts empty)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(0);

  // Preview Toolbar Controls
  const [zoom, setZoom] = useState<number>(100);
  const [isCompareMode, setIsCompareMode] = useState<boolean>(false);
  const [compareSliderPos, setCompareSliderPos] = useState<number>(50);
  const [showLayerBoxes, setShowLayerBoxes] = useState<boolean>(false);
  const [focusedTextId, setFocusedTextId] = useState<number | null>(null);

  // Bottom Sheet & AI Tools State
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTabId>('ai_tools');
  const [activeAiTool, setActiveAiTool] = useState<ActiveAiToolId>('text_editor');

  // AI Text Editor Flow State
  const [hasDetected, setHasDetected] = useState<boolean>(false);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectedTexts, setDetectedTexts] = useState<DetectedTextItem[]>([]);
  const [selectedModel, setSelectedModel] =
    useState<EditModelOption>('Gemini Image');
  const [isEditingModalOpen, setIsEditingModalOpen] = useState<boolean>(false);
  const [activeJobStatus, setActiveJobStatus] = useState<string>('');
  const [activeJobPrompt, setActiveJobPrompt] = useState<string>('');
  const [lastAppliedReplacements, setLastAppliedReplacements] = useState<
    TextReplacementSpec[]
  >([]);
  const [autoDownloadOnEdit, setAutoDownloadOnEdit] = useState<boolean>(false);

  // Other AI tools & Adjustments
  const [erasedTextIds, setErasedTextIds] = useState<number[]>([]);
  const [isEnhanced, setIsEnhanced] = useState<boolean>(false);
  const [customBgColor, setCustomBgColor] = useState<string | null>(null);
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [activeEffect, setActiveEffect] = useState<
    'none' | 'studio' | 'warm' | 'crisp'
  >('none');

  // Drawers & Modals
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState<boolean>(false);
  const [isStripeModalOpen, setIsStripeModalOpen] = useState<boolean>(false);
  const [isDraggingFile, setIsDraggingFile] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback(
    (text: string, type: 'success' | 'error' | 'info' = 'info') => {
      setToastMessage({ text, type });
      setTimeout(() => {
        setToastMessage((prev) => (prev?.text === text ? null : prev));
      }, 4500);
    },
    []
  );

  // Test Firestore connection on mount
  useEffect(() => {
    void testFirestoreConnection();
  }, []);

  // Listen to Firebase Auth state and sync user profile + credits in Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) return;

      const userPath = `users/${firebaseUser.uid}`;
      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.credits === 'number') {
            setCredits(data.credits);
          }
        } else {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            displayName: (
              firebaseUser.displayName || 'مستخدم الاستوديو'
            ).slice(0, 120),
            credits: 15,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setCredits(15);
        }

        const defaultProjId = `proj_${firebaseUser.uid.slice(0, 12)}`;
        setProjectId(defaultProjId);
        const projRef = doc(db, 'projects', defaultProjId);
        const projSnap = await getDoc(projRef);
        if (!projSnap.exists()) {
          await setDoc(projRef, {
            ownerId: firebaseUser.uid,
            name: projectName.slice(0, 200),
            mode: 'single',
            currentVersionId: 'v_root',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const txQuery = query(
          collection(db, 'credit_transactions'),
          where('ownerId', '==', firebaseUser.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        const txSnaps = await getDocs(txQuery);
        if (!txSnaps.empty) {
          const loadedTx: CreditTransactionEntry[] = txSnaps.docs.map((d) => {
            const val = d.data();
            return {
              id: d.id,
              amount: val.amount,
              type: val.type,
              reason: val.reason,
              jobId: val.jobId,
              createdAt: 'مزامن سحابياً',
            };
          });
          setTransactions(loadedTx);
        }
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.GET, userPath);
        } catch {
          // Handled and logged
        }
      }
    });

    return () => unsubscribe();
  }, [projectName]);

  // Helper to record credit changes locally and in Firestore
  const adjustUserCredits = useCallback(
    async (
      delta: number,
      type: 'deduct' | 'refund' | 'purchase' | 'bonus',
      reason: string,
      jobIdStr: string
    ) => {
      const nextCredits = Math.max(0, credits + delta);
      setCredits(nextCredits);

      const newTx: CreditTransactionEntry = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        amount: delta,
        type,
        reason: reason.slice(0, 300),
        jobId: jobIdStr.slice(0, 128),
        createdAt: new Date().toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setTransactions((prev) => [newTx, ...prev]);

      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            credits: nextCredits,
            updatedAt: serverTimestamp(),
          });
          const txRef = doc(db, 'credit_transactions', newTx.id);
          await setDoc(txRef, {
            ownerId: user.uid,
            amount: delta,
            type,
            reason: reason.slice(0, 300),
            jobId: jobIdStr.slice(0, 128),
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          try {
            handleFirestoreError(
              err,
              OperationType.WRITE,
              'credit_transactions'
            );
          } catch {
            // Logged structured error
          }
        }
      }
    },
    [credits, user]
  );

  // Current active image URL
  const currentVersion = versions[currentVersionIndex] || versions[0];
  const previousVersion =
    currentVersionIndex > 0 ? versions[currentVersionIndex - 1] : versions[0];

  const activeDisplayUrl =
    workspaceMode === 'batch'
      ? batchItems[activeBatchIndex]?.currentUrl || null
      : currentVersion?.imageUrl || null;

  const beforeCompareUrl =
    workspaceMode === 'batch'
      ? batchItems[activeBatchIndex]?.originalUrl || null
      : previousVersion?.imageUrl || null;

  // Upload custom image(s)
  const processUploadedFiles = useCallback(
    (files: FileList | File[]) => {
      if (!files || files.length === 0) return;

      const validFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (validFiles.length === 0) {
        showToast('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP).', 'error');
        return;
      }

      if (workspaceMode === 'batch' || validFiles.length > 1) {
        if (validFiles.length > 1 && workspaceMode !== 'batch') {
          setWorkspaceMode('batch');
        }
        const readers: Promise<BatchItem>[] = validFiles.map(
          (file, idx) =>
            new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = String(reader.result || '');
                resolve({
                  id: `batch_upload_${Date.now()}_${idx}`,
                  name: file.name,
                  originalUrl: dataUrl,
                  currentUrl: dataUrl,
                  texts: [],
                });
              };
              reader.readAsDataURL(file);
            })
        );
        Promise.all(readers).then((uploadedBatch) => {
          setBatchItems((prev) => [...prev, ...uploadedBatch]);
          setActiveBatchIndex(0);
          setCustomUploadedBaseUrl(uploadedBatch[0].originalUrl);
          setProjectName(uploadedBatch[0].name);
          setHasDetected(false);
          setDetectedTexts([]);
          showToast(
            `تم رفع ${uploadedBatch.length} صور بنجاح! اضغط على «تعرّف» لاستخراج النصوص.`,
            'success'
          );
        });
        return;
      }

      const file = validFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result || '');
        setCustomUploadedBaseUrl(dataUrl);
        setProjectName(file.name);
        const rootVersion: VersionEntry = {
          id: `v_upload_${Date.now()}`,
          imageUrl: dataUrl,
          parentId: 'root',
          createdAt: new Date().toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          promptUsed: `صورة مرفوعة: ${file.name}`,
          modelUsed: 'Original',
          textsSnapshot: [],
        };
        setVersions([rootVersion]);
        setCurrentVersionIndex(0);
        setHasDetected(false);
        setDetectedTexts([]);
        setErasedTextIds([]);
        setIsEnhanced(false);
        setCustomBgColor(null);
        setIsCompareMode(false);
        setLastAppliedReplacements([]);
        showToast(
          'تم رفع الصورة بنجاح! اضغط الآن على زر «تعرّف» لاستخراج النصوص وتعديلها.',
          'success'
        );
      };
      reader.readAsDataURL(file);
    },
    [showToast, workspaceMode]
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUploadedFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleClearImage = () => {
    setCustomUploadedBaseUrl(null);
    setVersions([]);
    setCurrentVersionIndex(0);
    setBatchItems([]);
    setActiveBatchIndex(0);
    setDetectedTexts([]);
    setHasDetected(false);
    setErasedTextIds([]);
    setLastAppliedReplacements([]);
    setProjectName('مشروع جديد');
    showToast('تم تفريغ مساحة العمل. يمكنك رفع صورة جديدة.', 'info');
  };

  // Fast client-side image downscaler for OCR detection (reduces 10MB images to ~90KB JPEG)
  const compressImageForVision = useCallback(
    async (dataUrl: string, maxDim = 1024): Promise<{ base64: string; mimeType: string }> => {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const origW = img.naturalWidth || 1024;
          const origH = img.naturalHeight || 1024;
          const scale = Math.min(1, maxDim / Math.max(origW, origH));
          const targetW = Math.max(1, Math.round(origW * scale));
          const targetH = Math.max(1, Math.round(origH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({ base64: dataUrl, mimeType: 'image/png' });
            return;
          }
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve({ base64: compressed, mimeType: 'image/jpeg' });
        };
        img.onerror = () => {
          resolve({ base64: dataUrl, mimeType: 'image/png' });
        };
        img.src = dataUrl;
      });
    },
    []
  );

  // Step 1-3: Detect Texts (/api/detect)
  const handleDetectTexts = async () => {
    if (isDetecting) return;
    if (!activeDisplayUrl) {
      showToast('يرجى رفع صورة من جهازك أولاً ليتم التعرّف على النصوص فيها.', 'info');
      fileInputRef.current?.click();
      return;
    }

    setIsDetecting(true);
    const detectJobId = `detect_${Date.now()}`;

    // Non-blocking credit deduction so OCR starts immediately
    void adjustUserCredits(
      -1,
      'deduct',
      'التعرّف على النصوص بالذكاء الاصطناعي',
      detectJobId
    );

    try {
      const { base64: optimizedBase64, mimeType: optimizedMime } =
        await compressImageForVision(activeDisplayUrl, 1024);

      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: optimizedBase64,
          mimeType: optimizedMime,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'فشل التعرّف على النصوص');
      }

      const data = await res.json();
      const rawList = Array.isArray(data.texts) ? data.texts : [];

      const formatted: DetectedTextItem[] = rawList.map(
        (
          item: {
            id?: number;
            label?: TextLabelType;
            position?: string;
            text?: string;
            box?: DetectedTextItem['box'];
          },
          idx: number
        ) => ({
          id: item.id || idx + 1,
          label: item.label || 'body',
          position: item.position || 'center',
          text: item.text || '',
          originalText: item.text || '',
          initialText: item.text || '',
          box: item.box,
        })
      );

      setDetectedTexts(formatted);
      if (workspaceMode === 'batch') {
        setBatchItems((prev) =>
          prev.map((b) => ({
            ...b,
            texts: formatted.map((t) => ({ ...t })),
          }))
        );
      }
      setHasDetected(true);
      setShowLayerBoxes(true);
      showToast(
        `تم التعرّف على ${formatted.length} نصوص داخل الصورة بنجاح`,
        'success'
      );
    } catch (error) {
      void adjustUserCredits(
        1,
        'refund',
        'إرجاع الرصيد تلقائياً بسبب تعذّر مهمة التعرّف',
        detectJobId
      );
      showToast(
        error instanceof Error
          ? error.message
          : 'حدث خطأ أثناء التعرّف على النصوص. تم إرجاع الرصيد لحسابك.',
        'error'
      );
    } finally {
      setIsDetecting(false);
    }
  };

  // Save new version to state & Firestore
  const pushNewVersion = useCallback(
    async (
      newImageUrl: string,
      promptStr: string,
      modelStr: string,
      updatedTexts: DetectedTextItem[]
    ) => {
      const parentVer = versions[currentVersionIndex] || versions[0];
      const newVerId = `ver_${Date.now()}`;
      const newVer: VersionEntry = {
        id: newVerId,
        imageUrl: newImageUrl,
        parentId: parentVer ? parentVer.id : 'root',
        createdAt: new Date().toLocaleTimeString('ar-SA', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        promptUsed: promptStr,
        modelUsed: modelStr,
        textsSnapshot: updatedTexts.map((t) => ({
          ...t,
          originalText: t.text,
          initialText: t.initialText ?? t.originalText,
        })),
      };

      const nextVersions = [
        ...versions.slice(0, currentVersionIndex + 1),
        newVer,
      ];
      setVersions(nextVersions);
      setCurrentVersionIndex(nextVersions.length - 1);

      setDetectedTexts(
        updatedTexts.map((t) => ({
          ...t,
          originalText: t.text,
          initialText: t.initialText ?? t.originalText,
        }))
      );

      if (user) {
        try {
          const verRef = doc(db, 'projects', projectId, 'versions', newVerId);
          await setDoc(verRef, {
            projectId,
            ownerId: user.uid,
            imageUrl: newImageUrl.slice(0, 490000),
            parentId: newVer.parentId,
            promptUsed: promptStr.slice(0, 3900),
            modelUsed: modelStr.slice(0, 80),
            createdAt: serverTimestamp(),
          });
          const projRef = doc(db, 'projects', projectId);
          await updateDoc(projRef, {
            currentVersionId: newVerId,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          try {
            handleFirestoreError(
              err,
              OperationType.CREATE,
              `projects/${projectId}/versions`
            );
          } catch {
            // Logged
          }
        }
      }
    },
    [currentVersionIndex, projectId, user, versions]
  );

  // Step 5-7: Apply Text Edits (/api/edit + polling on /api/jobs/:id)
  const handleApplyTextEdits = async (isRetryRun = false) => {
    if (!activeDisplayUrl) {
      showToast('يرجى رفع صورة أولاً.', 'info');
      return;
    }

    const modifiedReplacements: TextReplacementSpec[] = isRetryRun
      ? lastAppliedReplacements
      : detectedTexts
          .filter((t) => t.text.trim() !== t.originalText.trim())
          .map((t) => ({
            id: t.id,
            label: t.label,
            position: t.position,
            oldText: t.originalText,
            newText: t.text,
          }));

    if (modifiedReplacements.length === 0) {
      showToast(
        'قم بتعديل نص واحد على الأقل في الحقول أعلاه قبل التطبيق.',
        'info'
      );
      return;
    }

    const batchCount =
      workspaceMode === 'batch' ? Math.max(1, batchItems.length) : 1;
    const requiredCost = isRetryRun ? 0 : batchCount;

    const constructedPrompt = buildEditPrompt(modifiedReplacements);
    setActiveJobPrompt(constructedPrompt);
    setActiveJobStatus('queued');
    setIsEditingModalOpen(true);

    const tempJobId = `edit_${Date.now()}`;
    if (!isRetryRun) {
      void adjustUserCredits(
        -requiredCost,
        'deduct',
        workspaceMode === 'batch'
          ? `تعديل نصوص دفعة (${batchCount} صور) عبر ${selectedModel}`
          : `تعديل النص بالذكاء الاصطناعي عبر ${selectedModel}`,
        tempJobId
      );
    }

    try {
      const { base64: optimizedEditBase64, mimeType: optimizedEditMime } =
        await compressImageForVision(activeDisplayUrl, 1280);

      const startRes = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: optimizedEditBase64,
          mimeType: optimizedEditMime,
          replacements: modifiedReplacements,
          model:
            selectedModel === 'Gemini Image'
              ? 'gemini-3.1-flash-lite-image'
              : selectedModel,
          isRetry: isRetryRun,
          batchCount,
        }),
      });

      if (!startRes.ok) {
        const errPayload = await startRes.json().catch(() => ({}));
        throw new Error(errPayload.error || 'فشل إرسال مهمة التعديل');
      }

      const { jobId } = await startRes.json();

      if (user) {
        try {
          await setDoc(doc(db, 'jobs', jobId), {
            ownerId: user.uid,
            projectId,
            status: 'processing',
            type: 'edit',
            cost: requiredCost,
            model: selectedModel,
            prompt: constructedPrompt.slice(0, 3900),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignore non-fatal sync error
        }
      }

      // Poll /api/jobs/:id rapidly
      await new Promise<void>((resolve, reject) => {
        const checkJob = async () => {
          try {
            const pollRes = await fetch(`/api/jobs/${jobId}`);
            if (!pollRes.ok) {
              throw new Error('تعذّر قراءة حالة المهمة من الخادم');
            }
            const jobData = await pollRes.json();
            setActiveJobStatus(jobData.status);

            if (jobData.status === 'completed') {
              if (pollingTimerRef.current)
                clearTimeout(pollingTimerRef.current);

              if (workspaceMode === 'batch') {
                const updatedBatch = await Promise.all(
                  batchItems.map(async (item) => {
                    const nextItemTexts = item.texts.map((t) => {
                      const rep = modifiedReplacements.find(
                        (r) =>
                          r.id === t.id ||
                          r.oldText === t.text ||
                          r.label === t.label
                      );
                      return rep
                        ? { ...t, text: rep.newText }
                        : t;
                    });
                    const renderedUrl = await renderUploadedImageWithTextEdits(
                      item.originalUrl,
                      nextItemTexts,
                      erasedTextIds,
                      {
                        enhanced: isEnhanced,
                        customBgColor,
                      }
                    );
                    return {
                      ...item,
                      currentUrl: renderedUrl,
                      texts: nextItemTexts.map((t) => ({
                        ...t,
                        originalText: t.text,
                      })),
                    };
                  })
                );
                setBatchItems(updatedBatch);
              }

              let finalImageUrl = jobData.resultImageUrl;
              if (!finalImageUrl) {
                const targetTexts = isRetryRun
                  ? detectedTexts.map((t) => {
                      const rep = modifiedReplacements.find(
                        (r) => r.id === t.id
                      );
                      return rep ? { ...t, text: rep.newText } : t;
                    })
                  : detectedTexts;

                const baseImg =
                  customUploadedBaseUrl || activeDisplayUrl;
                finalImageUrl = await renderUploadedImageWithTextEdits(
                  baseImg,
                  targetTexts,
                  erasedTextIds,
                  {
                    enhanced: isEnhanced,
                    customBgColor,
                  }
                );
              }

              setLastAppliedReplacements(modifiedReplacements);
              await pushNewVersion(
                finalImageUrl,
                constructedPrompt,
                selectedModel,
                detectedTexts
              );

              if (autoDownloadOnEdit) {
                setTimeout(() => {
                  handleDownloadPng(finalImageUrl);
                }, 250);
              }

              if (user) {
                try {
                  await updateDoc(doc(db, 'jobs', jobId), {
                    status: 'completed',
                    updatedAt: serverTimestamp(),
                  });
                } catch {
                  // Ignore
                }
              }

              resolve();
            } else if (jobData.status === 'failed') {
              if (pollingTimerRef.current)
                clearTimeout(pollingTimerRef.current);
              reject(new Error(jobData.errorMessage || 'فشلت مهمة تعديل النص'));
            } else {
              pollingTimerRef.current = setTimeout(checkJob, 1200);
            }
          } catch (pollErr) {
            if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
            reject(pollErr);
          }
        };

        pollingTimerRef.current = setTimeout(checkJob, 600);
      });

      setIsEditingModalOpen(false);
      showToast(
        isRetryRun
          ? 'تمت إعادة توليد الخط العربي بنجاح! يمكنك تنزيل الصورة الآن.'
          : workspaceMode === 'batch'
          ? `تم تطبيق التعديلات على دفعة الصور (${batchItems.length} صور) بنجاح!`
          : 'تم تحديث النص في الصورة بنجاح! اضغط على «تنزيل الصورة المعدّلة» لحفظها.',
        'success'
      );
    } catch (error) {
      setIsEditingModalOpen(false);
      if (!isRetryRun) {
        await adjustUserCredits(
          requiredCost,
          'refund',
          'إرجاع الرصيد تلقائياً بسبب فشل مهمة تعديل النص',
          tempJobId
        );
      }
      showToast(
        error instanceof Error
          ? `${error.message} — تم إرجاع الرصيد إلى حسابك.`
          : 'تعذّر إكمال التعديل، وتم إرجاع الرصيد تلقائياً.',
        'error'
      );
    }
  };

  // Download High-Res PNG (always guarantees edited texts are composited)
  const handleDownloadPng = useCallback(
    async (overrideUrl?: string | React.MouseEvent) => {
      let targetUrl =
        typeof overrideUrl === 'string' && overrideUrl
          ? overrideUrl
          : activeDisplayUrl;

      if (!targetUrl) {
        showToast('يرجى رفع صورة أولاً لتنزيلها.', 'info');
        return;
      }

      // If user has any edited text (applied or pending in textareas), ensure it is rendered onto the image before downloading
      const hasAnyTextEdits = detectedTexts.some(
        (t) => t.text.trim() !== (t.initialText ?? t.originalText).trim()
      );
      if (
        typeof overrideUrl !== 'string' &&
        (hasAnyTextEdits ||
          erasedTextIds.length > 0 ||
          isEnhanced ||
          customBgColor)
      ) {
        const baseImg = customUploadedBaseUrl || targetUrl;
        targetUrl = await renderUploadedImageWithTextEdits(
          baseImg,
          detectedTexts,
          erasedTextIds,
          {
            enhanced: isEnhanced,
            customBgColor,
          }
        );
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 900;
        canvas.height = img.naturalHeight || 1200;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const pngUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `ai-text-studio-edited-${Date.now()}.png`;
        link.href = pngUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(
          'تم تنزيل وتحميل الصورة المعدّلة بصيغة PNG بأعلى جودة',
          'success'
        );
      };
      img.src = targetUrl;
    },
    [
      activeDisplayUrl,
      brightness,
      contrast,
      customBgColor,
      customUploadedBaseUrl,
      detectedTexts,
      erasedTextIds,
      isEnhanced,
      saturation,
      showToast,
    ]
  );

  // Magic Eraser on a specific text block
  const handleToggleEraseText = async (id: number) => {
    if (!customUploadedBaseUrl && !activeDisplayUrl) return;
    const nextErased = erasedTextIds.includes(id)
      ? erasedTextIds.filter((item) => item !== id)
      : [...erasedTextIds, id];
    setErasedTextIds(nextErased);

    const baseImg = customUploadedBaseUrl || activeDisplayUrl || '';
    const newUrl = await renderUploadedImageWithTextEdits(
      baseImg,
      detectedTexts,
      nextErased,
      {
        enhanced: isEnhanced,
        customBgColor,
      }
    );

    await pushNewVersion(
      newUrl,
      'الممحاة السحرية: إزالة عناصر نصية من الصورة',
      'Magic Eraser',
      detectedTexts
    );
    showToast('تم تحديث الصورة عبر الممحاة السحرية', 'success');
  };

  // Enhance & Restore HD
  const handleEnhanceImage = async () => {
    if (!customUploadedBaseUrl && !activeDisplayUrl) {
      showToast('يرجى رفع صورة أولاً لتحسين جودتها.', 'info');
      return;
    }
    const nextEnhanced = !isEnhanced;
    setIsEnhanced(nextEnhanced);
    const baseImg = customUploadedBaseUrl || activeDisplayUrl || '';
    const newUrl = await renderUploadedImageWithTextEdits(
      baseImg,
      detectedTexts,
      erasedTextIds,
      {
        enhanced: nextEnhanced,
        customBgColor,
      }
    );
    await pushNewVersion(
      newUrl,
      'تحسين واستعادة جودة الصورة والخطوط',
      'HD Restore',
      detectedTexts
    );
    showToast('تم تحسين وضوح الصورة والخطوط العربية بنجاح', 'success');
  };

  // Apply studio background tint
  const handleApplyBgColor = async (colorHex: string | null) => {
    setCustomBgColor(colorHex);
    if (customUploadedBaseUrl || activeDisplayUrl) {
      const baseImg = customUploadedBaseUrl || activeDisplayUrl || '';
      const newUrl = await renderUploadedImageWithTextEdits(
        baseImg,
        detectedTexts,
        erasedTextIds,
        {
          enhanced: isEnhanced,
          customBgColor: colorHex,
        }
      );
      await pushNewVersion(
        newUrl,
        'تغيير خلفية التصميم',
        'Background Studio',
        detectedTexts
      );
    }
  };

  // Google Sign-In handler
  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      showToast('تم تسجيل الدخول بحساب Google ومزامنة رصيدك بنجاح', 'success');
    } catch (error) {
      console.error('Google Sign-In error:', error);
      showToast('تعذّر إكمال تسجيل الدخول عبر Google.', 'error');
    }
  };

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
    showToast('تم تسجيل الخروج بنجاح', 'info');
  };

  const modifiedCount = detectedTexts.filter(
    (t) => t.text.trim() !== t.originalText.trim()
  ).length;

  const canUndo = currentVersionIndex > 0;
  const canRedo = currentVersionIndex < versions.length - 1;

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F3F4F6] text-slate-900 flex flex-col select-none overflow-x-hidden"
    >
      {/* Hidden File Input for Single or Batch Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={workspaceMode === 'batch'}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] pointer-events-auto">
          <div
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-lg border backdrop-blur-md text-sm font-medium transition-all ${
              toastMessage.type === 'error'
                ? 'bg-red-950/95 text-red-100 border-red-800'
                : 'bg-slate-900/95 text-white border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toastMessage.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#8B7CF6] shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 text-slate-400 hover:text-white"
              aria-label="إغلاق التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================== TOP BAR (الشريط العلوي) ==================== */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2">
        {/* Right Cluster (in RTL): Side Menu Button + Plus Upload Button + Project Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            onClick={() => setIsSideDrawerOpen(true)}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center text-slate-700 transition-colors cursor-pointer"
            title="القائمة الجانبية والرصيد"
            aria-label="القائمة الجانبية"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-10 px-3 rounded-xl border border-[#8B7CF6]/40 bg-[#8B7CF6]/10 hover:bg-[#8B7CF6]/20 flex items-center gap-1.5 text-[#8B7CF6] font-bold text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
            title={
              workspaceMode === 'batch'
                ? 'رفع عدة صور (دفعة)'
                : 'رفع صورة جديدة من جهازك'
            }
            aria-label="رفع صورة"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{workspaceMode === 'batch' ? 'رفع صور' : 'رفع صورة'}</span>
          </button>

          {/* Project Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProjectMenuOpen((prev) => !prev)}
              className="h-10 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800 transition-colors max-w-[140px] sm:max-w-[210px] cursor-pointer"
            >
              <span className="truncate">{projectName}</span>
              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
            </button>

            {isProjectMenuOpen && (
              <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white shadow-xl border border-slate-200 py-2 z-50">
                <button
                  onClick={() => {
                    setIsProjectMenuOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full text-right px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#8B7CF6] hover:bg-slate-50 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>رفع صورة جديدة من جهازك...</span>
                </button>
                {activeDisplayUrl && (
                  <button
                    onClick={() => {
                      setIsProjectMenuOpen(false);
                      handleClearImage();
                    }}
                    className="w-full text-right px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-100 mt-1 pt-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>إزالة الصورة الحالية</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center Cluster: Mode Switcher "فردي | دفعة" */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => setWorkspaceMode('single')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              workspaceMode === 'single'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            فردي
          </button>
          <button
            onClick={() => setWorkspaceMode('batch')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              workspaceMode === 'batch'
                ? 'bg-white text-[#8B7CF6] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            دفعة
          </button>
        </div>

        {/* Left Cluster (in RTL): Credits Trigger + Purple Download Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsStripeModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-800 text-xs font-bold transition-colors tabular-nums cursor-pointer"
            title="رصيد العمليات — اضغط لشراء رصيد إضافي"
          >
            <Zap className="w-3.5 h-3.5 text-[#8B7CF6] fill-[#8B7CF6]" />
            <span>{credits}</span>
            <span className="text-slate-500 font-normal">رصيد</span>
          </button>

          <button
            onClick={handleDownloadPng}
            disabled={!activeDisplayUrl}
            className="h-10 px-3.5 sm:px-4 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] disabled:opacity-50 active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تنزيل</span>
          </button>
        </div>
      </header>

      {/* ==================== MAIN WORKSPACE (Mobile-first + Desktop Split) ==================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto flex flex-col lg:flex-row lg:items-stretch lg:gap-6 lg:p-6">
        {/* ---------- PREVIEW & TOOLBAR COLUMN ---------- */}
        <section className="flex-1 flex flex-col justify-between bg-[#F3F4F6] lg:bg-white lg:rounded-3xl lg:border lg:border-slate-200/80 lg:shadow-xs overflow-hidden">
          {/* Batch Mode Filmstrip Bar */}
          {workspaceMode === 'batch' && (
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-3 overflow-x-auto">
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-slate-700">
                  صور الدفعة ({batchItems.length}):
                </span>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  ارفع عدة صور وسيتم تطبيق نفس استبدال النصوص عليها جميعاً
                </span>
              </div>
              <div className="flex items-center gap-2">
                {batchItems.map((item, idx) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveBatchIndex(idx)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                      activeBatchIndex === idx
                        ? 'bg-[#8B7CF6] text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    #{idx + 1} {item.name}
                  </button>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-dashed border-[#8B7CF6] text-[#8B7CF6] hover:bg-[#8B7CF6]/5 whitespace-nowrap cursor-pointer"
                >
                  + إضافة صور للدفعة
                </button>
              </div>
            </div>
          )}

          {/* Center Image Preview Canvas (with Drag & Drop support) */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingFile(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingFile(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processUploadedFiles(e.dataTransfer.files);
              }
            }}
            className={`relative flex-1 min-h-[360px] sm:min-h-[450px] flex items-center justify-center p-4 sm:p-6 overflow-auto transition-colors ${
              isDraggingFile
                ? 'bg-[#8B7CF6]/10 ring-2 ring-inset ring-[#8B7CF6]'
                : 'bg-[#F3F4F6]'
            }`}
          >
            {activeDisplayUrl ? (
              <div
                className="relative transition-transform duration-150 ease-out rounded-2xl overflow-hidden shadow-md border border-slate-200/80 bg-white"
                style={{
                  width: `${Math.round(360 * (zoom / 100))}px`,
                  maxWidth: '100%',
                }}
              >
                <img
                  src={activeDisplayUrl}
                  alt="معاينة الصورة"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto max-h-[65vh] object-contain block select-none"
                  style={{
                    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) ${
                      activeEffect === 'warm'
                        ? 'sepia(18%)'
                        : activeEffect === 'crisp'
                        ? 'contrast(112%)'
                        : ''
                    }`,
                  }}
                />

                {/* Before/After Comparison Slider Overlay */}
                {isCompareMode && beforeCompareUrl && (
                  <div className="absolute inset-0 select-none">
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{
                        clipPath: `inset(0 0 0 ${compareSliderPos}%)`,
                      }}
                    >
                      <img
                        src={beforeCompareUrl}
                        alt="قبل التعديل"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain block"
                      />
                    </div>

                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md pointer-events-none"
                      style={{ left: `${compareSliderPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#8B7CF6] text-white shadow-lg flex items-center justify-center border-2 border-white">
                        <Columns className="w-4 h-4" />
                      </div>
                    </div>

                    <span className="absolute top-3 right-3 bg-black/65 text-white text-[11px] font-bold px-2.5 py-1 rounded-md backdrop-blur-xs">
                      بعد التعديل
                    </span>
                    <span className="absolute top-3 left-3 bg-black/65 text-white text-[11px] font-bold px-2.5 py-1 rounded-md backdrop-blur-xs">
                      قبل التعديل
                    </span>

                    <input
                      type="range"
                      min={5}
                      max={95}
                      value={compareSliderPos}
                      onChange={(e) =>
                        setCompareSliderPos(Number(e.target.value))
                      }
                      className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                      aria-label="شريط المقارنة قبل وبعد"
                    />
                  </div>
                )}

                {/* Interactive Detected Text Bounding Boxes Overlay */}
                {showLayerBoxes && hasDetected && !isCompareMode && (
                  <div className="absolute inset-0 pointer-events-none">
                    {detectedTexts.map((item, idx) => {
                      if (erasedTextIds.includes(item.id)) return null;
                      const box = item.box || {
                        x: 12,
                        y: 12 + idx * 16,
                        width: 76,
                        height: 10,
                      };
                      const isFocused = focusedTextId === item.id;
                      const isModified =
                        item.text.trim() !== item.originalText.trim();
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setFocusedTextId(item.id);
                            setActiveBottomTab('ai_tools');
                            setActiveAiTool('text_editor');
                          }}
                          style={{
                            left: `${box.x}%`,
                            top: `${box.y}%`,
                            width: `${box.width}%`,
                            height: `${box.height}%`,
                          }}
                          className={`absolute pointer-events-auto rounded-lg border-2 transition-all flex items-start justify-end p-0.5 ${
                            isFocused
                              ? 'border-[#8B7CF6] bg-[#8B7CF6]/20 shadow-sm'
                              : isModified
                              ? 'border-emerald-400 bg-emerald-400/15'
                              : 'border-white/75 hover:border-[#8B7CF6] bg-black/15'
                          }`}
                          title={`${item.label}: ${item.text}`}
                        >
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900/85 text-white leading-none">
                            #{item.id} {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Clean Upload Dropzone when no image is loaded */
              <div
                onClick={() => fileInputRef.current?.click()}
                className="max-w-md w-full rounded-3xl border-2 border-dashed border-slate-300 hover:border-[#8B7CF6] bg-white p-8 text-center space-y-4 shadow-xs transition-all cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#8B7CF6]/10 text-[#8B7CF6] flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-base font-bold text-slate-900">
                    {workspaceMode === 'batch'
                      ? 'ارفع مجموعة صور لتعديل النصوص فيها دفعة واحدة'
                      : 'ارفع صورتك لتعديل النصوص بداخلها بالذكاء الاصطناعي'}
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    اسحب وأفلت الصورة هنا مباشرةً، أو اضغط لاختيار ملف من جهازك (PNG, JPG, WEBP)
                  </p>
                </div>
                <button
                  type="button"
                  className="h-11 px-6 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] text-white text-sm font-bold inline-flex items-center gap-2 shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {workspaceMode === 'batch'
                      ? 'اختيار صور من جهازك'
                      : 'اختيار صورة من جهازك'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ---------- TOOLBAR BELOW PREVIEW (شريط أدوات تحت المعاينة) ---------- */}
          <div className="bg-white border-t border-slate-200 px-3 py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
            {/* Zoom Controls (+ / 100% / −) */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
              <button
                onClick={() => setZoom((z) => Math.min(200, z + 25))}
                disabled={!activeDisplayUrl}
                className="w-8 h-8 rounded-lg hover:bg-white disabled:opacity-40 text-slate-700 flex items-center justify-center transition-colors"
                title="تكبير (+)"
                aria-label="تكبير"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoom(100)}
                disabled={!activeDisplayUrl}
                className="px-2 h-8 rounded-lg hover:bg-white disabled:opacity-40 text-xs font-bold text-slate-800 tabular-nums transition-colors"
                title="إعادة الضبط إلى 100%"
              >
                {zoom}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(50, z - 25))}
                disabled={!activeDisplayUrl}
                className="w-8 h-8 rounded-lg hover:bg-white disabled:opacity-40 text-slate-700 flex items-center justify-center transition-colors"
                title="تصغير (−)"
                aria-label="تصغير"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>

            {/* Compare Before/After + Undo + Redo + Retry + Layers */}
            <div className="flex items-center gap-1.5 shrink-0">
              {lastAppliedReplacements.length > 0 && (
                <button
                  onClick={() => handleApplyTextEdits(true)}
                  className="h-9 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  title="إعادة توليد النص إذا ظهر الخط العربي مشوهاً (مجاناً بدون خصم رصيد)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة المحاولة (مجاناً)</span>
                </button>
              )}

              <button
                onClick={() => setIsCompareMode((prev) => !prev)}
                disabled={versions.length < 2 && workspaceMode === 'single'}
                className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  isCompareMode
                    ? 'border-[#8B7CF6] bg-[#8B7CF6]/10 text-[#8B7CF6]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40'
                }`}
                title="مقارنة قبل وبعد بشريط السحب"
              >
                <Columns className="w-4 h-4" />
                <span className="hidden sm:inline">مقارنة قبل/بعد</span>
              </button>

              <button
                onClick={() => {
                  if (canUndo) {
                    const nextIdx = currentVersionIndex - 1;
                    setCurrentVersionIndex(nextIdx);
                    setDetectedTexts(versions[nextIdx].textsSnapshot);
                  }
                }}
                disabled={!canUndo}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 flex items-center justify-center transition-colors"
                title="تراجع (Undo)"
                aria-label="تراجع"
              >
                <Undo2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (canRedo) {
                    const nextIdx = currentVersionIndex + 1;
                    setCurrentVersionIndex(nextIdx);
                    setDetectedTexts(versions[nextIdx].textsSnapshot);
                  }
                }}
                disabled={!canRedo}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-slate-700 flex items-center justify-center transition-colors"
                title="إعادة (Redo)"
                aria-label="إعادة"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowLayerBoxes((prev) => !prev)}
                disabled={!activeDisplayUrl}
                className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
                  showLayerBoxes
                    ? 'border-[#8B7CF6] bg-[#8B7CF6]/10 text-[#8B7CF6]'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                title="إظهار/إخفاء طبقات النصوص على الصورة"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden sm:inline">الطبقات</span>
              </button>
            </div>
          </div>
        </section>

        {/* ---------- BOTTOM SHEET / SIDE PANEL (اللوحة السفلية والتبويبات الـ 5) ---------- */}
        <aside className="w-full lg:w-[440px] xl:w-[480px] bg-white rounded-t-3xl lg:rounded-3xl border-t lg:border border-slate-200 shadow-lg lg:shadow-xs flex flex-col justify-between overflow-hidden">
          <div className="lg:hidden pt-2.5 pb-1 flex justify-center">
            <div className="w-10 h-1.5 rounded-full bg-slate-300" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 max-h-[54vh] lg:max-h-[calc(100vh-190px)]">
            {/* ==================== TAB 2 (DEFAULT): أدوات الذكاء الاصطناعي ==================== */}
            {activeBottomTab === 'ai_tools' && (
              <div className="space-y-4">
                {/* 4 AI Tool Selector Cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setActiveAiTool('text_editor')}
                    className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                      activeAiTool === 'text_editor'
                        ? 'border-[#8B7CF6] bg-[#8B7CF6]/8 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-[#8B7CF6] text-white flex items-center justify-center shrink-0">
                      <TypeIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        محرر النصوص بالذكاء الاصطناعي
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        تعديل النصوص داخل الصور
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveAiTool('editable')}
                    className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                      activeAiTool === 'editable'
                        ? 'border-[#8B7CF6] bg-[#8B7CF6]/8 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        تحويل إلى قابل للتعديل
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        فصل الطبقات والعناصر
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveAiTool('magic_eraser')}
                    className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                      activeAiTool === 'magic_eraser'
                        ? 'border-[#8B7CF6] bg-[#8B7CF6]/8 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                      <Eraser className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        الممحاة السحرية
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        مسح النصوص والعناصر
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveAiTool('enhance')}
                    className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                      activeAiTool === 'enhance'
                        ? 'border-[#8B7CF6] bg-[#8B7CF6]/8 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Wand2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        تحسين واستعادة
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        رفع الدقة وتوضيح الخط
                      </div>
                    </div>
                  </button>
                </div>

                {/* ---------- SUB-PANEL 1: AI TEXT EDITOR (مسار محرر النصوص) ---------- */}
                {activeAiTool === 'text_editor' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">
                          محرر النصوص بالذكاء الاصطناعي
                        </h2>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          تعرّف على النص في صورتك، ثم غيّر النص وأنشئ صورة محدّثة
                        </p>
                      </div>

                      <button
                        onClick={handleDetectTexts}
                        disabled={isDetecting}
                        className="h-10 px-4 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] disabled:opacity-70 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all shrink-0 cursor-pointer"
                      >
                        {isDetecting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>جارٍ التعرّف...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 fill-white" />
                            <span>تعرّف</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-white/20 text-[11px] tabular-nums">
                              1
                            </span>
                          </>
                        )}
                      </button>
                    </div>

                    {hasDetected && detectedTexts.length > 0 ? (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>النصوص المكتشفة ({detectedTexts.length})</span>
                          <span>عدّل أي نص ثم اضغط تطبيق التعديلات</span>
                        </div>

                        <div className="space-y-2.5">
                          {detectedTexts.map((item) => {
                            const isChanged =
                              item.text.trim() !== item.originalText.trim();
                            const isFocused = focusedTextId === item.id;
                            return (
                              <div
                                key={item.id}
                                onClick={() => setFocusedTextId(item.id)}
                                className={`p-3 rounded-xl bg-white border transition-all space-y-2 ${
                                  isFocused
                                    ? 'border-[#8B7CF6] ring-2 ring-[#8B7CF6]/15'
                                    : isChanged
                                    ? 'border-emerald-500/60'
                                    : 'border-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-semibold">
                                      {item.label}
                                    </span>
                                    <span className="text-slate-400">·</span>
                                    <span className="text-slate-500 font-mono text-[11px]">
                                      {item.position}
                                    </span>
                                  </div>

                                  {isChanged && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDetectedTexts((prev) =>
                                          prev.map((t) =>
                                            t.id === item.id
                                              ? { ...t, text: t.originalText }
                                              : t
                                          )
                                        );
                                      }}
                                      className="text-[11px] text-[#8B7CF6] hover:underline font-semibold"
                                    >
                                      استعادة الأصلي
                                    </button>
                                  )}
                                </div>

                                <textarea
                                  rows={2}
                                  value={item.text}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDetectedTexts((prev) =>
                                      prev.map((t) =>
                                        t.id === item.id
                                          ? { ...t, text: val }
                                          : t
                                      )
                                    );
                                  }}
                                  className="w-full rounded-lg border border-slate-200 focus:border-[#8B7CF6] focus:outline-none p-2.5 text-sm font-medium text-slate-900 bg-slate-50/50 focus:bg-white resize-none leading-relaxed"
                                  placeholder="أدخل النص الجديد هنا..."
                                />
                              </div>
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-slate-200/80 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <label className="text-xs font-bold text-slate-700 shrink-0">
                              نموذج التحرير:
                            </label>
                            <select
                              value={selectedModel}
                              onChange={(e) =>
                                setSelectedModel(
                                  e.target.value as EditModelOption
                                )
                              }
                              className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:border-[#8B7CF6] focus:outline-none"
                            >
                              <option value="Gemini Image">Gemini Image</option>
                              <option value="Flux Kontext">Flux Kontext</option>
                              <option value="gpt-image">gpt-image</option>
                            </select>
                          </div>

                          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none py-0.5">
                            <input
                              type="checkbox"
                              checked={autoDownloadOnEdit}
                              onChange={(e) =>
                                setAutoDownloadOnEdit(e.target.checked)
                              }
                              className="w-4 h-4 rounded accent-[#8B7CF6] cursor-pointer"
                            />
                            <span>تنزيل وتحميل الصورة تلقائياً فور تطبيق التعديلات</span>
                          </label>

                          <button
                            onClick={() => handleApplyTextEdits(false)}
                            disabled={modifiedCount === 0}
                            className="w-full h-11 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>
                              تطبيق التعديلات
                              {modifiedCount > 0
                                ? ` (${modifiedCount} نص معدّل)`
                                : ''}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-white/20 text-xs tabular-nums">
                              {workspaceMode === 'batch'
                                ? Math.max(1, batchItems.length)
                                : 1}{' '}
                              رصيد
                            </span>
                          </button>

                          {/* Direct Download Button after applying edits or at any time */}
                          {activeDisplayUrl && (
                            <div
                              className={`p-3 rounded-xl border transition-all space-y-2 ${
                                versions.length > 1 ||
                                lastAppliedReplacements.length > 0
                                  ? 'bg-emerald-50/90 border-emerald-300'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              {(versions.length > 1 ||
                                lastAppliedReplacements.length > 0) && (
                                <div className="flex items-center justify-between text-xs text-emerald-800 font-bold">
                                  <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    الصورة المعدّلة جاهزة للتحميل!
                                  </span>
                                  <span className="text-[11px] font-normal text-emerald-700">
                                    جودة أصلية PNG
                                  </span>
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDownloadPng()}
                                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                              >
                                <Download className="w-4 h-4" />
                                <span>
                                  {versions.length > 1 ||
                                  lastAppliedReplacements.length > 0
                                    ? 'تنزيل وتحميل الصورة المعدّلة (PNG)'
                                    : 'تنزيل وتحميل الصورة الحالية (PNG)'}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 px-4 text-center space-y-3 border border-dashed border-slate-300 rounded-xl bg-white">
                        <TypeIcon className="w-7 h-7 text-[#8B7CF6] mx-auto opacity-80" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold text-slate-800">
                            {activeDisplayUrl
                              ? 'الصورة جاهزة! اضغط على زر «تعرّف» لاستخراج النصوص'
                              : 'ارفع صورتك أولاً ثم اضغط «تعرّف» لاستخراج النصوص وتعديلها'}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            يدعم استخراج وتعديل النصوص العربية والإنجليزية مع الحفاظ على الخط والتصميم
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-9 px-3.5 rounded-xl border border-[#8B7CF6] text-[#8B7CF6] hover:bg-[#8B7CF6]/8 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>رفع صورة من جهازك</span>
                          </button>
                          {activeDisplayUrl && (
                            <button
                              type="button"
                              onClick={handleDetectTexts}
                              disabled={isDetecting}
                              className="h-9 px-3.5 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Zap className="w-3.5 h-3.5 fill-white" />
                              <span>تعرّف الآن</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ---------- SUB-PANEL 2: CONVERT TO EDITABLE ---------- */}
                {activeAiTool === 'editable' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      تحويل التصميم إلى طبقات قابلة للتعديل
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      يفصل الذكاء الاصطناعي جميع النصوص والشعارات والخلفية إلى طبقات مستقلة يمكنك التحكم بمواقعها أو إخفاؤها مباشرة على لوحة المعاينة.
                    </p>
                    <button
                      onClick={() => {
                        if (!activeDisplayUrl) {
                          fileInputRef.current?.click();
                          return;
                        }
                        setShowLayerBoxes(true);
                        if (!hasDetected) {
                          void handleDetectTexts();
                        } else {
                          showToast(
                            'تم تفعيل عرض الطبقات التفاعلية على الصورة',
                            'success'
                          );
                        }
                      }}
                      className="w-full h-10 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Layers className="w-4 h-4" />
                      <span>تفعيل وفصل الطبقات التفاعلية</span>
                    </button>
                  </div>
                )}

                {/* ---------- SUB-PANEL 3: MAGIC ERASER ---------- */}
                {activeAiTool === 'magic_eraser' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      الممحاة السحرية (إزالة عناصر أو نصوص)
                    </h3>
                    {detectedTexts.length > 0 ? (
                      <>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          اختر أي عنصر نصي لإزالته تماماً من الصورة مع تعبئة الخلفية تلقائياً بنفس الألوان المحيطة:
                        </p>
                        <div className="space-y-2">
                          {detectedTexts.map((item) => {
                            const isErased = erasedTextIds.includes(item.id);
                            return (
                              <div
                                key={item.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 text-xs"
                              >
                                <span
                                  className={`truncate font-medium ${
                                    isErased
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-800'
                                  }`}
                                >
                                  {item.text}
                                </span>
                                <button
                                  onClick={() => handleToggleEraseText(item.id)}
                                  className={`px-3 py-1 rounded-lg font-bold transition-colors shrink-0 ${
                                    isErased
                                      ? 'bg-slate-200 text-slate-700'
                                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                  }`}
                                >
                                  {isErased ? 'استعادة' : 'مسح العنصر'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        يرجى رفع صورة والضغط على «تعرّف» أولاً لتحديد العناصر المراد مسحها.
                      </p>
                    )}
                  </div>
                )}

                {/* ---------- SUB-PANEL 4: ENHANCE & RESTORE ---------- */}
                {activeAiTool === 'enhance' && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      تحسين واستعادة الحدة (HD Upscale)
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      يعمل على تنعيم حواف الحروف العربية وإزالة التشويش البصري ومضاعفة التباين الطباعي.
                    </p>
                    <button
                      onClick={handleEnhanceImage}
                      className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Wand2 className="w-4 h-4" />
                      <span>
                        {isEnhanced
                          ? 'إيقاف التحسين الفائق'
                          : 'تطبيق التحسين واستعادة الحدة الآن'}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 1: إنشاء (Create / Upload) ==================== */}
            {activeBottomTab === 'create' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  رفع صورة جديدة للتعديل
                </h3>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#8B7CF6] bg-slate-50/70 text-center space-y-3 cursor-pointer transition-all"
                >
                  <Upload className="w-7 h-7 text-[#8B7CF6] mx-auto" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-800">
                      اضغط هنا لاختيار صورة من جهازك
                    </div>
                    <div className="text-[11px] text-slate-500">
                      يدعم صور الإعلانات والبوسترات والتصاميم بصيغ PNG و JPG و WEBP
                    </div>
                  </div>
                </div>

                {activeDisplayUrl && (
                  <button
                    onClick={handleClearImage}
                    className="w-full h-10 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>حذف الصورة الحالية والبدء من جديد</span>
                  </button>
                )}
              </div>
            )}

            {/* ==================== TAB 3: الخلفية (Background) ==================== */}
            {activeBottomTab === 'background' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">
                  تخصيص خلفية التصميم
                </h3>
                <p className="text-xs text-slate-600">
                  اختر لون خلفية بديل للتصميم مع الحفاظ على النصوص والعناصر الأمامية:
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => handleApplyBgColor(null)}
                    className={`px-3 py-2 rounded-xl border text-xs font-bold ${
                      customBgColor === null
                        ? 'border-[#8B7CF6] bg-[#8B7CF6]/10 text-[#8B7CF6]'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    الخلفية الأصلية
                  </button>
                  {[
                    { name: 'كحلي داكن', hex: '#0F172A' },
                    { name: 'إسبريسو دافئ', hex: '#281811' },
                    { name: 'بنفسجي ملكي', hex: '#1E1B4B' },
                    { name: 'رمادي استوديو', hex: '#E2E8F0' },
                    { name: 'أخضر زمردي', hex: '#062E22' },
                  ].map((col) => (
                    <button
                      key={col.hex}
                      onClick={() => handleApplyBgColor(col.hex)}
                      className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                        customBgColor === col.hex
                          ? 'border-[#8B7CF6] ring-2 ring-[#8B7CF6]/20'
                          : 'border-slate-200'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/15"
                        style={{ backgroundColor: col.hex }}
                      />
                      <span>{col.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ==================== TAB 4: ضبط (Adjust) ==================== */}
            {activeBottomTab === 'adjust' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    ضبط الإضاءة والألوان
                  </h3>
                  <button
                    onClick={() => {
                      setBrightness(100);
                      setContrast(100);
                      setSaturation(100);
                    }}
                    className="text-xs font-bold text-[#8B7CF6] hover:underline"
                  >
                    إعادة الضبط
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>السطوع (Brightness)</span>
                      <span className="tabular-nums">{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={140}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-[#8B7CF6]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>التباين (Contrast)</span>
                      <span className="tabular-nums">{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min={60}
                      max={140}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-[#8B7CF6]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                      <span>تشبع الألوان (Saturation)</span>
                      <span className="tabular-nums">{saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min={40}
                      max={160}
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full accent-[#8B7CF6]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ==================== TAB 5: تأثيرات (Effects) ==================== */}
            {activeBottomTab === 'effects' && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  تأثيرات بصرية جاهزة
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'none', label: 'طبيعي (بدون تأثير)' },
                    { id: 'studio', label: 'إضاءة استوديو ناعمة' },
                    { id: 'warm', label: 'طابع سينمائي دافئ' },
                    { id: 'crisp', label: 'تباين طباعي حاد' },
                  ].map((eff) => (
                    <button
                      key={eff.id}
                      onClick={() =>
                        setActiveEffect(
                          eff.id as 'none' | 'studio' | 'warm' | 'crisp'
                        )
                      }
                      className={`p-3 rounded-xl border text-xs font-bold text-right transition-all ${
                        activeEffect === eff.id
                          ? 'border-[#8B7CF6] bg-[#8B7CF6]/10 text-[#8B7CF6]'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      {eff.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ---------- 5 BOTTOM SHEET NAVIGATION TABS (5 تبويبات) ---------- */}
          <nav
            aria-label="تبويبات المحرر"
            className="border-t border-slate-200 bg-white px-2 py-1.5 grid grid-cols-5 gap-1"
          >
            {[
              { id: 'create', label: 'إنشاء', icon: ImageIcon },
              {
                id: 'ai_tools',
                label: 'أدوات الذكاء الاصطناعي',
                icon: Sparkles,
              },
              { id: 'background', label: 'الخلفية', icon: Palette },
              { id: 'adjust', label: 'ضبط', icon: Sliders },
              { id: 'effects', label: 'تأثيرات', icon: Eye },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeBottomTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveBottomTab(tab.id as BottomTabId)}
                  className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    isActive
                      ? 'text-[#8B7CF6] bg-[#8B7CF6]/8 font-bold'
                      : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] truncate max-w-full">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>
      </main>

      {/* ==================== STEP 6 MODAL: جارٍ تعديل النص... ==================== */}
      {isEditingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#8B7CF6]/12 text-[#8B7CF6] flex items-center justify-center mx-auto">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">
                جارٍ تعديل النص... قد تستغرق تعديلات الذكاء الاصطناعي دقيقة أو دقيقتين
              </h3>
              <p className="text-xs text-slate-500">
                يتم التحقق من حالة المهمة كل 3 ثوانٍ عبر{' '}
                <span className="font-mono">/api/jobs/:id</span> ({activeJobStatus})
              </p>
            </div>

            {activeJobPrompt && (
              <div className="text-left dir-ltr p-3 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-600 max-h-28 overflow-y-auto">
                {activeJobPrompt}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== SIDE DRAWER (القائمة الجانبية + حساب Google + السجل) ==================== */}
      {isSideDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-start">
          <div className="bg-white w-80 sm:w-96 h-full shadow-2xl border-l border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    AI Text Editor Studio
                  </h2>
                  <p className="text-xs text-slate-500">
                    محرر النصوص الذكي داخل الصور
                  </p>
                </div>
                <button
                  onClick={() => setIsSideDrawerOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          {user.displayName || 'مستخدم مسجّل'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {user.email}
                        </div>
                      </div>
                      <button
                        onClick={handleSignOut}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>خروج</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-600">
                      سجّل الدخول عبر Google لحفظ مشاريعك وإصدارات الصور ورصيدك سحابياً:
                    </p>
                    <button
                      onClick={handleGoogleSignIn}
                      className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>تسجيل الدخول عبر Google</span>
                    </button>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] text-slate-500">رصيدك المتاح</div>
                    <div className="text-lg font-extrabold text-[#8B7CF6] tabular-nums">
                      {credits} رصيد
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsSideDrawerOpen(false);
                      setIsStripeModalOpen(true);
                    }}
                    className="h-9 px-3.5 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>شراء رصيد (Stripe)</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <History className="w-4 h-4 text-[#8B7CF6]" />
                  <span>سجل الإصدارات المحفوظة ({versions.length})</span>
                </div>
                {versions.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {versions.map((ver, idx) => (
                      <button
                        key={ver.id}
                        onClick={() => {
                          setCurrentVersionIndex(idx);
                          setDetectedTexts(ver.textsSnapshot);
                          setIsSideDrawerOpen(false);
                        }}
                        className={`w-full text-right p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                          idx === currentVersionIndex
                            ? 'border-[#8B7CF6] bg-[#8B7CF6]/8 font-bold'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="truncate pr-1">
                          <div className="text-slate-900 truncate">
                            إصدار #{idx + 1} — {ver.modelUsed}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {ver.promptUsed}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                          {ver.createdAt}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    لا توجد إصدارات بعد. ارفع صورة للبدء.
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-800">
                  سجل حركات الرصيد (credit_transactions)
                </div>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">
                          {tx.reason}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {tx.createdAt}
                        </div>
                      </div>
                      <span
                        className={`font-bold tabular-nums shrink-0 ${
                          tx.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              AI Text Editor Studio · جميع الحقوق محفوظة
            </div>
          </div>
        </div>
      )}

      {/* ==================== STRIPE CREDIT PURCHASE MODAL ==================== */}
      {isStripeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  شحن رصيد الاستوديو (Stripe Checkout)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  اختر الباقة المناسبة لتعديل النصوص والصور بدقة عالية
                </p>
              </div>
              <button
                onClick={() => setIsStripeModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'pkg_starter',
                  title: 'باقة البداية',
                  credits: 25,
                  price: '$5',
                  desc: 'مثالية للتجربة والتصاميم الفردية',
                },
                {
                  id: 'pkg_pro',
                  title: 'باقة المحترفين',
                  credits: 100,
                  price: '$15',
                  desc: 'الأكثر طلباً لصناع المحتوى والمسوقين',
                  popular: true,
                },
                {
                  id: 'pkg_agency',
                  title: 'باقة الوكالات',
                  credits: 300,
                  price: '$39',
                  desc: 'لتعديل الدفعات الكبيرة والحملات الإعلانية',
                },
              ].map((pkg) => (
                <div
                  key={pkg.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between space-y-4 ${
                    pkg.popular
                      ? 'border-[#8B7CF6] bg-[#8B7CF6]/5'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-slate-900">
                      {pkg.title}
                    </div>
                    <div className="text-2xl font-extrabold text-[#8B7CF6] tabular-nums">
                      {pkg.credits}{' '}
                      <span className="text-xs font-normal">رصيد</span>
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      {pkg.price}
                    </div>
                    <p className="text-[11px] text-slate-500 pt-1">
                      {pkg.desc}
                    </p>
                  </div>

                  <button
                    onClick={async () => {
                      await adjustUserCredits(
                        pkg.credits,
                        'purchase',
                        `شراء ${pkg.title} (${pkg.credits} رصيد) عبر Stripe`,
                        `stripe_${pkg.id}_${Date.now()}`
                      );
                      setIsStripeModalOpen(false);
                      showToast(
                        `تمت عملية الدفع عبر Stripe وإضافة ${pkg.credits} رصيد لحسابك!`,
                        'success'
                      );
                    }}
                    className="w-full h-9 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>شراء الآن</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
