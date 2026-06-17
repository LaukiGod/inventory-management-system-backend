export type UserRole = 'ADMIN' | 'STAFF'
export type LogType = 'RECEIVED' | 'CONSUMED'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  created_at: string
}

export interface StockItem {
  id: string
  name: string
  category_id: string | null
  image_url: string | null
  current_qty: number
  low_stock_threshold: number
  created_by: string
  created_at: string
  is_active: boolean
}

export interface StockLog {
  id: string
  stock_item_id: string
  type: LogType
  quantity: number
  note: string | null
  performed_by: string
  created_at: string
}

// Extended shapes for API responses (with joins)
export interface StockItemWithCategory extends StockItem {
  category: Pick<Category, 'id' | 'name'> | null
}

export interface StockLogWithDetails extends StockLog {
  stock_item: Pick<StockItem, 'id' | 'name'> | null
  user: Pick<User, 'id' | 'name'> | null
}

// Attached to every authenticated request
export interface AuthUser {
  id: string
  email: string
  role: UserRole
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}
