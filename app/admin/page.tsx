import AdminDashboard from '@/components/AdminDashboard';

export const metadata = {
  title: 'لوحة تحكم الإدارة | AI Text Editor Studio',
  description:
    'لوحة تحكم شاملة لإدارة نماذج تعديل الصور، مفاتيح الـ API، الخطوط، الأرصدة، وأدوات الاستوديو.',
};

export default function AdminPage() {
  return <AdminDashboard />;
}
