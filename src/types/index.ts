export interface GenerateRequest {
  style: 'jogador' | 'pet' | 'familia' | 'rara';
  name?: string;
}

export interface GenerateResponse {
  success: boolean;
  previewUrl?: string;
  imageId?: string;
  creditsUsed?: number;
  creditsLimit?: number;
  error?: string;
}

export interface FreepikTask {
  task_id: string;
  status: 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  generated: string[];
}

export interface UsageCredits {
  id: string;
  user_id: string;
  credits_used: number;
  credits_limit: number;
}

export interface ImageRecord {
  id: string;
  user_id: string;
  original_url: string;
  generated_url: string;
  watermark_url: string;
  style: string;
  prompt: string;
  status: string;
  expires_at: string;
  cart_status: string;
  created_at: string;
}
