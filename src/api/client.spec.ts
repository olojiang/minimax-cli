import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchWeb, understandImage, setApiToken, textChat, generateImage, synthesizeSpeech, generateVideo, generateMusic } from './client';
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
  });

  describe('textChat', () => {
    it('should call text chat API', async () => {
      const mockResponse = { data: { reply: 'hello' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await textChat('Hello MiniMax');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/text/chatcompletion_v2',
        expect.objectContaining({ messages: [{ role: 'user', content: 'Hello MiniMax' }] }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
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
        expect.objectContaining({ text: 'hi', voice_id: 'zh-CN' }),
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
        expect.objectContaining({ prompt: 'ocean', duration: 6 }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('generateMusic', () => {
    it('should call music API', async () => {
      const mockResponse = { data: { url: 'http://music' } };
      (axios.post as any).mockResolvedValue(mockResponse);

      const result = await generateMusic('jazz', 'lyrics');

      expect(axios.post).toHaveBeenCalledWith(
        '/api/v1/music_generation',
        expect.objectContaining({ prompt: 'jazz', lyrics: 'lyrics' }),
        expect.anything()
      );
      expect(result).toEqual(mockResponse.data);
    });
  });
});
