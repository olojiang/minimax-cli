import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { logger } from '../utils/logger';
import { readStorage, removeStorage, writeStorage } from '../utils/safeStorage';

const DEFAULT_BASE_URL = Capacitor.isNativePlatform() ? 'https://api.minimaxi.com' : '/api';
const API_SOURCE = 'Minimax-Web';
const DEFAULT_TEXT_CHAT_MODEL = 'MiniMax-M2.7';
const DEFAULT_SPEECH_MODEL = 'speech-2.8-hd';
const DEFAULT_SPEECH_VOICE = 'female-shaonv';

const envToken = (import.meta.env as Record<string, string | undefined>).MINIMAX_TOKEN || '';
let apiToken = envToken || readStorage('minimax_token') || '';

export function setApiToken(token: string) {
  apiToken = token.trim();
  if (apiToken) {
    writeStorage('minimax_token', apiToken);
  } else {
    removeStorage('minimax_token');
  }
}

export function getApiToken() {
  return apiToken;
}

function getHeaders() {
  return {
    ...getAuthHeaders(),
    'Content-Type': 'application/json',
  };
}

function getAuthHeaders() {
  if (!apiToken) {
    throw new Error('API Token is not set. Please enter it in the settings.');
  }
  return {
    Authorization: `Bearer ${apiToken}`,
    'MM-API-Source': API_SOURCE,
  };
}

function throwIfBaseRespError(payload: any) {
  if (payload?.base_resp?.status_code && payload.base_resp.status_code !== 0) {
    throw new Error(payload.base_resp.status_msg || 'API returned an error');
  }
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
    throwIfBaseRespError(payload);
    
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
    throwIfBaseRespError(payload);
    
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

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export async function textChat(message: string | ChatMessage[]) {
  const messages = typeof message === 'string'
    ? [{ role: 'user' as const, content: message }]
    : message;
  const latestMessage = messages[messages.length - 1]?.content || '';

  logger.info(`Starting text chat: ${latestMessage}`);
  try {
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/text/chatcompletion_v2`,
      { 
        model: DEFAULT_TEXT_CHAT_MODEL, 
        messages
      },
      { headers: getHeaders() }
    );
    throwIfBaseRespError(response.data);
    logger.success('Text chat completed', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Text chat failed', error);
    throw error;
  }
}

export type ImageModel = 'image-01' | 'image-01-live';
export type ImageAspectRatio = '1:1' | '16:9' | '4:3' | '3:2' | '2:3' | '3:4' | '9:16' | '21:9';
export type ImageResponseFormat = 'url' | 'base64';
export type ImageSubjectReferenceType = 'character';

export type ImageGenerationOptions = {
  model?: ImageModel;
  aspectRatio?: ImageAspectRatio;
  width?: number;
  height?: number;
  responseFormat?: ImageResponseFormat;
  seed?: number;
  n?: number;
  promptOptimizer?: boolean;
  watermark?: boolean;
  subjectReference?: string | File;
  subjectReferenceType?: ImageSubjectReferenceType;
};

export async function generateImage(prompt: string, options: ImageGenerationOptions = {}) {
  if (!prompt || !prompt.trim()) {
    throw new Error('Prompt is required');
  }

  logger.info(`Starting image generation for: ${prompt}`);
  try {
    const payload: Record<string, any> = {
      model: options.model || 'image-01',
      prompt: prompt.trim(),
    };

    if (options.aspectRatio) payload.aspect_ratio = options.aspectRatio;
    if (options.width && options.height && !options.aspectRatio) {
      payload.width = options.width;
      payload.height = options.height;
    }
    if (options.responseFormat) payload.response_format = options.responseFormat;
    if (Number.isInteger(options.seed)) payload.seed = options.seed;
    if (options.n) payload.n = options.n;
    if (typeof options.promptOptimizer === 'boolean') payload.prompt_optimizer = options.promptOptimizer;
    if (typeof options.watermark === 'boolean') payload.aigc_watermark = options.watermark;

    if (options.subjectReference) {
      const imageFile = typeof options.subjectReference === 'string'
        ? options.subjectReference
        : await fileToDataUrl(options.subjectReference);
      payload.subject_reference = [
        {
          type: options.subjectReferenceType || 'character',
          image_file: imageFile,
        },
      ];
    }

    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/image_generation`,
      payload,
      { headers: getHeaders() }
    );
    const data = response.data;
    throwIfBaseRespError(data);
    logger.success('Image generation completed', data);
    return data;
  } catch (error: any) {
    logger.error('Image generation failed', error);
    throw error;
  }
}

export type SpeechModel =
  | 'speech-2.8-hd'
  | 'speech-2.8-turbo'
  | 'speech-2.6-hd'
  | 'speech-2.6-turbo'
  | 'speech-02-hd'
  | 'speech-02-turbo'
  | 'speech-01-hd'
  | 'speech-01-turbo'
  | 'speech-01';

export type SpeechFormat = 'mp3' | 'pcm' | 'flac' | 'wav';
export type VoiceType = 'system' | 'voice_cloning' | 'voice_generation' | 'all';

export type SpeechSynthesisOptions = {
  model?: SpeechModel;
  voiceId?: string;
  speed?: number;
  vol?: number;
  pitch?: number;
  sampleRate?: number;
  bitrate?: number;
  format?: SpeechFormat;
  channel?: number;
  languageBoost?: string;
};

export type VoiceInfo = {
  voice_id: string;
  voice_name?: string;
  description?: string[];
  created_time?: string;
};

export type VoiceCloneOptions = {
  fileId: number;
  voiceId: string;
  text?: string;
  model?: SpeechModel;
  promptAudioFileId?: number;
  promptText?: string;
  languageBoost?: string;
  needNoiseReduction?: boolean;
  needVolumeNormalization?: boolean;
  aigcWatermark?: boolean;
};

export async function synthesizeSpeech(
  text: string,
  optionsOrVoiceId: SpeechSynthesisOptions | string = {}
) {
  const options = typeof optionsOrVoiceId === 'string'
    ? { voiceId: optionsOrVoiceId }
    : optionsOrVoiceId;
  const voiceId = options.voiceId || DEFAULT_SPEECH_VOICE;

  logger.info(`Starting speech synthesis with voice ${voiceId}`);
  try {
    const payload: any = {
      model: options.model || DEFAULT_SPEECH_MODEL,
      text,
      voice_setting: {
        voice_id: voiceId,
        speed: options.speed ?? 1,
        vol: options.vol ?? 1,
        pitch: options.pitch ?? 0,
      },
      audio_setting: {
        sample_rate: options.sampleRate ?? 32000,
        bitrate: options.bitrate ?? 128000,
        format: options.format || 'mp3',
        channel: options.channel ?? 1,
      },
    };

    // Keep top-level voice_id for backward compatibility with older MiniMax payloads/proxies.
    payload.voice_id = voiceId;

    if (options.languageBoost) {
      payload.language_boost = options.languageBoost;
    }

    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/t2a_v2`,
      payload,
      { headers: getHeaders() }
    );
    throwIfBaseRespError(response.data);
    logger.success('Speech synthesis completed', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Speech synthesis failed', error);
    throw error;
  }
}

export async function getVoices(voiceType: VoiceType = 'all') {
  logger.info(`Fetching voices: ${voiceType}`);
  try {
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/get_voice`,
      { voice_type: voiceType },
      { headers: getHeaders() }
    );
    throwIfBaseRespError(response.data);
    logger.success('Voices fetched', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Failed to fetch voices', error);
    throw error;
  }
}

export async function uploadVoiceCloneFile(file: File, purpose: 'voice_clone' | 'prompt_audio' = 'voice_clone') {
  logger.info(`Uploading voice file: ${file.name}`);
  try {
    const formData = new FormData();
    formData.append('purpose', purpose);
    formData.append('file', file);

    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/files/upload`,
      formData,
      { headers: getAuthHeaders() }
    );
    throwIfBaseRespError(response.data);
    logger.success('Voice file uploaded', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Voice file upload failed', error);
    throw error;
  }
}

export async function cloneVoice(options: VoiceCloneOptions) {
  logger.info(`Cloning voice: ${options.voiceId}`);
  try {
    const payload: any = {
      file_id: options.fileId,
      voice_id: options.voiceId,
      need_noise_reduction: options.needNoiseReduction ?? false,
      need_volume_normalization: options.needVolumeNormalization ?? false,
      aigc_watermark: options.aigcWatermark ?? false,
    };

    if (options.text?.trim()) {
      payload.text = options.text.trim();
      payload.model = options.model || DEFAULT_SPEECH_MODEL;
    }

    if (options.promptAudioFileId && options.promptText?.trim()) {
      payload.clone_prompt = {
        prompt_audio: options.promptAudioFileId,
        prompt_text: options.promptText.trim(),
      };
    }

    if (options.languageBoost) {
      payload.language_boost = options.languageBoost;
    }

    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/voice_clone`,
      payload,
      { headers: getHeaders() }
    );
    throwIfBaseRespError(response.data);
    logger.success('Voice cloned', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Voice clone failed', error);
    throw error;
  }
}

export type VideoModel = 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-02' | 'T2V-01-Director' | 'T2V-01';
export type VideoResolution = '720P' | '768P' | '1080P';

export type VideoGenerationOptions = {
  model?: VideoModel;
  duration?: number;
  resolution?: VideoResolution | string;
  promptOptimizer?: boolean;
  fastPretreatment?: boolean;
};

export type VideoTaskStatus = 'Preparing' | 'Queueing' | 'Processing' | 'Success' | 'Fail';

export type VideoTaskQueryResponse = {
  task_id: string;
  status: VideoTaskStatus;
  file_id?: string;
  video_width?: number;
  video_height?: number;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
};

export type RetrievedFileResponse = {
  file?: {
    file_id?: string | number;
    bytes?: number;
    created_at?: number;
    filename?: string;
    purpose?: string;
    download_url?: string;
  };
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
};

export type VideoGenerationResult = {
  task: VideoTaskQueryResponse;
  file: NonNullable<RetrievedFileResponse['file']>;
  video_url: string;
};

export type WaitForVideoGenerationOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  onStatus?: (task: VideoTaskQueryResponse) => void;
};

const isHailuoVideoModel = (model: VideoModel) => model === 'MiniMax-Hailuo-2.3' || model === 'MiniMax-Hailuo-02';

const normalizeVideoResolution = (resolution?: VideoResolution | string): VideoResolution | undefined => {
  if (!resolution) return undefined;

  const normalized = resolution.toUpperCase();
  if (normalized === '720P' || normalized === '768P' || normalized === '1080P') {
    return normalized;
  }

  throw new Error(`Unsupported video resolution: ${resolution}`);
};

const validateVideoOptions = (model: VideoModel, duration: number, resolution?: VideoResolution) => {
  if (isHailuoVideoModel(model)) {
    if (duration !== 6 && duration !== 10) {
      throw new Error(`${model} supports 6s or 10s video duration`);
    }
    if (duration === 10 && resolution && resolution !== '768P') {
      throw new Error(`${model} supports only 768P resolution for 10s videos`);
    }
    if (duration === 6 && resolution && resolution !== '768P' && resolution !== '1080P') {
      throw new Error(`${model} supports only 768P or 1080P resolution for 6s videos`);
    }
    return;
  }

  if (duration !== 6) {
    throw new Error(`${model} supports only 6s video duration`);
  }
  if (resolution && resolution !== '720P' && resolution !== '1080P') {
    throw new Error(`${model} supports only 720P or 1080P resolution`);
  }
};

export async function generateVideo(prompt: string, optionsOrDuration: VideoGenerationOptions | number = {}) {
  const options = typeof optionsOrDuration === 'number'
    ? { duration: optionsOrDuration }
    : optionsOrDuration;
  const model = options.model || 'MiniMax-Hailuo-2.3';
  const duration = options.duration ?? 6;
  const resolution = normalizeVideoResolution(options.resolution);
  validateVideoOptions(model, duration, resolution);

  logger.info(`Starting video generation for: ${prompt} (${duration}s)`);
  try {
    const payload: any = {
      model,
      prompt,
      duration,
      prompt_optimizer: options.promptOptimizer ?? true,
    };

    if (isHailuoVideoModel(model)) {
      payload.fast_pretreatment = options.fastPretreatment ?? false;
    }

    if (resolution) {
      payload.resolution = resolution;
    }

    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/video_generation`,
      payload,
      { headers: getHeaders() }
    );
    throwIfBaseRespError(response.data);
    logger.success('Video generation requested', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Video generation failed', error);
    throw error;
  }
}

export async function queryVideoGenerationTask(taskId: string): Promise<VideoTaskQueryResponse> {
  if (!taskId.trim()) {
    throw new Error('Video task ID is required');
  }

  try {
    const response = await axios.get(
      `${DEFAULT_BASE_URL}/v1/query/video_generation`,
      {
        headers: getHeaders(),
        params: { task_id: taskId.trim() },
      }
    );
    throwIfBaseRespError(response.data);
    return response.data;
  } catch (error: any) {
    logger.error('Video task query failed', error);
    throw error;
  }
}

export async function retrieveFile(fileId: string | number): Promise<RetrievedFileResponse> {
  const normalizedFileId = String(fileId).trim();
  if (!normalizedFileId) {
    throw new Error('File ID is required');
  }

  try {
    const response = await axios.get(
      `${DEFAULT_BASE_URL}/v1/files/retrieve`,
      {
        headers: getHeaders(),
        params: { file_id: normalizedFileId },
      }
    );
    throwIfBaseRespError(response.data);
    return response.data;
  } catch (error: any) {
    logger.error('File retrieval failed', error);
    throw error;
  }
}

export async function waitForVideoGenerationResult(
  taskId: string,
  options: WaitForVideoGenerationOptions = {},
): Promise<VideoGenerationResult> {
  const intervalMs = options.intervalMs ?? 5_000;
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt <= timeoutMs) {
    const task = await queryVideoGenerationTask(taskId);
    options.onStatus?.(task);

    if (task.status === 'Fail') {
      throw new Error(task.base_resp?.status_msg || 'Video generation failed');
    }

    if (task.status === 'Success') {
      if (!task.file_id) {
        throw new Error('Video generation succeeded but did not return a file ID');
      }
      const fileResponse = await retrieveFile(task.file_id);
      const file = fileResponse.file;
      const videoUrl = normalizeDownloadUrl(file?.download_url || '');
      if (!file || !videoUrl) {
        throw new Error('Video file retrieval did not return a download URL');
      }
      return {
        task,
        file: {
          ...file,
          download_url: videoUrl,
        },
        video_url: videoUrl,
      };
    }

    await sleep(intervalMs);
  }

  throw new Error('Timed out waiting for video generation to finish');
}

function normalizeDownloadUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type MusicFormat = 'mp3' | 'wav';

export type MusicGenerationOptions = {
  lyrics?: string;
  lyricsOptimizer?: boolean;
  instrumental?: boolean;
  format?: MusicFormat;
  sampleRate?: number;
  bitrate?: number;
};

export async function generateMusic(prompt: string, lyricsOrOptions?: string | MusicGenerationOptions) {
  const options = typeof lyricsOrOptions === 'string'
    ? { lyrics: lyricsOrOptions }
    : (lyricsOrOptions || {});

  logger.info(`Starting music generation for: ${prompt}`);
  try {
    const payload: any = { model: 'music-2.6', prompt };
    const lyrics = options.lyrics?.trim() || '';
    const instrumental = options.instrumental ?? false;

    payload.is_instrumental = instrumental;
    payload.lyrics_optimizer = options.lyricsOptimizer ?? (!lyrics && !instrumental);

    if (lyrics && !instrumental) {
      payload.lyrics = lyrics;
    } else if (!instrumental) {
      payload.lyrics = '';
    }

    if (options.format) {
      payload.format = options.format;
    }

    if (options.sampleRate) {
      payload.sample_rate = options.sampleRate;
    }

    if (options.bitrate) {
      payload.bitrate = options.bitrate;
    }
    
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/v1/music_generation`,
      payload,
      { headers: getHeaders() }
    );
    
    const data = response.data;
    throwIfBaseRespError(data);
    
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
