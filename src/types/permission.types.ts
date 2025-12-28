/**
 * Permission Types
 * Định nghĩa các types cho hệ thống phân quyền
 */

/**
 * User Roles
 * - STUDENT: Sinh viên (người dùng thông thường)
 * - ADMIN: Quản trị viên
 */
export type UserRole = 'STUDENT' | 'ADMIN';

/**
 * Permission Constants
 */
export const ROLES = {
  STUDENT: 'STUDENT' as const,
  ADMIN: 'ADMIN' as const,
} as const;

/**
 * Permission Checks
 */
export const PERMISSIONS = {
  // Student permissions
  STUDENT: {
    // Documents
    UPLOAD_DOCUMENT: ['STUDENT', 'ADMIN'],
    VIEW_OWN_DOCUMENTS: ['STUDENT', 'ADMIN'],
    DELETE_OWN_DOCUMENT: ['STUDENT', 'ADMIN'],
    
    // Print Jobs
    CREATE_PRINT_JOB: ['STUDENT', 'ADMIN'],
    VIEW_OWN_PRINT_JOBS: ['STUDENT', 'ADMIN'],
    CANCEL_OWN_PRINT_JOB: ['STUDENT', 'ADMIN'],
    
    // Balance
    VIEW_OWN_BALANCE: ['STUDENT', 'ADMIN'],
    VIEW_OWN_TRANSACTIONS: ['STUDENT', 'ADMIN'],
    
    // Printers (public)
    VIEW_AVAILABLE_PRINTERS: ['STUDENT', 'ADMIN'],
  },
  
  // Admin permissions
  ADMIN: {
    // Printers Management
    MANAGE_PRINTERS: ['ADMIN'],
    VIEW_ALL_PRINTERS: ['ADMIN'],
    CREATE_PRINTER: ['ADMIN'],
    UPDATE_PRINTER: ['ADMIN'],
    DELETE_PRINTER: ['ADMIN'],
    
    // Users Management
    MANAGE_USERS: ['ADMIN'],
    VIEW_ALL_USERS: ['ADMIN'],
    CREATE_USER: ['ADMIN'],
    UPDATE_USER: ['ADMIN'],
    DELETE_USER: ['ADMIN'],
    
    // Students Management
    MANAGE_STUDENTS: ['ADMIN'],
    VIEW_ALL_STUDENTS: ['ADMIN'],
    UPDATE_STUDENT: ['ADMIN'],
    
    // Dashboard
    VIEW_DASHBOARD: ['ADMIN'],
    VIEW_STATISTICS: ['ADMIN'],
    VIEW_RECENT_ACTIVITIES: ['ADMIN'],
    
    // Print Jobs (all)
    VIEW_ALL_PRINT_JOBS: ['ADMIN'],
    MANAGE_ALL_PRINT_JOBS: ['ADMIN'],
    
    // Documents (all)
    VIEW_ALL_DOCUMENTS: ['ADMIN'],
    DELETE_ANY_DOCUMENT: ['ADMIN'],
  },
} as const;

/**
 * Check if a role has permission
 */
export function hasPermission(role: UserRole, permission: string[]): boolean {
  return permission.includes(role);
}

/**
 * Check if user can access resource
 */
export function canAccess(role: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(role);
}

