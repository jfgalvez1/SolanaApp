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
          description: string
          amount: number
          category: string
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          description: string
          amount: number
          category?: string
          date?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          description?: string
          amount?: number
          category?: string
          date?: string
          created_at?: string
        }
      }
      reservations: {
        Row: {
          id: string
          user_id: string
          guest_name: string
          check_in: string
          check_out: string
          total_price: number
          status: 'confirmed' | 'reserved' | 'cancelled' | 'completed'
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          guest_name: string
          check_in: string
          check_out: string
          total_price: number
          status?: 'confirmed' | 'reserved' | 'cancelled' | 'completed'
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          guest_name?: string
          check_in?: string
          check_out?: string
          total_price?: number
          status?: 'confirmed' | 'reserved' | 'cancelled' | 'completed'
          notes?: string | null
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
