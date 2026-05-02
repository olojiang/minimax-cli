import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cloneVoice,
  generateImage,
  generateMusic,
  generateVideo,
  getVoices,
  searchWeb,
  setApiToken,
  synthesizeSpeech,
  textChat,
  understandImage,
  uploadVoiceCloneFile
} from './client';
import { logger } from '../utils/logger';
import axios from 'axios';

vi.mock('axios');
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }
}));

describe('API Client', () => {
  beforeEach(() => {
    setApiToken('test-token');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('searchWeb', () => {
    it('should call the API and log success', async () => {
      const mockResponse = { data: { results: ['test'] } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await searchWeb('test query');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/coding_plan/search',
        { q: 'test query' },
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
        })
      );
      expect(logger.info).toHaveBeenCalledWith('Starting search for: test query');
      expect(logger.success).toHaveBeenCalledWith('Search completed successfully', mockResponse.data);
      expect(result).toEqual(mockResponse.data);
    });

    it('should handle errors and log them', async () => {
      const mockError = new Error('Network Error');
      (axios.post as any).mockRejectedValue(mockError);

      await expect(searchWeb('error query')).rejects.toThrow('Network Error');
      expect(logger.error).toHaveBeenCalledWith('Search failed', mockError);
    });
  });

  describe('understandImage', () => {
    it('should process base64 data URL and log correctly', async () => {
      const mockResponse = { data: { text: 'image desc' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const base64Url = 'data:image/png;base64,iVBOR...';
      const result = await understandImage('describe this', base64Url);

      expect(logger.info).toHaveBeenCalledWith('Starting image understanding...');
      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/coding_plan/vlm',
        { prompt: 'describe this', image_url: base64Url },
        expect.anything()
      );
      expect(logger.success).toHaveBeenCalledWith('Image understanding completed', mockResponse.data);
      expect(result).toEqual(mockResponse.data);
    });

    it('should map image generation options to API payload', async () => {
      const mockResponse = { data: { data: { image_urls: ['http://img'] } } };
      (axios.post as any).mockResolvedValue(mockResponse);

      await generateImage('cat', {
        model: 'image-01',
        aspectRatio: '16:9',
        responseFormat: 'base64',
        seed: 123,
        n: 2,
        promptOptimizer: true,
        watermark: true,
        subjectReference: 'https://example.com/ref.png',
      });

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/image_generation',
        {
          model: 'image-01',
          prompt: 'cat',
          aspect_ratio: '16:9',
          response_format: 'base64',
          seed: 123,
          n: 2,
          prompt_optimizer: true,
          aigc_watermark: true,
          subject_reference: [
            {
              type: 'character',
              image_file: 'https://example.com/ref.png',
            },
          ],
        },
        expect.anything()
      );
    });

    it('should send custom image dimensions when aspect ratio is not set', async () => {
      const mockResponse = { data: { url: 'http://img' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      await generateImage('cat', {
        width: 1024,
        height: 1536,
      });

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/image_generation',
        expect.objectContaining({
          width: 1024,
          height: 1536,
        }),
        expect.anything()
      );
    });

    it('should reject MiniMax base response errors', async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          base_resp: {
            status_code: 1004,
            status_msg: 'bad image request'
          }
        }
      });

      await expect(generateImage('cat')).rejects.toThrow('bad image request');
    });
  });

  describe('textChat', () => {
    it('should call text chat API', async () => {
      const mockResponse = { data: { reply: 'hello' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await textChat('Hello MiniMax');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/text/chatcompletion_v2',
        expect.objectContaining({
          model: 'MiniMax-M2.7',
          messages: [{ role: 'user', content: 'Hello MiniMax' }]
        }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should send chat history when provided', async () => {
      const mockResponse = { data: { reply: 'with context' } };
      const messages = [
        { role: 'user' as const, content: 'First' },
        { role: 'assistant' as const, content: 'Reply' },
        { role: 'user' as const, content: 'Follow up' },
      ];
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await textChat(messages);

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/text/chatcompletion_v2',
        expect.objectContaining({
          model: 'MiniMax-M2.7',
          messages
        }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should reject MiniMax base response errors', async () => {
      (axios.post as any).mockResolvedValue({
        data: {
          base_resp: {
            status_code: 2061,
            status_msg: 'your current token plan not support model'
          }
        }
      });

      await expect(textChat('Hello')).rejects.toThrow('your current token plan not support model');
    });
  });

  describe('generateImage', () => {
    it('should call image generation API', async () => {
      const mockResponse = { data: { url: 'http://img' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await generateImage('cat');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/image_generation',
        expect.objectContaining({ prompt: 'cat' }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('synthesizeSpeech', () => {
    it('should call speech API', async () => {
      const mockResponse = { data: { audio: 'base64' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await synthesizeSpeech('hi', 'zh-CN');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/t2a_v2',
        expect.objectContaining({
          model: 'speech-2.8-hd',
          text: 'hi',
          voice_id: 'zh-CN',
          voice_setting: expect.objectContaining({ voice_id: 'zh-CN' }),
          audio_setting: expect.objectContaining({ format: 'mp3' })
        }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should call speech API with synthesis options', async () => {
      const mockResponse = { data: { audio: 'base64' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      await synthesizeSpeech('hi', {
        model: 'speech-2.8-turbo',
        voiceId: 'voice-a',
        speed: 1.2,
        vol: 2,
        pitch: -1,
        format: 'wav',
        sampleRate: 44100,
        bitrate: 256000,
        channel: 2,
        languageBoost: 'Chinese'
      });

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/t2a_v2',
        expect.objectContaining({
          model: 'speech-2.8-turbo',
          text: 'hi',
          voice_setting: {
            voice_id: 'voice-a',
            speed: 1.2,
            vol: 2,
            pitch: -1
          },
          audio_setting: {
            sample_rate: 44100,
            bitrate: 256000,
            format: 'wav',
            channel: 2
          },
          language_boost: 'Chinese'
        }),
        expect.anything()
      );
    });

    it('should fetch available voices', async () => {
      const mockResponse = { data: { system_voice: [] } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await getVoices('all');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/get_voice',
        { voice_type: 'all' },
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should upload a voice clone file', async () => {
      const file = new File(['audio'], 'voice.mp3', { type: 'audio/mpeg' });
      const mockResponse = { data: { file: { file_id: 123 } } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await uploadVoiceCloneFile(file);
      const body = (axios.post as any).mock.calls[0][1] as FormData;

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/files/upload',
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' })
        })
      );
      expect(body.get('purpose')).toBe('voice_clone');
      expect(body.get('file')).toBe(file);
      expect(result).toEqual(mockResponse.data);
    });

    it('should clone a voice', async () => {
      const mockResponse = { data: { input_sensitive: false } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await cloneVoice({
        fileId: 123,
        voiceId: 'custom-voice',
        text: 'preview',
        model: 'speech-2.8-hd',
        needNoiseReduction: true,
        needVolumeNormalization: true
      });

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/voice_clone',
        expect.objectContaining({
          file_id: 123,
          voice_id: 'custom-voice',
          text: 'preview',
          model: 'speech-2.8-hd',
          need_noise_reduction: true,
          need_volume_normalization: true
        }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('generateVideo', () => {
    it('should call video API', async () => {
      const mockResponse = { data: { task_id: '123' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await generateVideo('ocean', 6);

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/video_generation',
        expect.objectContaining({
          model: 'MiniMax-Hailuo-2.3',
          prompt: 'ocean',
          duration: 6,
          prompt_optimizer: true,
          fast_pretreatment: false,
          watermark: false
        }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should call video API with generation options', async () => {
      const mockResponse = { data: { task_id: '123' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      await generateVideo('ocean', {
        model: 'MiniMax-Hailuo-2.3',
        duration: 10,
        resolution: '768P',
        promptOptimizer: false,
        fastPretreatment: true,
        watermark: true
      });

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/video_generation',
        expect.objectContaining({
          model: 'MiniMax-Hailuo-2.3',
          duration: 10,
          resolution: '768P',
          prompt_optimizer: false,
          fast_pretreatment: true,
          watermark: true
        }),
        expect.anything()
      );
    });

    it('should normalize legacy lowercase resolution values', async () => {
      const mockResponse = { data: { task_id: '123' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      await generateVideo('ocean', {
        model: 'MiniMax-Hailuo-2.3',
        duration: 6,
        resolution: '1080p'
      });

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/video_generation',
        expect.objectContaining({
          resolution: '1080P'
        }),
        expect.anything()
      );
    });

    it('should reject unsupported video option combinations before calling API', async () => {
      await expect(generateVideo('ocean', {
        model: 'MiniMax-Hailuo-2.3',
        duration: 10,
        resolution: '1080P'
      })).rejects.toThrow('supports only 768P');

      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('generateMusic', () => {
    it('should call music API', async () => {
      const mockResponse = { data: { url: 'http://music' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await generateMusic('jazz', 'lyrics');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/music_generation',
        expect.objectContaining({
          prompt: 'jazz',
          lyrics: 'lyrics',
          is_instrumental: false,
          lyrics_optimizer: false
        }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should call music API with generation options', async () => {
      const mockResponse = { data: { url: 'http://music' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      await generateMusic('ambient', {
        instrumental: true,
        lyricsOptimizer: false,
        format: 'wav',
        sampleRate: 48000,
        bitrate: 256000
      });

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/music_generation',
        expect.objectContaining({
          prompt: 'ambient',
          is_instrumental: true,
          lyrics_optimizer: false,
          format: 'wav',
          sample_rate: 48000,
          bitrate: 256000
        }),
        expect.anything()
      );
    });
  });
});
