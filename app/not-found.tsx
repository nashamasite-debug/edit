import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#F3F4F6] flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-sm border border-slate-200 space-y-4">
        <h1 className="text-2xl font-extrabold text-slate-900">
          الصفحة غير موجودة
        </h1>
        <p className="text-sm text-slate-600">
          عذراً، لم نتمكن من العثور على الصفحة المطلوبة.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-10 px-6 rounded-xl bg-[#8B7CF6] hover:bg-[#7A6AE6] text-white text-sm font-bold transition-colors"
        >
          العودة إلى الاستوديو
        </Link>
      </div>
    </div>
  );
}
