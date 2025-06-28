import { supabase } from '../supabase/config';

class SupabaseAuthService {
  constructor() {
    this.currentSession = null;
    this.currentUser = null;
    this.initializeSession();
  }

  async initializeSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        return;
      }
      
      this.currentSession = session;
      this.currentUser = session?.user || null;
    } catch (error) {
      console.error('Error initializing session:', error);
    }
  }

  async sendVerificationCode(phoneNumber) {
    try {
      console.log('📱 Sending SMS verification code to:', phoneNumber);

      const { data, error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber,
      });

      if (error) {
        console.error('Error sending SMS:', error);
        return {
          success: false,
          error: error.message || 'Failed to send SMS'
        };
      }

      return {
        success: true,
        message: `SMS sent to ${phoneNumber}`,
        data
      };
    } catch (error) {
      console.error('Error in sendVerificationCode:', error);
      return {
        success: false,
        error: error.message || 'Failed to send SMS'
      };
    }
  }

  // Verify SMS code using Supabase
  async verifyCode(phoneNumber, token) {
    try {
      console.log('📱 Verifying SMS code for:', phoneNumber);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: phoneNumber,
        token,
        type: 'sms'
      });

      if (error) {
        console.error('Error verifying SMS code:', error);
        return {
          success: false,
          error: error.message || 'Invalid verification code'
        };
      }

      // Update local session and user
      this.currentSession = data.session;
      this.currentUser = data.user;

      return {
        success: true,
        session: data.session,
        user: {
          uid: data.user.id,
          phoneNumber: data.user.phone,
          displayName: data.user.user_metadata?.display_name || '',
          isNewUser: !data.user.last_sign_in_at || 
                    new Date(data.user.created_at) >= new Date(Date.now() - 60000) // Within last minute
        }
      };
    } catch (error) {
      console.error('Error in verifyCode:', error);
      return {
        success: false,
        error: error.message || 'Verification failed'
      };
    }
  }

  async isAuthenticated() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error checking auth status:', error);
        return false;
      }
      
      this.currentSession = session;
      this.currentUser = session?.user || null;
      
      return !!session && !!session.user;
    } catch (error) {
      console.error('Error in isAuthenticated:', error);
      return false;
    }
  }

  async getCurrentUser() {
    try {
      if (this.currentUser) {
        return {
          uid: this.currentUser.id,
          phoneNumber: this.currentUser.phone,
          displayName: this.currentUser.user_metadata?.display_name || '',
          email: this.currentUser.email || null,
          session: this.currentSession
        };
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error getting user:', error);
        return null;
      }

      this.currentUser = user;
      
      return user ? {
        uid: user.id,
        phoneNumber: user.phone,
        displayName: user.user_metadata?.display_name || '',
        email: user.email || null,
        session: this.currentSession
      } : null;
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      return null;
    }
  }

  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error signing out:', error);
        return { success: false, error: error.message };
      }

      // Clear local state
      this.currentSession = null;
      this.currentUser = null;
      
      return { success: true };
    } catch (error) {
      console.error('Error in signOut:', error);
      return { success: false, error: error.message };
    }
  }

  async getSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      
      this.currentSession = session;
      return session;
    } catch (error) {
      console.error('Error in getSession:', error);
      return null;
    }
  }

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      this.currentSession = session;
      this.currentUser = session?.user || null;
      callback(event, session);
    });
  }

  async updateUser(updates) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      });

      if (error) {
        console.error('Error updating user:', error);
        return { success: false, error: error.message };
      }

      this.currentUser = data.user;
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Error in updateUser:', error);
      return { success: false, error: error.message };
    }
  }
}

export const supabaseAuthService = new SupabaseAuthService();
export default supabaseAuthService; 