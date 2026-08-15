import { addDoc, collection, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { AuditLogItem } from '../store';

export const logAdminAction = async (params: {
  actionType: 'create' | 'update' | 'delete' | 'permission_change' | 'status_change' | 'restore';
  targetCollection: string;
  targetId: string;
  targetTitle?: string;
  previousData?: any;
  newData?: any;
  notes?: string;
  adminProfile?: {
    uid?: string;
    name?: string;
    email?: string;
    avatar?: string;
  };
}) => {
  try {
    const user = auth.currentUser;
    const adminUid = params.adminProfile?.uid || user?.uid || 'system';
    const adminName = params.adminProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'مشرف النظام';
    const adminEmail = params.adminProfile?.email || user?.email || '';
    const adminAvatar = params.adminProfile?.avatar || user?.photoURL || '';

    const cleanData = (data: any) => {
      if (!data) return null;
      try {
        return JSON.parse(JSON.stringify(data));
      } catch (e) {
        return null;
      }
    };

    const logEntry: Omit<AuditLogItem, 'id'> = {
      adminUid,
      adminName,
      adminEmail,
      adminAvatar,
      actionType: params.actionType,
      targetCollection: params.targetCollection,
      targetId: params.targetId,
      targetTitle: params.targetTitle || params.targetId,
      timestamp: new Date().toISOString(),
      previousData: cleanData(params.previousData),
      newData: cleanData(params.newData),
      restored: false,
      notes: params.notes || ''
    };

    await addDoc(collection(db, 'audit_logs'), logEntry);
  } catch (error) {
    console.warn('Failed to record audit log:', error);
  }
};

export const restoreFromAuditLog = async (log: AuditLogItem, adminProfile?: any): Promise<{ success: boolean; message: string }> => {
  if (!log.targetCollection || !log.targetId) {
    return { success: false, message: 'بيانات السجل غير مكتملة' };
  }

  try {
    const cleanData = (obj: any) => {
      if (!obj) return {};
      const copy = { ...obj };
      delete copy.id; // avoid redundant id field in document body if needed
      return JSON.parse(JSON.stringify(copy));
    };

    if (log.actionType === 'delete') {
      // Re-create the deleted item
      if (!log.previousData) {
        return { success: false, message: 'لا توجد نسخة سابقة محفوظة لاسترجاعها' };
      }
      await setDoc(doc(db, log.targetCollection, log.targetId), cleanData(log.previousData));
    } else if (log.actionType === 'update' || log.actionType === 'permission_change' || log.actionType === 'status_change') {
      // Revert to previousData
      if (!log.previousData) {
        return { success: false, message: 'لا توجد بيانات سابقة محفوظة للرجوع إليها' };
      }
      await setDoc(doc(db, log.targetCollection, log.targetId), cleanData(log.previousData), { merge: true });
    } else if (log.actionType === 'create') {
      // Revert a created item by deleting it
      await deleteDoc(doc(db, log.targetCollection, log.targetId));
    }

    // Mark current log as restored
    await updateDoc(doc(db, 'audit_logs', log.id), {
      restored: true,
      restoredAt: new Date().toISOString(),
      restoredBy: adminProfile?.name || auth.currentUser?.email || 'مشرف'
    });

    // Log the restore operation itself
    await logAdminAction({
      actionType: 'restore',
      targetCollection: log.targetCollection,
      targetId: log.targetId,
      targetTitle: `استرجاع: ${log.targetTitle || log.targetId}`,
      previousData: log.newData,
      newData: log.previousData,
      notes: `تم استرجاع العملية ${log.id} بواسطة ${adminProfile?.name || 'المشرف'}`,
      adminProfile
    });

    return { success: true, message: 'تم استرجاع البيانات بنجاح إلى حالتها السابقة' };
  } catch (error: any) {
    console.error('Error during restoreFromAuditLog:', error);
    return { success: false, message: error?.message || 'حدث خطأ أثناء الاسترجاع' };
  }
};
