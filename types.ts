
export interface ProductSide {
  name: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  rating: number;
  reviews: string;
  image: string; 
  category: string;
  prepTime: string; 
  description: string;
  isVegan?: boolean;
  isCombo?: boolean;
  isHighlighted?: boolean; 
  availability?: 'available' | 'low_stock' | 'out_of_stock';
  inventoryId?: string; 
  stock?: number;
  moods?: string[]; 
  affinityTags?: string[];
  sides?: ProductSide[]; // Lista de acompanhamentos configuráveis
}

export type InventoryCategory = 'proteinas' | 'bebidas' | 'suprimentos' | 'outros';

export interface InventoryItem {
  id: string;
  name: string;
  currentQty: number; 
  minQty: number;     
  unit: string;
  category: InventoryCategory;
  costPrice: number;  
}

export interface WasteRecord {
  id: string;
  inventoryId: string;
  itemName: string;
  quantity: number;
  unit: string;
  costValue: number;
  reason: string;
  date: Date;
}

export interface FinancialSnapshot {
  id?: string;
  month: number;
  year: number;
  revenue: number;
  cmv: number;
  fixedCosts: number; 
  netProfit: number;  
  margin: number;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'order' | 'promo' | 'system';
  isRead: boolean; 
  createdAt: string; 
}

export interface PrinterSettings {
  tenant_slug?: string;
  printerWidth: number; 
  autoPrint: boolean;   
  ipAddress?: string;   
  headerText?: string;  
  footerText?: string;  
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface BusinessHours {
  open: string;
  close: string;
  isOpen: boolean;
}

export interface Tenant {
  name: string;
  slug: string;
  logo: string;
  whatsapp: string;
  pixKey: string;      
  paymentLink?: string; 
  deliveryFee: number;  
  deliveryTime?: string; 
  themeColor: string;
  products: Product[];
  categories: Category[];
  address: string;
  instagram: string;
  cardMachineFee: number; 
  isOpen?: boolean;
  operatingHours?: Record<string, BusinessHours>; 
  holidayClosures?: string[]; 
}

export interface CartItem extends Product {
  quantity: number;
  extras: string[]; // Mantido por compatibilidade
  selectedSides?: ProductSide[]; // Novos acompanhamentos dinâmicos
  doneness?: string;
  itemObservation?: string;
  isAdditional?: boolean;
  checked?: boolean;
}

export type OrderStatus = 'pending' | 'preparing' | 'finished' | 'canceled' | 'ready_to_send' | 'out_for_delivery';

export interface Order {
  id: string;
  orderNumber?: number;      
  customerName: string;      
  customerWhatsapp: string;  
  items: CartItem[];         
  total: number;
  type: OrderType;
  status: OrderStatus;
  createdAt: Date;           
  tableNumber?: string;
  address?: string;
  observation?: string;
  couponCode?: string;
  discountApplied?: number;
  userId?: string;           
}

export interface Coupon {
  id: string;
  code: string;
  discountValue: number; 
  maxUses: number;       
  currentUses: number;   
  isActive: boolean;     
  userId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  whatsapp: string;
  email?: string;
  address?: string;
  totalOrders: number; 
  totalSpent: number;  
  lastOrderDate?: string; 
  tenantSlug: string; 
}

export enum OrderType {
  DELIVERY = 'delivery',
  LOCAL = 'local',
  UNSET = 'unset'
}

export enum Page {
  HOME = 'home',
  DETAILS = 'details',
  CART = 'cart',
  ALERTS = 'alerts',
  FAVOURITE = 'favourite',
  PROFILE = 'profile',
  DASHBOARD = 'dashboard'
}

export interface UserInfo {
  name: string;
  whatsapp: string;
  address: string;
  reference?: string;
  tableNumber?: string;
  observation?: string;
}

export interface CustomerMetrics {
  name: string;
  whatsapp: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderDate: Date;
  status: 'novo' | 'regular' | 'vip' | 'sumido';
  daysSince: number;
  userId?: string;
}

export interface DREHistoryItem {
  period: string;
  revenue: number;
  cmv: number;
  fixedCosts: number;
  netProfit: number;
  margin: number;
}
