import axios from 'axios';
import { logger } from '../utils/logger';

const DEFAULT_BASE_URL = '/api';
const API_SOURCE = 'Minimax-Web';

let apiToken = (import.meta.env as any).MINIMAX_TOKEN || localStorage.getItem('minimax_token') || '';

export function setApiToken(token: string) {
  apiToken = token;
  localStorage.setItem('minimax_token', token);
}

export function getApiToken() {
  return apiToken;
}

function getHeaders() {
  if (!apiToken) {
    throw new Error('API Token is not set. Please enter it in the settings.');
  }
  return {
    Authorization: `Bearer ${apiToken}`,
    'MM-API-Source': API_SOURCE,
    'Content-Type': 'application/json',
  };
}

export async function searchWeb(query: string) {
  if (!query || !query.trim()) {
    throw new Error('Query is required');
  }
  
  logger.info(`Starting search for: ${query}`);
  try {
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/coding_plan/search`,
      { q: query.trim() },
      { headers: getHeaders() }
    );
    
    // Axios throws on non-2xx statuses, but we also check MiniMax specific error codes
    const payload = response.data;
    if (payload?.base_resp?.status_code && payload.base_resp.status_code !== 0) {
       throw new Error(payload.base_resp.status_msg || 'API returned an error');
    }
    
    logger.success('Search completed successfully', payload);
    return payload;
  } catch (error: any) {
    logger.error('Search failed', error);
    throw error;
  }
}

/**
 * Parses File object into Data URL
 */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function understandImage(prompt: string, imageInput: string | File) {
  if (!prompt || !prompt.trim()) {
    throw new Error('Prompt is required');
  }
  
  logger.info('Starting image understanding...');
  
  try {
    let imageUrl = '';
    if (typeof imageInput === 'string') {
      imageUrl = imageInput; // either a URL or data URL
    } else if (imageInput instanceof File) {
      logger.info('Converting local file to Data URL...');
      imageUrl = await fileToDataUrl(imageInput);
    }
    
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/coding_plan/vlm`,
      {
        prompt: prompt.trim(),
        image_url: imageUrl,
      },
      { headers: getHeaders() }
    );
    
    const payload = response.data;
    if (payload?.base_resp?.status_code && payload.base_resp.status_code !== 0) {
       throw new Error(payload.base_resp.status_msg || 'API returned an error');
    }
    
    logger.success('Image understanding completed', payload);
    return payload;
  } catch (error: any) {
    logger.error('Image understanding failed', error);
    throw error;
  }
}

// -------------------------------------------------------------
// New mmx capabilities
// -------------------------------------------------------------

export async function textChat(message: string) {
  logger.info(`Starting text chat: ${message}`);
  try {
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/text/chatcompletion_v2`,
      { 
        model: 'abab6.5s-chat', 
        messages: [{ role: 'user', content: message }] 
      },
      { headers: getHeaders() }
    );
    logger.success('Text chat completed', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Text chat failed', error);
    throw error;
  }
}

export async function generateImage(prompt: string) {
  logger.info(`Starting image generation for: ${prompt}`);
  try {
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/image_generation`,
      { model: 'abab-image-v1', prompt },
      { headers: getHeaders() }
    );
    logger.success('Image generation completed', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Image generation failed', error);
    throw error;
  }
}

export async function synthesizeSpeech(text: string, voiceId: string = 'zh-CN-XiaoxiaoNeural') {
  logger.info(`Starting speech synthesis with voice ${voiceId}`);
  try {
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/t2a_v2`,
      { text, voice_id: voiceId, model: 'speech-01' },
      { headers: getHeaders() }
    );
    logger.success('Speech synthesis completed', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Speech synthesis failed', error);
    throw error;
  }
}

export async function generateVideo(prompt: string, duration: number = 6) {
  logger.info(`Starting video generation for: ${prompt} (${duration}s)`);
  try {
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/video_generation`,
      { prompt, duration },
      { headers: getHeaders() }
    );
    logger.success('Video generation requested', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Video generation failed', error);
    throw error;
  }
}

export async function generateMusic(prompt: string, lyrics?: string) {
  logger.info(`Starting music generation for: ${prompt}`);
  try {
    const payload: any = { model: 'music-2.6', prompt };
    if (lyrics) {
      payload.lyrics = lyrics;
    } else {
      payload.lyrics = "";
      payload.lyrics_optimizer = true;
    }
    
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/music_generation`,
      payload,
      { headers: getHeaders() }
    );
    
    const data = response.data;
    if (data?.base_resp?.status_code && data.base_resp.status_code !== 0) {
      throw new Error(data.base_resp.status_msg || 'API returned an error');
    }
    
    logger.success('Music generation requested', data);
    return data;
  } catch (error: any) {
    logger.error('Music generation failed', error);
    throw error;
  }
}

export async function checkQuota() {
  logger.info('Checking API quota...');
  try {
    const response = await axios.get(
      `${DEFAULT_BASE_URL}/v1/token_plan/remains`,
      { headers: getHeaders() }
    );
    logger.success('Quota checked', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to check quota', error);
    throw error;
  }
}
