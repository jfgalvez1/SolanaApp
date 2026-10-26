export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      expenses: {
        Row: {
          id: string
          user_id: string
          property_id: string
          description: string
          amount: number
          category: string
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          description: string
          amount: number
          category?: string
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          description?: string
          amount?: number
          category?: string
          date?: string
          created_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          user_id: string
          product_name: string
          cost: number
          price: number
          stock: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          product_name: string
          cost: number
          price: number
          stock?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_name?: string
          cost?: number
          price?: number
          stock?: number
          created_at?: string
        }
        Relationships: []
      }
      sales_log: {
        Row: {
          id: string
          user_id: string
          inventory_id: string
          quantity_sold: number
          profit: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          inventory_id: string
          quantity_sold: number
          profit: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          inventory_id?: string
          quantity_sold?: number
          profit?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sales_log_inventory_id_fkey'
            columns: ['inventory_id']
            isOneToOne: false
            referencedRelation: 'inventory'
            referencedColumns: ['id']
          }
        ]
      }
      reservations: {
        Row: {
          id: string
          user_id: string
          property_id: string
          guest_name: string
          check_in: string
          check_out: string
          pax: number
          total_price: number
          status: 'confirmed' | 'reserved' | 'cancelled' | 'completed'
          notes: string | null
          contact_number: string | null
          check_in_preference: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          guest_name: string
          check_in: string
          check_out: string
          pax?: number
          total_price: number
          status?: 'confirmed' | 'reserved' | 'cancelled' | 'completed'
          notes?: string | null
          contact_number?: string | null
          check_in_preference?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          guest_name?: string
          check_in?: string
          check_out?: string
          pax?: number
          total_price?: number
          status?: 'confirmed' | 'reserved' | 'cancelled' | 'completed'
          notes?: string | null
          contact_number?: string | null
          check_in_preference?: string | null
          created_at?: string
        }
        Relationships: []
      }
      booking_requests: {
        Row: {
          id: string
          user_id: string
          property_id: string
          guest_name: string
          check_in: string
          check_out: string
          pax: number
          suggested_price: number
          status: 'pending' | 'approved' | 'rejected'
          overlap_warning: string | null
          notes: string | null
          contact_number: string | null
          check_in_preference: string | null
          reservation_id: string | null
          created_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          property_id: string
          guest_name: string
          check_in: string
          check_out: string
          pax?: number
          suggested_price?: number
          status?: 'pending' | 'approved' | 'rejected'
          overlap_warning?: string | null
          notes?: string | null
          contact_number?: string | null
          check_in_preference?: string | null
          reservation_id?: string | null
          created_at?: string
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          property_id?: string
          guest_name?: string
          check_in?: string
          check_out?: string
          pax?: number
          suggested_price?: number
          status?: 'pending' | 'approved' | 'rejected'
          overlap_warning?: string | null
          notes?: string | null
          contact_number?: string | null
          check_in_preference?: string | null
          reservation_id?: string | null
          created_at?: string
          reviewed_at?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          id: string
          user_id: string
          name: string
          slug: string
          base_price: number
          included_pax: number
          extra_pax_price: number
          max_pax: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          slug: string
          base_price?: number
          included_pax?: number
          extra_pax_price?: number
          max_pax?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          slug?: string
          base_price?: number
          included_pax?: number
          extra_pax_price?: number
          max_pax?: number
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          safety_code: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          safety_code?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          safety_code?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_availability: {
        Args: Record<string, never>
        Returns: {
          property_id: string
          property_name: string
          property_slug: string
          reservation_id: string | null
          check_in: string | null
          check_out: string | null
          status: string | null
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
